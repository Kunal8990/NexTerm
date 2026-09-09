package service

import (
	"context"
	"nexterm/internal/model"
	"nexterm/internal/protocol"
	"nexterm/internal/security"
	"testing"
)

type testEmitter struct {
	events []string
}

func (t *testEmitter) Emit(event string, optionalData ...interface{}) {
	t.events = append(t.events, event)
}

func TestSessionServiceTree(t *testing.T) {
	svc := NewSessionService(nil)
	root, err := svc.LoadRoot()
	if err != nil {
		t.Fatalf("LoadRoot failed: %v", err)
	}
	if root == nil || root.Name != "All Sessions" {
		t.Fatalf("expected root All Sessions, got %+v", root)
	}

	// Add Folder
	root, err = svc.AddFolder("", "Production")
	if err != nil {
		t.Fatalf("AddFolder failed: %v", err)
	}
	if len(root.Children) != 1 || root.Children[0].Name != "Production" {
		t.Fatalf("expected 1 folder named Production, got %+v", root.Children)
	}

	folderID := root.Children[0].ID

	// Add Session
	root, err = svc.AddSession(folderID, model.SessionProfile{
		Name:     "Web 01",
		Host:     "10.0.0.1",
		Port:     22,
		Protocol: "ssh",
	})
	if err != nil {
		t.Fatalf("AddSession failed: %v", err)
	}

	folder := svc.FindNode(folderID)
	if folder == nil || len(folder.Children) != 1 {
		t.Fatalf("expected 1 session in folder, got %+v", folder)
	}

	sessNode := folder.Children[0]
	if sessNode.Name != "Web 01" {
		t.Fatalf("expected session Web 01, got %s", sessNode.Name)
	}

	// Rename Node
	root, err = svc.RenameNode(sessNode.ID, "Web 01 Renamed")
	if err != nil {
		t.Fatalf("RenameNode failed: %v", err)
	}
	renamedNode := svc.FindNode(sessNode.ID)
	if renamedNode.Name != "Web 01 Renamed" {
		t.Fatalf("expected Web 01 Renamed, got %s", renamedNode.Name)
	}

	// Export and Import
	jsonStr, err := svc.ExportSessions()
	if err != nil {
		t.Fatalf("ExportSessions failed: %v", err)
	}
	if len(jsonStr) == 0 {
		t.Fatalf("expected non-empty json export")
	}

	svc2 := NewSessionService(nil)
	_, err = svc2.ImportSessions(jsonStr)
	if err != nil {
		t.Fatalf("ImportSessions failed: %v", err)
	}
	if svc2.GetSessionTree().Name != "All Sessions" {
		t.Fatalf("imported root mismatch")
	}
}

func TestLoggingService(t *testing.T) {
	emitter := &testEmitter{}
	logger := NewLoggingService(emitter)

	logger.LogInfo("test", "hello world")
	logger.LogWarn("test", "a warning")
	logger.LogSessionEvent("tab-1", "connect", "connected to server")

	logs := logger.GetRecentLogs(10)
	if len(logs) != 3 {
		t.Fatalf("expected 3 log entries, got %d", len(logs))
	}
	if logs[0].Message != "hello world" {
		t.Fatalf("expected first log 'hello world', got '%s'", logs[0].Message)
	}
	if len(emitter.events) != 3 {
		t.Fatalf("expected 3 emitted events, got %d", len(emitter.events))
	}

	logger.ClearLogs()
	if len(logger.GetRecentLogs(10)) != 0 {
		t.Fatalf("expected 0 logs after clear")
	}
}

func TestSettingsService(t *testing.T) {
	secMgr := security.NewSecurityManager()
	svc := NewSettingsService(secMgr)

	ws := svc.GetWorkspace()
	if ws.Layout != "single" {
		t.Fatalf("expected initial single layout, got %s", ws.Layout)
	}

	ws, err := svc.SetWorkspaceLayout("split-v")
	if err != nil {
		t.Fatalf("SetWorkspaceLayout failed: %v", err)
	}
	if ws.Layout != "split-v" {
		t.Fatalf("expected split-v, got %s", ws.Layout)
	}
}

type mockMultiSession struct {
	*protocol.BaseSession
	written []byte
}

func newMockMultiSession(id string) *mockMultiSession {
	return &mockMultiSession{
		BaseSession: protocol.NewBaseSession(id, "ssh", model.SessionProfile{Name: id}),
	}
}

func (m *mockMultiSession) Connect(ctx context.Context) error { return nil }
func (m *mockMultiSession) Disconnect() error                 { return nil }
func (m *mockMultiSession) Resize(cols, rows int) error       { return nil }
func (m *mockMultiSession) Write(data []byte) error {
	m.written = append(m.written, data...)
	return nil
}

func TestConnectionManagerExecuteMulti(t *testing.T) {
	cm := NewConnectionManager(nil, nil, nil, nil)

	s1 := newMockMultiSession("billing-01")
	s2 := newMockMultiSession("billing-02")
	s3 := newMockMultiSession("billing-03")
	s4 := newMockMultiSession("billing-04")

	cm.RegisterSession("billing-01", s1)
	cm.RegisterSession("billing-02", s2)
	cm.RegisterSession("billing-03", s3)
	cm.RegisterSession("billing-04", s4)

	// Execute command across billing-01, billing-02, billing-03 (as in user spec)
	targets := []string{"billing-01", "billing-02", "billing-03"}
	cmd := "systemctl status billing\r"

	err := cm.ExecuteMulti(targets, cmd)
	if err != nil {
		t.Fatalf("ExecuteMulti failed: %v", err)
	}

	if string(s1.written) != cmd {
		t.Fatalf("expected s1 to receive %q, got %q", cmd, string(s1.written))
	}
	if string(s2.written) != cmd {
		t.Fatalf("expected s2 to receive %q, got %q", cmd, string(s2.written))
	}
	if string(s3.written) != cmd {
		t.Fatalf("expected s3 to receive %q, got %q", cmd, string(s3.written))
	}
	if len(s4.written) != 0 {
		t.Fatalf("expected s4 not to receive command, got %q", string(s4.written))
	}
}
