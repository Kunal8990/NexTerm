package sshsession

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

func generateTestRSAKeyPEM(t *testing.T, bits int) []byte {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	der := x509.MarshalPKCS1PrivateKey(priv)
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: der,
	}
	return pem.EncodeToMemory(block)
}

func generateTestED25519KeyPEM(t *testing.T) []byte {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("ed25519.GenerateKey: %v", err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(priv)
	if err != nil {
		t.Fatalf("x509.MarshalPKCS8PrivateKey: %v", err)
	}
	block := &pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: der,
	}
	return pem.EncodeToMemory(block)
}

func TestPasswordAuthProvider(t *testing.T) {
	provider := &PasswordAuthProvider{Password: "secret123"}
	if provider.Type() != AuthTypePassword {
		t.Errorf("expected AuthTypePassword, got %v", provider.Type())
	}

	methods, err := provider.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods failed: %v", err)
	}
	if len(methods) != 2 {
		t.Fatalf("expected 2 methods (password + keyboard-interactive), got %d", len(methods))
	}
}

func TestPrivateKeyAuthProvider_RawBytes(t *testing.T) {
	pemBytes := generateTestRSAKeyPEM(t, 2048)

	provider := &PrivateKeyAuthProvider{
		KeyPEM: pemBytes,
	}
	if provider.Type() != AuthTypePrivateKey {
		t.Errorf("expected AuthTypePrivateKey, got %v", provider.Type())
	}

	methods, err := provider.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods failed: %v", err)
	}
	if len(methods) != 1 {
		t.Fatalf("expected 1 auth method, got %d", len(methods))
	}
}

func TestPrivateKeyAuthProvider_FileOnDisk(t *testing.T) {
	pemBytes := generateTestED25519KeyPEM(t)
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "id_ed25519")
	if err := os.WriteFile(keyPath, pemBytes, 0600); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	provider := &PrivateKeyAuthProvider{
		KeyPath: keyPath,
	}
	methods, err := provider.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods from file failed: %v", err)
	}
	if len(methods) != 1 {
		t.Fatalf("expected 1 auth method, got %d", len(methods))
	}
}

func TestPrivateKeyValidation_RSA(t *testing.T) {
	pemBytes := generateTestRSAKeyPEM(t, 2048)
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "id_rsa")
	if err := os.WriteFile(keyPath, pemBytes, 0600); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	info, err := ValidatePrivateKey(keyPath, "")
	if err != nil {
		t.Fatalf("ValidatePrivateKey returned unexpected error: %v", err)
	}
	if !info.Valid {
		t.Fatalf("expected key to be valid, got false (%s)", info.Error)
	}
	if info.KeyType != "RSA 2048-bit" {
		t.Errorf("expected KeyType 'RSA 2048-bit', got '%s'", info.KeyType)
	}
	if info.Encrypted {
		t.Errorf("expected unencrypted key, got Encrypted=true")
	}
	if info.Fingerprint == "" {
		t.Errorf("expected non-empty fingerprint")
	}
}

func TestPrivateKeyValidation_ED25519(t *testing.T) {
	pemBytes := generateTestED25519KeyPEM(t)
	info, err := InspectPrivateKeyData(pemBytes, "")
	if err != nil {
		t.Fatalf("InspectPrivateKeyData returned error: %v", err)
	}
	if !info.Valid {
		t.Fatalf("expected key to be valid, got false (%s)", info.Error)
	}
	if info.KeyType != "ED25519 (256-bit)" {
		t.Errorf("expected KeyType 'ED25519 (256-bit)', got '%s'", info.KeyType)
	}
	if info.Encrypted {
		t.Errorf("expected unencrypted key")
	}
}

func TestPrivateKeyValidation_PuTTYPPK(t *testing.T) {
	ppkContent := []byte("PuTTY-User-Key-File-2: ssh-rsa\nEncryption: none\nComment: test\n")
	info, err := InspectPrivateKeyData(ppkContent, "")
	if err == nil {
		t.Errorf("expected error for PPK key, got nil")
	}
	if info.KeyType != "PuTTY PPK" {
		t.Errorf("expected 'PuTTY PPK', got '%s'", info.KeyType)
	}
	if info.Valid {
		t.Errorf("expected Valid=false for raw PPK")
	}
}

func TestPrivateKeyValidation_EmptyOrCorrupt(t *testing.T) {
	info, err := InspectPrivateKeyData([]byte(""), "")
	if err == nil {
		t.Errorf("expected error on empty data")
	}
	if info.Valid {
		t.Errorf("expected Valid=false")
	}

	corrupt := []byte("-----BEGIN RSA PRIVATE KEY-----\ninvalid base64 content\n-----END RSA PRIVATE KEY-----")
	info, err = InspectPrivateKeyData(corrupt, "")
	if err == nil {
		t.Errorf("expected error on corrupt key")
	}
	if info.Valid {
		t.Errorf("expected Valid=false")
	}
}

func TestSSHAgentAuthProvider_MissingAgent(t *testing.T) {
	provider := &SSHAgentAuthProvider{
		CustomSocket: filepath.Join(t.TempDir(), "nonexistent.sock"),
	}
	if provider.Type() != AuthTypeAgent {
		t.Errorf("expected AuthTypeAgent")
	}

	_, err := provider.BuildAuthMethods()
	if err == nil {
		t.Errorf("expected error when connecting to nonexistent agent socket, got nil")
	}
}

func TestBuildAuthMethods_PriorityResolution(t *testing.T) {
	rsaPEM := generateTestRSAKeyPEM(t, 2048)

	// 1. Explicit key provider
	methods, err := buildAuthMethods(ConnectOptions{
		AuthType:      AuthTypePrivateKey,
		PrivateKeyPEM: rsaPEM,
		Password:      "fallbackPass",
	})
	if err != nil {
		t.Fatalf("buildAuthMethods failed: %v", err)
	}
	if len(methods) != 1 {
		t.Errorf("expected exactly 1 method for explicit key auth, got %d", len(methods))
	}

	// 2. Explicit password provider
	methods, err = buildAuthMethods(ConnectOptions{
		AuthType: AuthTypePassword,
		Password: "testPassword",
	})
	if err != nil {
		t.Fatalf("buildAuthMethods failed: %v", err)
	}
	if len(methods) != 2 { // Password + Keyboard-Interactive
		t.Errorf("expected 2 methods for password auth, got %d", len(methods))
	}

	// 3. Auto priority chain
	methods, err = buildAuthMethods(ConnectOptions{
		AuthType:      AuthTypeAuto,
		PrivateKeyPEM: rsaPEM,
		Password:      "myPass",
	})
	if err != nil {
		t.Fatalf("buildAuthMethods failed: %v", err)
	}
	// Expected: Private key (1) + Password (2) = 3 methods
	if len(methods) < 2 {
		t.Errorf("expected at least 2 methods for auto auth, got %d", len(methods))
	}
}

func TestKeyboardInteractiveAuthProvider_DynamicChallenge(t *testing.T) {
	promptCalled := false
	prov := &KeyboardInteractiveAuthProvider{
		Prompt: func(user, instruction string, questions []string, echos []bool) ([]string, error) {
			promptCalled = true
			if len(questions) != 1 || questions[0] != "Verification code: " {
				t.Errorf("unexpected questions: %v", questions)
			}
			return []string{"123456"}, nil
		},
	}

	methods, err := prov.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods failed: %v", err)
	}
	if len(methods) != 1 {
		t.Fatalf("expected 1 auth method, got %d", len(methods))
	}

	// Provoke handler
	answers, err := prov.Prompt("root", "2FA", []string{"Verification code: "}, []bool{false})
	if err != nil || len(answers) != 1 || answers[0] != "123456" || !promptCalled {
		t.Errorf("expected prompt to be called and return answers, got %v (err: %v)", answers, err)
	}
}

func TestKeyboardInteractiveAuthProvider_FallbackToPassword(t *testing.T) {
	prov := &KeyboardInteractiveAuthProvider{
		Password: "testSecretPassword",
	}

	methods, err := prov.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods failed: %v", err)
	}
	if len(methods) != 1 {
		t.Fatalf("expected 1 auth method, got %d", len(methods))
	}
}

func TestPrivateKeyWithOpenSSHCertificate(t *testing.T) {
	rsaPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	der := x509.MarshalPKCS1PrivateKey(rsaPriv)
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: der})

	signer, err := ssh.NewSignerFromKey(rsaPriv)
	if err != nil {
		t.Fatalf("NewSignerFromKey: %v", err)
	}

	// Create user certificate signed by same key (self-signed for test)
	cert := &ssh.Certificate{
		Key:             signer.PublicKey(),
		Serial:          1,
		CertType:        ssh.UserCert,
		KeyId:           "test-user-cert",
		ValidPrincipals: []string{"testuser"},
		ValidAfter:      0,
		ValidBefore:     ssh.CertTimeInfinity,
	}
	if err := cert.SignCert(rand.Reader, signer); err != nil {
		t.Fatalf("SignCert failed: %v", err)
	}

	certBytes := ssh.MarshalAuthorizedKey(cert)
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "id_rsa")
	certPath := filepath.Join(tmpDir, "id_rsa-cert.pub")

	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		t.Fatalf("WriteFile key: %v", err)
	}
	if err := os.WriteFile(certPath, certBytes, 0644); err != nil {
		t.Fatalf("WriteFile cert: %v", err)
	}

	// Test ValidatePrivateKey detects certificate
	info, err := ValidatePrivateKey(keyPath, "")
	if err != nil {
		t.Fatalf("ValidatePrivateKey: %v", err)
	}
	if !info.HasCertificate {
		t.Errorf("expected HasCertificate=true")
	}
	if info.CertificateKeyID != "test-user-cert" {
		t.Errorf("expected CertificateKeyID 'test-user-cert', got '%s'", info.CertificateKeyID)
	}

	// Test PrivateKeyAuthProvider loads certificate
	prov := &PrivateKeyAuthProvider{
		KeyPath: keyPath,
	}
	methods, err := prov.BuildAuthMethods()
	if err != nil {
		t.Fatalf("BuildAuthMethods with cert failed: %v", err)
	}
	if len(methods) != 1 {
		t.Fatalf("expected 1 method, got %d", len(methods))
	}
}
