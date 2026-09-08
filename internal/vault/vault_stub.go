//go:build !windows

package vault

import (
	"encoding/base64"
	"os"
	"path/filepath"
)

// Vault stub for non-Windows dev machines so `go build`/`go vet` work while
// editing away from Windows. This is NOT secure (base64 is not encryption) —
// the real implementation is vault_windows.go, used automatically when
// GOOS=windows. Never ship this stub.
type Vault struct {
	dir string
}

func NewVault() (*Vault, error) {
	dir := filepath.Join(os.TempDir(), "Nexterm-vault-devonly")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &Vault{dir: dir}, nil
}

func (v *Vault) path(key string) string { return filepath.Join(v.dir, key+".txt") }

func (v *Vault) Save(key, secret string) error {
	return os.WriteFile(v.path(key), []byte(base64.StdEncoding.EncodeToString([]byte(secret))), 0o600)
}

func (v *Vault) Load(key string) (string, bool, error) {
	data, err := os.ReadFile(v.path(key))
	if os.IsNotExist(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	plain, err := base64.StdEncoding.DecodeString(string(data))
	if err != nil {
		return "", false, err
	}
	return string(plain), true, nil
}

func (v *Vault) Delete(key string) error {
	err := os.Remove(v.path(key))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
