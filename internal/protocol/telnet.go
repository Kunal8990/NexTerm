package protocol

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"nexterm/internal/model"
	"sync"
	"time"
)

const (
	// Telnet command bytes (RFC 854)
	iac  byte = 255
	dont byte = 254
	do   byte = 253
	wont byte = 252
	will byte = 251
	sb   byte = 250
	se   byte = 240

	// Telnet options
	optEcho             byte = 1
	optSuppressGoAhead  byte = 3
	optTerminalType     byte = 24
	optNAWS             byte = 31 // RFC 1073: Negotiate About Window Size
)

// TelnetSession implements ProtocolSession for unencrypted Telnet connections.
type TelnetSession struct {
	*BaseSession
	conn        net.Conn
	stopChan    chan struct{}
	closeOnce   sync.Once
	cols        int
	rows        int
	termType    string
	nawsEnabled bool
	mu          sync.Mutex
}

// NewTelnetSession constructs a new Telnet protocol session.
func NewTelnetSession(id string, profile model.SessionProfile) *TelnetSession {
	base := NewBaseSession(id, "telnet", profile)
	cols := profile.Cols
	if cols <= 0 {
		cols = 80
	}
	rows := profile.Rows
	if rows <= 0 {
		rows = 24
	}
	termType := profile.TerminalType
	if termType == "" {
		termType = "xterm-256color"
	}

	return &TelnetSession{
		BaseSession: base,
		cols:        cols,
		rows:        rows,
		termType:    termType,
		stopChan:    make(chan struct{}),
	}
}

// Connect dials the telnet server over TCP and starts reading.
func (t *TelnetSession) Connect(ctx context.Context) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	host := t.Profile().Host
	port := t.Profile().Port
	if port <= 0 {
		port = 23
	}

	t.EmitStateChange("connecting", fmt.Sprintf("Connecting to %s:%d via Telnet...", host, port))

	addr := fmt.Sprintf("%s:%d", host, port)
	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		t.SetConnected(false)
		t.EmitStateChange("failed", err.Error())
		return fmt.Errorf("telnet dial %s failed: %w", addr, err)
	}

	t.conn = conn
	t.SetConnected(true)
	t.EmitStateChange("connected", "Telnet connection established")

	// Proactively offer NAWS and Terminal Type
	t.sendTelnetCmd(will, optNAWS)
	t.sendTelnetCmd(will, optTerminalType)
	t.sendTelnetCmd(do, optSuppressGoAhead)

	go t.readLoop()

	return nil
}

func (t *TelnetSession) sendTelnetCmd(action, opt byte) {
	if t.conn == nil {
		return
	}
	_, _ = t.conn.Write([]byte{iac, action, opt})
}

func (t *TelnetSession) sendNAWS(cols, rows int) {
	if t.conn == nil {
		return
	}
	buf := []byte{
		iac, sb, optNAWS,
		byte(cols >> 8), byte(cols & 0xff),
		byte(rows >> 8), byte(rows & 0xff),
		iac, se,
	}
	_, _ = t.conn.Write(buf)
}

func (t *TelnetSession) readLoop() {
	buf := make([]byte, 4096)
	var stateBuffer []byte

	for {
		select {
		case <-t.stopChan:
			return
		default:
		}

		n, err := t.conn.Read(buf)
		if err != nil {
			t.SetConnected(false)
			if err != io.EOF {
				t.EmitDisconnect("Connection reset by peer", err)
			} else {
				t.EmitDisconnect("Server closed telnet connection", nil)
			}
			_ = t.Disconnect()
			return
		}

		if n > 0 {
			stateBuffer = append(stateBuffer, buf[:n]...)
			cleaned := t.processTelnetBytes(&stateBuffer)
			if len(cleaned) > 0 {
				t.EmitData(cleaned)
			}
		}
	}
}

// processTelnetBytes handles Telnet command escapes (IAC) and returns pure terminal data.
func (t *TelnetSession) processTelnetBytes(buf *[]byte) []byte {
	var clean bytes.Buffer
	data := *buf
	i := 0

	for i < len(data) {
		if data[i] == iac {
			if i+1 >= len(data) {
				// Incomplete command, keep in buffer
				break
			}
			cmd := data[i+1]
			if cmd == iac {
				// Escaped IAC byte 255
				clean.WriteByte(iac)
				i += 2
				continue
			}

			if cmd == will || cmd == wont || cmd == do || cmd == dont {
				if i+2 >= len(data) {
					break
				}
				opt := data[i+2]
				t.handleNegotiation(cmd, opt)
				i += 3
				continue
			}

			if cmd == sb {
				// Subnegotiation: look for IAC SE
				seIdx := -1
				for j := i + 2; j < len(data)-1; j++ {
					if data[j] == iac && data[j+1] == se {
						seIdx = j + 1
						break
					}
				}
				if seIdx == -1 {
					// Incomplete subnegotiation
					break
				}
				t.handleSubnegotiation(data[i+2 : seIdx-1])
				i = seIdx + 1
				continue
			}

			// Other 2-byte commands
			i += 2
			continue
		}

		clean.WriteByte(data[i])
		i++
	}

	*buf = (*buf)[i:]
	return clean.Bytes()
}

func (t *TelnetSession) handleNegotiation(cmd, opt byte) {
	switch cmd {
	case do:
		switch opt {
		case optNAWS:
			t.nawsEnabled = true
			t.sendTelnetCmd(will, optNAWS)
			t.sendNAWS(t.cols, t.rows)
		case optTerminalType:
			t.sendTelnetCmd(will, optTerminalType)
		case optEcho:
			t.sendTelnetCmd(will, optEcho)
		case optSuppressGoAhead:
			t.sendTelnetCmd(will, optSuppressGoAhead)
		default:
			t.sendTelnetCmd(wont, opt)
		}
	case dont:
		t.sendTelnetCmd(wont, opt)
	case will:
		switch opt {
		case optEcho, optSuppressGoAhead:
			t.sendTelnetCmd(do, opt)
		default:
			t.sendTelnetCmd(dont, opt)
		}
	case wont:
		t.sendTelnetCmd(dont, opt)
	}
}

func (t *TelnetSession) handleSubnegotiation(sub []byte) {
	if len(sub) == 0 {
		return
	}
	opt := sub[0]
	if opt == optTerminalType && len(sub) > 1 && sub[1] == 1 { // SEND
		// Reply with IS <termType>
		resp := []byte{iac, sb, optTerminalType, 0}
		resp = append(resp, []byte(t.termType)...)
		resp = append(resp, iac, se)
		if t.conn != nil {
			_, _ = t.conn.Write(resp)
		}
	}
}

// Disconnect shuts down the telnet connection.
func (t *TelnetSession) Disconnect() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.closeOnce.Do(func() {
		close(t.stopChan)
		t.SetConnected(false)
		if t.conn != nil {
			_ = t.conn.Close()
			t.conn = nil
		}
	})
	return nil
}

// Write sends raw terminal keystrokes/input to the telnet connection.
func (t *TelnetSession) Write(data []byte) error {
	t.mu.Lock()
	conn := t.conn
	t.mu.Unlock()

	if conn == nil {
		return fmt.Errorf("telnet session not connected")
	}

	// Escape IAC bytes
	var escaped bytes.Buffer
	for _, b := range data {
		if b == iac {
			escaped.WriteByte(iac)
			escaped.WriteByte(iac)
		} else {
			escaped.WriteByte(b)
		}
	}

	_, err := conn.Write(escaped.Bytes())
	return err
}

// Resize notifies the remote server of window size changes via NAWS.
func (t *TelnetSession) Resize(cols, rows int) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.cols = cols
	t.rows = rows
	if t.nawsEnabled && t.conn != nil {
		t.sendNAWS(cols, rows)
	}
	return nil
}
