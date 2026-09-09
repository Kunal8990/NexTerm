package service

import (
	"context"
	"errors"
	"nexterm/internal/model"
	"nexterm/internal/protocol"
	"strings"
	"sync"
	"testing"
	"time"
)

type mockSession struct {
	*protocol.BaseSession
	writeDelay time.Duration
	writeErr   error
	written    [][]byte
	mu         sync.Mutex
}

func newMockSession(id string) *mockSession {
	return &mockSession{
		BaseSession: protocol.NewBaseSession(id, "ssh", model.SessionProfile{ID: id, Name: id}),
	}
}

func (m *mockSession) Connect(ctx context.Context) error { return nil }
func (m *mockSession) Disconnect() error                 { return nil }
func (m *mockSession) Resize(cols, rows int) error      { return nil }

func (m *mockSession) Write(data []byte) error {
	if m.writeDelay > 0 {
		time.Sleep(m.writeDelay)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.writeErr != nil {
		return m.writeErr
	}
	copyData := make([]byte, len(data))
	copy(copyData, data)
	m.written = append(m.written, copyData)
	return nil
}

func TestBroadcast_Validation(t *testing.T) {
	cm := NewConnectionManager(nil, nil, nil, nil)

	// 1. Empty command validation
	_, err := cm.BroadcastCommandToTargets(context.Background(), "", []string{"tab-1"}, "   ", "parallel", nil, nil)
	if err == nil || !strings.Contains(err.Error(), "command cannot be empty") {
		t.Fatalf("expected command cannot be empty error, got %v", err)
	}

	// 2. Empty targets validation
	_, err = cm.BroadcastCommandToTargets(context.Background(), "", []string{}, "ls -la", "parallel", nil, nil)
	if err == nil || !strings.Contains(err.Error(), "no target sessions specified") {
		t.Fatalf("expected no target sessions specified error, got %v", err)
	}

	// 3. Unsupported mode validation
	_, err = cm.BroadcastCommandToTargets(context.Background(), "", []string{"tab-1"}, "ls -la", "invalid-mode", nil, nil)
	if err == nil || !strings.Contains(err.Error(), "unsupported execution mode") {
		t.Fatalf("expected unsupported execution mode error, got %v", err)
	}
}

func TestBroadcast_ParallelAndSequentialExecution(t *testing.T) {
	cm := NewConnectionManager(nil, nil, nil, nil)

	sess1 := newMockSession("tab-1")
	sess2 := newMockSession("tab-2")
	sess3 := newMockSession("tab-3")

	cm.RegisterSession("tab-1", sess1)
	cm.RegisterSession("tab-2", sess2)
	cm.RegisterSession("tab-3", sess3)

	// 1. Parallel execution
	resParallel, err := cm.BroadcastCommandToTargets(context.Background(), "req-par", []string{"tab-1", "tab-2"}, "uptime", "parallel", nil, nil)
	if err != nil {
		t.Fatalf("parallel broadcast failed: %v", err)
	}
	if len(resParallel.Targets) != 2 {
		t.Fatalf("expected 2 targets, got %d", len(resParallel.Targets))
	}
	for _, tr := range resParallel.Targets {
		if tr.Status != "completed" {
			t.Errorf("expected target %s to be completed, got %s", tr.TabID, tr.Status)
		}
	}

	// Verify command normalization has trailing \r
	if len(sess1.written) == 0 || string(sess1.written[0]) != "uptime\r" {
		t.Errorf("expected sess1 to receive 'uptime\\r', got %q", string(sess1.written[0]))
	}

	// 2. Sequential execution
	resSeq, err := cm.BroadcastCommandToTargets(context.Background(), "req-seq", []string{"tab-2", "tab-3"}, "df -h", "sequential", nil, nil)
	if err != nil {
		t.Fatalf("sequential broadcast failed: %v", err)
	}
	if len(resSeq.Targets) != 2 {
		t.Fatalf("expected 2 targets, got %d", len(resSeq.Targets))
	}
	for _, tr := range resSeq.Targets {
		if tr.Status != "completed" {
			t.Errorf("expected target %s to be completed in sequential, got %s", tr.TabID, tr.Status)
		}
	}
}

func TestBroadcast_PartialFailureIsolation(t *testing.T) {
	cm := NewConnectionManager(nil, nil, nil, nil)

	sessOK := newMockSession("tab-ok")
	sessErr := newMockSession("tab-err")
	sessErr.writeErr = errors.New("broken pipe")

	cm.RegisterSession("tab-ok", sessOK)
	cm.RegisterSession("tab-err", sessErr)

	// Tab-disc is not registered (disconnected)
	res, err := cm.BroadcastCommandToTargets(context.Background(), "req-fail", []string{"tab-ok", "tab-err", "tab-disc"}, "status check", "parallel", nil, nil)
	if err != nil {
		t.Fatalf("BroadcastCommandToTargets should succeed and report target-level statuses, but returned error: %v", err)
	}

	targetMap := make(map[string]BroadcastTargetResult)
	for _, tr := range res.Targets {
		targetMap[tr.TabID] = tr
	}

	if targetMap["tab-ok"].Status != "completed" {
		t.Errorf("expected tab-ok to be completed, got %s", targetMap["tab-ok"].Status)
	}
	if targetMap["tab-err"].Status != "failed" || !strings.Contains(targetMap["tab-err"].Error, "broken pipe") {
		t.Errorf("expected tab-err to fail with broken pipe, got status=%s err=%s", targetMap["tab-err"].Status, targetMap["tab-err"].Error)
	}
	if targetMap["tab-disc"].Status != "disconnected" {
		t.Errorf("expected tab-disc to be disconnected, got %s", targetMap["tab-disc"].Status)
	}
}

func TestBroadcast_Cancellation(t *testing.T) {
	cm := NewConnectionManager(nil, nil, nil, nil)

	sessSlow := newMockSession("tab-slow")
	sessSlow.writeDelay = 100 * time.Millisecond
	cm.RegisterSession("tab-slow", sessSlow)

	reqID := "req-cancel-test"
	go func() {
		time.Sleep(20 * time.Millisecond)
		_ = cm.CancelBroadcast(reqID)
	}()

	res, err := cm.BroadcastCommandToTargets(context.Background(), reqID, []string{"tab-slow"}, "sleep 10", "parallel", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.RequestID != reqID {
		t.Fatalf("request ID mismatch")
	}
}

func TestBroadcast_RedactSensitiveCommand(t *testing.T) {
	cmd1 := "systemctl restart nginx"
	if redactSensitiveCommand(cmd1) != cmd1 {
		t.Errorf("safe command was falsely redacted")
	}

	cmd2 := "mysql -u root -pPassword123"
	if !strings.Contains(redactSensitiveCommand(cmd2), "REDACTED") {
		t.Errorf("password containing command was not redacted")
	}
}
