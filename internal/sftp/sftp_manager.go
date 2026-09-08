package sftpmanager

import (
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// SFTPItem represents one remote file or folder.
type SFTPItem struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	FormattedSize string `json:"formattedSize"`
	IsDir       bool   `json:"isDir"`
	ModTime     string `json:"modTime"`
	Permissions string `json:"permissions"`
	Extension   string `json:"extension"`
}

// SFTPManager manages persistent SFTP client sessions keyed by tabID.
type SFTPManager struct {
	mu      sync.Mutex
	clients map[string]*sftp.Client
}

func NewSFTPManager() *SFTPManager {
	return &SFTPManager{
		clients: make(map[string]*sftp.Client),
	}
}

func (m *SFTPManager) getOrCreate(tabID string, sshClient *ssh.Client) (*sftp.Client, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if c, ok := m.clients[tabID]; ok && c != nil {
		return c, nil
	}

	if sshClient == nil {
		return nil, fmt.Errorf("underlying SSH client is disconnected")
	}

	client, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, fmt.Errorf("failed to create SFTP subsystem: %w", err)
	}

	m.clients[tabID] = client
	return client, nil
}

func (m *SFTPManager) CloseTab(tabID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if c, ok := m.clients[tabID]; ok && c != nil {
		_ = c.Close()
		delete(m.clients, tabID)
	}
}

// List returns all files in remotePath (or current home if empty) along with resolved working directory.
func (m *SFTPManager) List(tabID string, sshClient *ssh.Client, remotePath string) ([]SFTPItem, string, error) {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return nil, "", err
	}

	if remotePath == "" || remotePath == "~" || strings.HasPrefix(remotePath, "~/") {
		wd, err := client.Getwd()
		if err != nil || wd == "" || wd == "." {
			if rp, rperr := client.RealPath("."); rperr == nil && rp != "" && rp != "." {
				wd = rp
			}
		}
		if wd != "" && wd != "." {
			if remotePath == "" || remotePath == "~" {
				remotePath = wd
			} else {
				remotePath = path.Join(wd, strings.TrimPrefix(remotePath, "~/"))
			}
		} else {
			if remotePath == "" || remotePath == "~" {
				remotePath = "/"
			} else {
				remotePath = "/" + strings.TrimPrefix(remotePath, "~/")
			}
		}
	}

	// Normalize remote path with forward slashes
	remotePath = path.Clean(remotePath)
	if !strings.HasPrefix(remotePath, "/") {
		remotePath = "/" + remotePath
	}

	entries, err := client.ReadDir(remotePath)
	if err != nil {
		return nil, remotePath, fmt.Errorf("read directory %s failed: %w", remotePath, err)
	}

	var items []SFTPItem
	for _, e := range entries {
		itemPath := path.Join(remotePath, e.Name())
		ext := strings.ToLower(filepath.Ext(e.Name()))
		items = append(items, SFTPItem{
			Name:          e.Name(),
			Path:          itemPath,
			Size:          e.Size(),
			FormattedSize: formatBytes(e.Size(), e.IsDir()),
			IsDir:         e.IsDir(),
			ModTime:       e.ModTime().Format("2006-01-02 15:04"),
			Permissions:   e.Mode().String(),
			Extension:     ext,
		})
	}

	// Sort folders first, then alphabetical
	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	return items, remotePath, nil
}

// Download saves a remote file to a local destination path.
func (m *SFTPManager) Download(tabID string, sshClient *ssh.Client, remotePath, localPath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}

	remoteFile, err := client.Open(remotePath)
	if err != nil {
		return fmt.Errorf("open remote file: %w", err)
	}
	defer remoteFile.Close()

	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return fmt.Errorf("create local dir: %w", err)
	}

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("create local file: %w", err)
	}
	defer localFile.Close()

	_, err = io.Copy(localFile, remoteFile)
	return err
}

// Upload transfers a local file to remote destination.
func (m *SFTPManager) Upload(tabID string, sshClient *ssh.Client, localPath, remotePath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}

	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("open local file: %w", err)
	}
	defer localFile.Close()

	remoteFile, err := client.Create(remotePath)
	if err != nil {
		return fmt.Errorf("create remote file: %w", err)
	}
	defer remoteFile.Close()

	_, err = io.Copy(remoteFile, localFile)
	return err
}

// Delete removes a remote file or folder.
func (m *SFTPManager) Delete(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}

	stat, err := client.Stat(remotePath)
	if err != nil {
		return err
	}

	if stat.IsDir() {
		return client.RemoveDirectory(remotePath)
	}
	return client.Remove(remotePath)
}

// Rename changes the name/path of a remote file or folder.
func (m *SFTPManager) Rename(tabID string, sshClient *ssh.Client, oldPath, newPath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return client.Rename(oldPath, newPath)
}

// Mkdir creates a new directory on the remote host.
func (m *SFTPManager) Mkdir(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	return client.Mkdir(remotePath)
}

// CreateFile creates a new empty file on the remote host.
func (m *SFTPManager) CreateFile(tabID string, sshClient *ssh.Client, remotePath string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}
	f, err := client.Create(remotePath)
	if err != nil {
		return err
	}
	return f.Close()
}

// ReadFile reads the full text of a remote file for inline viewing/editing.
func (m *SFTPManager) ReadFile(tabID string, sshClient *ssh.Client, remotePath string) (string, error) {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return "", err
	}

	file, err := client.Open(remotePath)
	if err != nil {
		return "", fmt.Errorf("open remote file: %w", err)
	}
	defer file.Close()

	// Read up to 2MB for editing
	limitReader := io.LimitReader(file, 2*1024*1024)
	data, err := io.ReadAll(limitReader)
	if err != nil {
		return "", fmt.Errorf("read remote file: %w", err)
	}

	return string(data), nil
}

// WriteFile overwrites a remote file with new text content.
func (m *SFTPManager) WriteFile(tabID string, sshClient *ssh.Client, remotePath string, content string) error {
	client, err := m.getOrCreate(tabID, sshClient)
	if err != nil {
		return err
	}

	file, err := client.Create(remotePath)
	if err != nil {
		return fmt.Errorf("create remote file: %w", err)
	}
	defer file.Close()

	_, err = file.Write([]byte(content))
	return err
}

func formatBytes(bytes int64, isDir bool) string {
	if isDir {
		return "<DIR>"
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
