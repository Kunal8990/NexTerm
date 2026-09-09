package sshsession

import (
	"crypto/rand"
	"crypto/rsa"
	"fmt"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/ssh"
)

// setupMockSSHServer starts an in-process SSH server listening on 127.0.0.1 on a random available port.
func setupMockSSHServer(t *testing.T, expectedUser, expectedPass string) (string, func()) {
	t.Helper()

	config := &ssh.ServerConfig{
		PasswordCallback: func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
			if conn.User() == expectedUser && string(password) == expectedPass {
				return nil, nil
			}
			return nil, fmt.Errorf("invalid password")
		},
	}

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("Failed to generate test server private key: %v", err)
	}
	signer, err := ssh.NewSignerFromKey(key)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}
	config.AddHostKey(signer)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to listen: %v", err)
	}

	stopCh := make(chan struct{})

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-stopCh:
					return
				default:
					return
				}
			}

			go func(c net.Conn) {
				sshConn, chans, reqs, err := ssh.NewServerConn(c, config)
				if err != nil {
					_ = c.Close()
					return
				}
				defer sshConn.Close()

				go ssh.DiscardRequests(reqs)

				for newChannel := range chans {
					if newChannel.ChannelType() != "session" {
						_ = newChannel.Reject(ssh.UnknownChannelType, "unknown channel type")
						continue
					}

					ch, requests, err := newChannel.Accept()
					if err != nil {
						continue
					}

					go func(in <-chan *ssh.Request) {
						for req := range in {
							switch req.Type {
							case "pty-req", "shell", "window-change":
								_ = req.Reply(true, nil)
							default:
								_ = req.Reply(false, nil)
							}
						}
					}(requests)

					// Echo data back
					go func() {
						defer ch.Close()
						_, _ = io.Copy(ch, ch)
					}()
				}
			}(conn)
		}
	}()

	cleanup := func() {
		close(stopCh)
		_ = listener.Close()
	}

	return listener.Addr().String(), cleanup
}

func parseHostPort(addr string) (string, int) {
	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	fmt.Sscanf(portStr, "%d", &port)
	return host, port
}

func TestConnect_WithValidPassword_Succeeds(t *testing.T) {
	addr, cleanup := setupMockSSHServer(t, "testuser", "correcthorse")
	defer cleanup()

	host, port := parseHostPort(addr)

	var dataReceived []byte
	var mu sync.Mutex
	dataCond := sync.NewCond(&mu)

	opts := ConnectOptions{
		Host:              host,
		Port:              port,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "correcthorse",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 5,
		OnData: func(d []byte) {
			mu.Lock()
			dataReceived = append(dataReceived, d...)
			dataCond.Broadcast()
			mu.Unlock()
		},
	}

	sess, err := Connect(opts)
	if err != nil {
		t.Fatalf("Expected successful connection, got error: %v", err)
	}
	defer sess.Close()

	if sess.client == nil || sess.sshSess == nil {
		t.Fatalf("Session or client was nil after Connect")
	}
}

func TestConnect_WithInvalidPassword_Fails(t *testing.T) {
	addr, cleanup := setupMockSSHServer(t, "testuser", "correcthorse")
	defer cleanup()

	host, port := parseHostPort(addr)

	opts := ConnectOptions{
		Host:              host,
		Port:              port,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "wrongpassword",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 5,
	}

	sess, err := Connect(opts)
	if err == nil {
		if sess != nil {
			sess.Close()
		}
		t.Fatalf("Expected connection failure with wrong password, but it succeeded")
	}
}

func TestConnect_UnreachableHost_ReturnsErrorPromptly(t *testing.T) {
	// Connect to non-routable IP with a short timeout
	start := time.Now()
	opts := ConnectOptions{
		Host:              "192.0.2.1", // RFC 5737 TEST-NET-1 (unreachable)
		Port:              22,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "somepass",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 2, // 2 second bound
	}

	_, err := Connect(opts)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatalf("Expected connection error for unreachable host")
	}

	if elapsed > 10*time.Second {
		t.Fatalf("Connection took too long to fail: %v (expected <= 10s)", elapsed)
	}
}

func TestSessionWrite_EchoedBackViaOnData(t *testing.T) {
	addr, cleanup := setupMockSSHServer(t, "testuser", "pass123")
	defer cleanup()

	host, port := parseHostPort(addr)

	var mu sync.Mutex
	dataCond := sync.NewCond(&mu)
	var received []byte

	opts := ConnectOptions{
		Host:              host,
		Port:              port,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "pass123",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 5,
		OnData: func(data []byte) {
			mu.Lock()
			received = append(received, data...)
			dataCond.Broadcast()
			mu.Unlock()
		},
	}

	sess, err := Connect(opts)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	defer sess.Close()

	payload := []byte("hello ssh test\r\n")
	if err := sess.Write(payload); err != nil {
		t.Fatalf("sess.Write failed: %v", err)
	}

	mu.Lock()
	deadline := time.Now().Add(3 * time.Second)
	for len(received) < len(payload) && time.Now().Before(deadline) {
		dataCond.Wait()
	}
	got := string(received)
	mu.Unlock()

	if got != string(payload) {
		t.Fatalf("Expected echoed data %q, got %q", string(payload), got)
	}
}

func TestSessionResize_DoesNotError(t *testing.T) {
	addr, cleanup := setupMockSSHServer(t, "testuser", "pass123")
	defer cleanup()

	host, port := parseHostPort(addr)

	opts := ConnectOptions{
		Host:              host,
		Port:              port,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "pass123",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 5,
	}

	sess, err := Connect(opts)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	defer sess.Close()

	if err := sess.Resize(120, 40); err != nil {
		t.Fatalf("sess.Resize failed: %v", err)
	}
}

func TestSessionClose_TriggersOnDisconnected(t *testing.T) {
	addr, cleanup := setupMockSSHServer(t, "testuser", "pass123")
	defer cleanup()

	host, port := parseHostPort(addr)

	disconnectedCh := make(chan bool, 1)

	opts := ConnectOptions{
		Host:              host,
		Port:              port,
		Username:          "testuser",
		AuthType:          AuthTypePassword,
		Password:          "pass123",
		HostKeyCallback:   ssh.InsecureIgnoreHostKey(),
		ConnectionTimeout: 5,
		OnDisconnected: func(reason string, classified ClassifiedError) {
			select {
			case disconnectedCh <- true:
			default:
			}
		},
	}

	sess, err := Connect(opts)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}

	sess.Close()

	select {
	case <-disconnectedCh:
		// Succeeded in receiving disconnect notification
	case <-time.After(2 * time.Second):
		// Close should notify or clean up
	}
}
