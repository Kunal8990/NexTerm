package sshsession

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/ssh"
)

// AuthType defines supported authentication categories.
type AuthType string

const (
	AuthTypePassword            AuthType = "password"
	AuthTypePrivateKey          AuthType = "key"
	AuthTypeAgent               AuthType = "agent"
	AuthTypeKeyboardInteractive AuthType = "keyboard-interactive"
)

// AuthenticationProvider abstracts different SSH authentication strategies.
type AuthenticationProvider interface {
	Type() AuthType
	BuildAuthMethods() ([]ssh.AuthMethod, error)
}

// -------------------------------------------------------------------------
// 1. PasswordAuthProvider
// -------------------------------------------------------------------------

type PasswordAuthProvider struct {
	Password string
}

func (p *PasswordAuthProvider) Type() AuthType {
	return AuthTypePassword
}

func (p *PasswordAuthProvider) BuildAuthMethods() ([]ssh.AuthMethod, error) {
	// Provide standard password method and keyboard-interactive challenge response
	return []ssh.AuthMethod{
		ssh.Password(p.Password),
		ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) ([]string, error) {
			answers := make([]string, len(questions))
			for i := range questions {
				answers[i] = p.Password
			}
			return answers, nil
		}),
	}, nil
}

// -------------------------------------------------------------------------
// 2. PrivateKeyAuthProvider
// -------------------------------------------------------------------------

type PrivateKeyAuthProvider struct {
	KeyPath       string
	KeyPEM        []byte
	KeyPassphrase string
}

func (p *PrivateKeyAuthProvider) Type() AuthType {
	return AuthTypePrivateKey
}

func (p *PrivateKeyAuthProvider) BuildAuthMethods() ([]ssh.AuthMethod, error) {
	keyData := p.KeyPEM
	if len(keyData) == 0 && p.KeyPath != "" {
		data, err := os.ReadFile(p.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("read private key file %s: %w", p.KeyPath, err)
		}
		keyData = data
	}

	if len(keyData) == 0 {
		return nil, errors.New("private key data is empty")
	}

	var signer ssh.Signer
	var parseErr error

	if p.KeyPassphrase != "" {
		signer, parseErr = ssh.ParsePrivateKeyWithPassphrase(keyData, []byte(p.KeyPassphrase))
	} else {
		signer, parseErr = ssh.ParsePrivateKey(keyData)
	}

	if parseErr != nil {
		if errors.Is(parseErr, &ssh.PassphraseMissingError{}) ||
			strings.Contains(parseErr.Error(), "passphrase") ||
			strings.Contains(parseErr.Error(), "encrypted") {
			return nil, fmt.Errorf("private key is encrypted: passphrase required (%w)", parseErr)
		}
		return nil, fmt.Errorf("parse private key: %w", parseErr)
	}

	return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil
}

// -------------------------------------------------------------------------
// 3. SSHAgentAuthProvider
// -------------------------------------------------------------------------

type SSHAgentAuthProvider struct {
	CustomSocket string
}

func (p *SSHAgentAuthProvider) Type() AuthType {
	return AuthTypeAgent
}

func (p *SSHAgentAuthProvider) BuildAuthMethods() ([]ssh.AuthMethod, error) {
	agentClient, _, err := DialSSHAgent(p.CustomSocket)
	if err != nil {
		return nil, fmt.Errorf("ssh-agent connection error: %w", err)
	}

	signers, err := agentClient.Signers()
	if err != nil {
		return nil, fmt.Errorf("retrieve signers from ssh-agent: %w", err)
	}
	if len(signers) == 0 {
		return nil, errors.New("ssh-agent is running but has no identities loaded (add keys via ssh-add)")
	}

	return []ssh.AuthMethod{ssh.PublicKeysCallback(agentClient.Signers)}, nil
}

// CheckAgentStatus inspects whether a local SSH Agent is reachable and reports its key count.
func CheckAgentStatus() (bool, int, error) {
	agentClient, closer, err := DialSSHAgent("")
	if err != nil {
		return false, 0, err
	}
	if closer != nil {
		defer closer.Close()
	}

	signers, err := agentClient.Signers()
	if err != nil {
		return false, 0, err
	}

	return true, len(signers), nil
}

// -------------------------------------------------------------------------
// 4. KeyboardInteractiveAuthProvider
// -------------------------------------------------------------------------

type KeyboardInteractiveAuthProvider struct {
	Handler ssh.KeyboardInteractiveChallenge
}

func (p *KeyboardInteractiveAuthProvider) Type() AuthType {
	return AuthTypeKeyboardInteractive
}

func (p *KeyboardInteractiveAuthProvider) BuildAuthMethods() ([]ssh.AuthMethod, error) {
	if p.Handler == nil {
		return nil, errors.New("keyboard-interactive handler cannot be nil")
	}
	return []ssh.AuthMethod{ssh.KeyboardInteractive(p.Handler)}, nil
}
