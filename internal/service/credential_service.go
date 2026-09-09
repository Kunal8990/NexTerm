package service

import (
	"context"
	"fmt"
	"nexterm/internal/model"
	"nexterm/internal/sshsession"
	"nexterm/internal/vault"
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
	mu    sync.RWMutex
	vault *vault.Vault
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
	pass, ok, err := c.vault.Load(vaultKey + "_passphrase")
	if err != nil || !ok {
		return "", nil
	}
	return pass, nil
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
