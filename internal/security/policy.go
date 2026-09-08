package security

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type SecurityPolicy struct {
	AllowSSH              bool `json:"allowSSH"`
	AllowSFTP             bool `json:"allowSFTP"`
	AllowRDP              bool `json:"allowRDP"`
	AllowVNC              bool `json:"allowVNC"`
	AllowTelnet           bool `json:"allowTelnet"`
	AllowSerial           bool `json:"allowSerial"`
	AllowPasswordSaving   bool `json:"allowPasswordSaving"`
	AllowClipboardSharing bool `json:"allowClipboardSharing"`
	AllowFileTransfers    bool `json:"allowFileTransfers"`
	RequireAuditLog       bool `json:"requireAuditLog"`
}

type CustomizerConfig struct {
	AppName         string         `json:"appName"`
	CompanyName     string         `json:"companyName"`
	CompanyLogoText string         `json:"companyLogoText"`
	SplashMessage   string         `json:"splashMessage"`
	DefaultSSHPort  int            `json:"defaultSSHPort"`
	DefaultTheme    string         `json:"defaultTheme"`
	DefaultFontSize int            `json:"defaultFontSize"`
	Security        SecurityPolicy `json:"security"`
}

type SecurityManager struct {
	mu       sync.Mutex
	policy   SecurityPolicy
	custom   CustomizerConfig
	filePath string
}

func NewSecurityManager() *SecurityManager {
	appData, err := os.UserConfigDir()
	if err != nil {
		appData = "."
	}
	dir := filepath.Join(appData, "Nexterm")
	_ = os.MkdirAll(dir, 0700)

	sm := &SecurityManager{
		policy: SecurityPolicy{
			AllowSSH:              true,
			AllowSFTP:             true,
			AllowRDP:              true,
			AllowVNC:              true,
			AllowTelnet:           false,
			AllowSerial:           true,
			AllowPasswordSaving:   true,
			AllowClipboardSharing: true,
			AllowFileTransfers:    true,
			RequireAuditLog:       false,
		},
		custom: CustomizerConfig{
			AppName:         "Nexterm Professional",
			CompanyName:     "Enterprise IT",
			CompanyLogoText: "Nexterm",
			SplashMessage:   "Empowering Enterprise Infrastructure & Cloud Engineering",
			DefaultSSHPort:  22,
			DefaultTheme:    "dark-modern",
			DefaultFontSize: 13,
		},
		filePath: filepath.Join(dir, "security_policy.json"),
	}
	_ = sm.load()
	return sm
}

func (sm *SecurityManager) load() error {
	data, err := os.ReadFile(sm.filePath)
	if err != nil {
		return err
	}
	_ = os.Chmod(sm.filePath, 0600)
	var cfg struct {
		Policy SecurityPolicy   `json:"policy"`
		Custom CustomizerConfig `json:"custom"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	sm.policy = cfg.Policy
	sm.custom = cfg.Custom
	return nil
}

func (sm *SecurityManager) save() error {
	cfg := struct {
		Policy SecurityPolicy   `json:"policy"`
		Custom CustomizerConfig `json:"custom"`
	}{
		Policy: sm.policy,
		Custom: sm.custom,
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(sm.filePath, data, 0600); err != nil {
		return err
	}
	_ = os.Chmod(sm.filePath, 0600)
	return nil
}

func (sm *SecurityManager) GetPolicy() SecurityPolicy {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.policy
}

func (sm *SecurityManager) SavePolicy(p SecurityPolicy) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.policy = p
	return sm.save()
}

func (sm *SecurityManager) GetCustomizer() CustomizerConfig {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	return sm.custom
}

func (sm *SecurityManager) SaveCustomizer(c CustomizerConfig) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.custom = c
	return sm.save()
}
