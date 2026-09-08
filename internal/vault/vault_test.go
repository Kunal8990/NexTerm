package vault

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestVault_BasicRoundTrip(t *testing.T) {
	tempDir := t.TempDir()

	var v *Vault
	var err error

	if runtime.GOOS == "windows" {
		v, err = NewVaultAt(filepath.Join(tempDir, "vault"))
		if err != nil {
			t.Fatalf("NewVaultAt failed: %v", err)
		}
	} else {
		v, err = NewVault()
		if err != nil {
			t.Skipf("skipping on non-windows platform without secure backend: %v", err)
		}
	}

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

	// On Windows, verify that the raw saved file on disk does NOT contain plaintext secret!
	if runtime.GOOS == "windows" {
		filePath := v.path(key)
		rawBytes, err := os.ReadFile(filePath)
		if err != nil {
			t.Fatalf("failed to read raw encrypted file: %v", err)
		}
		if string(rawBytes) == secret {
			t.Fatalf("FATAL: saved file contains unencrypted plaintext secret!")
		}
		// Verify file permissions are 0600
		fi, err := os.Stat(filePath)
		if err != nil {
			t.Fatalf("Stat failed: %v", err)
		}
		if fi.Mode().Perm()&0o600 == 0 {
			t.Errorf("expected owner read/write permissions, got %o", fi.Mode().Perm())
		}
	}

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
	var v *Vault
	var err error

	if runtime.GOOS == "windows" {
		v, err = NewVaultAt(filepath.Join(tempDir, "vault"))
		if err != nil {
			t.Fatalf("NewVaultAt failed: %v", err)
		}
	} else {
		v, err = NewVault()
		if err != nil {
			t.Skipf("skipping on non-windows platform: %v", err)
		}
	}

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
