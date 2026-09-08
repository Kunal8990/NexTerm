package store

import (
	"encoding/json"
	"os"
	"path/filepath"

	"nexterm/internal/model"

	"github.com/google/uuid"
)

// Default session folder categories as specified by user
var DefaultFolderNames = []string{
	"Production",
	"UAT",
	"Testing",
	"Local",
	"Client",
	"User",
}

// SessionStore loads/saves the saved-sessions tree to a single JSON file
// under %AppData%\Nexterm. Simple full-file rewrite on every save.
type SessionStore struct {
	filePath string
}

func NewSessionStore() (*SessionStore, error) {
	appData, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(appData, "Nexterm")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	store := &SessionStore{filePath: filepath.Join(dir, "sessions.json")}

	// Check if legacy MobaCloneGo session file exists and migrate it if new one doesn't
	if _, err := os.Stat(store.filePath); os.IsNotExist(err) {
		oldDir := filepath.Join(appData, "MobaCloneGo")
		oldFile := filepath.Join(oldDir, "sessions.json")
		if oldData, err := os.ReadFile(oldFile); err == nil {
			_ = os.WriteFile(store.filePath, oldData, 0o644)
		}
	}

	return store, nil
}

func (s *SessionStore) LoadRoot() (*model.TreeNode, error) {
	data, err := os.ReadFile(s.filePath)
	if os.IsNotExist(err) {
		root := seedDefaultTree()
		_ = s.Save(root)
		return root, nil
	}
	if err != nil {
		return nil, err
	}

	var root model.TreeNode
	if err := json.Unmarshal(data, &root); err != nil {
		root := seedDefaultTree()
		_ = s.Save(root)
		return root, nil
	}

	// Ensure standard default folders exist without losing any existing user sessions
	modified := ensureDefaultFolders(&root)
	if modified {
		_ = s.Save(&root)
	}

	return &root, nil
}

func (s *SessionStore) Save(root *model.TreeNode) error {
	data, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0o644)
}

func ensureDefaultFolders(root *model.TreeNode) bool {
	if root == nil {
		return false
	}
	if root.Children == nil {
		root.Children = make([]*model.TreeNode, 0)
	}

	// Filter out old empty generic placeholder folders if they have 0 sessions
	var cleanedChildren []*model.TreeNode
	for _, child := range root.Children {
		if child == nil {
			continue
		}
		// If it's the old empty default placeholders with no sessions, replace them cleanly
		if (child.Name == "Production Servers" || child.Name == "Development & Staging") && len(child.Children) == 0 {
			continue
		}
		cleanedChildren = append(cleanedChildren, child)
	}
	if len(cleanedChildren) != len(root.Children) {
		root.Children = cleanedChildren
	}

	existingFolders := make(map[string]bool)
	for _, child := range root.Children {
		if child != nil && child.Session == nil {
			existingFolders[child.Name] = true
		}
	}

	modified := false
	for _, name := range DefaultFolderNames {
		if !existingFolders[name] {
			root.Children = append(root.Children, &model.TreeNode{
				ID:       uuid.NewString(),
				Name:     name,
				Expanded: true,
				Children: []*model.TreeNode{},
			})
			modified = true
		}
	}
	return modified
}

func seedDefaultTree() *model.TreeNode {
	children := make([]*model.TreeNode, 0, len(DefaultFolderNames))
	for _, name := range DefaultFolderNames {
		children = append(children, &model.TreeNode{
			ID:       uuid.NewString(),
			Name:     name,
			Expanded: true,
			Children: []*model.TreeNode{},
		})
	}

	return &model.TreeNode{
		ID:       uuid.NewString(),
		Name:     "SAVED SESSIONS",
		Expanded: true,
		Children: children,
	}
}
