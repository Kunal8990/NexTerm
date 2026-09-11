// ==========================================================================
// Nexterm — Multi-Server Connect & Broadcast Subsystem
// Enables concurrent multi-session connection with automated split layout
// and synchronized broadcast command execution.
// ==========================================================================

import { rootNode } from '../state/sessionState.js';
import { tabs, getTabs, getEnvironmentInfo, getEnvironmentFromFolderName } from '../state/tabState.js';
import { connectToSession, toggleMultiExec } from '../terminal/terminalManager.js';
import { setSplitMode, setActiveWorkspacePane, workspaceState } from '../state/workspaceState.js';
import { showModal, hideModal } from '../ui/modal.js';
import { showToast, escapeHtml } from '../ui/notifications.js';

// Flatten session tree into structured server list with parent folder metadata
export function collectSavedServers(node, folderName = "All Sessions", folderId = "") {
  if (!node) return [];
  const results = [];

  if (node.session) {
    results.push({
      id: node.session.id || node.id,
      nodeId: node.id,
      name: node.name || node.session.name || node.session.host || "Server",
      host: node.session.host || "",
      port: node.session.port || 22,
      username: node.session.username || "",
      protocol: (node.session.protocol || "ssh").toLowerCase(),
      environment: node.session.environment || "",
      color: node.session.color || "",
      folderName: folderName,
      folderId: folderId,
      profile: node.session
    });
  }

  if (node.children && Array.isArray(node.children)) {
    const curFolder = node.session ? folderName : (node.name || folderName);
    const curFolderId = node.session ? folderId : (node.id || folderId);
    for (const child of node.children) {
      results.push(...collectSavedServers(child, curFolder, curFolderId));
    }
  }

  return results;
}

// Collect unique folders containing at least one session
export function getAvailableFoldersWithSessions(servers) {
  const foldersMap = new Map();
  servers.forEach(s => {
    if (!foldersMap.has(s.folderId)) {
      foldersMap.set(s.folderId, {
        id: s.folderId,
        name: s.folderName,
        count: 0
      });
    }
    foldersMap.get(s.folderId).count++;
  });
  return Array.from(foldersMap.values());
}

// Check if a server profile is already connected in any open tab
function isServerConnected(profileId, host, username) {
  const allTabs = (typeof getTabs === "function" ? getTabs() : tabs) || {};
  return Object.values(allTabs).some(t => {
    if (!t || !t.isConnected) return false;
    if (t.profile && t.profile.id && t.profile.id === profileId) return true;
    if (t.profile && t.profile.host === host && (t.profile.username || "") === (username || "")) return true;
    return false;
  });
}

// --------------------------------------------------------------------------
// Multi-Server Connect & Broadcast Dialog
// --------------------------------------------------------------------------

export function showMultiServerConnectDialog(preselectedFolderId = null) {
  const allServers = collectSavedServers(rootNode);

  if (allServers.length === 0) {
    showToast("No saved servers found. Create a session first using '＋' or Quick Connect.", "warning");
    return;
  }

  const folders = getAvailableFoldersWithSessions(allServers);
  let activeFolderFilter = preselectedFolderId || "all";
  let searchTerm = "";

  const box = showModal(`
    <div class="modal-header multiconnect-modal-header">
      <div class="multiconnect-title-group">
        <div class="modal-title multiconnect-title">
          <span class="multiconnect-icon">📡</span>
          <span>Multi-Server Broadcast Connect</span>
        </div>
        <div class="multiconnect-subtitle">
          Select multiple servers to connect concurrently with automated split layout and synchronized broadcasting.
        </div>
      </div>
      <button class="modal-close-btn" id="modalClose" title="Close">&times;</button>
    </div>

    <div class="modal-body multiconnect-modal-body">
      <!-- Search & Filters Toolbar -->
      <div class="multiconnect-toolbar">
        <div class="multiconnect-search-wrap">
          <span class="search-lens-icon">🔍</span>
          <input type="text" id="mconnSearchInput" class="multiconnect-search-input" placeholder="Search servers by name, host, or user..." autocomplete="off" />
        </div>

        <div class="multiconnect-quick-actions">
          <button type="button" class="btn-sm-action" id="mconnSelectAllBtn">Select All</button>
          <button type="button" class="btn-sm-action" id="mconnSelectNoneBtn">Deselect All</button>
          <span class="mconn-selected-counter" id="mconnSelectedBadge">0 selected</span>
        </div>
      </div>

      <!-- Folder Filter Pills -->
      <div class="multiconnect-folder-pills" id="mconnFolderPills">
        <button type="button" class="mconn-pill ${activeFolderFilter === 'all' ? 'active' : ''}" data-folder-id="all">
          All (${allServers.length})
        </button>
        ${folders.map(f => `
          <button type="button" class="mconn-pill ${activeFolderFilter === f.id ? 'active' : ''}" data-folder-id="${escapeHtml(f.id)}">
            📁 ${escapeHtml(f.name)} (${f.count})
          </button>
        `).join('')}
      </div>

      <!-- Server Selection Cards Grid / List -->
      <div class="multiconnect-server-list" id="mconnServerList">
        <!-- Rendered dynamically -->
      </div>

      <!-- Connection & Broadcast Options Bar -->
      <div class="multiconnect-options-card">
        <div class="mconn-option-section">
          <label class="mconn-option-label">Split Layout Strategy:</label>
          <div class="mconn-layout-selector">
            <label class="mconn-radio-label">
              <input type="radio" name="mconnLayout" value="auto-split" checked />
              <span>⊞ Auto-Split (Side-by-Side / 2x2 Grid)</span>
            </label>
            <label class="mconn-radio-label">
              <input type="radio" name="mconnLayout" value="tabbed" />
              <span>📑 Tabbed (Full width per terminal)</span>
            </label>
          </div>
        </div>

        <div class="mconn-option-section" style="margin-top: 8px;">
          <label class="checkbox-label" style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="mconnEnableBroadcastCheck" checked />
            <span style="font-weight: 600; color: #38bdf8;">⚡ Activate Broadcast Command Bar immediately on connect</span>
          </label>
          <div style="font-size: 11px; color: var(--text-muted); margin-left: 24px; margin-top: 2px;">
            Enables instant synchronous typing & command broadcasting across all selected servers.
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer multiconnect-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="mconnLaunchBtn" style="background: linear-gradient(135deg, #0284c7, #38bdf8); font-weight: 600;">
        🚀 Connect & Start Broadcasting (<span id="mconnLaunchCount">0</span>)
      </button>
    </div>
  `);

  const searchInput = box.querySelector("#mconnSearchInput");
  const serverListEl = box.querySelector("#mconnServerList");
  const folderPillsEl = box.querySelector("#mconnFolderPills");
  const selectedBadgeEl = box.querySelector("#mconnSelectedBadge");
  const launchCountEl = box.querySelector("#mconnLaunchCount");
  const launchBtn = box.querySelector("#mconnLaunchBtn");
  const selectAllBtn = box.querySelector("#mconnSelectAllBtn");
  const selectNoneBtn = box.querySelector("#mconnSelectNoneBtn");

  // Track selected server IDs
  const selectedIds = new Set();

  // If a folder was preselected, select all servers in that folder by default
  if (preselectedFolderId && preselectedFolderId !== "all") {
    allServers.forEach(s => {
      if (s.folderId === preselectedFolderId) selectedIds.add(s.id);
    });
  } else {
    // Select first 2 or all if <= 4
    if (allServers.length <= 4) {
      allServers.forEach(s => selectedIds.add(s.id));
    } else {
      allServers.slice(0, 2).forEach(s => selectedIds.add(s.id));
    }
  }

  function updateCounts() {
    const count = selectedIds.size;
    if (selectedBadgeEl) selectedBadgeEl.textContent = `${count} selected`;
    if (launchCountEl) launchCountEl.textContent = `${count}`;
    if (launchBtn) {
      launchBtn.disabled = count === 0;
      launchBtn.style.opacity = count === 0 ? "0.5" : "1";
    }
  }

  function renderList() {
    serverListEl.innerHTML = "";
    const query = searchTerm.toLowerCase().trim();

    const filtered = allServers.filter(s => {
      if (activeFolderFilter !== "all" && s.folderId !== activeFolderFilter) return false;
      if (query) {
        const matchName = s.name.toLowerCase().includes(query);
        const matchHost = s.host.toLowerCase().includes(query);
        const matchUser = s.username.toLowerCase().includes(query);
        const matchFolder = s.folderName.toLowerCase().includes(query);
        if (!matchName && !matchHost && !matchUser && !matchFolder) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      serverListEl.innerHTML = `
        <div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 12.5px;">
          No matching servers found for this filter.
        </div>
      `;
      return;
    }

    filtered.forEach(s => {
      const isChecked = selectedIds.has(s.id);
      const isConnected = isServerConnected(s.id, s.host, s.username);
      const env = getEnvironmentInfo(s.environment || s.color) || getEnvironmentFromFolderName(s.folderName);
      const customColor = s.color || (env ? env.color : "");

      const envBadge = env
        ? `<span class="mconn-env-badge" style="background:${env.bg}; color:${env.color}; border: 1px solid ${env.border};">${env.label}</span>`
        : '';

      const card = document.createElement("div");
      card.className = `mconn-server-card ${isChecked ? 'selected' : ''} ${isConnected ? 'active-connected' : ''}`;
      card.dataset.id = s.id;
      if (customColor) {
        card.style.borderLeft = `3px solid ${customColor}`;
      }

      card.innerHTML = `
        <div class="mconn-card-left">
          <input type="checkbox" class="mconn-card-checkbox" ${isChecked ? 'checked' : ''} />
          <span class="mconn-card-dot ${isConnected ? 'dot-live' : 'dot-offline'}" title="${isConnected ? 'Connected' : 'Offline / Saved'}"></span>
          <div class="mconn-card-details">
            <div class="mconn-card-title-row">
              <span class="mconn-card-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
              ${envBadge}
              <span class="mconn-proto-tag ${s.protocol}">${s.protocol.toUpperCase()}</span>
            </div>
            <div class="mconn-card-meta">
              <span class="mconn-card-host">👤 ${escapeHtml(s.username || 'user')}@${escapeHtml(s.host)}:${s.port}</span>
              <span class="mconn-card-folder">📁 ${escapeHtml(s.folderName)}</span>
              ${isConnected ? '<span class="mconn-live-badge">LIVE</span>' : ''}
            </div>
          </div>
        </div>
      `;

      // Toggle selection on click
      card.addEventListener("click", (e) => {
        if (e.target.tagName.toLowerCase() === "input") return;
        const cb = card.querySelector(".mconn-card-checkbox");
        if (cb) {
          cb.checked = !cb.checked;
          if (cb.checked) {
            selectedIds.add(s.id);
            card.classList.add("selected");
          } else {
            selectedIds.delete(s.id);
            card.classList.remove("selected");
          }
          updateCounts();
        }
      });

      const cb = card.querySelector(".mconn-card-checkbox");
      if (cb) {
        cb.addEventListener("change", (e) => {
          e.stopPropagation();
          if (cb.checked) {
            selectedIds.add(s.id);
            card.classList.add("selected");
          } else {
            selectedIds.delete(s.id);
            card.classList.remove("selected");
          }
          updateCounts();
        });
      }

      serverListEl.appendChild(card);
    });

    updateCounts();
  }

  // Search input handler
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value;
      renderList();
    });
  }

  // Folder pill click handler
  if (folderPillsEl) {
    folderPillsEl.addEventListener("click", (e) => {
      const pill = e.target.closest(".mconn-pill");
      if (!pill) return;
      activeFolderFilter = pill.dataset.folderId;
      folderPillsEl.querySelectorAll(".mconn-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      renderList();
    });
  }

  // Select All button
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      const query = searchTerm.toLowerCase().trim();
      allServers.forEach(s => {
        if (activeFolderFilter !== "all" && s.folderId !== activeFolderFilter) return;
        if (query && !s.name.toLowerCase().includes(query) && !s.host.toLowerCase().includes(query)) return;
        selectedIds.add(s.id);
      });
      renderList();
    };
  }

  // Select None button
  if (selectNoneBtn) {
    selectNoneBtn.onclick = () => {
      selectedIds.clear();
      renderList();
    };
  }

  // Launch button
  if (launchBtn) {
    launchBtn.onclick = async () => {
      if (selectedIds.size === 0) {
        showToast("Please select at least one server to connect.", "warning");
        return;
      }

      const selectedServers = allServers.filter(s => selectedIds.has(s.id));
      const layoutChoice = box.querySelector("input[name='mconnLayout']:checked")?.value || "auto-split";
      const enableBroadcast = box.querySelector("#mconnEnableBroadcastCheck")?.checked ?? true;

      hideModal();

      await executeMultiServerConnect(selectedServers, layoutChoice, enableBroadcast);
    };
  }

  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCancel").onclick = hideModal;

  // Initial render
  renderList();
  if (searchInput) searchInput.focus();
}

// --------------------------------------------------------------------------
// Multi-Server Execution & Broadcast Runner
// --------------------------------------------------------------------------

export async function executeMultiServerConnect(servers, layoutChoice = "auto-split", enableBroadcast = true) {
  if (!servers || servers.length === 0) return;

  const count = servers.length;
  showToast(`⚡ Connecting ${count} server(s) concurrently for broadcasting...`, "info");

  // 1. Arrange split layout
  if (layoutChoice === "auto-split") {
    if (count === 2) {
      setSplitMode("split-v");
    } else if (count >= 3 && count <= 4) {
      setSplitMode("grid-4");
    } else if (count > 4) {
      setSplitMode("grid-4");
    }
  }

  // 2. Connect each server into sequential panes
  const activePanes = workspaceState.panes || [];
  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    if (layoutChoice === "auto-split" && activePanes.length > 0) {
      const targetPane = activePanes[i % activePanes.length];
      if (targetPane) {
        setActiveWorkspacePane(targetPane.id);
      }
    }

    try {
      // Connect each server with forceNewTab = true so each gets its own tab/pane
      await connectToSession(s.profile, true);
    } catch (err) {
      console.error(`Failed to connect to ${s.name}:`, err);
    }
  }

  // 3. Activate Broadcast Mode
  if (enableBroadcast) {
    setTimeout(() => {
      toggleMultiExec();
      showToast(`📡 Broadcast mode active across ${count} connected server(s)! Enter command to broadcast.`, "success");
    }, 800);
  }
}

// --------------------------------------------------------------------------
// 1-Click Folder Connect & Broadcast
// --------------------------------------------------------------------------

export async function connectFolderSessionsAndBroadcast(folderNode) {
  if (!folderNode) return;
  const servers = collectSavedServers(folderNode, folderNode.name, folderNode.id);

  if (servers.length === 0) {
    showToast(`No saved sessions found inside folder "${folderNode.name}".`, "warning");
    return;
  }

  await executeMultiServerConnect(servers, "auto-split", true);
}

// Open every saved session in a folder as its own tab — no split layout and no
// broadcast bar. This is the plain "connect all in this folder" action.
export async function connectFolderSessionsTabbed(folderNode) {
  if (!folderNode) return;
  const servers = collectSavedServers(folderNode, folderNode.name, folderNode.id);

  if (servers.length === 0) {
    showToast(`No saved sessions found inside folder "${folderNode.name}".`, "warning");
    return;
  }

  showToast(`Opening ${servers.length} session(s) from "${folderNode.name}"...`, "info");
  await executeMultiServerConnect(servers, "tabbed", false);
}
