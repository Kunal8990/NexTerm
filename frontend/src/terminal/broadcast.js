// ==========================================================================
// Nexterm — Broadcast Command Subsystem
// Matches NexTerm Broadcast Architecture: UI -> App Facade -> ConnectionManager -> ProtocolSession targets.
// Bounded parallel or sequential execution with dangerous command safety,
// per-target status tracking, cancellation, and real-time event streaming.
// ==========================================================================

import { tabs, getTabs, getAllTabs, getActiveTab } from '../state/tabState.js';
import { rootNode } from '../state/sessionState.js';
import { showModal, hideModal } from '../ui/modal.js';
import { showToast, escapeHtml } from '../ui/notifications.js';
import { showMultiServerConnectDialog } from '../sessions/multiServerConnect.js';

// Configurable dangerous command patterns per Section 5
export const DANGEROUS_PATTERNS = [
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

export function isDestructiveCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const trimmed = cmd.trim();
  return DANGEROUS_PATTERNS.some(rx => rx.test(trimmed));
}

// Global broadcast UI state
export const broadcastState = {
  isOpen: false,
  currentStep: 'input', // 'input', 'preview', 'running', 'completed'
  selectedTargets: new Set(),
  targetScope: 'all', // 'selected', 'folder', 'all'
  command: '',
  mode: 'parallel', // 'parallel' | 'sequential'
  requestId: null,
  results: [],
  targetStatuses: new Map(), // tabId -> { tabId, name, host, status, error }
  isDangerous: false,
  searchTerm: ''
};

let eventListenersRegistered = false;

// --------------------------------------------------------------------------
// Connected Sessions Discovery
// --------------------------------------------------------------------------

export function getConnectedSessions() {
  const allTabs = (typeof getTabs === 'function' ? getTabs() : tabs) || {};
  const tabEntries = Object.entries(allTabs);
  return tabEntries.filter(([id, t]) => {
    if (!t || !id || id === 'home') return false;
    return true;
  }).map(([id, t]) => {
    const tabId = t.id || id;
    const title = t.customTitle || t.title || t.profile?.name || (t.isLocal ? 'Local Terminal' : ('Terminal ' + String(tabId).slice(0, 6)));
    const host = t.host || t.profile?.host || (t.isLocal ? 'Local Shell' : '127.0.0.1');
    return {
      id: tabId,
      title,
      host,
      isLocal: !!t.isLocal,
      env: inferEnvironment(title, host)
    };
  });
}

function inferEnvironment(title, host) {
  const text = (title + ' ' + host).toLowerCase();
  if (text.includes('prod')) return 'prod';
  if (text.includes('uat')) return 'uat';
  if (text.includes('test') || text.includes('dev')) return 'test';
  return 'default';
}

// --------------------------------------------------------------------------
// Public Dialog Operations
// --------------------------------------------------------------------------

export function openBroadcastDialog(scope = 'all', preselectedTabIDs = null) {
  ensureEventListeners();

  const sessions = getConnectedSessions();
  if (sessions.length === 0) {
    showToast('No active connected terminal sessions. Select saved servers to connect & broadcast.', 'info');
    if (typeof showMultiServerConnectDialog === 'function') {
      showMultiServerConnectDialog();
    }
    return;
  }

  broadcastState.isOpen = true;
  broadcastState.currentStep = 'input';
  broadcastState.targetScope = scope;
  broadcastState.command = '';
  broadcastState.mode = 'parallel';
  broadcastState.requestId = null;
  broadcastState.results = [];
  broadcastState.targetStatuses.clear();
  broadcastState.searchTerm = '';

  // Target initialization
  broadcastState.selectedTargets.clear();
  if (preselectedTabIDs && Array.isArray(preselectedTabIDs) && preselectedTabIDs.length > 0) {
    preselectedTabIDs.forEach(id => {
      if (sessions.some(s => s.id === id)) broadcastState.selectedTargets.add(id);
    });
  } else if (scope === 'selected') {
    const active = getActiveTab();
    if (active && active.id !== 'home') {
      broadcastState.selectedTargets.add(active.id);
    } else if (sessions.length > 0) {
      broadcastState.selectedTargets.add(sessions[0].id);
    }
  } else {
    // 'all' or 'folder' defaults to all connected
    sessions.forEach(s => broadcastState.selectedTargets.add(s.id));
  }

  renderBroadcastModal();
}

export function closeBroadcast() {
  broadcastState.isOpen = false;
  hideModal();
}

// --------------------------------------------------------------------------
// Event Streaming Handlers (from Backend Wails Runtime)
// --------------------------------------------------------------------------

function ensureEventListeners() {
  if (eventListenersRegistered) return;
  if (window.runtime && window.runtime.EventsOn) {
    window.runtime.EventsOn('broadcast:state', handleBroadcastState);
    window.runtime.EventsOn('broadcast:progress', handleBroadcastProgress);
    window.runtime.EventsOn('broadcast:complete', handleBroadcastComplete);
    eventListenersRegistered = true;
  }
}

export function handleBroadcastState(event) {
  if (!event || !broadcastState.isOpen) return;
  if (event.state === 'cancelled') {
    broadcastState.currentStep = 'completed';
    showToast('Broadcast dispatch cancelled by user', 'warning');
    renderBroadcastModal();
  }
}

export function handleBroadcastProgress(progress) {
  if (!progress || !broadcastState.isOpen) return;
  const { tabId, status, error } = progress;
  if (tabId && broadcastState.targetStatuses.has(tabId)) {
    const item = broadcastState.targetStatuses.get(tabId);
    item.status = status;
    item.error = error || '';
    renderRunningView();
  }
}

export function handleBroadcastComplete(result) {
  if (!result || !broadcastState.isOpen) return;
  broadcastState.currentStep = 'completed';
  broadcastState.results = result.targets || [];
  if (result.targets) {
    result.targets.forEach(tr => {
      if (broadcastState.targetStatuses.has(tr.tabId)) {
        const item = broadcastState.targetStatuses.get(tr.tabId);
        item.status = tr.status;
        item.error = tr.error || '';
      }
    });
  }
  renderBroadcastModal();
}

// --------------------------------------------------------------------------
// Execution & Cancellation
// --------------------------------------------------------------------------

export async function startBroadcast() {
  const targetIDs = Array.from(broadcastState.selectedTargets);
  if (targetIDs.length === 0) {
    showToast('Please select at least one connected session target.', 'warning');
    return;
  }
  const cmd = broadcastState.command.trim();
  if (!cmd) {
    showToast('Please enter a command to broadcast.', 'warning');
    return;
  }

  broadcastState.currentStep = 'running';
  broadcastState.targetStatuses.clear();

  const sessions = getConnectedSessions();
  targetIDs.forEach(id => {
    const s = sessions.find(sess => sess.id === id);
    broadcastState.targetStatuses.set(id, {
      tabId: id,
      name: s ? s.title : id,
      host: s ? s.host : '',
      status: 'pending',
      error: ''
    });
  });

  renderBroadcastModal();

  try {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.BroadcastCommand) {
      const res = await window.go.main.App.BroadcastCommand(targetIDs, cmd, broadcastState.mode);
      if (res) {
        broadcastState.requestId = res.requestId;
        handleBroadcastComplete(res);
      }
    } else {
      // Mock execution for browser mode / unit tests
      broadcastState.requestId = 'mock-bcast-' + Date.now();
      for (const id of targetIDs) {
        await new Promise(r => setTimeout(r, 60));
        handleBroadcastProgress({
          requestId: broadcastState.requestId,
          tabId: id,
          status: 'completed'
        });
      }
      handleBroadcastComplete({
        requestId: broadcastState.requestId,
        targets: targetIDs.map(id => ({ tabId: id, status: 'completed' }))
      });
    }
  } catch (err) {
    showToast('Broadcast failed: ' + (err.message || err), 'error');
    broadcastState.currentStep = 'completed';
    renderBroadcastModal();
  }
}

export async function cancelBroadcast() {
  if (broadcastState.requestId && window.go && window.go.main && window.go.main.App && window.go.main.App.CancelBroadcast) {
    try {
      await window.go.main.App.CancelBroadcast(broadcastState.requestId);
      showToast('Cancellation requested...', 'info');
    } catch (err) {
      console.warn('CancelBroadcast error:', err);
    }
  }
  broadcastState.currentStep = 'completed';
  broadcastState.targetStatuses.forEach(item => {
    if (item.status === 'pending' || item.status === 'sending') {
      item.status = 'cancelled';
      item.error = 'Cancelled by user';
    }
  });
  renderBroadcastModal();
}

// --------------------------------------------------------------------------
// UI Rendering
// --------------------------------------------------------------------------

function renderBroadcastModal() {
  if (!broadcastState.isOpen) return;

  let contentHtml = '';
  if (broadcastState.currentStep === 'input') {
    contentHtml = renderInputStep();
  } else if (broadcastState.currentStep === 'preview') {
    contentHtml = renderPreviewStep();
  } else if (broadcastState.currentStep === 'running') {
    contentHtml = renderRunningStep();
  } else if (broadcastState.currentStep === 'completed') {
    contentHtml = renderCompletedStep();
  }

  showModal(contentHtml);
  attachModalHandlers();
}

function renderInputStep() {
  const sessions = getConnectedSessions();
  const search = broadcastState.searchTerm.toLowerCase();
  const filtered = sessions.filter(s => {
    if (!search) return true;
    return s.title.toLowerCase().includes(search) || s.host.toLowerCase().includes(search);
  });

  const isDangerous = isDestructiveCommand(broadcastState.command);
  const selectedCount = broadcastState.selectedTargets.size;

  return `
    <div class="broadcast-modal-card">
      <div class="broadcast-header">
        <div class="broadcast-title-row">
          <span class="broadcast-icon">📡</span>
          <div>
            <h3>Broadcast Command</h3>
            <p class="broadcast-subtitle">Execute an operational command across multiple active terminals simultaneously</p>
          </div>
        </div>
        <button id="broadcastCloseBtn" class="broadcast-close-btn" title="Close">✕</button>
      </div>

      <div class="broadcast-body">
        <!-- Target Scope & Controls -->
        <div class="broadcast-section">
          <div class="broadcast-section-header">
            <label class="broadcast-label">1. Select Target Terminals (${selectedCount} of ${sessions.length} selected)</label>
            <div class="broadcast-actions-group">
              <button id="bcastConnectMoreBtn" class="bcast-btn-text" style="color: #38bdf8; font-weight: 600;">➕ Multi-Connect Servers...</button>
              <span class="bcast-sep">|</span>
              <button id="bcastSelectAllBtn" class="bcast-btn-text">Select All</button>
              <span class="bcast-sep">|</span>
              <button id="bcastClearAllBtn" class="bcast-btn-text">Clear</button>
            </div>
          </div>

          <div class="bcast-filter-bar">
            <input type="text" id="bcastSearchInput" class="bcast-search-input" placeholder="Search targets by name or host..." value="${escapeHtml(broadcastState.searchTerm)}" />
          </div>

          <div class="bcast-targets-list">
            ${filtered.length === 0 ? `<div class="bcast-empty">No connected terminals match search</div>` : ''}
            ${filtered.map(s => {
              const isChecked = broadcastState.selectedTargets.has(s.id);
              const envBadge = s.env === 'prod' 
                ? '<span class="bcast-env-badge badge-prod">PROD</span>'
                : (s.env === 'uat' ? '<span class="bcast-env-badge badge-uat">UAT</span>' : (s.env === 'test' ? '<span class="bcast-env-badge badge-test">TEST</span>' : ''));
              return `
                <label class="bcast-target-item ${isChecked ? 'selected' : ''}" data-id="${s.id}">
                  <input type="checkbox" class="bcast-target-checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''} />
                  <span class="bcast-target-icon">${s.isLocal ? '💻' : '🖥️'}</span>
                  <div class="bcast-target-info">
                    <div class="bcast-target-name">${escapeHtml(s.title)} ${envBadge}</div>
                    <div class="bcast-target-host">${escapeHtml(s.host)}</div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Command Input -->
        <div class="broadcast-section">
          <label class="broadcast-label" for="bcastCommandInput">2. Enter Command</label>
          <div class="bcast-cmd-wrapper">
            <textarea id="bcastCommandInput" class="bcast-textarea" rows="3" placeholder="e.g. systemctl restart billing or uptime">${escapeHtml(broadcastState.command)}</textarea>
          </div>
          ${isDangerous ? `
            <div class="bcast-danger-banner">
              <span class="danger-icon">⚠️</span>
              <div>
                <strong>High Risk / Destructive Command Detected</strong>
                <p>This command contains patterns that can permanently alter system state, erase files, or reboot servers. Review targets carefully before proceeding.</p>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Mode & Options -->
        <div class="broadcast-section">
          <label class="broadcast-label">3. Execution Mode</label>
          <div class="bcast-mode-options">
            <label class="bcast-mode-radio ${broadcastState.mode === 'parallel' ? 'active' : ''}">
              <input type="radio" name="bcastMode" value="parallel" ${broadcastState.mode === 'parallel' ? 'checked' : ''} />
              <div>
                <strong>Parallel (Recommended)</strong>
                <span>Dispatch to all targets simultaneously with bounded concurrency (up to 20 workers).</span>
              </div>
            </label>
            <label class="bcast-mode-radio ${broadcastState.mode === 'sequential' ? 'active' : ''}">
              <input type="radio" name="bcastMode" value="sequential" ${broadcastState.mode === 'sequential' ? 'checked' : ''} />
              <div>
                <strong>Sequential Rollout</strong>
                <span>Dispatch one target at a time. Useful for rolling canary restarts.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div class="broadcast-footer">
        <button id="bcastCancelBtn" class="btn btn-secondary">Cancel</button>
        <button id="bcastPreviewBtn" class="btn btn-primary" ${selectedCount === 0 || !broadcastState.command.trim() ? 'disabled' : ''}>
          Preview & Confirm (${selectedCount} Targets) →
        </button>
      </div>
    </div>
  `;
}

function renderPreviewStep() {
  const sessions = getConnectedSessions();
  const targets = sessions.filter(s => broadcastState.selectedTargets.has(s.id));
  const isDangerous = isDestructiveCommand(broadcastState.command);
  const prodTargets = targets.filter(t => t.env === 'prod');

  return `
    <div class="broadcast-modal-card">
      <div class="broadcast-header">
        <div class="broadcast-title-row">
          <span class="broadcast-icon">⚠️</span>
          <div>
            <h3>Review & Confirm Broadcast</h3>
            <p class="broadcast-subtitle">Verify targets and command payload before initiating dispatch</p>
          </div>
        </div>
        <button id="broadcastCloseBtn" class="broadcast-close-btn">✕</button>
      </div>

      <div class="broadcast-body">
        ${isDangerous ? `
          <div class="bcast-danger-banner bcast-danger-prominent">
            <span class="danger-icon">🛑</span>
            <div>
              <strong>DESTRUCTIVE ACTION WARNING</strong>
              <p>You are about to execute a potentially destructive command across <strong>${targets.length} servers</strong> simultaneously.</p>
            </div>
          </div>
        ` : ''}

        ${prodTargets.length > 0 ? `
          <div class="bcast-prod-alert">
            <span>🚨</span>
            <div>
              <strong>Production Servers Targeted (${prodTargets.length})</strong>
              <p>Targets include production instances: ${prodTargets.map(p => escapeHtml(p.title)).join(', ')}</p>
            </div>
          </div>
        ` : ''}

        <div class="bcast-preview-block">
          <div class="preview-label">Command to Execute</div>
          <pre class="bcast-cmd-preview"><code>${escapeHtml(broadcastState.command)}</code></pre>
        </div>

        <div class="bcast-preview-meta">
          <div><strong>Execution Mode:</strong> ${broadcastState.mode === 'parallel' ? 'Parallel (simultaneous)' : 'Sequential (one by one)'}</div>
          <div><strong>Target Count:</strong> ${targets.length} connected sessions</div>
        </div>

        <div class="preview-label">Target Server List:</div>
        <div class="bcast-preview-targets">
          ${targets.map(t => `
            <div class="bcast-preview-chip ${t.env === 'prod' ? 'chip-prod' : ''}">
              ${t.title} <span class="chip-host">(${t.host})</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="broadcast-footer">
        <button id="bcastBackBtn" class="btn btn-secondary">← Back to Edit</button>
        <button id="bcastExecuteBtn" class="btn ${isDangerous ? 'btn-danger' : 'btn-primary'}">
          ${isDangerous ? '⚠️ I Understand, Execute Broadcast' : '🚀 Confirm & Broadcast'}
        </button>
      </div>
    </div>
  `;
}

function renderRunningStep() {
  const items = Array.from(broadcastState.targetStatuses.values());
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  return `
    <div class="broadcast-modal-card">
      <div class="broadcast-header">
        <div class="broadcast-title-row">
          <span class="broadcast-spinner"></span>
          <div>
            <h3>Broadcasting Command...</h3>
            <p class="broadcast-subtitle">Progress: ${completedCount + failedCount} of ${items.length} completed</p>
          </div>
        </div>
      </div>

      <div class="broadcast-body">
        <div class="bcast-progress-summary">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${(items.length > 0 ? ((completedCount + failedCount) / items.length) * 100 : 0)}%"></div>
          </div>
        </div>

        <div id="bcastRunningList" class="bcast-running-list">
          ${items.map(item => renderTargetStatusItem(item)).join('')}
        </div>
      </div>

      <div class="broadcast-footer">
        <button id="bcastCancelExecutionBtn" class="btn btn-danger">Cancel Remaining</button>
      </div>
    </div>
  `;
}

function renderTargetStatusItem(item) {
  let statusBadge = '';
  if (item.status === 'completed') {
    statusBadge = '<span class="status-pill pill-success">✓ Completed</span>';
  } else if (item.status === 'failed') {
    statusBadge = `<span class="status-pill pill-danger" title="${escapeHtml(item.error)}">✕ Failed</span>`;
  } else if (item.status === 'sending') {
    statusBadge = '<span class="status-pill pill-running">● Sending...</span>';
  } else if (item.status === 'cancelled') {
    statusBadge = '<span class="status-pill pill-cancelled">⏹ Cancelled</span>';
  } else if (item.status === 'disconnected') {
    statusBadge = '<span class="status-pill pill-disconnected">🔌 Disconnected</span>';
  } else {
    statusBadge = '<span class="status-pill pill-pending">⏳ Pending</span>';
  }

  return `
    <div class="bcast-status-row">
      <div class="bcast-status-info">
        <span class="bcast-status-name">${escapeHtml(item.name)}</span>
        <span class="bcast-status-host">${escapeHtml(item.host)}</span>
      </div>
      <div class="bcast-status-badge-wrap">
        ${statusBadge}
        ${item.error ? `<div class="bcast-status-err">${escapeHtml(item.error)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderCompletedStep() {
  const items = Array.from(broadcastState.targetStatuses.values());
  const completed = items.filter(i => i.status === 'completed').length;
  const failed = items.filter(i => i.status === 'failed' || i.status === 'disconnected').length;
  const cancelled = items.filter(i => i.status === 'cancelled').length;

  return `
    <div class="broadcast-modal-card">
      <div class="broadcast-header">
        <div class="broadcast-title-row">
          <span class="broadcast-icon">${failed === 0 ? '✅' : '⚠️'}</span>
          <div>
            <h3>Broadcast Complete</h3>
            <p class="broadcast-subtitle">${completed} succeeded, ${failed} failed, ${cancelled} cancelled</p>
          </div>
        </div>
        <button id="broadcastCloseBtn" class="broadcast-close-btn">✕</button>
      </div>

      <div class="broadcast-body">
        <div class="bcast-running-list">
          ${items.map(item => renderTargetStatusItem(item)).join('')}
        </div>
      </div>

      <div class="broadcast-footer">
        <button id="bcastNewBtn" class="btn btn-secondary">New Broadcast</button>
        <button id="bcastDoneBtn" class="btn btn-primary">Done</button>
      </div>
    </div>
  `;
}

function renderRunningView() {
  const container = document.getElementById('bcastRunningList');
  if (!container) return;
  const items = Array.from(broadcastState.targetStatuses.values());
  container.innerHTML = items.map(item => renderTargetStatusItem(item)).join('');
}

// --------------------------------------------------------------------------
// DOM Handlers
// --------------------------------------------------------------------------

function attachModalHandlers() {
  const closeBtn = document.getElementById('broadcastCloseBtn');
  if (closeBtn) closeBtn.onclick = closeBroadcast;

  const cancelBtn = document.getElementById('bcastCancelBtn');
  if (cancelBtn) cancelBtn.onclick = closeBroadcast;

  const doneBtn = document.getElementById('bcastDoneBtn');
  if (doneBtn) doneBtn.onclick = closeBroadcast;

  const newBtn = document.getElementById('bcastNewBtn');
  if (newBtn) newBtn.onclick = () => openBroadcastDialog('all');

  const connectMoreBtn = document.getElementById('bcastConnectMoreBtn');
  if (connectMoreBtn) {
    connectMoreBtn.onclick = () => {
      closeBroadcast();
      showMultiServerConnectDialog();
    };
  }

  const selectAllBtn = document.getElementById('bcastSelectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      const sessions = getConnectedSessions();
      sessions.forEach(s => broadcastState.selectedTargets.add(s.id));
      renderBroadcastModal();
    };
  }

  const clearAllBtn = document.getElementById('bcastClearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.onclick = () => {
      broadcastState.selectedTargets.clear();
      renderBroadcastModal();
    };
  }

  const searchInput = document.getElementById('bcastSearchInput');
  if (searchInput) {
    searchInput.oninput = (e) => {
      broadcastState.searchTerm = e.target.value;
      const listEl = document.querySelector('.bcast-targets-list');
      if (listEl) {
        const sessions = getConnectedSessions();
        const search = broadcastState.searchTerm.toLowerCase();
        const filtered = sessions.filter(s => !search || s.title.toLowerCase().includes(search) || s.host.toLowerCase().includes(search));
        listEl.innerHTML = filtered.map(s => {
          const isChecked = broadcastState.selectedTargets.has(s.id);
          return `
            <label class="bcast-target-item ${isChecked ? 'selected' : ''}" data-id="${s.id}">
              <input type="checkbox" class="bcast-target-checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''} />
              <span class="bcast-target-icon">${s.isLocal ? '💻' : '🖥️'}</span>
              <div class="bcast-target-info">
                <div class="bcast-target-name">${escapeHtml(s.title)}</div>
                <div class="bcast-target-host">${escapeHtml(s.host)}</div>
              </div>
            </label>
          `;
        }).join('');
        attachTargetCheckboxHandlers();
      }
    };
  }

  attachTargetCheckboxHandlers();

  const cmdInput = document.getElementById('bcastCommandInput');
  if (cmdInput) {
    cmdInput.oninput = (e) => {
      broadcastState.command = e.target.value;
      const previewBtn = document.getElementById('bcastPreviewBtn');
      if (previewBtn) {
        previewBtn.disabled = broadcastState.selectedTargets.size === 0 || !broadcastState.command.trim();
      }
      // Toggle danger warning if needed
      const danger = isDestructiveCommand(broadcastState.command);
      if (danger !== broadcastState.isDangerous) {
        broadcastState.isDangerous = danger;
        renderBroadcastModal();
      }
    };
  }

  const modeRadios = document.querySelectorAll('input[name="bcastMode"]');
  modeRadios.forEach(r => {
    r.onchange = (e) => {
      broadcastState.mode = e.target.value;
      renderBroadcastModal();
    };
  });

  const previewBtn = document.getElementById('bcastPreviewBtn');
  if (previewBtn) {
    previewBtn.onclick = () => {
      broadcastState.currentStep = 'preview';
      renderBroadcastModal();
    };
  }

  const backBtn = document.getElementById('bcastBackBtn');
  if (backBtn) {
    backBtn.onclick = () => {
      broadcastState.currentStep = 'input';
      renderBroadcastModal();
    };
  }

  const executeBtn = document.getElementById('bcastExecuteBtn');
  if (executeBtn) {
    executeBtn.onclick = startBroadcast;
  }

  const cancelExecBtn = document.getElementById('bcastCancelExecutionBtn');
  if (cancelExecBtn) {
    cancelExecBtn.onclick = cancelBroadcast;
  }
}

function attachTargetCheckboxHandlers() {
  const checkboxes = document.querySelectorAll('.bcast-target-checkbox');
  checkboxes.forEach(cb => {
    cb.onchange = (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) {
        broadcastState.selectedTargets.add(id);
      } else {
        broadcastState.selectedTargets.delete(id);
      }
      const label = e.target.closest('.bcast-target-item');
      if (label) label.classList.toggle('selected', e.target.checked);

      const previewBtn = document.getElementById('bcastPreviewBtn');
      if (previewBtn) {
        previewBtn.disabled = broadcastState.selectedTargets.size === 0 || !broadcastState.command.trim();
        previewBtn.textContent = `Preview & Confirm (${broadcastState.selectedTargets.size} Targets) →`;
      }
      const headerLabel = document.querySelector('.broadcast-section-header .broadcast-label');
      if (headerLabel) {
        const sessions = getConnectedSessions();
        headerLabel.textContent = `1. Select Target Terminals (${broadcastState.selectedTargets.size} of ${sessions.length} selected)`;
      }
    };
  });
}
