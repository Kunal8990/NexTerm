// ==========================================================================
// Nexterm — Multi-Execution Subsystem & Matrix View
// Architecture: Command -> ConnectionManager -> Server 1, Server 2, Server 3...
// Output Matrix: 2x2 / NxN real-time streaming grid
// ==========================================================================

import { tabs, getAllTabs } from '../state/tabState.js';
import { rootNode, getAllSessions } from '../state/sessionState.js';
import { connectToSession, addMultiExecDataListener, broadcastMultiExecData } from './terminalManager.js';
import { showModal, hideModal } from '../ui/modal.js';
import { escapeHtml, showToast } from '../ui/notifications.js';

// ANSI code to styled HTML parser for clean, beautiful terminal output in matrix panes
export function formatAnsiToHtml(raw) {
  if (!raw) return '';
  let text = escapeHtml(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Basic ANSI styles
  text = text
    .replace(/\x1b\[0m/g, '</span>')
    .replace(/\x1b\[1m/g, '<span style="font-weight:700;color:#f8fafc;">')
    .replace(/\x1b\[2m/g, '<span style="opacity:0.7;">')
    .replace(/\x1b\[31m/g, '<span style="color:#f87171;">')
    .replace(/\x1b\[32m/g, '<span style="color:#4ade80;">')
    .replace(/\x1b\[33m/g, '<span style="color:#facc15;">')
    .replace(/\x1b\[34m/g, '<span style="color:#60a5fa;">')
    .replace(/\x1b\[35m/g, '<span style="color:#c084fc;">')
    .replace(/\x1b\[36m/g, '<span style="color:#22d3ee;">')
    .replace(/\x1b\[37m/g, '<span style="color:#f1f5f9;">')
    .replace(/\x1b\[90m/g, '<span style="color:#94a3b8;">')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''); // Strip unhandled control codes

  return text;
}

// Configurable dangerous command patterns per Section 5 & GAP-26
export const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-[rf]{1,3}\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bdrop\s+database\b/i,
  /\bdrop\s+table\b/i,
  /\btruncate\s+table\b/i,
  /\bformat\s+[a-z]:/i,
  /\bkill\s+-9\s+-1\b/i,
  /\binit\s+[06]\b/i
];

export function isDangerousCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const trimmed = cmd.trim();
  return DANGEROUS_COMMAND_PATTERNS.some(rx => rx.test(trimmed));
}

// Generate realistic simulated output for demo/browser execution
function getSimulatedCommandOutput(cmd, serverName, serverHost) {
  const trimmed = cmd.trim();
  const timeStr = new Date().toTimeString().split(' ')[0];
  const hostname = serverName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  if (trimmed.startsWith('systemctl status')) {
    const srv = trimmed.split(' ')[2] || 'billing';
    return `\x1b[1m● ${srv}.service - Nexterm Core Production Daemon\x1b[0m
     Loaded: loaded (/etc/systemd/system/${srv}.service; \x1b[32menabled\x1b[0m; vendor preset: enabled)
     Active: \x1b[1;32mactive (running)\x1b[0m since Tue 2026-09-09 04:15:10 UTC; 8h 12min ago
   Main PID: ${Math.floor(1200 + Math.random() * 4000)} (${srv}-daemon)
      Tasks: 14 (limit: 8192)
     Memory: ${(42.5 + Math.random() * 8).toFixed(1)}M
        CPU: ${(1.8 + Math.random() * 1.5).toFixed(3)}s
     CGroup: /system.slice/${srv}.service
             └─${Math.floor(1200 + Math.random() * 4000)} /opt/nexterm/bin/${srv}-daemon --cluster=prod-primary --port=8080

Sep 09 04:15:10 ${hostname} systemd[1]: Started Nexterm Core Production Daemon.
Sep 09 04:15:11 ${hostname} ${srv}-daemon: [INFO] Initialized DB connection pool (max=64, active=12)
Sep 09 04:15:11 ${hostname} ${srv}-daemon: [INFO] Synchronized cluster state with coordinator at ${serverHost}
Sep 09 ${timeStr} ${hostname} ${srv}-daemon: [INFO] Health check OK: latency 0.8ms, error rate 0.00%
`;
  }

  if (trimmed === 'uptime') {
    return ` ${timeStr} up 42 days, 14:22,  2 users,  load average: ${(0.1 + Math.random() * 0.4).toFixed(2)}, ${(0.2 + Math.random() * 0.3).toFixed(2)}, 0.15\n`;
  }

  if (trimmed === 'df -h') {
    return `Filesystem      Size  Used Avail Use% Mounted on
udev            3.9G     0  3.9G   0% /dev
tmpfs           794M  1.4M  793M   1% /run
/dev/sda1        78G   22G   53G  30% /
tmpfs           3.9G     0  3.9G   0% /dev/shm
tmpfs           5.0M     0  5.0M   0% /run/lock
/dev/sda15      124M   12M  112M  10% /boot/efi
`;
  }

  if (trimmed === 'free -m' || trimmed === 'free -h') {
    return `               total        used        free      shared  buff/cache   available
Mem:            7936        2140        3820          45        1976        5480
Swap:           2048           0        2048
`;
  }

  if (trimmed.startsWith('docker ps')) {
    return `CONTAINER ID   IMAGE                 COMMAND                  CREATED        STATUS        PORTS                    NAMES
a4f912c8b01a   redis:7.2-alpine      "docker-entrypoint.s…"   3 days ago     Up 3 days     0.0.0.0:6379->6379/tcp   billing-cache
c189e3a1f94d   postgres:16-alpine    "docker-entrypoint.s…"   3 days ago     Up 3 days     0.0.0.0:5432->5432/tcp   billing-db
8912ba77d3f1   nexterm/billing:v2.4  "/entrypoint.sh run"     8 hours ago    Up 8 hours    0.0.0.0:8080->8080/tcp   billing-api
`;
  }

  return `[${hostname} (${serverHost})] Command executed successfully at ${timeStr}: exit code 0\n`;
}

// State for active multi-execution dialog
let multiExecUnsub = null;
let currentGridCols = 'auto'; // 'auto', '2x2', '3x2', '1col'

/**
 * Open the Multi-Execution Center & Command Matrix Dialog
 */
export function showMultiExecutionModal() {
  // 1. Gather all candidates (Active Tabs + Saved Sessions Tree)
  const candidates = [];
  const openTabMap = new Map();

  // Active terminal tabs
  const activeTabsList = getAllTabs();
  for (const t of activeTabsList) {
    if (t && t.profile) {
      const targetId = t.profile.id || t.tabId;
      openTabMap.set(targetId, t);
      candidates.push({
        id: targetId,
        tabId: t.tabId,
        name: t.profile.name || `Session ${t.tabId.slice(0, 6)}`,
        host: t.profile.host ? `${t.profile.username || 'root'}@${t.profile.host}` : (t.isLocal ? 'localhost (Local Shell)' : '127.0.0.1'),
        protocol: t.profile.protocol || (t.isLocal ? 'local' : 'ssh'),
        isConnected: !!t.isConnected,
        isOpen: true,
        profile: t.profile,
        checked: true
      });
    }
  }

  // Saved sessions from session tree
  const savedSessions = getAllSessions(rootNode);
  for (const s of savedSessions) {
    if (s && !openTabMap.has(s.id)) {
      candidates.push({
        id: s.id,
        tabId: null,
        name: s.name || 'Server',
        host: s.host ? `${s.username || 'root'}@${s.host}` : 'remote-server',
        protocol: s.protocol || 'ssh',
        isConnected: false,
        isOpen: false,
        profile: s,
        checked: false
      });
    }
  }

  // If no sessions exist, candidates remains empty (do not show fake test servers)

  // Store output history per target
  const outputBuffers = new Map();
  candidates.forEach(c => outputBuffers.set(c.id, ''));

  // Render modal HTML
  const modalHtml = `
    <div class="modal-header multiexec-modal-header">
      <div class="multiexec-title-wrap">
        <div class="modal-title multiexec-title">
          <span class="multiexec-title-icon">⚡</span>
          <span>Multi-Execution Command Center</span>
        </div>
        <div class="multiexec-subtitle">
          Architecture: <b>Command</b> ➔ <b>ConnectionManager</b> ➔ <b>Server 1, Server 2, Server 3...</b>
        </div>
      </div>
      <button class="modal-close-btn" id="multiExecModalClose" title="Close Dialog">&times;</button>
    </div>

    <div class="modal-body multiexec-modal-body">
      <!-- TOP SECTION: Server Selection & Command Control Panel -->
      <div class="multiexec-control-panel">
        
        <!-- Left: Selected Target Servers -->
        <div class="multiexec-targets-card">
          <div class="multiexec-section-title-row">
            <span class="multiexec-section-title">
              Selected Servers (<span id="multiexecSelectedCount">0</span>)
            </span>
            <div class="multiexec-selection-tools">
              <button class="multiexec-link-btn" id="mexecSelectAllBtn">Select All</button>
              <span class="multiexec-sep">|</span>
              <button class="multiexec-link-btn" id="mexecSelectNoneBtn">None</button>
              <span class="multiexec-sep">|</span>
              <button class="multiexec-link-btn" id="mexecSelectConnBtn">Connected Only</button>
            </div>
          </div>

          <div class="multiexec-server-list" id="multiExecServerList">
            ${candidates.map(c => `
              <label class="multiexec-server-item" data-id="${c.id}">
                <input type="checkbox" class="multiexec-server-checkbox" data-id="${c.id}" ${c.checked ? 'checked' : ''} />
                <span class="multiexec-status-dot ${c.isConnected ? 'dot-connected' : 'dot-idle'}" title="${c.isConnected ? 'Connected' : 'Offline / Saved'}"></span>
                <div class="multiexec-server-details">
                  <span class="multiexec-server-name">${escapeHtml(c.name)}</span>
                  <span class="multiexec-server-host">${escapeHtml(c.host)}</span>
                </div>
                <span class="multiexec-proto-badge ${c.protocol}">${c.protocol.toUpperCase()}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Right: Command Dispatcher & Presets -->
        <div class="multiexec-dispatch-card">
          <div class="multiexec-section-title-row">
            <span class="multiexec-section-title">Command Dispatcher</span>
            <div class="multiexec-layout-switch">
              <span class="multiexec-layout-label">Grid Layout:</span>
              <button class="multiexec-layout-btn active" data-layout="auto" title="Auto Responsive Grid">Auto</button>
              <button class="multiexec-layout-btn" data-layout="2x2" title="2x2 Matrix Grid">2x2</button>
              <button class="multiexec-layout-btn" data-layout="3x2" title="3 Columns Grid">3x2</button>
              <button class="multiexec-layout-btn" data-layout="1col" title="Single Stacked Column">1 Col</button>
            </div>
          </div>

          <div class="multiexec-cmd-input-wrap">
            <span class="multiexec-cmd-prompt">$</span>
            <input 
              type="text" 
              id="multiExecCommandInput" 
              class="multiexec-cmd-input" 
              placeholder="e.g. systemctl status billing" 
              value="systemctl status billing" 
              autocomplete="off" 
              spellcheck="false" 
            />
            <button id="multiExecExecuteBtn" class="multiexec-execute-btn" title="Execute command across all selected servers (Ctrl+Enter)">
              <span>⚡ Execute</span>
            </button>
          </div>

          <!-- Command Snippet Pills -->
          <div class="multiexec-presets-row">
            <span class="multiexec-presets-label">Quick Snippets:</span>
            <div class="multiexec-presets-list">
              <button class="multiexec-preset-pill" data-cmd="systemctl status billing">systemctl status billing</button>
              <button class="multiexec-preset-pill" data-cmd="uptime">uptime</button>
              <button class="multiexec-preset-pill" data-cmd="df -h">df -h</button>
              <button class="multiexec-preset-pill" data-cmd="free -m">free -m</button>
              <button class="multiexec-preset-pill" data-cmd="docker ps">docker ps</button>
              <button class="multiexec-preset-pill" data-cmd="journalctl -n 25 --no-pager">journalctl -n 25</button>
            </div>
          </div>

          <!-- Action Bar -->
          <div class="multiexec-action-bar">
            <div class="multiexec-dispatch-info">
              Dispatches simultaneously through <b>ConnectionManager</b> to all checked servers.
            </div>
            <div class="multiexec-btn-group">
              <button id="multiExecClearAllBtn" class="multiexec-aux-btn" title="Clear all console panes">
                🧹 Clear Outputs
              </button>
              <button id="multiExecCopyAllBtn" class="multiexec-aux-btn" title="Copy combined matrix outputs to clipboard">
                📋 Copy All Outputs
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- BOTTOM SECTION: Real-Time Output Matrix View (┌───┬───┐ Layout) -->
      <div class="multiexec-matrix-wrapper">
        <div class="multiexec-matrix-header">
          <span class="multiexec-matrix-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line><line x1="3" y1="12" x2="21" y2="12"></line></svg>
            Multi-Server Output Matrix
          </span>
          <span class="multiexec-matrix-hint">Real-time asynchronous stream per server</span>
        </div>

        <div class="multiexec-matrix-grid layout-auto" id="multiExecMatrixGrid">
          <!-- Dynamically populated per selected server -->
        </div>
      </div>
    </div>
  `;

  const box = showModal(modalHtml, 'modal-multiexec');
  if (!box) return;

  const cmdInput = box.querySelector('#multiExecCommandInput');
  const executeBtn = box.querySelector('#multiExecExecuteBtn');
  const closeBtn = box.querySelector('#multiExecModalClose');
  const matrixGrid = box.querySelector('#multiExecMatrixGrid');
  const countBadge = box.querySelector('#multiexecSelectedCount');

  // Update selection count & refresh matrix cards
  function updateSelection() {
    const checkboxes = box.querySelectorAll('.multiexec-server-checkbox');
    let selectedCount = 0;

    checkboxes.forEach(cb => {
      const targetId = cb.getAttribute('data-id');
      const candidate = candidates.find(c => c.id === targetId);
      if (candidate) {
        candidate.checked = cb.checked;
        if (cb.checked) selectedCount++;
      }
    });

    if (countBadge) countBadge.textContent = selectedCount;
    renderMatrixPanes();
  }

  // Render output cards in the matrix grid
  function renderMatrixPanes() {
    const selected = candidates.filter(c => c.checked);
    if (!matrixGrid) return;

    if (selected.length === 0) {
      matrixGrid.innerHTML = `
        <div class="multiexec-empty-matrix">
          <div class="multiexec-empty-icon">⚠️</div>
          <div class="multiexec-empty-title">No servers selected</div>
          <div class="multiexec-empty-desc">Check one or more servers above to inspect live multi-execution output.</div>
        </div>
      `;
      return;
    }

    // Retain existing console text if card already rendered
    const existingTexts = new Map();
    selected.forEach(s => {
      const existingPre = matrixGrid.querySelector(`#mexecConsole_${s.id}`);
      if (existingPre) {
        existingTexts.set(s.id, existingPre.innerHTML);
      }
    });

    matrixGrid.innerHTML = selected.map(s => `
      <div class="multiexec-server-card" id="mexecCard_${s.id}" data-id="${s.id}">
        <div class="multiexec-card-header">
          <div class="multiexec-card-title-group">
            <span class="multiexec-status-dot ${s.isConnected ? 'dot-connected' : 'dot-idle'}" id="mexecDot_${s.id}"></span>
            <span class="multiexec-card-server-name">${escapeHtml(s.name)}</span>
            <span class="multiexec-card-server-host">${escapeHtml(s.host)}</span>
          </div>
          <div class="multiexec-card-actions">
            <span class="multiexec-card-state-pill" id="mexecState_${s.id}">Ready</span>
            <button class="multiexec-card-btn mexec-copy-btn" data-id="${s.id}" title="Copy Output">📋</button>
            <button class="multiexec-card-btn mexec-clear-btn" data-id="${s.id}" title="Clear Console">✕</button>
          </div>
        </div>
        <pre class="multiexec-console-output" id="mexecConsole_${s.id}">${existingTexts.get(s.id) || `<span class="multiexec-console-idle">[${escapeHtml(s.name)}] Waiting for command execution...</span>\n`}</pre>
      </div>
    `).join('');

    // Rebind per-card action buttons
    matrixGrid.querySelectorAll('.mexec-copy-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const pre = matrixGrid.querySelector(`#mexecConsole_${id}`);
        if (pre) {
          navigator.clipboard.writeText(pre.textContent);
          showToast(`Copied output for ${id}`, 'info');
        }
      };
    });

    matrixGrid.querySelectorAll('.mexec-clear-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const pre = matrixGrid.querySelector(`#mexecConsole_${id}`);
        if (pre) {
          pre.innerHTML = '<span class="multiexec-console-idle">Console cleared. Ready.</span>\n';
          outputBuffers.set(id, '');
        }
      };
    });
  }

  // Hook up real-time multi-execution output listener from terminalManager
  if (multiExecUnsub) {
    multiExecUnsub();
    multiExecUnsub = null;
  }

  multiExecUnsub = addMultiExecDataListener((tabId, rawData) => {
    // Locate server candidate by tabId
    const candidate = candidates.find(c => c.tabId === tabId || c.id === tabId);
    if (!candidate || !candidate.checked) return;

    const consoleEl = matrixGrid.querySelector(`#mexecConsole_${candidate.id}`);
    if (consoleEl) {
      const currentBuf = (outputBuffers.get(candidate.id) || '') + rawData;
      outputBuffers.set(candidate.id, currentBuf.slice(-10000));
      consoleEl.innerHTML = formatAnsiToHtml(currentBuf);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  });

  // Execute Command Logic
  async function runExecution() {
    const cmd = cmdInput.value.trim();
    if (!cmd) {
      showToast('Please specify a command to execute', 'warning');
      cmdInput.focus();
      return;
    }

    const selected = candidates.filter(c => c.checked);
    if (selected.length === 0) {
      showToast('Please select at least one server to execute', 'warning');
      return;
    }

    // GAP-26: Dangerous command confirmation
    if (isDangerousCommand(cmd)) {
      const confirmed = confirm(`⚠️ WARNING: Potentially Destructive Command Detected!\n\nYou are about to execute:\n"${cmd}"\n\nacross ${selected.length} server(s) simultaneously.\nAre you sure you want to proceed?`);
      if (!confirmed) {
        showToast('Execution cancelled by user', 'info');
        return;
      }
    }

    executeBtn.disabled = true;
    executeBtn.innerHTML = '<span>⏳ Executing...</span>';

    // 1. Ensure all selected servers have active connections
    const targetTabIds = [];
    for (const server of selected) {
      const stateBadge = matrixGrid.querySelector(`#mexecState_${server.id}`);
      const consoleEl = matrixGrid.querySelector(`#mexecConsole_${server.id}`);
      if (stateBadge) {
        stateBadge.textContent = 'Executing...';
        stateBadge.className = 'multiexec-card-state-pill running';
      }

      const promptLine = `<span style="color:#38bdf8;font-weight:bold;">$ ${escapeHtml(cmd)}</span>\n`;
      if (consoleEl) {
        if (consoleEl.innerHTML.includes('Waiting for command execution') || consoleEl.innerHTML.includes('Console cleared')) {
          consoleEl.innerHTML = promptLine;
        } else {
          consoleEl.innerHTML += '\n' + promptLine;
        }
      }

      // If active tab exists in Nexterm
      if (server.tabId && tabs[server.tabId]) {
        targetTabIds.push(server.tabId);
      } else if (server.profile && !server.isOpen) {
        // Saved profile not yet connected: connect session
        try {
          if (stateBadge) stateBadge.textContent = 'Connecting...';
          const newTabId = await connectToSession(server.profile);
          if (newTabId) {
            server.tabId = newTabId;
            server.isOpen = true;
            server.isConnected = true;
            targetTabIds.push(newTabId);
          }
        } catch (e) {
          console.error('Auto-connect failed for server:', server.name, e);
        }
      } else {
        // Mock / demo tab ID
        targetTabIds.push(server.id);
      }
    }

    // 2. Dispatch via ConnectionManager architecture:
    // Command -> ConnectionManager -> Server 1, Server 2, Server 3
    try {
      if (window.go && window.go.main && window.go.main.App && window.go.main.App.ExecuteMulti && targetTabIds.length > 0) {
        await window.go.main.App.ExecuteMulti(targetTabIds, cmd);
        showToast(`Command dispatched to ${selected.length} servers via ConnectionManager`, 'success');
      } else {
        // Simulated execution (for dev browser / offline testing)
        selected.forEach((server, index) => {
          setTimeout(() => {
            const simulatedOutput = getSimulatedCommandOutput(cmd, server.name, server.host);
            const consoleEl = matrixGrid.querySelector(`#mexecConsole_${server.id}`);
            const stateBadge = matrixGrid.querySelector(`#mexecState_${server.id}`);

            if (consoleEl) {
              consoleEl.innerHTML += formatAnsiToHtml(simulatedOutput);
              consoleEl.scrollTop = consoleEl.scrollHeight;
            }
            if (stateBadge) {
              stateBadge.textContent = 'Completed (0)';
              stateBadge.className = 'multiexec-card-state-pill success';
            }
            // Also broadcast to any listeners
            broadcastMultiExecData(server.id, simulatedOutput);
          }, 120 + (index * 90));
        });
        showToast(`Simulated dispatch to ${selected.length} servers`, 'info');
      }
    } catch (err) {
      showToast(`Multi-execution error: ${err}`, 'error');
    } finally {
      setTimeout(() => {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<span>⚡ Execute</span>';
        selected.forEach(s => {
          const stateBadge = matrixGrid.querySelector(`#mexecState_${s.id}`);
          if (stateBadge && stateBadge.textContent === 'Executing...') {
            stateBadge.textContent = 'Done';
            stateBadge.className = 'multiexec-card-state-pill success';
          }
        });
      }, 500);
    }
  }

  // Wire events
  box.querySelectorAll('.multiexec-server-checkbox').forEach(cb => {
    cb.onchange = updateSelection;
  });

  box.querySelector('#mexecSelectAllBtn').onclick = () => {
    box.querySelectorAll('.multiexec-server-checkbox').forEach(cb => cb.checked = true);
    updateSelection();
  };

  box.querySelector('#mexecSelectNoneBtn').onclick = () => {
    box.querySelectorAll('.multiexec-server-checkbox').forEach(cb => cb.checked = false);
    updateSelection();
  };

  box.querySelector('#mexecSelectConnBtn').onclick = () => {
    candidates.forEach(c => {
      const cb = box.querySelector(`.multiexec-server-checkbox[data-id="${c.id}"]`);
      if (cb) cb.checked = !!c.isConnected;
    });
    updateSelection();
  };

  // Quick Snippet Pills
  box.querySelectorAll('.multiexec-preset-pill').forEach(pill => {
    pill.onclick = () => {
      const snippet = pill.getAttribute('data-cmd');
      if (snippet && cmdInput) {
        cmdInput.value = snippet;
        cmdInput.focus();
      }
    };
  });

  // Grid Layout Switcher
  box.querySelectorAll('.multiexec-layout-btn').forEach(lBtn => {
    lBtn.onclick = () => {
      box.querySelectorAll('.multiexec-layout-btn').forEach(b => b.classList.remove('active'));
      lBtn.classList.add('active');
      const layout = lBtn.getAttribute('data-layout');
      matrixGrid.className = `multiexec-matrix-grid layout-${layout}`;
      currentGridCols = layout;
    };
  });

  // Clear All Outputs
  box.querySelector('#multiExecClearAllBtn').onclick = () => {
    candidates.forEach(c => {
      const consoleEl = matrixGrid.querySelector(`#mexecConsole_${c.id}`);
      if (consoleEl) consoleEl.innerHTML = '<span class="multiexec-console-idle">Console cleared. Ready.</span>\n';
      outputBuffers.set(c.id, '');
    });
    showToast('All matrix outputs cleared', 'info');
  };

  // Copy All Outputs
  box.querySelector('#multiExecCopyAllBtn').onclick = () => {
    const selected = candidates.filter(c => c.checked);
    if (selected.length === 0) return;

    const combined = selected.map(s => {
      const consoleEl = matrixGrid.querySelector(`#mexecConsole_${s.id}`);
      const body = consoleEl ? consoleEl.textContent : '';
      return `=== [ ${s.name} (${s.host}) ] ===\n${body}\n`;
    }).join('\n');

    navigator.clipboard.writeText(combined);
    showToast(`Copied outputs from ${selected.length} servers`, 'success');
  };

  // Execute on Enter / Click
  executeBtn.onclick = runExecution;
  cmdInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runExecution();
    }
  };

  // Cleanup on close
  const doClose = () => {
    if (multiExecUnsub) {
      multiExecUnsub();
      multiExecUnsub = null;
    }
    hideModal();
  };

  closeBtn.onclick = doClose;

  // Initialize
  updateSelection();
  setTimeout(() => cmdInput.focus(), 50);
}
