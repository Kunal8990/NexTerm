package service

import (
	"context"
	"fmt"
	"nexterm/internal/model"
	"nexterm/internal/sshsession"
	"nexterm/internal/vault"
	"strings"
	"sync"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// SavedCredential represents a decrypted credential item for the UI Password Manager.
type SavedCredential struct {
	SessionID   string `json:"sessionId"`
	SessionName string `json:"sessionName"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Username    string `json:"username"`
	VaultKey    string `json:"vaultKey"`
	Password    string `json:"password"`
}

// CredentialService encapsulates DPAPI / OS Keychain credentials, key inspection, and agent checks.
type CredentialService struct {
	mu           sync.RWMutex
	vault        *vault.Vault
	treeProvider func() *model.TreeNode
}

// NewCredentialService constructs a new CredentialService.
func NewCredentialService(v *vault.Vault) *CredentialService {
	return &CredentialService{
		vault: v,
	}
}

// Vault returns the underlying vault instance.
func (c *CredentialService) Vault() *vault.Vault {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.vault
}

// SetVault assigns or updates the active Vault.
func (c *CredentialService) SetVault(v *vault.Vault) {
	c.mu.Lock()
	c.vault = v
	c.mu.Unlock()
}

// SetTreeProvider configures a callback to fetch the live session tree for cross-referencing credentials.
func (c *CredentialService) SetTreeProvider(fn func() *model.TreeNode) {
	c.mu.Lock()
	c.treeProvider = fn
	c.mu.Unlock()
}

// GetSavedPasswords returns all stored credentials decrypted for Password Management.
func (c *CredentialService) GetSavedPasswords(root *model.TreeNode) ([]SavedCredential, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var list []SavedCredential
	if c.vault == nil || root == nil {
		return list, nil
	}

	var collect func(n *model.TreeNode)
	collect = func(n *model.TreeNode) {
		if n == nil {
			return
		}
		if n.Session != nil && n.Session.VaultKey != "" {
			pwd, ok, err := c.vault.Load(n.Session.VaultKey)
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
		for _, ch := range n.Children {
			collect(ch)
		}
	}
	collect(root)
	return list, nil
}

// SaveSessionPassword stores a password encrypted in the DPAPI vault.
func (c *CredentialService) SaveSessionPassword(vaultKey, password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.vault == nil {
		return fmt.Errorf("vault is not initialized")
	}
	return c.vault.Save(vaultKey, password)
}

// HasSavedPassword returns true if a password is encrypted in the vault.
func (c *CredentialService) HasSavedPassword(vaultKey string) (bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.vault == nil || vaultKey == "" {
		return false, nil
	}
	_, ok, err := c.vault.Load(vaultKey)
	return ok, err
}

// DeleteSavedPassword removes a stored password from the DPAPI vault.
func (c *CredentialService) DeleteSavedPassword(vaultKey string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.vault == nil || vaultKey == "" {
		return nil
	}
	return c.vault.Delete(vaultKey)
}

// GetSessionPassword retrieves a stored password from the DPAPI vault for editing.
func (c *CredentialService) GetSessionPassword(vaultKey string) (string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.vault == nil || vaultKey == "" {
		return "", nil
	}
	pwd, ok, err := c.vault.Load(vaultKey)
	if err != nil || !ok {
		return "", nil
	}
	return pwd, nil
}

// GetSessionPassphrase retrieves a stored key passphrase from the vault for editing.
func (c *CredentialService) GetSessionPassphrase(vaultKey string) (string, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.vault == nil || vaultKey == "" {
		return "", nil
	}
	key := vaultKey
	if !strings.HasSuffix(key, "_passphrase") {
		key = key + "_passphrase"
	}
	pass, ok, err := c.vault.Load(key)
	if err != nil || !ok || pass == "" {
		pass, ok, err = c.vault.Load(vaultKey)
		if err != nil || !ok {
			return "", nil
		}
	}
	return pass, nil
}

// FindSessionPassword searches for a stored password by vaultKey, or falls back to
// host, port, and username matching across saved sessions and deterministic vault keys.
func (c *CredentialService) FindSessionPassword(vaultKey, host string, port int, username string) (string, error) {
	c.mu.RLock()
	treeFn := c.treeProvider
	c.mu.RUnlock()

	// 1. Direct VaultKey lookup
	if vaultKey != "" {
		if pwd, err := c.GetSessionPassword(vaultKey); err == nil && pwd != "" {
			return pwd, nil
		}
	}

	// 2. Deterministic key lookup based on server coordinates (check both dot and underscore formats)
	if host != "" && username != "" {
		p := port
		if p <= 0 {
			p = 22
		}
		cleanUser := sanitizeVaultKey(username)
		cleanHost := sanitizeVaultKey(host)
		underHost := strings.ReplaceAll(cleanHost, ".", "_")

		detKeys := []string{
			fmt.Sprintf("session_%s_%s_%d", cleanUser, cleanHost, p),
			fmt.Sprintf("session_%s_%s_%d", cleanUser, underHost, p),
			fmt.Sprintf("session_%s_%s", cleanUser, cleanHost),
			fmt.Sprintf("session_%s_%s", cleanUser, underHost),
		}
		for _, detKey := range detKeys {
			if pwd, err := c.GetSessionPassword(detKey); err == nil && pwd != "" {
				if vaultKey != "" && vaultKey != detKey {
					_ = c.SaveSessionPassword(vaultKey, pwd)
				}
				return pwd, nil
			}
		}
	}

	// 3. Search across all saved sessions in tree
	if treeFn != nil && host != "" && username != "" {
		root := treeFn()
		if root != nil {
			var foundPwd string
			var search func(n *model.TreeNode)
			search = func(n *model.TreeNode) {
				if n == nil || foundPwd != "" {
					return
				}
				if n.Session != nil {
					s := n.Session
					if strings.EqualFold(s.Host, host) && strings.EqualFold(s.Username, username) {
						if s.VaultKey != "" {
							if p, err := c.GetSessionPassword(s.VaultKey); err == nil && p != "" {
								foundPwd = p
								return
							}
						}
					}
				}
				for _, ch := range n.Children {
					search(ch)
					if foundPwd != "" {
						return
					}
				}
			}
			search(root)

			if foundPwd != "" {
				if vaultKey != "" {
					_ = c.SaveSessionPassword(vaultKey, foundPwd)
				}
				return foundPwd, nil
			}
		}
	}

	return "", nil
}

func sanitizeVaultKey(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			sb.WriteRune(r)
		} else {
			sb.WriteRune('_')
		}
	}
	return sb.String()
}

// SelectPrivateKeyFile opens a native OS file dialog to select a private key file.
func (c *CredentialService) SelectPrivateKeyFile(ctx context.Context) (string, error) {
	return wailsruntime.OpenFileDialog(ctx, wailsruntime.OpenDialogOptions{
		Title: "Select SSH Private Key",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Private Key Files (*.pem, *.key, id_*, *.id, *.pk, *.ppk)", Pattern: "*.pem;*.key;id_*;*.id;*.pk;*.ppk"},
			{DisplayName: "All Files (*.*)", Pattern: "*.*"},
		},
	})
}

// ValidatePrivateKeyFile checks a private key file and returns metadata (type, fingerprint, encryption).
func (c *CredentialService) ValidatePrivateKeyFile(path, passphrase string) (*sshsession.KeyInfo, error) {
	return sshsession.ValidatePrivateKey(path, passphrase)
}

// CheckSSHAgent returns the status of the local SSH agent (OpenSSH agent / Pageant).
func (c *CredentialService) CheckSSHAgent() (map[string]interface{}, error) {
	avail, count, err := sshsession.CheckAgentStatus()
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	return map[string]interface{}{
		"available": avail,
		"keyCount":  count,
		"error":     errMsg,
	}, nil
}
