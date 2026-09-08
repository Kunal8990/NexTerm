package sftpmanager

import (
	"golang.org/x/crypto/ssh"
)

// SFTPManager manages persistent SFTP client sessions and provides file operations.
type SFTPManager struct {
	clientMgr *ClientManager
}

// NewSFTPManager creates an SFTPManager instance.
func NewSFTPManager() *SFTPManager {
	return &SFTPManager{
		clientMgr: NewClientManager(),
	}
}

// CloseTab terminates the SFTP session for a tab.
func (m *SFTPManager) CloseTab(tabID string) {
	m.clientMgr.CloseTab(tabID)
}

// List returns all files in remotePath along with resolved working directory.
func (m *SFTPManager) List(tabID string, sshClient *ssh.Client, remotePath string) ([]SFTPItem, string, error) {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return nil, "", err
	}
	return ListRemote(client, remotePath)
}

// Download saves a remote file or folder to a local destination path.
func (m *SFTPManager) Download(tabID string, sshClient *ssh.Client, remotePath, localPath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return Download(client, remotePath, localPath)
}

// Upload transfers a local file or folder to a remote destination path.
func (m *SFTPManager) Upload(tabID string, sshClient *ssh.Client, localPath, remotePath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return Upload(client, localPath, remotePath)
}

// Delete removes a remote file or folder.
func (m *SFTPManager) Delete(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return DeleteRemote(client, remotePath)
}

// Rename changes the name or path of a remote file or folder.
func (m *SFTPManager) Rename(tabID string, sshClient *ssh.Client, oldPath, newPath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return RenameRemote(client, oldPath, newPath)
}

// Mkdir creates a directory on the remote host.
func (m *SFTPManager) Mkdir(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return MkdirRemote(client, remotePath)
}

// CreateFile creates an empty file on the remote host.
func (m *SFTPManager) CreateFile(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return CreateFileRemote(client, remotePath)
}

// ReadFile reads the full text of a remote file for inline editing.
func (m *SFTPManager) ReadFile(tabID string, sshClient *ssh.Client, remotePath string) (string, error) {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return "", err
	}
	return ReadFileRemote(client, remotePath)
}

// WriteFile overwrites a remote file with new text content.
func (m *SFTPManager) WriteFile(tabID string, sshClient *ssh.Client, remotePath, content string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return WriteFileRemote(client, remotePath, content)
}

// Stat returns metadata for a remote path.
func (m *SFTPManager) Stat(tabID string, sshClient *ssh.Client, remotePath string) (*SFTPItem, error) {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return nil, err
	}
	return StatRemote(client, remotePath)
}

// Chmod modifies permissions of a remote file or directory.
func (m *SFTPManager) Chmod(tabID string, sshClient *ssh.Client, remotePath, octalMode string) error {
	client, err := m.clientMgr.GetOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return ChmodRemote(client, remotePath, octalMode)
}
