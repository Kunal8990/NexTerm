//go:build !windows

package sshsession

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"

	"golang.org/x/crypto/ssh/agent"
)

// DialSSHAgent connects to the SSH Agent on Unix/Linux/macOS via SSH_AUTH_SOCK.
func DialSSHAgent(customSocket string) (agent.ExtendedAgent, io.Closer, error) {
	sock := customSocket
	if sock == "" {
		sock = os.Getenv("SSH_AUTH_SOCK")
	}
	if sock == "" {
		return nil, nil, errors.New("SSH_AUTH_SOCK environment variable not set")
	}
	conn, err := net.Dial("unix", sock)
	if err != nil {
		return nil, nil, fmt.Errorf("connect to ssh-agent socket %s: %w", sock, err)
	}
	return agent.NewClient(conn), conn, nil
}
