package protocol

import (
	"nexterm/internal/model"
	"nexterm/internal/sshsession"
	"testing"
)

func TestProtocolSessionInterfaceCompliance(t *testing.T) {
	profile := model.SessionProfile{
		ID:       "test-id",
		Name:     "Test Session",
		Host:     "127.0.0.1",
		Port:     22,
		Protocol: "ssh",
	}

	var _ ProtocolSession = NewSSHSession("s1", profile, sshsession.ConnectOptions{})
	var _ ProtocolSession = NewTelnetSession("s2", profile)
	var _ ProtocolSession = NewSerialSession("s3", profile)
	var _ ProtocolSession = NewRDPSession("s4", profile)
	var _ ProtocolSession = NewVNCSession("s5", profile)
}

func TestBaseSessionProperties(t *testing.T) {
	profile := model.SessionProfile{
		ID:       "id-123",
		Name:     "My Server",
		Host:     "192.168.1.1",
		Port:     22,
		Protocol: "ssh",
	}

	base := NewBaseSession("tab-1", "ssh", profile)
	if base.ID() != "tab-1" {
		t.Fatalf("expected ID tab-1, got %s", base.ID())
	}
	if base.Protocol() != "ssh" {
		t.Fatalf("expected Protocol ssh, got %s", base.Protocol())
	}
	if base.Profile().Name != "My Server" {
		t.Fatalf("expected Name My Server, got %s", base.Profile().Name)
	}

	if base.IsConnected() {
		t.Fatalf("expected initially disconnected")
	}

	base.SetConnected(true)
	if !base.IsConnected() {
		t.Fatalf("expected connected after SetConnected(true)")
	}

	var dataReceived []byte
	base.SetDataHandler(func(d []byte) {
		dataReceived = d
	})
	base.EmitData([]byte("hello"))
	if string(dataReceived) != "hello" {
		t.Fatalf("expected 'hello', got '%s'", string(dataReceived))
	}
}
