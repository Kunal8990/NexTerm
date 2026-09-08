package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"nexterm/internal/macro"
	"nexterm/internal/model"
	"nexterm/internal/nettools"
	"nexterm/internal/pty"
	"nexterm/internal/security"
	sftpmanager "nexterm/internal/sftp"
	"nexterm/internal/sshsession"
	"nexterm/internal/store"
	"nexterm/internal/tunnel"
	"nexterm/internal/vault"

	"github.com/google/uuid"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is bound to the frontend by Wails: every exported method here becomes
// callable from JS as window.go.main.App.<MethodName>(...).
type App struct {
	ctx   context.Context
	store *store.SessionStore
	vault *vault.Vault
	root  *model.TreeNode

	mu        sync.Mutex
	tabs      map[string]*sshsession.Session // tabID -> live SSH session
	localTabs map[string]*pty.Terminal       // tabID -> live local ConPTY session

	sftpMgr   *sftpmanager.SFTPManager
	tunnelMgr *tunnel.TunnelManager
	macroMgr  *macro.MacroManager
	secMgr    *security.SecurityManager
}

func NewApp() *App {
	return &App{
		tabs:      make(map[string]*sshsession.Session),
		localTabs: make(map[string]*pty.Terminal),
		sftpMgr:   sftpmanager.NewSFTPManager(),
		tunnelMgr: tunnel.NewTunnelManager(),
		macroMgr:  macro.NewMacroManager(),
		secMgr:    security.NewSecurityManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	s, err := store.NewSessionStore()
	if err != nil {
		wailsruntime.LogErrorf(ctx, "session store init failed: %v", err)
		return
	}
	a.store = s

	v, err := vault.NewVault()
	if err != nil {
		wailsruntime.LogErrorf(ctx, "vault init failed: %v", err)
		return
	}
	a.vault = v

	root, err := a.store.LoadRoot()
	if err != nil {
		wailsruntime.LogErrorf(ctx, "load session tree failed: %v", err)
		root = &model.TreeNode{
			ID:       uuid.NewString(),
			Name:     "All Sessions",
			Expanded: true,
			Children: []*model.TreeNode{},
		}
	}
	a.root = root
}

// GetSessionTree returns the full saved-sessions tree for the sidebar.
func (a *App) GetSessionTree() *model.TreeNode {
	return a.root
}

// AddFolder adds a new subfolder under parentID.
func (a *App) AddFolder(parentID, name string) (*model.TreeNode, error) {
	if name == "" {
		name = "New Folder"
	}
	parent := findNode(a.root, parentID)
	if parent == nil {
		parent = a.root
	}
	node := &model.TreeNode{
		ID:       uuid.NewString(),
		Name:     name,
		Expanded: true,
		Children: []*model.TreeNode{},
	}
	parent.Children = append(parent.Children, node)
	return a.root, a.store.Save(a.root)
}

// UpdateFolder renames an existing folder.
func (a *App) UpdateFolder(id, name string) (*model.TreeNode, error) {
	node := findNode(a.root, id)
	if node == nil {
		return a.root, fmt.Errorf("folder not found: %s", id)
	}
	node.Name = name
	return a.root, a.store.Save(a.root)
}

// ToggleFolder toggles expanded/collapsed state of a folder node.
func (a *App) ToggleFolder(id string, expanded bool) (*model.TreeNode, error) {
	node := findNode(a.root, id)
	if node != nil {
		node.Expanded = expanded
		_ = a.store.Save(a.root)
	}
	return a.root, nil
}

// DeleteNode removes a folder or session node by ID.
func (a *App) DeleteNode(id string) (*model.TreeNode, error) {
	if id == a.root.ID {
		return a.root, fmt.Errorf("cannot delete root node")
	}
	// Also delete any associated vault keys recursively
	node := findNode(a.root, id)
	if node != nil {
		a.cleanupVaultKeys(node)
	}
	deleted := deleteNodeRecursive(a.root, id)
	if !deleted {
		return a.root, fmt.Errorf("node not found: %s", id)
	}
	return a.root, a.store.Save(a.root)
}

func (a *App) cleanupVaultKeys(n *model.TreeNode) {
	if n == nil {
		return
	}
	if n.Session != nil && n.Session.VaultKey != "" {
		_ = a.vault.Delete(n.Session.VaultKey)
	}
	for _, c := range n.Children {
		a.cleanupVaultKeys(c)
	}
}

// AddSession creates a new session in the given parent folder.
func (a *App) AddSession(parentID string, profile model.SessionProfile) (*model.TreeNode, error) {
	parent := findNode(a.root, parentID)
	if parent == nil {
		parent = a.root
	}
	if profile.ID == "" {
		profile.ID = uuid.NewString()
	}
	if profile.VaultKey == "" {
		profile.VaultKey = profile.ID
	}
	if profile.Port <= 0 {
		profile.Port = 22
	}
	if profile.Name == "" {
		profile.Name = profile.Host
	}
	node := &model.TreeNode{
		ID:      uuid.NewString(),
		Name:    profile.Name,
		Session: &profile,
	}
	parent.Children = append(parent.Children, node)
	return a.root, a.store.Save(a.root)
}

// UpdateSession updates an existing session's configuration.
func (a *App) UpdateSession(profile model.SessionProfile) (*model.TreeNode, error) {
	node := findNodeBySessionID(a.root, profile.ID)
	if node == nil {
		return a.root, fmt.Errorf("session not found: %s", profile.ID)
	}
	if profile.Port <= 0 {
		profile.Port = 22
	}
	if profile.VaultKey == "" {
		profile.VaultKey = profile.ID
	}
	node.Name = profile.Name
	node.Session = &profile
	return a.root, a.store.Save(a.root)
}

// DuplicateSession creates a copy of an existing session profile.
func (a *App) DuplicateSession(id string) (*model.TreeNode, error) {
	node := findNode(a.root, id)
	if node == nil || node.Session == nil {
		return a.root, fmt.Errorf("session node not found: %s", id)
	}
	parent := findParentNode(a.root, id)
	if parent == nil {
		parent = a.root
	}
	cloneProfile := *node.Session
	cloneProfile.ID = uuid.NewString()
	cloneProfile.VaultKey = cloneProfile.ID
	cloneProfile.Name = cloneProfile.Name + " (Copy)"

	newNode := &model.TreeNode{
		ID:      uuid.NewString(),
		Name:    cloneProfile.Name,
		Session: &cloneProfile,
	}
	parent.Children = append(parent.Children, newNode)
	return a.root, a.store.Save(a.root)
}

type SavedCredential struct {
	SessionID   string `json:"sessionId"`
	SessionName string `json:"sessionName"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	VaultKey    string `json:"vaultKey"`
	Password    string `json:"password"`
}

// MoveSession moves a session node to a new parent folder (for drag-and-drop).
func (a *App) MoveSession(nodeID, targetFolderID string) (*model.TreeNode, error) {
	node := findNode(a.root, nodeID)
	if node == nil {
		return a.root, fmt.Errorf("node not found: %s", nodeID)
	}

	targetFolder := findNode(a.root, targetFolderID)
	if targetFolder == nil {
		targetFolder = a.root
	}

	// Detach from current parent
	parent := findParentNode(a.root, nodeID)
	if parent != nil {
		for i, c := range parent.Children {
			if c.ID == nodeID {
				parent.Children = append(parent.Children[:i], parent.Children[i+1:]...)
				break
			}
		}
	}

	// Append to target folder
	targetFolder.Children = append(targetFolder.Children, node)
	return a.root, a.store.Save(a.root)
}

// GetSavedPasswords returns all stored credentials decrypted for Password Management.
func (a *App) GetSavedPasswords() ([]SavedCredential, error) {
	var list []SavedCredential
	if a.vault == nil || a.root == nil {
		return list, nil
	}

	var collect func(n *model.TreeNode)
	collect = func(n *model.TreeNode) {
		if n == nil {
			return
		}
		if n.Session != nil && n.Session.VaultKey != "" {
			pwd, ok, err := a.vault.Load(n.Session.VaultKey)
			if err == nil && ok && pwd != "" {
				list = append(list, SavedCredential{
					SessionID:   n.Session.ID,
					SessionName: n.Session.Name,
					Host:        n.Session.Host,
					Port:        n.Session.Port,
					Username:    n.Session.Username,
					VaultKey:    n.Session.VaultKey,
					Password:    pwd,
				})
			}
		}
		for _, c := range n.Children {
			collect(c)
		}
	}
	collect(a.root)
	return list, nil
}

// SaveSessionPassword stores a password encrypted in the DPAPI vault.
func (a *App) SaveSessionPassword(vaultKey, password string) error {
	if a.vault == nil {
		return fmt.Errorf("vault is not initialized")
	}
	return a.vault.Save(vaultKey, password)
}

// HasSavedPassword returns true if a password is encrypted in the vault.
func (a *App) HasSavedPassword(vaultKey string) (bool, error) {
	if a.vault == nil || vaultKey == "" {
		return false, nil
	}
	_, ok, err := a.vault.Load(vaultKey)
	return ok, err
}

// DeleteSavedPassword removes a stored password from the DPAPI vault.
func (a *App) DeleteSavedPassword(vaultKey string) error {
	if a.vault == nil || vaultKey == "" {
		return nil
	}
	return a.vault.Delete(vaultKey)
}

// OpenSession connects a saved (or ad-hoc) session and returns a tabID.
func (a *App) OpenSession(profile model.SessionProfile, password string) (string, error) {
	opts := sshsession.ConnectOptions{
		Host:              profile.Host,
		Port:              profile.Port,
		Username:          profile.Username,
		StartupCommand:    profile.StartupCommand,
		TerminalType:      profile.TerminalType,
		KeepAliveInterval: profile.KeepAliveInterval,
		KeyPassphrase:     profile.KeyPassphrase,
	}

	if profile.PrivateKeyPath != "" {
		keyBytes, err := sshsession.ReadPrivateKeyFile(profile.PrivateKeyPath)
		if err != nil {
			return "", fmt.Errorf("read private key: %w", err)
		}
		opts.PrivateKeyPEM = keyBytes
	} else if password != "" {
		opts.Password = password
	} else if profile.VaultKey != "" && a.vault != nil {
		saved, ok, err := a.vault.Load(profile.VaultKey)
		if err == nil && ok {
			opts.Password = saved
		}
	}

	// Handle Jump Host / Bastion Proxy configuration
	if profile.UseJumpHost && profile.JumpHost != "" {
		opts.UseJumpHost = true
		opts.JumpHost = profile.JumpHost
		opts.JumpPort = profile.JumpPort
		opts.JumpUsername = profile.JumpUsername
		if profile.JumpPrivateKeyPath != "" {
			jKeyBytes, err := sshsession.ReadPrivateKeyFile(profile.JumpPrivateKeyPath)
			if err == nil {
				opts.JumpPrivateKeyPEM = jKeyBytes
			}
		} else if profile.JumpVaultKey != "" && a.vault != nil {
			jPw, ok, err := a.vault.Load(profile.JumpVaultKey)
			if err == nil && ok {
				opts.JumpPassword = jPw
			}
		}
	}

	sess, err := sshsession.Connect(opts)
	if err != nil {
		return "", err
	}

	tabID := uuid.NewString()

	sess.OnData = func(data []byte) {
		wailsruntime.EventsEmit(a.ctx, "terminal:data:"+tabID, string(data))
	}
	sess.OnDisconnected = func(reason string) {
		wailsruntime.EventsEmit(a.ctx, "terminal:closed:"+tabID, reason)
		a.mu.Lock()
		delete(a.tabs, tabID)
		a.mu.Unlock()
	}

	a.mu.Lock()
	a.tabs[tabID] = sess
	a.mu.Unlock()

	return tabID, nil
}

// QuickConnect creates an immediate ad-hoc connection.
func (a *App) QuickConnect(host string, port int, username, password, privateKeyPath string) (string, error) {
	if port <= 0 {
		port = 22
	}
	profile := model.SessionProfile{
		ID:             uuid.NewString(),
		Name:           fmt.Sprintf("%s@%s", username, host),
		Host:           host,
		Port:           port,
		Username:       username,
		PrivateKeyPath: privateKeyPath,
	}
	return a.OpenSession(profile, password)
}

// SelectPrivateKeyFile launches the native Windows open file dialog.
func (a *App) SelectPrivateKeyFile() (string, error) {
	file, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select Private Key File",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "SSH Keys (*.pem;*.id_rsa;*.key;*.*)", Pattern: "*;*.pem;*.id_rsa;*.key;*.pub"},
		},
	})
	return file, err
}

// ExportSessions returns the serialized JSON of the entire session tree.
func (a *App) ExportSessions() (string, error) {
	data, err := json.MarshalIndent(a.root, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ImportSessions restores session tree from a JSON string.
func (a *App) ImportSessions(jsonContent string) (*model.TreeNode, error) {
	var imported model.TreeNode
	if err := json.Unmarshal([]byte(jsonContent), &imported); err != nil {
		return a.root, fmt.Errorf("invalid session JSON: %w", err)
	}
	a.root = &imported
	return a.root, a.store.Save(a.root)
}

// OpenLocalTerminal starts a local PowerShell / CMD process attached to Windows ConPTY.
func (a *App) OpenLocalTerminal(shellType string) (string, error) {
	tabID := uuid.NewString()
	cmdLine := "powershell.exe -NoLogo"
	if shellType == "cmd" {
		cmdLine = "cmd.exe"
	}

	term, err := pty.Start(cmdLine, 120, 30)
	if err != nil {
		return "", fmt.Errorf("start local pseudo terminal: %w", err)
	}

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := term.Read(buf)
			if n > 0 {
				wailsruntime.EventsEmit(a.ctx, "terminal:data:"+tabID, string(buf[:n]))
			}
			if err != nil {
				wailsruntime.EventsEmit(a.ctx, "terminal:closed:"+tabID, "Local terminal exited")
				return
			}
		}
	}()

	a.mu.Lock()
	a.localTabs[tabID] = term
	a.mu.Unlock()

	return tabID, nil
}

// BroadcastCommand sends command text simultaneously to ALL active SSH & local tabs (MultiExec).
func (a *App) BroadcastCommand(data string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, sess := range a.tabs {
		_ = sess.Write([]byte(data))
	}
	for _, l := range a.localTabs {
		_, _ = l.Write([]byte(data))
	}
	return nil
}

// LaunchSystemTool opens built-in Windows admin tools.
func (a *App) LaunchSystemTool(toolKey string) error {
	switch toolKey {
	case "taskmgr":
		return exec.Command("taskmgr.exe").Start()
	case "devmgmt":
		return exec.Command("devmgmt.msc").Start()
	case "resmon":
		return exec.Command("resmon.exe").Start()
	case "cmd_admin":
		return exec.Command("powershell.exe", "-Command", "Start-Process cmd.exe -Verb RunAs").Start()
	case "powershell_admin":
		return exec.Command("powershell.exe", "-Command", "Start-Process powershell.exe -Verb RunAs").Start()
	default:
		return fmt.Errorf("unknown tool: %s", toolKey)
	}
}

func (a *App) WriteToTerminal(tabID, data string) error {
	a.mu.Lock()
	sess, isSSH := a.tabs[tabID]
	local, isLocal := a.localTabs[tabID]
	a.mu.Unlock()

	if isSSH {
		return sess.Write([]byte(data))
	}
	if isLocal {
		_, err := local.Write([]byte(data))
		return err
	}
	return fmt.Errorf("no such tab: %s", tabID)
}

func (a *App) ResizeTerminal(tabID string, cols, rows int) error {
	a.mu.Lock()
	sess, isSSH := a.tabs[tabID]
	local, isLocal := a.localTabs[tabID]
	a.mu.Unlock()

	if isSSH {
		return sess.Resize(cols, rows)
	}
	if isLocal {
		return local.Resize(cols, rows)
	}
	return nil
}

func (a *App) CloseTab(tabID string) error {
	a.sftpMgr.CloseTab(tabID)

	a.mu.Lock()
	sess, isSSH := a.tabs[tabID]
	delete(a.tabs, tabID)
	local, isLocal := a.localTabs[tabID]
	delete(a.localTabs, tabID)
	a.mu.Unlock()

	if isSSH {
		sess.Close()
	}
	if isLocal {
		_ = local.Close()
	}
	return nil
}

// =========================================================================
// SFTP Remote File Operations
// =========================================================================

type SFTPListResult struct {
	Path  string                 `json:"path"`
	Items []sftpmanager.SFTPItem `json:"items"`
}

func (a *App) SFTPList(tabID, remotePath string) (*SFTPListResult, error) {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return nil, fmt.Errorf("active SSH session not found for tab %s", tabID)
	}

	items, resolved, err := a.sftpMgr.List(tabID, sess.Client(), remotePath)
	if err != nil {
		return nil, err
	}
	return &SFTPListResult{
		Path:  resolved,
		Items: items,
	}, nil
}

func (a *App) SFTPDownload(tabID, remotePath, localDest string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.Download(tabID, sess.Client(), remotePath, localDest)
}

func (a *App) SFTPUpload(tabID, localSrc, remoteDest string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.Upload(tabID, sess.Client(), localSrc, remoteDest)
}

func (a *App) SFTPDelete(tabID, remotePath string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.Delete(tabID, sess.Client(), remotePath)
}

func (a *App) SFTPRename(tabID, oldPath, newPath string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.Rename(tabID, sess.Client(), oldPath, newPath)
}

func (a *App) SFTPMkdir(tabID, remotePath string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.Mkdir(tabID, sess.Client(), remotePath)
}

func (a *App) SFTPCreateFile(tabID, remotePath string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.CreateFile(tabID, sess.Client(), remotePath)
}

func (a *App) SFTPReadFile(tabID, remotePath string) (string, error) {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return "", fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.ReadFile(tabID, sess.Client(), remotePath)
}

func (a *App) SFTPWriteFile(tabID, remotePath, content string) error {
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("active SSH session not found")
	}
	return a.sftpMgr.WriteFile(tabID, sess.Client(), remotePath, content)
}

func (a *App) SelectDownloadDest(defaultName string) (string, error) {
	return wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Save Downloaded File As",
		DefaultFilename: defaultName,
	})
}

func (a *App) SelectUploadFile() (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Select File to Upload via SFTP",
	})
}

// =========================================================================
// MobaSSHTunnel Management
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
	a.mu.Lock()
	sess, ok := a.tabs[tabID]
	a.mu.Unlock()

	if !ok || sess == nil {
		return fmt.Errorf("please open an SSH connection first to bind the tunnel")
	}
	return a.tunnelMgr.StartTunnel(id, sess.Client())
}

func (a *App) StopTunnel(id string) error {
	return a.tunnelMgr.StopTunnel(id)
}

// =========================================================================
// Macro Engine
// =========================================================================

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

	a.mu.Lock()
	defer a.mu.Unlock()

	for _, tabID := range targetTabIDs {
		sess, isSSH := a.tabs[tabID]
		local, isLocal := a.localTabs[tabID]
		for _, cmd := range targetMacro.Commands {
			payload := []byte(cmd + "\r\n")
			if isSSH {
				_ = sess.Write(payload)
			} else if isLocal {
				_, _ = local.Write(payload)
			}
		}
	}
	return nil
}

// =========================================================================
// Enterprise Security Policies & Professional Customizer
// =========================================================================

func (a *App) GetSecurityPolicy() security.SecurityPolicy {
	return a.secMgr.GetPolicy()
}

func (a *App) SaveSecurityPolicy(p security.SecurityPolicy) error {
	return a.secMgr.SavePolicy(p)
}

func (a *App) GetCustomizerConfig() security.CustomizerConfig {
	return a.secMgr.GetCustomizer()
}

func (a *App) SaveCustomizerConfig(c security.CustomizerConfig) error {
	return a.secMgr.SaveCustomizer(c)
}

// =========================================================================
// Network & Sysadmin Utilities
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
// Multi-Protocol & Native RDP Session Launch
// =========================================================================

func (a *App) LaunchRDPSession(profile model.SessionProfile, password string) error {
	if profile.Host == "" {
		return fmt.Errorf("remote host is required for RDP")
	}

	// Create temporary .rdp file for launch
	tempRDP := filepath.Join(os.TempDir(), fmt.Sprintf("nexterm_%s.rdp", profile.ID))
	rdpContent := fmt.Sprintf("full address:s:%s:%d\r\nprompt for credentials:i:1\r\n", profile.Host, profile.Port)
	if profile.Username != "" {
		rdpContent += fmt.Sprintf("username:s:%s\r\n", profile.Username)
	}
	if profile.RDPDomain != "" {
		rdpContent += fmt.Sprintf("domain:s:%s\r\n", profile.RDPDomain)
	}
	if profile.RDPFullScreen {
		rdpContent += "screen mode id:i:2\r\n"
	} else if profile.RDPWidth > 0 && profile.RDPHeight > 0 {
		rdpContent += fmt.Sprintf("desktopwidth:i:%d\r\ndesktopheight:i:%d\r\nscreen mode id:i:1\r\n", profile.RDPWidth, profile.RDPHeight)
	}

	if err := os.WriteFile(tempRDP, []byte(rdpContent), 0644); err != nil {
		return fmt.Errorf("failed to generate RDP profile: %w", err)
	}

	return exec.Command("mstsc.exe", tempRDP).Start()
}

func (a *App) GetAvailableSerialPorts() []string {
	var ports []string
	for i := 1; i <= 32; i++ {
		p := fmt.Sprintf("COM%d", i)
		ports = append(ports, p)
	}
	return ports
}

func findNode(n *model.TreeNode, id string) *model.TreeNode {
	if n == nil {
		return nil
	}
	if n.ID == id {
		return n
	}
	for _, c := range n.Children {
		if found := findNode(c, id); found != nil {
			return found
		}
	}
	return nil
}

func findNodeBySessionID(n *model.TreeNode, sessionID string) *model.TreeNode {
	if n == nil {
		return nil
	}
	if n.Session != nil && n.Session.ID == sessionID {
		return n
	}
	for _, c := range n.Children {
		if found := findNodeBySessionID(c, sessionID); found != nil {
			return found
		}
	}
	return nil
}

func findParentNode(root *model.TreeNode, childID string) *model.TreeNode {
	if root == nil {
		return nil
	}
	for _, c := range root.Children {
		if c.ID == childID {
			return root
		}
		if found := findParentNode(c, childID); found != nil {
			return found
		}
	}
	return nil
}

func deleteNodeRecursive(parent *model.TreeNode, id string) bool {
	if parent == nil {
		return false
	}
	for i, c := range parent.Children {
		if c.ID == id {
			parent.Children = append(parent.Children[:i], parent.Children[i+1:]...)
			return true
		}
		if deleteNodeRecursive(c, id) {
			return true
		}
	}
	return false
}

