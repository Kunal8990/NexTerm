//go:build windows

package sshsession

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strings"

	"golang.org/x/crypto/ssh/agent"
)

// DialSSHAgent connects to the SSH Agent on Windows.
// It searches in order:
// 1. Explicit custom socket/pipe path (if provided)
// 2. SSH_AUTH_SOCK environment variable
// 3. Windows OpenSSH Authentication Agent named pipe (\\.\pipe\openssh-ssh-agent)
func DialSSHAgent(customSocket string) (agent.ExtendedAgent, io.Closer, error) {
	targets := []string{}
	if customSocket != "" {
		targets = append(targets, customSocket)
	}
	if envSock := os.Getenv("SSH_AUTH_SOCK"); envSock != "" {
		targets = append(targets, envSock)
	}
	targets = append(targets, `\\.\pipe\openssh-ssh-agent`)

	var lastErr error
	for _, target := range targets {
		if strings.HasPrefix(target, `\\.\pipe\`) {
			f, err := os.OpenFile(target, os.O_RDWR, 0)
			if err == nil {
				return agent.NewClient(f), f, nil
			}
			lastErr = err
		} else {
			conn, err := net.Dial("unix", target)
			if err == nil {
				return agent.NewClient(conn), conn, nil
			}
			lastErr = err
		}
	}

	if lastErr != nil {
		return nil, nil, fmt.Errorf("ssh-agent unavailable on Windows: %w", lastErr)
	}
	return nil, nil, errors.New("ssh-agent not found (neither OpenSSH named pipe nor SSH_AUTH_SOCK accessible)")
}
