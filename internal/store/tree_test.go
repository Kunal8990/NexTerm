package store

import (
	"fmt"
	"testing"

	"nexterm/internal/model"

	"github.com/google/uuid"
)

// Helper functions mirroring app.go's tree logic for isolated testing
func findNode(n *model.TreeNode, id string) *model.TreeNode {
	if n == nil {
		return nil
	}
	if n.ID == id {
		return n
	}
	for _, c := range n.Children {
		if found := findNode(c, id); found != nil {
			return found
		}
	}
	return nil
}

func findParentNode(root *model.TreeNode, childID string) *model.TreeNode {
	if root == nil {
		return nil
	}
	for _, c := range root.Children {
		if c.ID == childID {
			return root
		}
		if found := findParentNode(c, childID); found != nil {
			return found
		}
	}
	return nil
}

func isDescendantNode(ancestor, candidateChild *model.TreeNode) bool {
	if ancestor == nil || candidateChild == nil {
		return false
	}
	if ancestor.ID == candidateChild.ID {
		return true
	}
	for _, c := range ancestor.Children {
		if isDescendantNode(c, candidateChild) {
			return true
		}
	}
	return false
}

func moveNodeTest(root *model.TreeNode, sourceID, targetParentID string, targetIndex int) error {
	if sourceID == root.ID {
		return fmt.Errorf("cannot move root node")
	}
	sourceNode := findNode(root, sourceID)
	if sourceNode == nil {
		return fmt.Errorf("source node not found: %s", sourceID)
	}

	var targetParent *model.TreeNode
	if targetParentID == "" || targetParentID == root.ID {
		targetParent = root
	} else {
		targetParent = findNode(root, targetParentID)
		if targetParent == nil {
			targetParent = root
		}
	}

	if targetParent.Session != nil {
		actualParent := findParentNode(root, targetParent.ID)
		if actualParent != nil {
			targetParent = actualParent
		} else {
			targetParent = root
		}
	}

	if sourceNode.IsFolder() {
		if sourceNode.ID == targetParent.ID || isDescendantNode(sourceNode, targetParent) {
			return fmt.Errorf("cannot move folder into itself or its descendant")
		}
	}

	currentParent := findParentNode(root, sourceID)
	if currentParent == nil {
		return fmt.Errorf("current parent not found for: %s", sourceID)
	}

	currentIndex := -1
	for i, c := range currentParent.Children {
		if c.ID == sourceID {
			currentIndex = i
			break
		}
	}
	if currentIndex >= 0 {
		currentParent.Children = append(currentParent.Children[:currentIndex], currentParent.Children[currentIndex+1:]...)
	}

	if targetIndex < 0 || targetIndex >= len(targetParent.Children) {
		targetParent.Children = append(targetParent.Children, sourceNode)
	} else {
		targetParent.Children = append(targetParent.Children[:targetIndex], append([]*model.TreeNode{sourceNode}, targetParent.Children[targetIndex:]...)...)
	}
	return nil
}

func cloneFolderRecursiveTest(src *model.TreeNode) *model.TreeNode {
	if src == nil {
		return nil
	}
	clone := &model.TreeNode{
		ID:       uuid.NewString(),
		Name:     src.Name,
		Expanded: src.Expanded,
		Children: make([]*model.TreeNode, 0, len(src.Children)),
	}
	if src.Session != nil {
		profCopy := *src.Session
		profCopy.ID = uuid.NewString()
		profCopy.VaultKey = profCopy.ID
		clone.Session = &profCopy
	}
	for _, child := range src.Children {
		clonedChild := cloneFolderRecursiveTest(child)
		if clonedChild != nil {
			clone.Children = append(clone.Children, clonedChild)
		}
	}
	return clone
}

func TestTreeHierarchicalOperations(t *testing.T) {
	root := &model.TreeNode{
		ID:       "root",
		Name:     "SAVED SESSIONS",
		Expanded: true,
		Children: []*model.TreeNode{
			{
				ID:       "f_prod",
				Name:     "Production",
				Expanded: true,
				Children: []*model.TreeNode{
					{
						ID:   "s_billing",
						Name: "Billing Server",
						Session: &model.SessionProfile{
							ID:   "s_billing_id",
							Name: "Billing Server",
							Host: "192.168.1.10",
							Port: 22,
						},
					},
					{
						ID:       "f_dbs",
						Name:     "Databases",
						Expanded: true,
						Children: []*model.TreeNode{
							{
								ID:   "s_postgres",
								Name: "PostgreSQL Primary",
								Session: &model.SessionProfile{
									ID:   "s_postgres_id",
									Name: "PostgreSQL Primary",
									Host: "192.168.1.20",
									Port: 22,
								},
							},
						},
					},
				},
			},
			{
				ID:       "f_dev",
				Name:     "Development",
				Expanded: true,
				Children: []*model.TreeNode{
					{
						ID:   "s_dev_vm",
						Name: "Local VM",
						Session: &model.SessionProfile{
							ID:   "s_dev_vm_id",
							Name: "Local VM",
							Host: "127.0.0.1",
							Port: 2222,
						},
					},
				},
			},
		},
	}

	// 1. Test Node Finding
	billing := findNode(root, "s_billing")
	if billing == nil || billing.Session == nil || billing.Session.Host != "192.168.1.10" {
		t.Fatalf("expected billing node found, got %v", billing)
	}

	dbs := findNode(root, "f_dbs")
	if dbs == nil || len(dbs.Children) != 1 {
		t.Fatalf("expected databases folder found with 1 child")
	}

	// 2. Test Parent Node Finding
	parent := findParentNode(root, "s_postgres")
	if parent == nil || parent.ID != "f_dbs" {
		t.Fatalf("expected parent f_dbs, got %v", parent)
	}

	// 3. Test Renaming Node (Folder and Session)
	dbs.Name = "Database Cluster"
	if dbs.Name != "Database Cluster" {
		t.Errorf("rename folder failed")
	}
	billing.Name = "Billing Core"
	billing.Session.Name = "Billing Core"
	if billing.Name != "Billing Core" || billing.Session.Name != "Billing Core" {
		t.Errorf("rename session failed")
	}

	// 4. Test MoveNode: Reparenting session from Production to Development
	err := moveNodeTest(root, "s_billing", "f_dev", -1)
	if err != nil {
		t.Fatalf("moveNode error: %v", err)
	}
	devFolder := findNode(root, "f_dev")
	if len(devFolder.Children) != 2 || devFolder.Children[1].ID != "s_billing" {
		t.Fatalf("expected s_billing in dev folder at index 1")
	}

	// 5. Test MoveNode: Reordering within same folder (move index 1 to index 0)
	err = moveNodeTest(root, "s_billing", "f_dev", 0)
	if err != nil {
		t.Fatalf("reorder error: %v", err)
	}
	if devFolder.Children[0].ID != "s_billing" {
		t.Fatalf("expected s_billing at index 0 after reordering")
	}

	// 6. Test Cycle Detection: Cannot move Production into Databases (which is inside Production!)
	err = moveNodeTest(root, "f_prod", "f_dbs", -1)
	if err == nil {
		t.Fatalf("expected cycle error when moving parent into child, but got nil")
	}

	// 7. Test Duplicate Folder: Recursive clone
	cloned := cloneFolderRecursiveTest(devFolder)
	if cloned == nil || cloned.ID == devFolder.ID {
		t.Fatalf("clone folder failed or kept same ID")
	}
	if len(cloned.Children) != len(devFolder.Children) {
		t.Fatalf("cloned children count mismatch: expected %d, got %d", len(devFolder.Children), len(cloned.Children))
	}
	if cloned.Children[0].ID == devFolder.Children[0].ID {
		t.Fatalf("cloned child should have a unique ID")
	}
	if cloned.Children[0].Session.ID == devFolder.Children[0].Session.ID {
		t.Fatalf("cloned child session profile should have a unique ID")
	}
}
