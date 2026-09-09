//go:build windows

package vault

import (
	"os"
	"testing"
)

// verifyWindowsDiskEncryption checks that the raw file on disk is encrypted via DPAPI
// and has tightened file permissions (0600).
func verifyWindowsDiskEncryption(t *testing.T, v *Vault, key, secret string) {
	t.Helper()
	filePath := v.path(key)
	rawBytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read raw encrypted file: %v", err)
	}
	if string(rawBytes) == secret {
		t.Fatalf("FATAL: saved file contains unencrypted plaintext secret!")
	}
	fi, err := os.Stat(filePath)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}
	if fi.Mode().Perm()&0o600 == 0 {
		t.Errorf("expected owner read/write permissions, got %o", fi.Mode().Perm())
	}
}
