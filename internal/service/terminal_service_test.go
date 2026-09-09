package service

import (
	"testing"
	"time"
)

func TestTerminalServiceLifecycle(t *testing.T) {
	emitter := &testEmitter{}
	svc := NewTerminalService(nil, emitter)

	tabID, title, err := svc.OpenLocalTerminal("default", 80, 24)
	if err != nil {
		t.Fatalf("OpenLocalTerminal failed: %v", err)
	}
	if tabID == "" {
		t.Fatalf("expected non-empty tabID")
	}
	if title == "" {
		t.Fatalf("expected non-empty title")
	}

	if !svc.Has(tabID) {
		t.Fatalf("expected svc.Has(tabID) == true")
	}

	err = svc.Write(tabID, []byte("echo TEST\r\n"))
	if err != nil {
		t.Fatalf("svc.Write failed: %v", err)
	}

	err = svc.Resize(tabID, 100, 30)
	if err != nil {
		t.Fatalf("svc.Resize failed: %v", err)
	}

	svc.Broadcast([]byte("echo BROADCAST\r\n"))

	time.Sleep(150 * time.Millisecond)

	err = svc.Close(tabID)
	if err != nil {
		t.Fatalf("svc.Close failed: %v", err)
	}

	if svc.Has(tabID) {
		t.Fatalf("expected svc.Has(tabID) == false after Close")
	}
}
