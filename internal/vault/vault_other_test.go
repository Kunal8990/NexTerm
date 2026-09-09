//go:build !windows

package vault

import "testing"

// verifyWindowsDiskEncryption is a no-op on non-Windows platforms since credentials
// are managed directly by the OS native credential store (macOS Keychain / Linux Secret Service).
func verifyWindowsDiskEncryption(t *testing.T, v *Vault, key, secret string) {
	// No disk-level inspection needed on Keychain / Secret Service
}
