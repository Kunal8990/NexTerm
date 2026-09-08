package hostkey

import (
	"crypto/ed25519"
	"crypto/rand"
	"net"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

func generateTestSSHKey(t *testing.T) ssh.PublicKey {
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519 key: %v", err)
	}
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatalf("failed to create ssh public key: %v", err)
	}
	return sshPub
}

func TestHostKeyManager(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nexterm_knownhosts_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	appHosts := filepath.Join(tempDir, "known_hosts")
	mgr := NewManager(appHosts, "")

	key1 := generateTestSSHKey(t)
	key2 := generateTestSSHKey(t)

	hostname := "testserver.local:22"
	dummyAddr, _ := net.ResolveTCPAddr("tcp", "192.168.1.50:22")

	// 1. Initial check: should be unknown
	res, err := mgr.Check(hostname, dummyAddr, key1)
	if err != nil {
		t.Fatalf("check failed: %v", err)
	}
	if res.Status != StatusUnknown {
		t.Errorf("expected StatusUnknown, got %v", res.Status)
	}
	if res.FingerprintSHA256 != ssh.FingerprintSHA256(key1) {
		t.Errorf("fingerprint mismatch")
	}

	// 2. Add key1
	if err := mgr.Add(hostname, dummyAddr, key1); err != nil {
		t.Fatalf("failed to add host key: %v", err)
	}

	// 3. Check key1 again: should now be trusted
	res2, err := mgr.Check(hostname, dummyAddr, key1)
	if err != nil {
		t.Fatalf("check 2 failed: %v", err)
	}
	if res2.Status != StatusTrusted {
		t.Errorf("expected StatusTrusted, got %v", res2.Status)
	}

	// 4. Check key2 for same host: should detect mismatch!
	res3, err := mgr.Check(hostname, dummyAddr, key2)
	if err != nil {
		t.Fatalf("check 3 failed: %v", err)
	}
	if res3.Status != StatusMismatch {
		t.Errorf("expected StatusMismatch, got %v", res3.Status)
	}
	if res3.OldFingerprintSHA != ssh.FingerprintSHA256(key1) {
		t.Errorf("expected OldFingerprintSHA %s, got %s", ssh.FingerprintSHA256(key1), res3.OldFingerprintSHA)
	}

	// 5. Test List()
	list, err := mgr.List()
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(list) == 0 {
		t.Errorf("expected at least 1 entry in list")
	}

	// 6. Test Replace key with key2
	if err := mgr.Replace(hostname, dummyAddr, key2); err != nil {
		t.Fatalf("replace failed: %v", err)
	}
	res4, err := mgr.Check(hostname, dummyAddr, key2)
	if err != nil {
		t.Fatalf("check 4 failed: %v", err)
	}
	if res4.Status != StatusTrusted {
		t.Errorf("expected StatusTrusted after replace, got %v", res4.Status)
	}

	// 7. Test Remove
	if err := mgr.Remove("testserver.local", 22); err != nil {
		t.Fatalf("remove failed: %v", err)
	}
	res5, err := mgr.Check(hostname, dummyAddr, key2)
	if err != nil {
		t.Fatalf("check 5 failed: %v", err)
	}
	if res5.Status != StatusUnknown {
		t.Errorf("expected StatusUnknown after remove, got %v", res5.Status)
	}
}
