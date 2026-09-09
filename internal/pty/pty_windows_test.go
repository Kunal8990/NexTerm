//go:build windows

package pty

import (
	"testing"
	"time"
)

func TestWindowsPTYStart(t *testing.T) {
	term, err := Start("cmd.exe", 80, 24)
	if err != nil {
		t.Fatalf("pty.Start failed: %v", err)
	}
	defer term.Close()

	if term.Pid() <= 0 {
		t.Errorf("expected positive pid, got %d", term.Pid())
	}

	// Read initial banner
	buf := make([]byte, 1024)
	n, err := term.Read(buf)
	if err != nil {
		t.Fatalf("term.Read failed: %v", err)
	}
	if n == 0 {
		t.Fatalf("expected read > 0 bytes")
	}

	// Write command
	_, err = term.Write([]byte("echo PTY_TEST_OK\r\n"))
	if err != nil {
		t.Fatalf("term.Write failed: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
	_ = term.Resize(100, 30)
}
