package macro

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Macro struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Commands    []string `json:"commands"`
	DelayMs     int      `json:"delayMs"`
	Category    string   `json:"category"`
}

type MacroManager struct {
	mu       sync.Mutex
	macros   map[string]Macro
	filePath string
}

func NewMacroManager() *MacroManager {
	appData, err := os.UserConfigDir()
	if err != nil {
		appData = "."
	}
	dir := filepath.Join(appData, "Nexterm")
	_ = os.MkdirAll(dir, 0755)

	mm := &MacroManager{
		macros:   make(map[string]Macro),
		filePath: filepath.Join(dir, "macros.json"),
	}
	_ = mm.load()
	if len(mm.macros) == 0 {
		mm.seedDefaults()
	}
	return mm
}

func (mm *MacroManager) seedDefaults() {
	defaults := []Macro{
		{
			ID:          "m-sys-check",
			Name:        "System Health & Resources",
			Description: "Check uptime, CPU load, free memory, and disk space",
			Commands:    []string{"uptime", "free -h", "df -h"},
			DelayMs:     500,
			Category:    "Monitoring",
		},
		{
			ID:          "m-net-check",
			Name:        "Network & Open Ports",
			Description: "Inspect IP configuration, routing table, and open listening ports",
			Commands:    []string{"ip addr show || ifconfig", "ss -tuln || netstat -tuln"},
			DelayMs:     500,
			Category:    "Network",
		},
		{
			ID:          "m-proc-check",
			Name:        "Top Resource Processes",
			Description: "List top 10 memory-consuming processes and failed systemd units",
			Commands:    []string{"ps aux --sort=-%mem | head -n 10", "systemctl --failed --no-pager || true"},
			DelayMs:     500,
			Category:    "Processes",
		},
		{
			ID:          "m-docker-check",
			Name:        "Docker Containers & Stats",
			Description: "View running container list and quick resource snapshot",
			Commands:    []string{"docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", "docker stats --no-stream || true"},
			DelayMs:     500,
			Category:    "DevOps",
		},
		{
			ID:          "m-brm-check",
			Name:        "Oracle BRM / App Status",
			Description: "Check status of billing, database, and background services",
			Commands:    []string{"if [ -d /opt/brm ]; then cd /opt/brm && ./pin_ctl status; else echo 'Checking service status:'; systemctl status oracle || systemctl status mariadb; fi"},
			DelayMs:     800,
			Category:    "Enterprise",
		},
	}

	for _, d := range defaults {
		mm.macros[d.ID] = d
	}
	_ = mm.save()
}

func (mm *MacroManager) load() error {
	data, err := os.ReadFile(mm.filePath)
	if err != nil {
		return err
	}
	var list []Macro
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	for _, m := range list {
		mm.macros[m.ID] = m
	}
	return nil
}

func (mm *MacroManager) save() error {
	var list []Macro
	for _, m := range mm.macros {
		list = append(list, m)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(mm.filePath, data, 0644)
}

func (mm *MacroManager) GetMacros() []Macro {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	var list []Macro
	for _, m := range mm.macros {
		list = append(list, m)
	}
	return list
}

func (mm *MacroManager) SaveMacro(m Macro) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	if m.ID == "" {
		m.ID = fmt.Sprintf("macro-%d", time.Now().UnixNano())
	}
	if m.DelayMs <= 0 {
		m.DelayMs = 500
	}
	mm.macros[m.ID] = m
	return mm.save()
}

func (mm *MacroManager) DeleteMacro(id string) error {
	mm.mu.Lock()
	defer mm.mu.Unlock()

	delete(mm.macros, id)
	return mm.save()
}
