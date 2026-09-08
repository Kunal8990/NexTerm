package sshsession

import (
	"fmt"
	"io"
	"net"
	"os"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// Session wraps one live SSH connection + PTY. This is the "protocol
// adapter" — Telnet/RDP/VNC adapters later expose the same shape
// (Connect happens in the constructor, then Write/Resize/Close) so the frontend
// and App layer don't care which protocol is underneath.
type Session struct {
	client     *ssh.Client
	sshSess    *ssh.Session
	stdin      io.WriteCloser
	closeOnce  sync.Once
	stopChan   chan struct{}

	OnData         func(data []byte)
	OnDisconnected func(reason string)
}

type ConnectOptions struct {
	Host              string
	Port              int
	Username          string
	Password          string // empty if using a key
	PrivateKeyPEM     []byte // empty if using a password
	KeyPassphrase     string
	StartupCommand    string
	TerminalType      string
	KeepAliveInterval int // in seconds
	Cols              int
	Rows              int

	// Jump Host / Bastion Proxy Configuration
	UseJumpHost       bool
	JumpHost          string
	JumpPort          int
	JumpUsername      string
	JumpPassword      string
	JumpPrivateKeyPEM []byte
	JumpKeyPassphrase string
}

func Connect(opts ConnectOptions) (*Session, error) {
	if opts.Port <= 0 {
		opts.Port = 22
	}
	if opts.TerminalType == "" {
		opts.TerminalType = "xterm-256color"
	}
	if opts.Cols <= 0 {
		opts.Cols = 80
	}
	if opts.Rows <= 0 {
		opts.Rows = 24
	}
	if opts.KeepAliveInterval <= 0 {
		opts.KeepAliveInterval = 15
	}

	authMethods, err := buildAuthMethods(opts)
	if err != nil {
		return nil, err
	}

	config := &ssh.ClientConfig{
		User:            opts.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Accepts host keys for fast connection
		Timeout:         15 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", opts.Host, opts.Port)
	var conn net.Conn

	if opts.UseJumpHost && opts.JumpHost != "" {
		if opts.JumpPort <= 0 {
			opts.JumpPort = 22
		}
		jumpOpts := ConnectOptions{
			Host:          opts.JumpHost,
			Port:          opts.JumpPort,
			Username:      opts.JumpUsername,
			Password:      opts.JumpPassword,
			PrivateKeyPEM: opts.JumpPrivateKeyPEM,
			KeyPassphrase: opts.JumpKeyPassphrase,
		}
		jumpAuth, jErr := buildAuthMethods(jumpOpts)
		if jErr != nil {
			return nil, fmt.Errorf("bastion auth failed: %w", jErr)
		}
		jumpConfig := &ssh.ClientConfig{
			User:            opts.JumpUsername,
			Auth:            jumpAuth,
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			Timeout:         15 * time.Second,
		}
		jumpAddr := fmt.Sprintf("%s:%d", opts.JumpHost, opts.JumpPort)
		bastionDirectConn, bErr := net.DialTimeout("tcp", jumpAddr, 15*time.Second)
		if bErr != nil {
			return nil, fmt.Errorf("bastion connection failed to %s: %w", jumpAddr, bErr)
		}
		bastionSSHConn, bastionChans, bastionReqs, bErr := ssh.NewClientConn(bastionDirectConn, jumpAddr, jumpConfig)
		if bErr != nil {
			_ = bastionDirectConn.Close()
			return nil, fmt.Errorf("bastion handshake failed: %w", bErr)
		}
		bastionClient := ssh.NewClient(bastionSSHConn, bastionChans, bastionReqs)

		// Tunnel through bastion to target
		proxiedConn, pErr := bastionClient.Dial("tcp", addr)
		if pErr != nil {
			_ = bastionClient.Close()
			return nil, fmt.Errorf("bastion failed to dial target %s: %w", addr, pErr)
		}
		conn = proxiedConn
	} else {
		directConn, dErr := net.DialTimeout("tcp", addr, 15*time.Second)
		if dErr != nil {
			return nil, fmt.Errorf("connection failed to %s: %w", addr, dErr)
		}
		conn = directConn
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, addr, config)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("ssh handshake failed: %w", err)
	}
	client := ssh.NewClient(sshConn, chans, reqs)

	sshSess, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("new session: %w", err)
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sshSess.RequestPty(opts.TerminalType, opts.Rows, opts.Cols, modes); err != nil {
		_ = sshSess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("request pty: %w", err)
	}

	stdin, err := sshSess.StdinPipe()
	if err != nil {
		_ = sshSess.Close()
		_ = client.Close()
		return nil, err
	}
	stdout, err := sshSess.StdoutPipe()
	if err != nil {
		_ = sshSess.Close()
		_ = client.Close()
		return nil, err
	}
	stderr, err := sshSess.StderrPipe()
	if err != nil {
		_ = sshSess.Close()
		_ = client.Close()
		return nil, err
	}

	if err := sshSess.Shell(); err != nil {
		_ = sshSess.Close()
		_ = client.Close()
		return nil, fmt.Errorf("start shell: %w", err)
	}

	s := &Session{
		client:   client,
		sshSess:  sshSess,
		stdin:    stdin,
		stopChan: make(chan struct{}),
	}

	if opts.StartupCommand != "" {
		_, _ = stdin.Write([]byte(opts.StartupCommand + "\r\n"))
	}

	// Start reading stdout and stderr
	go s.readLoop(stdout)
	go s.readLoop(stderr)

	// Start keepalive heartbeat
	go s.keepAliveLoop(time.Duration(opts.KeepAliveInterval) * time.Second)

	return s, nil
}

func buildAuthMethods(opts ConnectOptions) ([]ssh.AuthMethod, error) {
	if len(opts.PrivateKeyPEM) > 0 {
		var signer ssh.Signer
		var err error
		if opts.KeyPassphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase(opts.PrivateKeyPEM, []byte(opts.KeyPassphrase))
		} else {
			signer, err = ssh.ParsePrivateKey(opts.PrivateKeyPEM)
		}
		if err != nil {
			return nil, fmt.Errorf("parse private key: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil
	}
	return []ssh.AuthMethod{ssh.Password(opts.Password)}, nil
}

func (s *Session) readLoop(reader io.Reader) {
	buf := make([]byte, 4096)
	for {
		n, err := reader.Read(buf)
		if n > 0 && s.OnData != nil {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			s.OnData(chunk)
		}
		if err != nil {
			select {
			case <-s.stopChan:
				return
			default:
				if s.OnDisconnected != nil {
					s.OnDisconnected(err.Error())
				}
				s.Close()
				return
			}
		}
	}
}

func (s *Session) keepAliveLoop(interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			_, _, _ = s.client.SendRequest("keepalive@openssh.com", true, nil)
		}
	}
}

// Write sends raw bytes typed/pasted in the frontend terminal straight to
// the remote shell — no local line-editing, matching real terminal behavior.
func (s *Session) Write(data []byte) error {
	_, err := s.stdin.Write(data)
	return err
}

func (s *Session) Resize(cols, rows int) error {
	if s.sshSess == nil {
		return nil
	}
	return s.sshSess.WindowChange(rows, cols)
}

func (s *Session) Close() {
	s.closeOnce.Do(func() {
		close(s.stopChan)
		if s.stdin != nil {
			_ = s.stdin.Close()
		}
		if s.sshSess != nil {
			_ = s.sshSess.Close()
		}
		if s.client != nil {
			_ = s.client.Close()
		}
	})
}

func (s *Session) Client() *ssh.Client {
	return s.client
}

// ReadPrivateKeyFile is a helper the App layer calls before Connect
// when the profile specifies a key file path instead of a password.
func ReadPrivateKeyFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}
