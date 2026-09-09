package protocol

import (
	"context"
	"fmt"
	"io"
	"net"
	"nexterm/internal/model"
	"os/exec"
	"runtime"
	"sync"
	"time"
)

// VNCSession implements ProtocolSession for Virtual Network Computing (RFB) connections.
type VNCSession struct {
	*BaseSession
	conn      net.Conn
	viewerCmd *exec.Cmd
	stopChan  chan struct{}
	closeOnce sync.Once
	mu        sync.Mutex
}

// NewVNCSession constructs a new VNC protocol session.
func NewVNCSession(id string, profile model.SessionProfile) *VNCSession {
	base := NewBaseSession(id, "vnc", profile)
	return &VNCSession{
		BaseSession: base,
		stopChan:    make(chan struct{}),
	}
}

// Connect dials the VNC server, negotiates RFB handshake, and verifies connection.
func (v *VNCSession) Connect(ctx context.Context) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	p := v.Profile()
	if p.Host == "" {
		return fmt.Errorf("remote host is required for VNC")
	}

	port := p.Port
	if port <= 0 {
		port = 5900
	}

	v.EmitStateChange("connecting", fmt.Sprintf("Connecting to VNC server at %s:%d...", p.Host, port))

	addr := fmt.Sprintf("%s:%d", p.Host, port)
	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		v.SetConnected(false)
		v.EmitStateChange("failed", err.Error())
		return fmt.Errorf("vnc dial %s failed: %w", addr, err)
	}

	v.conn = conn

	// RFB Protocol Version Handshake (RFC 6143 §7.1.1)
	serverVer := make([]byte, 12)
	_, err = io.ReadFull(conn, serverVer)
	if err != nil {
		_ = conn.Close()
		v.SetConnected(false)
		v.EmitStateChange("failed", "failed to read RFB version handshake")
		return fmt.Errorf("read RFB handshake: %w", err)
	}

	// Respond with standard RFB 003.008\n
	clientVer := []byte("RFB 003.008\n")
	_, err = conn.Write(clientVer)
	if err != nil {
		_ = conn.Close()
		v.SetConnected(false)
		v.EmitStateChange("failed", "failed to send RFB version response")
		return fmt.Errorf("write RFB handshake: %w", err)
	}

	v.SetConnected(true)
	v.EmitStateChange("connected", fmt.Sprintf("VNC connected to %s (%s)", addr, string(serverVer[:11])))

	banner := fmt.Sprintf("\r\n======================================================\r\n"+
		"  Virtual Network Computing (VNC) Active\r\n"+
		"  Target: %s:%d\r\n"+
		"  Negotiated Protocol: %s"+
		"======================================================\r\n\r\n",
		p.Host, port, string(serverVer))
	v.EmitData([]byte(banner))

	// Try launching native viewer (macOS Screen Sharing, or vncviewer on PATH)
	var viewerCmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		vncURL := fmt.Sprintf("vnc://%s:%d", p.Host, port)
		if p.Username != "" {
			vncURL = fmt.Sprintf("vnc://%s@%s:%d", p.Username, p.Host, port)
		}
		viewerCmd = exec.Command("open", vncURL)
	} else if viewerPath, err := exec.LookPath("vncviewer"); err == nil {
		viewerCmd = exec.Command(viewerPath, addr)
	} else if viewerPath, err := exec.LookPath("vncviewer.exe"); err == nil {
		viewerCmd = exec.Command(viewerPath, addr)
	}

	if viewerCmd != nil {
		if err := viewerCmd.Start(); err == nil {
			v.viewerCmd = viewerCmd
			go func() {
				_ = viewerCmd.Wait()
				_ = v.Disconnect()
			}()
		}
	}

	go v.monitorLoop()

	return nil
}

func (v *VNCSession) monitorLoop() {
	buf := make([]byte, 256)
	for {
		select {
		case <-v.stopChan:
			return
		default:
		}

		// Read keepalive/status bytes
		n, err := v.conn.Read(buf)
		if err != nil {
			v.SetConnected(false)
			v.EmitDisconnect("VNC server connection terminated", err)
			_ = v.Disconnect()
			return
		}
		if n > 0 {
			// Informational notification of RFB packet
			msg := fmt.Sprintf("[VNC packet: %d bytes received]\r\n", n)
			v.EmitData([]byte(msg))
		}
	}
}

// Disconnect closes the network socket and viewer process.
func (v *VNCSession) Disconnect() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	v.closeOnce.Do(func() {
		close(v.stopChan)
		v.SetConnected(false)
		if v.viewerCmd != nil && v.viewerCmd.Process != nil {
			_ = v.viewerCmd.Process.Kill()
			v.viewerCmd = nil
		}
		if v.conn != nil {
			_ = v.conn.Close()
			v.conn = nil
		}
	})
	return nil
}

// Write transmits raw bytes.
func (v *VNCSession) Write(data []byte) error {
	v.mu.Lock()
	conn := v.conn
	v.mu.Unlock()

	if conn == nil {
		return fmt.Errorf("vnc session not connected")
	}
	_, err := conn.Write(data)
	return err
}

// Resize handles display reconfiguration.
func (v *VNCSession) Resize(cols, rows int) error {
	return nil
}
