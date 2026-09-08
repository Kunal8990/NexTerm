package model

import (
	"testing"
)

func TestWorkspaceOperations(t *testing.T) {
	ws := NewWorkspace("test-ws", "Production Workspace")
	if ws.Layout != LayoutSingle {
		t.Fatalf("expected layout single, got %s", ws.Layout)
	}
	if len(ws.Panes) != 1 {
		t.Fatalf("expected 1 initial pane, got %d", len(ws.Panes))
	}

	// 1. Add tabs to primary pane
	tabA := &TabSession{ID: "tab-a", Title: "SSH Server A", IsConnected: true}
	tabB := &TabSession{ID: "tab-b", Title: "SSH Server B", IsConnected: true}
	tabC := &TabSession{ID: "tab-c", Title: "SSH Server C", IsConnected: true}

	pane1, err := ws.AddTabToPane("", tabA)
	if err != nil || pane1.ActiveTabID != "tab-a" {
		t.Fatalf("failed to add tab-a: %v", err)
	}

	// 2. Set Target Layout: 2-top-1-bot (2 Top + 1 Bottom Wide)
	err = ws.SetLayout(Layout2Top1Bot)
	if err != nil {
		t.Fatalf("SetLayout failed: %v", err)
	}

	state := ws.GetState()
	if len(state.Panes) != 3 {
		t.Fatalf("expected 3 panes for 2-top-1-bot, got %d", len(state.Panes))
	}

	// Verify grid coordinates for 2-top-1-bot
	p1 := state.Panes[0]
	p2 := state.Panes[1]
	p3 := state.Panes[2]

	if p1.Row != 1 || p1.Col != 1 || p1.RowSpan != 1 || p1.ColSpan != 1 {
		t.Fatalf("pane 1 coordinates unexpected: %+v", p1)
	}
	if p2.Row != 1 || p2.Col != 2 || p2.RowSpan != 1 || p2.ColSpan != 1 {
		t.Fatalf("pane 2 coordinates unexpected: %+v", p2)
	}
	if p3.Row != 2 || p3.Col != 1 || p3.RowSpan != 1 || p3.ColSpan != 2 {
		t.Fatalf("pane 3 (bottom wide) coordinates unexpected: %+v", p3)
	}

	// 3. Add Tab B to Pane 2, and Tab C to Pane 3
	_, err = ws.AddTabToPane(p2.ID, tabB)
	if err != nil {
		t.Fatalf("failed adding tab-b to pane 2: %v", err)
	}
	_, err = ws.AddTabToPane(p3.ID, tabC)
	if err != nil {
		t.Fatalf("failed adding tab-c to pane 3: %v", err)
	}

	// Verify tab placements
	if ws.FindPaneByTabID("tab-a").ID != p1.ID {
		t.Fatal("tab-a should be in pane 1")
	}
	if ws.FindPaneByTabID("tab-b").ID != p2.ID {
		t.Fatal("tab-b should be in pane 2")
	}
	if ws.FindPaneByTabID("tab-c").ID != p3.ID {
		t.Fatal("tab-c should be in pane 3")
	}

	// 4. Move Tab B from Pane 2 to Pane 1
	err = ws.MoveTab("tab-b", p1.ID, -1)
	if err != nil {
		t.Fatalf("MoveTab failed: %v", err)
	}
	if len(ws.Panes[0].Tabs) != 2 {
		t.Fatalf("pane 1 should now have 2 tabs, got %d", len(ws.Panes[0].Tabs))
	}

	// 5. Close Pane 2 (tabs should redistribute)
	err = ws.ClosePane(p2.ID)
	if err != nil {
		t.Fatalf("ClosePane failed: %v", err)
	}
	if len(ws.Panes) != 2 {
		t.Fatalf("expected 2 remaining panes, got %d", len(ws.Panes))
	}

	// 6. Test SplitPane
	newPane, err := ws.SplitPane(ws.Panes[0].ID, "down")
	if err != nil {
		t.Fatalf("SplitPane failed: %v", err)
	}
	if newPane == nil || len(ws.Panes) != 3 {
		t.Fatalf("expected 3 panes after split, got %d", len(ws.Panes))
	}
}
