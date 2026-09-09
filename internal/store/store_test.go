package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"

	"nexterm/internal/model"

	"github.com/google/uuid"
)

func TestSaveThenLoadRoot_RoundTrips(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sessions.json")

	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("failed to create session store: %v", err)
	}

	sessionID := uuid.NewString()
	initialRoot := &model.TreeNode{
		ID:       "root-1",
		Name:     "SAVED SESSIONS",
		Expanded: true,
		Children: []*model.TreeNode{
			{
				ID:       "folder-prod",
				Name:     "Production",
				Expanded: true,
				Children: []*model.TreeNode{
					{
						ID:   "node-session-1",
						Name: "Web Server 01",
						Session: &model.SessionProfile{
							ID:       sessionID,
							Name:     "Web Server 01",
							Host:     "10.0.0.1",
							Port:     22,
							Username: "admin",
							VaultKey: sessionID,
						},
					},
				},
			},
		},
	}

	if err := store.Save(initialRoot); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify temp file does not remain on disk
	tmpPath := filePath + ".tmp"
	if _, err := os.Stat(tmpPath); !os.IsNotExist(err) {
		t.Fatalf("expected tmp file %s to be cleaned up or renamed", tmpPath)
	}

	// Verify target file exists
	if _, err := os.Stat(filePath); err != nil {
		t.Fatalf("target sessions.json does not exist: %v", err)
	}

	// Load and verify
	loadedRoot, err := store.LoadRoot()
	if err != nil {
		t.Fatalf("LoadRoot failed: %v", err)
	}
	if loadedRoot == nil {
		t.Fatalf("loadedRoot is nil")
	}
	if loadedRoot.ID != "root-1" {
		t.Errorf("expected root ID 'root-1', got '%s'", loadedRoot.ID)
	}

	// Find child session
	var foundSession *model.TreeNode
	for _, child := range loadedRoot.Children {
		if child.Name == "Production" {
			for _, sub := range child.Children {
				if sub.Name == "Web Server 01" {
					foundSession = sub
					break
				}
			}
		}
	}
	if foundSession == nil || foundSession.Session == nil {
		t.Fatalf("expected 'Web Server 01' session inside 'Production' folder")
	}
	if foundSession.Session.Host != "10.0.0.1" {
		t.Errorf("expected host 10.0.0.1, got %s", foundSession.Session.Host)
	}
}

func TestTransactionalSave_VersionEnvelope(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sessions.json")

	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("failed to create session store: %v", err)
	}

	root := seedDefaultTree()
	if err := store.Save(root); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Inspect raw file contents on disk
	rawBytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read raw saved file: %v", err)
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(rawBytes, &rawMap); err != nil {
		t.Fatalf("saved file is not valid JSON: %v", err)
	}

	// Check version and root keys exist
	versionVal, hasVersion := rawMap["version"]
	if !hasVersion {
		t.Fatalf("expected 'version' key in saved JSON envelope, got %s", string(rawBytes))
	}
	if versionNum, ok := versionVal.(float64); !ok || int(versionNum) != CurrentStoreVersion {
		t.Errorf("expected version %d, got %v", CurrentStoreVersion, versionVal)
	}

	rootVal, hasRoot := rawMap["root"]
	if !hasRoot || rootVal == nil {
		t.Fatalf("expected 'root' key in saved JSON envelope")
	}

	// Ensure no .tmp file left behind
	if _, err := os.Stat(filePath + ".tmp"); !os.IsNotExist(err) {
		t.Errorf("tmp file was not cleaned up")
	}
}

func TestStore_BackwardCompatibility_LegacyFormat(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sessions.json")

	// Write legacy format directly without version/root envelope
	legacyRoot := &model.TreeNode{
		ID:       "legacy-root-999",
		Name:     "SAVED SESSIONS",
		Expanded: true,
		Children: []*model.TreeNode{
			{
				ID:       "legacy-folder-1",
				Name:     "Testing",
				Expanded: true,
				Children: []*model.TreeNode{
					{
						ID:   "legacy-sess-1",
						Name: "Old Server",
						Session: &model.SessionProfile{
							ID:   "sess-id-999",
							Name: "Old Server",
							Host: "172.16.0.5",
							Port: 22,
						},
					},
				},
			},
		},
	}

	rawLegacyJSON, err := json.MarshalIndent(legacyRoot, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal legacy json: %v", err)
	}
	if err := os.WriteFile(filePath, rawLegacyJSON, 0o644); err != nil {
		t.Fatalf("failed to write legacy file: %v", err)
	}

	// Now load with store
	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	loadedRoot, err := store.LoadRoot()
	if err != nil {
		t.Fatalf("failed to load legacy root: %v", err)
	}
	if loadedRoot.ID != "legacy-root-999" {
		t.Errorf("expected ID 'legacy-root-999', got '%s'", loadedRoot.ID)
	}

	// Verify legacy session was retained
	found := false
	for _, child := range loadedRoot.Children {
		for _, sub := range child.Children {
			if sub.Session != nil && sub.Session.Host == "172.16.0.5" {
				found = true
				break
			}
		}
	}
	if !found {
		t.Fatalf("legacy session was not retained during migration")
	}

	// Verify file on disk has been migrated to versioned format
	migratedBytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read migrated file: %v", err)
	}
	var migratedMap map[string]interface{}
	if err := json.Unmarshal(migratedBytes, &migratedMap); err != nil {
		t.Fatalf("migrated file is invalid JSON: %v", err)
	}
	if migratedMap["version"] == nil || int(migratedMap["version"].(float64)) != CurrentStoreVersion {
		t.Errorf("expected file to be migrated to version %d, got %v", CurrentStoreVersion, migratedMap["version"])
	}
}

func TestStore_CorruptedFileFallback(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sessions.json")

	// Write completely broken data (simulating crash or truncation)
	corruptData := []byte(`{"version": 1, "root": {"id": "truncated...`)
	if err := os.WriteFile(filePath, corruptData, 0o644); err != nil {
		t.Fatalf("failed to write corrupt file: %v", err)
	}

	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	// LoadRoot should recover gracefully without panic or error
	root, err := store.LoadRoot()
	if err != nil {
		t.Fatalf("LoadRoot returned unexpected error on corrupt file: %v", err)
	}
	if root == nil || len(root.Children) == 0 {
		t.Fatalf("expected recovered default tree with children")
	}

	// Verify the file was restored to valid JSON
	validBytes, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("failed to read restored file: %v", err)
	}
	var env PersistedSessions
	if err := json.Unmarshal(validBytes, &env); err != nil {
		t.Fatalf("restored file was not valid PersistedSessions JSON: %v", err)
	}
	if env.Version != CurrentStoreVersion {
		t.Errorf("expected restored version %d, got %d", CurrentStoreVersion, env.Version)
	}
}

func TestStore_ConcurrentSaves(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "sessions.json")

	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	root := seedDefaultTree()
	var wg sync.WaitGroup
	errCh := make(chan error, 20)

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			copyRoot := *root
			copyRoot.Name = "Concurrent Test"
			if err := store.Save(&copyRoot); err != nil {
				errCh <- err
			}
			_, _ = store.LoadRoot()
		}(i)
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Fatalf("concurrent store operation failed: %v", err)
	}

	// Final check that file on disk is valid
	finalRoot, err := store.LoadRoot()
	if err != nil {
		t.Fatalf("final LoadRoot failed: %v", err)
	}
	if finalRoot == nil {
		t.Fatalf("final root is nil")
	}
}

func TestStore_DirectoryCreation(t *testing.T) {
	tempDir := t.TempDir()
	nestedPath := filepath.Join(tempDir, "subdir1", "subdir2", "sessions.json")

	store, err := NewSessionStoreAt(nestedPath)
	if err != nil {
		t.Fatalf("NewSessionStoreAt failed to create nested directory: %v", err)
	}

	root := seedDefaultTree()
	if err := store.Save(root); err != nil {
		t.Fatalf("Save to nested directory failed: %v", err)
	}

	if _, err := os.Stat(nestedPath); err != nil {
		t.Fatalf("nested file does not exist: %v", err)
	}
}

func TestStore_TightenedFilePermissions(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "secure_dir", "sessions.json")

	store, err := NewSessionStoreAt(filePath)
	if err != nil {
		t.Fatalf("NewSessionStoreAt failed: %v", err)
	}

	root := seedDefaultTree()
	if err := store.Save(root); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	fi, err := os.Stat(filePath)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	// On POSIX systems, verify mode is 0600 and dir is 0700
	if runtime.GOOS != "windows" {
		if fi.Mode().Perm() != 0o600 {
			t.Errorf("expected file mode 0600, got %o", fi.Mode().Perm())
		}
		dirFi, err := os.Stat(filepath.Dir(filePath))
		if err != nil {
			t.Fatalf("dir Stat failed: %v", err)
		}
		if dirFi.Mode().Perm() != 0o700 {
			t.Errorf("expected dir mode 0700, got %o", dirFi.Mode().Perm())
		}
	} else {
		// On Windows, verify file is writable and readable by owner
		if fi.Mode().Perm()&0o600 == 0 {
			t.Errorf("expected owner read/write permissions on Windows, got %o", fi.Mode().Perm())
		}
	}

	// Verify existing file permissions are tightened upon LoadRoot
	if err := os.Chmod(filePath, 0o644); err == nil {
		_, err = store.LoadRoot()
		if err != nil {
			t.Fatalf("LoadRoot failed: %v", err)
		}
		if runtime.GOOS != "windows" {
			newFi, err := os.Stat(filePath)
			if err != nil {
				t.Fatalf("Stat failed after LoadRoot: %v", err)
			}
			if newFi.Mode().Perm() != 0o600 {
				t.Errorf("expected file mode to be tightened to 0600 after LoadRoot, got %o", newFi.Mode().Perm())
			}
		}
	}
}

func TestStore_SeedDefaultEnvironmentFolders(t *testing.T) {
	root := seedDefaultTree()
	if root == nil {
		t.Fatalf("expected seedDefaultTree to return non-nil root")
	}

	expected := []string{"Production", "UAT", "Testing", "Local", "Client", "User"}
	if len(root.Children) != len(expected) {
		t.Fatalf("expected %d default folders, got %d", len(expected), len(root.Children))
	}

	seenIDs := make(map[string]bool)
	for i, exp := range expected {
		child := root.Children[i]
		if child.Name != exp {
			t.Errorf("folder index %d mismatch: expected %q, got %q", i, exp, child.Name)
		}
		if child.Session != nil {
			t.Errorf("default folder %q should not be a session node", child.Name)
		}
		if seenIDs[child.ID] {
			t.Errorf("duplicate folder ID detected: %s", child.ID)
		}
		seenIDs[child.ID] = true
	}
}

