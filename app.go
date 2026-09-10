package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"nexterm/internal/hostkey"
	"nexterm/internal/macro"
	"nexterm/internal/model"
	"nexterm/internal/nettools"
	"nexterm/internal/security"
	"nexterm/internal/service"
	sftpmanager "nexterm/internal/sftp"
	"nexterm/internal/sshsession"
	"nexterm/internal/store"
	"nexterm/internal/tunnel"
	"nexterm/internal/vault"

	"github.com/google/uuid"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// wailsEventEmitter adapts Wails runtime.EventsEmit to service.EventEmitter.
type wailsEventEmitter struct {
	app *App
}

func (w *wailsEventEmitter) Emit(event string, optionalData ...interface{}) {
	if w.app == nil || w.app.ctx == nil || w.app.ctx.Value("events") == nil {
		return
	}
	wailsruntime.EventsEmit(w.app.ctx, event, optionalData...)
}

func (a *App) logRuntimeError(format string, args ...interface{}) {
	if a.ctx == nil || a.ctx.Value("logger") == nil {
		log.Printf(format, args...)
		return
	}
	wailsruntime.LogErrorf(a.ctx, format, args...)
}

// App is the central facade bound to the frontend by Wails.
// It delegates operations to dedicated domain services:
//   - SessionService (sessions tree, folders, CRUD, import/export)
//   - CredentialService (DPAPI vault, master passwords, keys, SSH agent)
//   - ConnectionManager (ProtocolSession router: SSH, Telnet, Serial, RDP, VNC)
//   - TerminalService (local ConPTY terminal sessions)
//   - SFTPService (remote/local file operations, file watching, transfers)
//   - SettingsService (workspace layout, security policies, customizer)
//   - HostKeyService (known hosts, host key verification prompts)
//   - LoggingService (structured audit logs, diagnostic buffer)
type App struct {
	ctx context.Context

	sessionService    *service.SessionService
	credentialService *service.CredentialService
	connectionManager *service.ConnectionManager
	terminalService   *service.TerminalService
	sftpService       *service.SFTPService
	settingsService   *service.SettingsService
	hostKeyService    *service.HostKeyService
	loggingService    *service.LoggingService

	tunnelMgr *tunnel.TunnelManager
	macroMgr  *macro.MacroManager
}

// NewApp instantiates the App facade and initializes all domain services.
func NewApp() *App {
	a := &App{
		tunnelMgr: tunnel.NewTunnelManager(),
		macroMgr:  macro.NewMacroManager(),
	}

	emitter := &wailsEventEmitter{app: a}
	a.loggingService = service.NewLoggingService(emitter)
	a.hostKeyService = service.NewHostKeyService(emitter)
	a.credentialService = service.NewCredentialService(nil)
	a.connectionManager = service.NewConnectionManager(a.credentialService, a.hostKeyService, a.loggingService, emitter)
	a.terminalService = service.NewTerminalService(a.loggingService, emitter)
	a.sftpService = service.NewSFTPService(a.connectionManager, emitter)
	a.settingsService = service.NewSettingsService(nil)
	a.sessionService = service.NewSessionService(nil)

	// Clean up workspace tabs and watchers on disconnect
	a.connectionManager.SetOnSessionClosed(func(tabID string) {
		_, _ = a.settingsService.RemoveTab(tabID)
		a.sftpService.CloseWatchersForTab(tabID)
	})

	a.terminalService.SetOnTerminalClosed(func(tabID string, title string) {
		_, _ = a.settingsService.RemoveTab(tabID)
	})

	return a
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.loggingService.LogInfo("App", "Nexterm application started")

	// 1. Session Store
	if a.sessionService == nil || !a.sessionService.HasStore() {
		s, err := store.NewSessionStore()
		if err != nil {
			a.logRuntimeError("session store init failed: %v", err)
		} else {
			a.sessionService = service.NewSessionService(s)
		}
	}

	// 2. Vault
	v, err := vault.NewVault()
	if err != nil {
		a.logRuntimeError("vault init failed: %v", err)
	} else {
		a.credentialService.SetVault(v)
		a.credentialService.SetTreeProvider(func() *model.TreeNode {
			return a.sessionService.GetSessionTree()
		})
	}

	// Wire vault hooks into session service
	a.sessionService.SetVaultHooks(
		func(key string) { _ = a.credentialService.DeleteSavedPassword(key) },
		func(key, val string) error { return a.credentialService.SaveSessionPassword(key, val) },
		func(key string) (string, bool, error) {
			p, err := a.credentialService.GetSessionPassword(key)
			return p, p != "", err
		},
	)

	// Load session tree
	if _, err := a.sessionService.LoadRoot(); err != nil {
		a.logRuntimeError("load session tree failed: %v", err)
	}
}

// =========================================================================
// Session Service Delegations
// =========================================================================

func (a *App) GetSessionTree() *model.TreeNode {
	return a.sessionService.GetSessionTree()
}

func (a *App) AddFolder(parentID, name string) (*model.TreeNode, error) {
	return a.sessionService.AddFolder(parentID, name)
}

func (a *App) AddFolderWithOptions(parentID, name, defaultUsername, environment, color string, defaultPort int) (*model.TreeNode, error) {
	return a.sessionService.AddFolderWithOptions(parentID, name, defaultUsername, environment, color, defaultPort)
}

func (a *App) ConfigureFolder(id, name, defaultUsername, environment, color string, defaultPort int) (*model.TreeNode, error) {
	return a.sessionService.ConfigureFolder(id, name, defaultUsername, environment, color, defaultPort)
}

func (a *App) RenameNode(id, newName string) (*model.TreeNode, error) {
	return a.sessionService.RenameNode(id, newName)
}

func (a *App) UpdateFolder(id, name string) (*model.TreeNode, error) {
	return a.sessionService.UpdateFolder(id, name)
}

func (a *App) ToggleFolder(id string, expanded bool) (*model.TreeNode, error) {
	return a.sessionService.ToggleFolder(id, expanded)
}

func (a *App) DeleteNode(id string) (*model.TreeNode, error) {
	return a.sessionService.DeleteNode(id)
}

func (a *App) AddSession(parentID string, profile model.SessionProfile) (*model.TreeNode, error) {
	return a.sessionService.AddSession(parentID, profile)
}

func (a *App) UpdateSession(profile model.SessionProfile) (*model.TreeNode, error) {
	return a.sessionService.UpdateSession(profile)
}

func (a *App) DuplicateSession(id string) (*model.TreeNode, error) {
	return a.sessionService.DuplicateSession(id)
}

func (a *App) DuplicateFolder(folderID string) (*model.TreeNode, error) {
	return a.sessionService.DuplicateFolder(folderID)
}

func (a *App) ExpandAllFolders(expanded bool) (*model.TreeNode, error) {
	return a.sessionService.ExpandAllFolders(expanded)
}

func (a *App) MoveNode(sourceID, targetParentID string, targetIndex int) (*model.TreeNode, error) {
	return a.sessionService.MoveNode(sourceID, targetParentID, targetIndex)
}

func (a *App) MoveSession(nodeID, targetFolderID string) (*model.TreeNode, error) {
	return a.sessionService.MoveSession(nodeID, targetFolderID)
}

func (a *App) ExportSessions() (string, error) {
	return a.sessionService.ExportSessions()
}

func (a *App) ImportSessions(jsonContent string) (*model.TreeNode, error) {
	return a.sessionService.ImportSessions(jsonContent)
}

// =========================================================================
// Credential Service Delegations
// =========================================================================

func (a *App) GetSavedPasswords() ([]service.SavedCredential, error) {
	return a.credentialService.GetSavedPasswords(a.sessionService.GetSessionTree())
}

func (a *App) SaveSessionPassword(vaultKey, password string) error {
	if err := a.settingsService.CheckPasswordSaving(); err != nil {
		a.loggingService.LogAudit("POLICY_DENIED", "vault", "", "", vaultKey, "DENIED", err.Error())
		return err
	}
	err := a.credentialService.SaveSessionPassword(vaultKey, password)
	if err == nil {
		a.loggingService.LogAudit("PASSWORD_SAVED", "vault", "", "", vaultKey, "SUCCESS", "Credentials saved securely to DPAPI platform vault")
	}
	return err
}

// SavePassword is a compatibility alias for SaveSessionPassword.
func (a *App) SavePassword(vaultKey, password string) error {
	return a.SaveSessionPassword(vaultKey, password)
}

func (a *App) HasSavedPassword(vaultKey string) (bool, error) {
	return a.credentialService.HasSavedPassword(vaultKey)
}

func (a *App) DeleteSavedPassword(vaultKey string) error {
	err := a.credentialService.DeleteSavedPassword(vaultKey)
	if err == nil {
		a.loggingService.LogAudit("PASSWORD_DELETED", "vault", "", "", vaultKey, "SUCCESS", "Credential removed from vault")
	}
	return err
}

func (a *App) GetSessionPassword(vaultKey string) (string, error) {
	return a.credentialService.GetSessionPassword(vaultKey)
}

// GetSavedPassword is a compatibility alias for GetSessionPassword.
func (a *App) GetSavedPassword(vaultKey string) (string, error) {
	return a.credentialService.GetSessionPassword(vaultKey)
}

func (a *App) GetSessionPassphrase(vaultKey string) (string, error) {
	return a.credentialService.GetSessionPassphrase(vaultKey)
}

func (a *App) FindSessionPassword(vaultKey, host string, port int, username string) (string, error) {
	return a.credentialService.FindSessionPassword(vaultKey, host, port, username)
}

func (a *App) SelectPrivateKeyFile() (string, error) {
	return a.credentialService.SelectPrivateKeyFile(a.ctx)
}

func (a *App) ValidatePrivateKeyFile(path, passphrase string) (*sshsession.KeyInfo, error) {
	return a.credentialService.ValidatePrivateKeyFile(path, passphrase)
}

func (a *App) CheckSSHAgent() (map[string]interface{}, error) {
	return a.credentialService.CheckSSHAgent()
}

// =========================================================================
// Connection & Protocol Session Delegations
// =========================================================================

func (a *App) OpenSession(profile model.SessionProfile, password string) (string, error) {
	tabID := uuid.NewString()
	err := a.OpenSessionWithTabID(tabID, profile, password)
	return tabID, err
}

// OpenSessionWithTabID keeps its original signature for backward compatibility
// with older frontend bundles; it simply forwards with no bastion secret.
func (a *App) OpenSessionWithTabID(tabID string, profile model.SessionProfile, password string) error {
	return a.OpenSessionWithTabIDAndJumpSecret(tabID, profile, password, "")
}

// OpenSessionWithTabIDAndJumpSecret is the full entry point used by the
// session dialog / terminal manager. jumpSecret carries whatever credential
// the bastion hop needs for this connect attempt: a plaintext password when
// profile.JumpAuthType is "password", or a private-key passphrase when it is
// "key". It is never persisted here — the frontend is responsible for saving
// it to the vault (via SaveSessionPassword) if the user opted in.
func (a *App) OpenSessionWithTabIDAndJumpSecret(tabID string, profile model.SessionProfile, password string, jumpSecret string) error {
	if tabID == "" {
		tabID = uuid.NewString()
	}

	proto := profile.Protocol
	if proto == "" {
		proto = "ssh"
	}

	// Security Policy Check (GAP-12)
	if err := a.settingsService.CheckProtocol(proto); err != nil {
		a.loggingService.LogAudit("POLICY_DENIED", proto, profile.Host, profile.Username, tabID, "DENIED", err.Error())
		return err
	}

	if err := a.connectionManager.OpenSession(a.ctx, tabID, profile, password, jumpSecret); err != nil {
		a.loggingService.LogAudit("AUTH_FAILED", proto, profile.Host, profile.Username, tabID, "FAILURE", err.Error())
		return err
	}

	a.loggingService.LogAudit("CONNECTED", proto, profile.Host, profile.Username, tabID, "SUCCESS", fmt.Sprintf("Connected to %s (%s)", profile.Name, profile.Host))

	_, _ = a.settingsService.AddTabToPane("", &model.TabSession{
		ID:          tabID,
		Title:       profile.Name,
		Profile:     profile,
		IsConnected: true,
		IsLocal:     false,
		CreatedAt:   time.Now().Format(time.RFC3339),
	})

	return nil
}

func (a *App) QuickConnect(host string, port int, username, password, privateKeyPath string) (string, error) {
	tabID := uuid.NewString()
	name := fmt.Sprintf("%s@%s:%d", username, host, port)
	profile := model.SessionProfile{
		ID:             tabID,
		Name:           name,
		Host:           host,
		Port:           port,
		Username:       username,
		PrivateKeyPath: privateKeyPath,
		Protocol:       "ssh",
	}
	if privateKeyPath != "" {
		profile.AuthType = "key"
	} else if password != "" {
		profile.AuthType = "password"
	}
	err := a.OpenSessionWithTabID(tabID, profile, password)
	return tabID, err
}

func (a *App) OpenLocalTerminal(shell string) (string, error) {
	tabID, title, err := a.terminalService.OpenLocalTerminal(shell, 120, 30)
	if err != nil {
		return "", err
	}

	_, _ = a.settingsService.AddTabToPane("", &model.TabSession{
		ID:          tabID,
		Title:       title,
		Profile:     model.SessionProfile{Name: title, Protocol: "local"},
		IsConnected: true,
		IsLocal:     true,
		CreatedAt:   time.Now().Format(time.RFC3339),
	})

	return tabID, nil
}

// BroadcastCommand dispatches a command across target sessions or all currently connected sessions.
// Matches NexTerm Broadcast Architecture: UI -> App Facade -> ConnectionManager -> ProtocolSession targets.
func (a *App) BroadcastCommand(tabIDs []string, command, mode string) (*service.BroadcastResult, error) {
	// If no tabIDs specified, collect all connected remote and local sessions
	if len(tabIDs) == 0 {
		seen := make(map[string]bool)
		for id := range a.connectionManager.ActiveSessions() {
			if !seen[id] {
				tabIDs = append(tabIDs, id)
				seen[id] = true
			}
		}
		for _, id := range a.terminalService.ActiveTabIDs() {
			if !seen[id] {
				tabIDs = append(tabIDs, id)
				seen[id] = true
			}
		}
	}

	fallbackResolver := func(tabID string) (func([]byte) error, bool) {
		if a.terminalService.Has(tabID) {
			return func(payload []byte) error {
				return a.terminalService.Write(tabID, payload)
			}, true
		}
		return nil, false
	}

	reqID := "bcast-" + uuid.NewString()[:8]
	return a.connectionManager.BroadcastCommandToTargets(a.ctx, reqID, tabIDs, command, mode, nil, fallbackResolver)
}

// CancelBroadcast cancels an in-flight broadcast dispatch by its request ID.
func (a *App) CancelBroadcast(requestID string) error {
	return a.connectionManager.CancelBroadcast(requestID)
}

// BroadcastRaw sends raw bytes to all connected sessions (kept for direct terminal piping).
func (a *App) BroadcastRaw(data string) error {
	err1 := a.connectionManager.BroadcastCommand(data)
	a.terminalService.Broadcast([]byte(data))
	return err1
}

// ExecuteMulti dispatches a command simultaneously to a selected list of active session or terminal tab IDs.
// Follows architecture: Command -> ConnectionManager (and TerminalService for local shells) -> [Server 1, Server 2, Server 3, ...]
func (a *App) ExecuteMulti(targetTabIDs []string, command string) error {
	if !strings.HasSuffix(command, "\n") && !strings.HasSuffix(command, "\r") {
		command += "\r"
	}

	var errs []string
	var remoteTabIDs []string
	payload := []byte(command)

	for _, tabID := range targetTabIDs {
		if a.terminalService.Has(tabID) {
			if err := a.terminalService.Write(tabID, payload); err != nil {
				errs = append(errs, fmt.Sprintf("local %s: %v", tabID, err))
			}
		} else {
			remoteTabIDs = append(remoteTabIDs, tabID)
		}
	}

	if len(remoteTabIDs) > 0 {
		if err := a.connectionManager.ExecuteMulti(remoteTabIDs, command); err != nil {
			errs = append(errs, err.Error())
		}
	}

	if a.loggingService != nil {
		a.loggingService.LogInfo("multi_exec", fmt.Sprintf("Multi-execution dispatched across %d target tabs: %s", len(targetTabIDs), strings.TrimSpace(command)))
	}

	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func (a *App) LaunchSystemTool(toolKey string) error {
	if runtime.GOOS == "darwin" {
		macTools := map[string][]string{
			"taskmgr":          {"open", "-a", "Activity Monitor"},
			"resmon":           {"open", "-a", "Activity Monitor"},
			"devmgmt":          {"open", "-a", "System Information"},
			"cmd_admin":        {"open", "-a", "Terminal"},
			"powershell_admin": {"open", "-a", "Terminal"},
		}
		if cmdArgs, ok := macTools[toolKey]; ok {
			return exec.Command(cmdArgs[0], cmdArgs[1:]...).Start()
		}
		return fmt.Errorf("system tool not available on macOS: %s", toolKey)
	}

	if runtime.GOOS == "linux" {
		linuxTools := map[string][]string{
			"taskmgr":   {"gnome-system-monitor"},
			"resmon":    {"top"},
			"devmgmt":   {"hardinfo"},
			"cmd_admin": {"x-terminal-emulator"},
		}
		if cmdArgs, ok := linuxTools[toolKey]; ok {
			return exec.Command(cmdArgs[0], cmdArgs[1:]...).Start()
		}
		return fmt.Errorf("system tool not available on Linux: %s", toolKey)
	}

	cmdMap := map[string]string{
		"devmgmt":          "devmgmt.msc",
		"taskmgr":          "taskmgr.exe",
		"cmd_admin":        "cmd.exe",
		"powershell_admin": "powershell.exe",
		"resmon":           "resmon.exe",
	}

	executable, exists := cmdMap[toolKey]
	if !exists {
		return fmt.Errorf("unknown system tool: %s", toolKey)
	}

	if toolKey == "cmd_admin" || toolKey == "powershell_admin" {
		return exec.Command("powershell", "-Command", fmt.Sprintf("Start-Process %s -Verb RunAs", executable)).Start()
	}
	return exec.Command(executable).Start()
}

func (a *App) WriteToTerminal(tabID, data string) error {
	if a.terminalService.Has(tabID) {
		return a.terminalService.Write(tabID, []byte(data))
	}
	return a.connectionManager.Write(tabID, []byte(data))
}

func (a *App) ResizeTerminal(tabID string, cols, rows int) error {
	if a.terminalService.Has(tabID) {
		return a.terminalService.Resize(tabID, cols, rows)
	}
	return a.connectionManager.Resize(tabID, cols, rows)
}

func (a *App) CloseTab(tabID string) error {
	_ = a.terminalService.Close(tabID)
	_ = a.connectionManager.CloseSession(tabID)
	_, _ = a.settingsService.RemoveTab(tabID)
	a.sftpService.CloseWatchersForTab(tabID)
	return nil
}

func (a *App) ClassifyConnectionError(errString string) sshsession.ClassifiedError {
	return a.connectionManager.ClassifyConnectionError(errString)
}

// =========================================================================
// Workspace & Settings Service Delegations
// =========================================================================

func (a *App) GetWorkspace() model.Workspace {
	return a.settingsService.GetWorkspace()
}

func (a *App) SetWorkspaceLayout(layout string) (model.Workspace, error) {
	return a.settingsService.SetWorkspaceLayout(layout)
}

func (a *App) AddWorkspacePane(direction string) (*model.Pane, error) {
	return a.settingsService.AddWorkspacePane(direction)
}

func (a *App) CloseWorkspacePane(paneID string) (model.Workspace, error) {
	return a.settingsService.CloseWorkspacePane(paneID)
}

func (a *App) MoveWorkspaceTab(tabID, targetPaneID string, targetIndex int) (model.Workspace, error) {
	return a.settingsService.MoveWorkspaceTab(tabID, targetPaneID, targetIndex)
}

func (a *App) FocusWorkspacePane(paneID string) error {
	return a.settingsService.FocusWorkspacePane(paneID)
}

func (a *App) SetWorkspaceActiveTab(paneID, tabID string) error {
	return a.settingsService.SetWorkspaceActiveTab(paneID, tabID)
}

func (a *App) GetSecurityPolicy() security.SecurityPolicy {
	return a.settingsService.GetSecurityPolicy()
}

func (a *App) SaveSecurityPolicy(p security.SecurityPolicy) error {
	return a.settingsService.SaveSecurityPolicy(p)
}

func (a *App) GetCustomizerConfig() security.CustomizerConfig {
	return a.settingsService.GetCustomizerConfig()
}

func (a *App) SaveCustomizerConfig(c security.CustomizerConfig) error {
	return a.settingsService.SaveCustomizerConfig(c)
}

// =========================================================================
// SFTP Service Delegations
// =========================================================================

func (a *App) SFTPList(tabID, remotePath string) (*service.SFTPListResult, error) {
	return a.sftpService.List(tabID, remotePath)
}

func (a *App) SFTPDownload(tabID, remotePath, localDest string) error {
	if err := a.settingsService.CheckFileTransfers(); err != nil {
		a.loggingService.LogAudit("POLICY_DENIED", "sftp", "", "", tabID, "DENIED", err.Error())
		return err
	}
	err := a.sftpService.Download(tabID, remotePath, localDest)
	if err == nil {
		a.loggingService.LogAudit("FILE_DOWNLOADED", "sftp", "", "", tabID, "SUCCESS", fmt.Sprintf("%s -> %s", remotePath, localDest))
	} else {
		a.loggingService.LogAudit("FILE_DOWNLOAD_FAILED", "sftp", "", "", tabID, "FAILURE", err.Error())
	}
	return err
}

func (a *App) SFTPUpload(tabID, localSrc, remoteDest string) error {
	if err := a.settingsService.CheckFileTransfers(); err != nil {
		a.loggingService.LogAudit("POLICY_DENIED", "sftp", "", "", tabID, "DENIED", err.Error())
		return err
	}
	err := a.sftpService.Upload(tabID, localSrc, remoteDest)
	if err == nil {
		a.loggingService.LogAudit("FILE_UPLOADED", "sftp", "", "", tabID, "SUCCESS", fmt.Sprintf("%s -> %s", localSrc, remoteDest))
	} else {
		a.loggingService.LogAudit("FILE_UPLOAD_FAILED", "sftp", "", "", tabID, "FAILURE", err.Error())
	}
	return err
}

func (a *App) SFTPDelete(tabID, remotePath string) error {
	err := a.sftpService.Delete(tabID, remotePath)
	if err == nil {
		a.loggingService.LogAudit("FILE_DELETED", "sftp", "", "", tabID, "SUCCESS", remotePath)
	}
	return err
}

func (a *App) SFTPRename(tabID, oldPath, newPath string) error {
	return a.sftpService.Rename(tabID, oldPath, newPath)
}

func (a *App) SFTPMkdir(tabID, remotePath string) error {
	return a.sftpService.Mkdir(tabID, remotePath)
}

func (a *App) SFTPCreateFile(tabID, remotePath string) error {
	return a.sftpService.CreateFile(tabID, remotePath)
}

func (a *App) SFTPReadFile(tabID, remotePath string) (string, error) {
	return a.sftpService.ReadFile(tabID, remotePath)
}

func (a *App) SFTPWriteFile(tabID, remotePath, content string) error {
	return a.sftpService.WriteFile(tabID, remotePath, content)
}

func (a *App) SelectDownloadDest(defaultName string) (string, error) {
	return a.sftpService.SelectDownloadDest(a.ctx, defaultName)
}

func (a *App) SelectUploadFile() (string, error) {
	return a.sftpService.SelectUploadFile(a.ctx)
}

func (a *App) SFTPListLocal(localPath string) (*service.SFTPListResult, error) {
	return a.sftpService.ListLocal(localPath)
}

func (a *App) SFTPGetLocalDrives() ([]string, error) {
	return a.sftpService.GetLocalDrives()
}

func (a *App) SFTPMkdirLocal(localPath string) error {
	return a.sftpService.MkdirLocal(localPath)
}

func (a *App) SFTPCreateFileLocal(localPath string) error {
	return a.sftpService.CreateFileLocal(localPath)
}

func (a *App) SFTPRenameLocal(oldPath, newPath string) error {
	return a.sftpService.RenameLocal(oldPath, newPath)
}

func (a *App) SFTPDeleteLocal(localPath string) error {
	return a.sftpService.DeleteLocal(localPath)
}

func (a *App) SFTPChmodLocal(localPath, octalMode string) error {
	return a.sftpService.ChmodLocal(localPath, octalMode)
}

func (a *App) SFTPChmodRemote(tabID, remotePath, octalMode string) error {
	return a.sftpService.ChmodRemote(tabID, remotePath, octalMode)
}

func (a *App) SFTPOpenExternal(tabID, remotePath string, chooseApp bool) error {
	return a.sftpService.OpenExternal(tabID, remotePath, chooseApp)
}

func (a *App) SFTPCommitExternalChange(tabID, remotePath, localPath string) error {
	return a.sftpService.CommitExternalChange(tabID, remotePath, localPath)
}

func (a *App) SFTPGetFileProperties(tabID, remotePath string) (*sftpmanager.SFTPItem, error) {
	return a.sftpService.GetFileProperties(tabID, remotePath)
}

// =========================================================================
// Host Key & Auth Challenge Service Delegations
// =========================================================================

func (a *App) GetKnownHosts() ([]hostkey.HostKeyEntry, error) {
	return a.hostKeyService.GetKnownHosts()
}

func (a *App) DeleteKnownHost(hostname string, port int) error {
	return a.hostKeyService.DeleteKnownHost(hostname, port)
}

func (a *App) RespondHostKey(requestID string, action string) error {
	return a.hostKeyService.RespondHostKey(requestID, action)
}

func (a *App) RespondAuthChallenge(requestID string, answers []string) error {
	return a.connectionManager.RespondAuthChallenge(requestID, answers)
}

func (a *App) CancelAuthChallenge(requestID string) error {
	return a.connectionManager.CancelAuthChallenge(requestID)
}

// =========================================================================
// Tunnel & Macro Managers
// =========================================================================

func (a *App) GetTunnels() []tunnel.TunnelConfig {
	return a.tunnelMgr.GetTunnels()
}

func (a *App) SaveTunnel(t tunnel.TunnelConfig) error {
	return a.tunnelMgr.SaveTunnel(t)
}

func (a *App) DeleteTunnel(id string) error {
	return a.tunnelMgr.DeleteTunnel(id)
}

func (a *App) StartTunnel(id, tabID string) error {
	client := a.connectionManager.GetSSHClient(tabID)
	if client == nil {
		return fmt.Errorf("active SSH connection required to forward tunnel ports")
	}
	return a.tunnelMgr.StartTunnel(id, client)
}

func (a *App) StopTunnel(id string) error {
	return a.tunnelMgr.StopTunnel(id)
}

func (a *App) GetMacros() []macro.Macro {
	return a.macroMgr.GetMacros()
}

func (a *App) SaveMacro(m macro.Macro) error {
	return a.macroMgr.SaveMacro(m)
}

func (a *App) DeleteMacro(id string) error {
	return a.macroMgr.DeleteMacro(id)
}

func (a *App) ExecuteMacro(macroID string, targetTabIDs []string) error {
	macros := a.macroMgr.GetMacros()
	var targetMacro *macro.Macro
	for _, m := range macros {
		if m.ID == macroID {
			targetMacro = &m
			break
		}
	}
	if targetMacro == nil {
		return fmt.Errorf("macro not found: %s", macroID)
	}

	targets := targetTabIDs
	if len(targets) == 0 {
		active := a.connectionManager.ActiveSessions()
		for id := range active {
			targets = append(targets, id)
		}
	}

	if len(targets) == 0 {
		return fmt.Errorf("no active terminals to execute macro against")
	}

	go func() {
		for _, cmd := range targetMacro.Commands {
			if targetMacro.DelayMs > 0 {
				time.Sleep(time.Duration(targetMacro.DelayMs) * time.Millisecond)
			}
			payload := cmd + "\r"
			for _, tID := range targets {
				_ = a.WriteToTerminal(tID, payload)
			}
		}
	}()

	return nil
}

// =========================================================================
// Network Diagnostic Tools
// =========================================================================

func (a *App) NetPing(host string) (string, error) {
	return nettools.Ping(host)
}

func (a *App) NetLookupDNS(host string) (map[string][]string, error) {
	return nettools.LookupDNS(host)
}

func (a *App) NetPortScan(host string, ports []int) []nettools.PortScanResult {
	return nettools.PortScan(host, ports)
}

func (a *App) NetCalculateHash(input, algorithm string) string {
	return nettools.CalculateHash(input, algorithm)
}

// =========================================================================
// Multi-Protocol Launcher & Serial Ports
// =========================================================================

func (a *App) LaunchRDPSession(profile model.SessionProfile, password string) error {
	profile.Protocol = "rdp"
	return a.OpenSessionWithTabID(profile.ID, profile, password)
}

func (a *App) GetAvailableSerialPorts() []string {
	var ports []string
	for i := 1; i <= 32; i++ {
		ports = append(ports, fmt.Sprintf("COM%d", i))
	}
	return ports
}

// =========================================================================
// Logging & Diagnostics
// =========================================================================

func (a *App) GetRecentLogs(count int) []service.LogEntry {
	return a.loggingService.GetRecentLogs(count)
}

// =========================================================================
// Audit Logging & Security Compliance (GAP-11)
// =========================================================================

func (a *App) GetAuditLogs(limit int) []service.AuditEvent {
	return a.loggingService.GetAuditLogs(limit)
}

func (a *App) ExportAuditLogsJSON() (string, error) {
	return a.loggingService.ExportAuditJSON()
}

func (a *App) ExportAuditLogsCSV() (string, error) {
	return a.loggingService.ExportAuditCSV()
}

func (a *App) ClearAuditLogs() error {
	return a.loggingService.ClearAuditLogs()
}

// SaveTerminalOutput saves terminal scrollback buffer to a local text file (GAP-27).
func (a *App) SaveTerminalOutput(suggestedFilename, content string) (string, error) {
	if suggestedFilename == "" {
		suggestedFilename = fmt.Sprintf("terminal_transcript_%s.txt", time.Now().Format("20060102_150405"))
	}
	savePath, err := a.sftpService.SelectDownloadDest(a.ctx, suggestedFilename)
	if err != nil || savePath == "" {
		return "", err
	}

	if err := os.WriteFile(savePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to save terminal transcript: %w", err)
	}

	a.loggingService.LogAudit("TRANSCRIPT_SAVED", "terminal", "", "", "", "SUCCESS", savePath)
	return savePath, nil
}
