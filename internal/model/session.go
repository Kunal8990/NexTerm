package model

// SessionProfile is one saved connection. Credentials (passwords/passphrases)
// are stored encrypted in the secure vault via VaultKey, never in plaintext.
type SessionProfile struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Host              string `json:"host"`
	Port              int    `json:"port"`
	Username          string `json:"username"`
	AuthType          string `json:"authType,omitempty"` // "password", "key", or "agent"
	VaultKey          string `json:"vaultKey,omitempty"`
	PrivateKeyPath    string `json:"privateKeyPath,omitempty"`
	KeyPassphrase     string `json:"keyPassphrase,omitempty"`
	StartupCommand    string `json:"startupCommand,omitempty"`
	TerminalType      string `json:"terminalType,omitempty"`      // e.g. "xterm-256color"
	Theme             string `json:"theme,omitempty"`             // e.g. "dark-modern", "monokai", "dracula", "nord"
	FontSize          int    `json:"fontSize,omitempty"`          // e.g. 14
	KeepAliveInterval int    `json:"keepAliveInterval,omitempty"` // in seconds, default 15

	// Protocol: "ssh", "sftp", "rdp", "vnc", "telnet", "serial", "local"
	Protocol string `json:"protocol,omitempty"`

	// Jump Host / Bastion Gateway Configuration
	UseJumpHost        bool   `json:"useJumpHost,omitempty"`
	JumpHost           string `json:"jumpHost,omitempty"`
	JumpPort           int    `json:"jumpPort,omitempty"`
	JumpUsername       string `json:"jumpUsername,omitempty"`
	JumpAuthType       string `json:"jumpAuthType,omitempty"` // "password" or "key"
	JumpVaultKey       string `json:"jumpVaultKey,omitempty"`
	JumpPrivateKeyPath string `json:"jumpPrivateKeyPath,omitempty"`

	// Serial / COM Port Configuration
	SerialPort string `json:"serialPort,omitempty"` // e.g. "COM1", "COM3"
	BaudRate   int    `json:"baudRate,omitempty"`   // e.g. 9600, 115200
	DataBits   int    `json:"dataBits,omitempty"`   // e.g. 8
	StopBits   int    `json:"stopBits,omitempty"`   // e.g. 1
	Parity     string `json:"parity,omitempty"`     // "none", "odd", "even"

	// RDP Configuration
	RDPDomain     string `json:"rdpDomain,omitempty"`
	RDPWidth      int    `json:"rdpWidth,omitempty"`
	RDPHeight     int    `json:"rdpHeight,omitempty"`
	RDPFullScreen bool   `json:"rdpFullScreen,omitempty"`
}

// TreeNode is either a folder (Children populated, Session nil) or a leaf
// (Session populated). Mirrors the tree the frontend renders in the sidebar.
type TreeNode struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Session  *SessionProfile `json:"session,omitempty"`
	Children []*TreeNode     `json:"children,omitempty"`
	Expanded bool            `json:"expanded,omitempty"`
}

func (n *TreeNode) IsFolder() bool {
	return n.Session == nil
}

