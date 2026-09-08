package sftpmanager

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOctalAndByteFormatting(t *testing.T) {
	mode, err := parseOctal("0755")
	if err != nil {
		t.Fatalf("parseOctal failed: %v", err)
	}
	if mode.Perm() != 0755 {
		t.Errorf("expected 0755, got %v", mode.Perm())
	}

	octStr := formatOctal(mode)
	if octStr != "0755" {
		t.Errorf("expected '0755', got %q", octStr)
	}

	if b := formatBytes(100, false); b != "100 B" {
		t.Errorf("expected '100 B', got %q", b)
	}
	if b := formatBytes(2048, false); b != "2.0 KB" {
		t.Errorf("expected '2.0 KB', got %q", b)
	}
	if b := formatBytes(0, true); b != "<DIR>" {
		t.Errorf("expected '<DIR>', got %q", b)
	}
}

func TestLocalFilesystemOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "nexterm_localfs_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 1. Create directory
	subDir := filepath.Join(tempDir, "test_folder")
	if err := MkdirLocal(subDir); err != nil {
		t.Fatalf("MkdirLocal failed: %v", err)
	}

	// 2. Create file
	filePath := filepath.Join(subDir, "test_file.txt")
	if err := CreateFileLocal(filePath); err != nil {
		t.Fatalf("CreateFileLocal failed: %v", err)
	}

	// 3. List
	items, cleanPath, err := ListLocal(subDir)
	if err != nil {
		t.Fatalf("ListLocal failed: %v", err)
	}
	if cleanPath != filepath.Clean(subDir) {
		t.Errorf("cleanPath mismatch")
	}
	if len(items) != 1 || items[0].Name != "test_file.txt" {
		t.Errorf("expected 1 file named test_file.txt, got %v", items)
	}

	// 4. Rename
	newFilePath := filepath.Join(subDir, "renamed_file.txt")
	if err := RenameLocal(filePath, newFilePath); err != nil {
		t.Fatalf("RenameLocal failed: %v", err)
	}

	// 5. Delete
	if err := DeleteLocal(subDir); err != nil {
		t.Fatalf("DeleteLocal failed: %v", err)
	}
	if _, err := os.Stat(subDir); !os.IsNotExist(err) {
		t.Errorf("expected folder to be deleted")
	}

	// 6. Test GetLocalDrives
	drives, err := GetLocalDrives()
	if err != nil {
		t.Fatalf("GetLocalDrives failed: %v", err)
	}
	if len(drives) == 0 {
		t.Errorf("expected at least 1 local drive")
	}
}
