package vault

import (
	"path/filepath"
	"testing"
)

func createTestVault(t *testing.T, tempDir string) *Vault {
	t.Helper()
	v, err := NewVaultAt(filepath.Join(tempDir, "vault"))
	if err != nil {
		t.Skipf("skipping vault test on current platform: %v", err)
	}
	return v
}

func TestVault_BasicRoundTrip(t *testing.T) {
	tempDir := t.TempDir()
	v := createTestVault(t, tempDir)

	key := "test-session-key-123"
	secret := "P@ssw0rd!Secure#987"

	// 1. Initial Load should return false (not found)
	loaded, ok, err := v.Load(key)
	if err != nil {
		t.Fatalf("Load on nonexistent key returned error: %v", err)
	}
	if ok || loaded != "" {
		t.Fatalf("expected not found for nonexistent key, got ok=%v, loaded=%s", ok, loaded)
	}

	// 2. Save secret
	if err := v.Save(key, secret); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify disk-level encryption on Windows (no-op on macOS/Linux Keychain)
	verifyWindowsDiskEncryption(t, v, key, secret)

	// 3. Load secret and verify it matches original
	loaded, ok, err = v.Load(key)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if !ok {
		t.Fatalf("expected ok=true for saved key")
	}
	if loaded != secret {
		t.Errorf("secret mismatch: expected %q, got %q", secret, loaded)
	}

	// 4. Overwrite secret with a new one
	newSecret := "UpdatedSuperSecretKey#2026"
	if err := v.Save(key, newSecret); err != nil {
		t.Fatalf("Save update failed: %v", err)
	}
	loaded, ok, err = v.Load(key)
	if err != nil || !ok || loaded != newSecret {
		t.Fatalf("failed to load updated secret: got %q, ok=%v, err=%v", loaded, ok, err)
	}

	// 5. Delete secret
	if err := v.Delete(key); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// 6. Verify secret is gone
	loaded, ok, err = v.Load(key)
	if err != nil {
		t.Fatalf("Load after delete returned error: %v", err)
	}
	if ok || loaded != "" {
		t.Fatalf("expected secret to be deleted, but found ok=%v, loaded=%s", ok, loaded)
	}

	// 7. Redundant delete should succeed cleanly
	if err := v.Delete(key); err != nil {
		t.Fatalf("subsequent Delete failed: %v", err)
	}
}

func TestVault_EmptyKeyHandling(t *testing.T) {
	tempDir := t.TempDir()
	v := createTestVault(t, tempDir)

	// Save with empty key must return an error
	if err := v.Save("", "some-secret"); err == nil {
		t.Errorf("expected error when saving with empty key, got nil")
	}

	// Load with empty key must return ok=false, err=nil
	val, ok, err := v.Load("")
	if err != nil || ok || val != "" {
		t.Errorf("expected empty key load to return empty/false, got val=%q, ok=%v, err=%v", val, ok, err)
	}

	// Delete with empty key must succeed cleanly
	if err := v.Delete(""); err != nil {
		t.Errorf("expected empty key delete to succeed, got %v", err)
	}
}
