package sftpmanager

import (
	"fmt"
	"sync"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// ClientManager handles caching and lifecycle of SFTP client sessions linked to SSH connections.
type ClientManager struct {
	mu      sync.Mutex
	clients map[string]*sftp.Client
}

// NewClientManager initializes an empty ClientManager.
func NewClientManager() *ClientManager {
	return &ClientManager{
		clients: make(map[string]*sftp.Client),
	}
}

// GetOrCreate returns an existing SFTP client for the given tabID or creates a new one via the SSH client.
func (cm *ClientManager) GetOrCreate(tabID string, sshClient *ssh.Client) (*sftp.Client, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if c, ok := cm.clients[tabID]; ok && c != nil {
		return c, nil
	}

	if sshClient == nil {
		return nil, fmt.Errorf("underlying SSH client is disconnected")
	}

	client, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create SFTP subsystem: %w", err)
	}

	cm.clients[tabID] = client
	return client, nil
}

// Get retrieves an existing SFTP client for the given tabID if present.
func (cm *ClientManager) Get(tabID string) (*sftp.Client, bool) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	c, ok := cm.clients[tabID]
	return c, ok && c != nil
}

// CloseTab terminates and removes the SFTP client associated with the given tabID.
func (cm *ClientManager) CloseTab(tabID string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if c, ok := cm.clients[tabID]; ok && c != nil {
		_ = c.Close()
		delete(cm.clients, tabID)
	}
}

// CloseAll terminates all active SFTP sessions.
func (cm *ClientManager) CloseAll() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	for tabID, c := range cm.clients {
		if c != nil {
			_ = c.Close()
		}
		delete(cm.clients, tabID)
	}
}
