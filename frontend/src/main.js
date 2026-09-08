// ==========================================================================
// Nexterm — Professional Desktop SSH Client Controller (MobaXterm Clone)
// ==========================================================================

let rootNode = null;
let activeTabId = null; // "home" or uuid
const tabs = {}; // tabID -> { term, fitAddon, profile, paneEl, tabEl, isConnected, isLocal }

// DOM Elements
const treeEl = document.getElementById("tree");
const tabbarEl = document.getElementById("tabbar");
const panesEl = document.getElementById("panes");
const welcomeStateEl = document.getElementById("welcomeState");
const homeTabBtnEl = document.getElementById("homeTabBtn");
const floatingControlsEl = document.getElementById("terminalFloatingControls");
const sidebarQuickConnectInput = document.getElementById("sidebarQuickConnectInput");
const welcomeSearchInput = document.getElementById("welcomeSearchInput");
const statusMessageEl = document.getElementById("statusMessage");
const activeTargetTextEl = document.getElementById("activeTargetText");
const activeSessionsCountEl = document.getElementById("activeSessionsCount");
const multiExecBarEl = document.getElementById("multiExecBar");
const multiExecInputEl = document.getElementById("multiExecInput");
const contextMenuEl = document.getElementById("contextMenu");
const modalOverlayEl = document.getElementById("modalOverlay");
const modalBoxEl = document.getElementById("modalBox");

// Default user settings
let userSettings = {
  theme: "dark-modern",
  fontFamily: "Cascadia Mono, Consolas, Fira Code, monospace",
  fontSize: 13,
  cursorBlink: true,
  cursorStyle: "block",
  scrollback: 10000,
  rightClickPaste: true,
  autoCopySelection: true
};

const THEMES = {
  "dark-modern": {
    background: "#090c11",
    foreground: "#d9e0ea",
    cursor: "#60a5fa",
    cursorAccent: "#090c11",
    selectionBackground: "rgba(59, 130, 246, 0.4)",
    black: "#1e2233",
    red: "#f43f5e",
    green: "#10b981",
    yellow: "#f59e0b",
    blue: "#3b82f6",
    magenta: "#8b5cf6",
    cyan: "#06b6d4",
    white: "#f8fafc",
    brightBlack: "#475569",
    brightRed: "#fb7185",
    brightGreen: "#34d399",
    brightYellow: "#fbbf24",
    brightBlue: "#60a5fa",
    brightMagenta: "#a78bfa",
    brightCyan: "#22d3ee",
    brightWhite: "#ffffff"
  },
  "solarized-dark": {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#93a1a1",
    cursorAccent: "#002b36",
    selectionBackground: "rgba(7, 54, 66, 0.8)",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#586e75",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3"
  },
  "monokai": {
    background: "#272822",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    cursorAccent: "#272822",
    selectionBackground: "rgba(73, 72, 62, 0.8)",
    black: "#272822",
    red: "#f92672",
    green: "#a6e22e",
    yellow: "#f4bf75",
    blue: "#66d9ef",
    magenta: "#ae81ff",
    cyan: "#a1efe4",
    white: "#f8f8f2",
    brightBlack: "#75715e",
    brightRed: "#f92672",
    brightGreen: "#a6e22e",
    brightYellow: "#f4bf75",
    brightBlue: "#66d9ef",
    brightMagenta: "#ae81ff",
    brightCyan: "#a1efe4",
    brightWhite: "#f9f8f5"
  },
  "nord": {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#88c0d0",
    cursorAccent: "#2e3440",
    selectionBackground: "rgba(67, 76, 94, 0.8)",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4"
  },
  "dracula": {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    cursorAccent: "#282a36",
    selectionBackground: "rgba(68, 71, 90, 0.8)",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff"
  },
  "one-dark": {
    background: "#1e1e1e",
    foreground: "#abb2bf",
    cursor: "#528bff",
    cursorAccent: "#1e1e1e",
    selectionBackground: "rgba(62, 68, 81, 0.8)",
    black: "#282c34",
    red: "#e06c75",
    green: "#98c379",
    yellow: "#e5c07b",
    blue: "#61afef",
    magenta: "#c678dd",
    cyan: "#56b6c2",
    white: "#abb2bf",
    brightBlack: "#5c6370",
    brightRed: "#e06c75",
    brightGreen: "#98c379",
    brightYellow: "#e5c07b",
    brightBlue: "#61afef",
    brightMagenta: "#c678dd",
    brightCyan: "#56b6c2",
    brightWhite: "#ffffff"
  },
  "matrix": {
    background: "#031105",
    foreground: "#22eb4f",
    cursor: "#22eb4f",
    cursorAccent: "#031105",
    selectionBackground: "rgba(10, 60, 20, 0.8)",
    black: "#002008",
    red: "#00ff41",
    green: "#00ff41",
    yellow: "#5cff77",
    blue: "#00cc33",
    magenta: "#00aa2a",
    cyan: "#00ff55",
    white: "#d0ffd7",
    brightBlack: "#005515",
    brightRed: "#33ff66",
    brightGreen: "#00ff41",
    brightYellow: "#88ffa0",
    brightBlue: "#00dd38",
    brightMagenta: "#00bb2f",
    brightCyan: "#44ff77",
    brightWhite: "#ffffff"
  },
  "cyberpunk": {
    background: "#0f051d",
    foreground: "#00f0ff",
    cursor: "#ff007f",
    cursorAccent: "#0f051d",
    selectionBackground: "rgba(255, 0, 127, 0.35)",
    black: "#1a0b2e",
    red: "#ff0055",
    green: "#00ff9f",
    yellow: "#ffe600",
    blue: "#00f0ff",
    magenta: "#ff007f",
    cyan: "#7928ca",
    white: "#ffffff",
    brightBlack: "#2d1254",
    brightRed: "#ff3377",
    brightGreen: "#33ffb2",
    brightYellow: "#ffeb33",
    brightBlue: "#33f3ff",
    brightMagenta: "#ff3399",
    brightCyan: "#9b4dca",
    brightWhite: "#ffffff"
  },
  "avisys-navy": {
    background: "#0b1528",
    foreground: "#e2e8f0",
    cursor: "#38bdf8",
    cursorAccent: "#0b1528",
    selectionBackground: "rgba(14, 165, 233, 0.35)",
    black: "#0f172a",
    red: "#f87171",
    green: "#4ade80",
    yellow: "#facc15",
    blue: "#38bdf8",
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#f8fafc",
    brightBlack: "#334155",
    brightRed: "#fca5a5",
    brightGreen: "#86efac",
    brightYellow: "#fde047",
    brightBlue: "#7dd3fc",
    brightMagenta: "#d8b4fe",
    brightCyan: "#67e8f9",
    brightWhite: "#ffffff"
  },
  "light-modern": {
    background: "#f8fafc",
    foreground: "#0f172a",
    cursor: "#0284c7",
    cursorAccent: "#f8fafc",
    selectionBackground: "rgba(2, 132, 199, 0.2)",
    black: "#0f172a",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#d97706",
    blue: "#0284c7",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#ffffff",
    brightBlack: "#64748b",
    brightRed: "#ef4444",
    brightGreen: "#22c55e",
    brightYellow: "#f59e0b",
    brightBlue: "#38bdf8",
    brightMagenta: "#a855f7",
    brightCyan: "#06b6d4",
    brightWhite: "#ffffff"
  }
};

// --------------------------------------------------------------------------
// Initialization & Lifecycle
// --------------------------------------------------------------------------

async function init() {
  const savedSettings = localStorage.getItem("nexterm_settings");
  if (savedSettings) {
    try { userSettings = { ...userSettings, ...JSON.parse(savedSettings) }; } catch (e) {}
  }

  setupEventListeners();
  await refreshTree();
  activateHomeTab();
  updateStatus();
}

function updateStatus() {
  const tabCount = Object.keys(tabs).length;
  if (activeSessionsCountEl) {
    activeSessionsCountEl.textContent = `${tabCount} active tab${tabCount === 1 ? '' : 's'}`;
  }
  if (!activeTabId || activeTabId === "home") {
    if (activeTargetTextEl) activeTargetTextEl.textContent = "Home Dashboard";
    if (statusMessageEl) statusMessageEl.textContent = "Ready";
  } else {
    const t = tabs[activeTabId];
    if (t) {
      if (activeTargetTextEl) {
        activeTargetTextEl.textContent = t.isLocal ? "Local Terminal" : `SSH • ${t.profile.username}@${t.profile.host}`;
      }
      if (statusMessageEl) {
        statusMessageEl.textContent = t.isConnected ? `Connected: ${t.profile.name}` : `Disconnected: ${t.profile.name}`;
      }
    }
  }
  renderConnectedServers();
}

// Helper for escaping HTML entities
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --------------------------------------------------------------------------
// Connected Servers Panel (Live Active Sessions)
// --------------------------------------------------------------------------

function renderConnectedServers() {
  const listEl = document.getElementById("connectedServersList");
  const badgeEl = document.getElementById("connectedCountBadge");
  if (!listEl) return;

  const openTabsList = Object.entries(tabs);
  if (badgeEl) badgeEl.textContent = openTabsList.length.toString();

  if (openTabsList.length === 0) {
    listEl.innerHTML = `<div class="connected-empty-msg">No active connections</div>`;
    return;
  }

  listEl.innerHTML = "";
  openTabsList.forEach(([tabId, t]) => {
    const item = document.createElement("div");
    const isActive = activeTabId === tabId;
    item.className = `connected-server-item ${isActive ? 'active' : ''}`;
    item.dataset.tabId = tabId;

    const titleText = t.profile.name || (t.isLocal ? "Local Terminal" : t.profile.host);
    const subText = t.isLocal ? "Local Terminal (PowerShell)" : `SSH • ${t.profile.username || 'user'}@${t.profile.host || 'host'}:${t.profile.port || 22}`;

    item.innerHTML = `
      <span class="connected-item-dot"></span>
      <div class="connected-item-info">
        <span class="connected-item-title" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>
        <span class="connected-item-sub" title="${escapeHtml(subText)}">${escapeHtml(subText)}</span>
      </div>
      <span class="connected-item-close" title="Close connection">&times;</span>
    `;

    item.addEventListener("click", () => activateTab(tabId));
    item.querySelector(".connected-item-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tabId);
    });

    listEl.appendChild(item);
  });
}

// --------------------------------------------------------------------------
// Tree Rendering & Session Management (Drag-and-Drop)
// --------------------------------------------------------------------------

async function refreshTree(filter = "") {
  try {
    if (window.go && window.go.main && window.go.main.App) {
      rootNode = await window.go.main.App.GetSessionTree();
    } else {
      rootNode = {
        id: "root",
        name: "SAVED SESSIONS",
        expanded: true,
        children: [
          { id: "f1", name: "Production", expanded: true, children: [] },
          { id: "f2", name: "UAT", expanded: true, children: [] },
          { id: "f3", name: "Testing", expanded: true, children: [] },
          { id: "f4", name: "Local", expanded: true, children: [] },
          { id: "f5", name: "Client", expanded: true, children: [] },
          { id: "f6", name: "User", expanded: true, children: [] },
        ]
      };
    }
    renderTree(filter);
    updateRecentSessionsGrid();
  } catch (err) {
    console.error("Failed to load session tree:", err);
  }
}

function renderTree(filter = "") {
  treeEl.innerHTML = "";
  if (!rootNode) return;
  const lowerFilter = filter.trim().toLowerCase();

  // If root node has children, render its category folders directly under SAVED SESSIONS
  if (rootNode.children && rootNode.children.length > 0) {
    rootNode.children.forEach(child => {
      const el = renderNode(child, lowerFilter);
      if (el) treeEl.appendChild(el);
    });
  } else {
    const el = renderNode(rootNode, lowerFilter);
    if (el) treeEl.appendChild(el);
  }
}

function renderNode(node, filter = "") {
  if (!node) return null;
  const isFolder = !node.session;
  const matches = !filter || node.name.toLowerCase().includes(filter) ||
    (node.session && (node.session.host.toLowerCase().includes(filter) || node.session.username.toLowerCase().includes(filter)));

  let filteredChildren = [];
  if (isFolder && node.children) {
    filteredChildren = node.children
      .map(child => renderNode(child, filter))
      .filter(el => el !== null);
  }

  if (filter && !matches && filteredChildren.length === 0) return null;

  const wrap = document.createElement("div");
  const row = document.createElement("div");
  row.className = `tree-node-row ${isFolder ? "folder" : "session"}`;
  row.dataset.id = node.id;

  if (isFolder) {
    row.innerHTML = `
      <span class="chevron">${node.expanded !== false ? "▾" : "▸"}</span>
      <span class="node-icon">📁</span>
      <span class="node-name" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
      <span class="node-badge">${node.children ? node.children.length : 0}</span>
    `;

    row.addEventListener("click", (e) => {
      e.stopPropagation();
      node.expanded = !node.expanded;
      renderTree(sidebarQuickConnectInput ? sidebarQuickConnectInput.value : "");
      if (window.go && window.go.main && window.go.main.App) {
        window.go.main.App.ToggleFolder(node.id, node.expanded);
      }
    });

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showFolderContextMenu(e.clientX, e.clientY, node);
    });

    // Folder is a drop target for drag-and-drop
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      row.classList.add("drag-target-over");
    });

    row.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      row.classList.remove("drag-target-over");
    });

    row.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drag-target-over");
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data.nodeId || data.nodeId === node.id) return;

        if (window.go && window.go.main && window.go.main.App) {
          await window.go.main.App.MoveSession(data.nodeId, node.id);
        }
        await refreshTree();
        showToast(`Moved "${data.sessionName}" to "${node.name}"`, "success");
      } catch (err) {
        console.error("Drop error:", err);
      }
    });

  } else {
    const isConn = Object.values(tabs).some(t => t.profile && t.profile.id === node.session.id && t.isConnected);
    row.innerHTML = `
      <span style="width: 14px;"></span>
      <span class="node-icon">🔑</span>
      <span class="node-name" title="${escapeHtml(node.session.username)}@${escapeHtml(node.session.host)}">${escapeHtml(node.name)}</span>
      ${isConn ? '<span class="status-dot"></span>' : ''}
    `;

    // Session is draggable
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", JSON.stringify({ nodeId: node.id, sessionName: node.name }));
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });

    row.addEventListener("dragend", (e) => {
      e.stopPropagation();
      row.classList.remove("dragging");
      document.querySelectorAll(".tree-node-row.drag-target-over").forEach(el => el.classList.remove("drag-target-over"));
    });

    row.addEventListener("dblclick", () => connectToSession(node.session));
    row.addEventListener("click", () => {
      document.querySelectorAll(".tree-node-row.selected").forEach(el => el.classList.remove("selected"));
      row.classList.add("selected");
      if (statusMessageEl) statusMessageEl.textContent = `Selected: ${node.name}`;
    });
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showSessionContextMenu(e.clientX, e.clientY, node.session, node.id);
    });
  }

  wrap.appendChild(row);

  if (isFolder && node.children && node.children.length > 0 && node.expanded !== false) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "tree-node-children";
    filteredChildren.forEach(c => childrenContainer.appendChild(c));
    wrap.appendChild(childrenContainer);
  }

  return wrap;
}

function updateRecentSessionsGrid() {
  const section = document.getElementById("recentSessionsSection");
  const grid = document.getElementById("recentSessionsGrid");
  if (!grid || !rootNode) {
    if (section) section.style.display = "none";
    return;
  }

  const sessions = [];
  function collect(n) {
    if (!n) return;
    if (n.session) sessions.push(n.session);
    if (n.children) n.children.forEach(collect);
  }
  collect(rootNode);

  if (sessions.length === 0) {
    if (section) section.style.display = "none";
    grid.innerHTML = "";
    return;
  }

  if (section) section.style.display = "block";
  grid.innerHTML = sessions.slice(0, 6).map(s => {
    const safeName = (s.name || s.host || "Session").replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    const safeTitle = `${s.username || ''}@${s.host || ''}`.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    return `
      <div class="recent-session-card" data-id="${s.id}" title="${safeTitle}">
        <span class="key-icon">🔑</span>
        <span class="card-name">${safeName}</span>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".recent-session-card").forEach(card => {
    card.addEventListener("click", () => {
      const sess = sessions.find(s => s.id === card.dataset.id);
      if (sess) connectToSession(sess);
    });
  });
}

// --------------------------------------------------------------------------
// Tab & Terminal Connections
// --------------------------------------------------------------------------

function activateHomeTab() {
  activeTabId = "home";
  homeTabBtnEl.classList.add("active");
  welcomeStateEl.classList.add("active");
  floatingControlsEl.classList.add("hidden");

  Object.values(tabs).forEach(t => {
    t.tabEl.classList.remove("active");
    t.paneEl.classList.remove("active");
  });

  updateStatus();
}

async function startLocalTerminal(shellType = "powershell") {
  showToast("Launching local terminal...", "info");
  let tabId;
  try {
    if (window.go && window.go.main && window.go.main.App) {
      tabId = await window.go.main.App.OpenLocalTerminal(shellType);
    } else {
      tabId = "mock-local-" + Date.now();
    }
  } catch (err) {
    showToast("Failed to start local terminal: " + err, "error");
    return;
  }

  const profile = {
    id: tabId,
    name: shellType === "powershell" ? "PowerShell" : "Command Prompt",
    host: "localhost",
    username: "Local"
  };

  createTab(tabId, profile, true);
  showToast("Local terminal started", "success");
}

async function connectToSession(profile) {
  let password = "";

  if (!profile.privateKeyPath) {
    let hasSaved = false;
    if (window.go && window.go.main && window.go.main.App && profile.vaultKey) {
      try {
        hasSaved = await window.go.main.App.HasSavedPassword(profile.vaultKey);
      } catch (err) {}
    }

    if (!hasSaved) {
      password = await promptPasswordDialog(profile);
      if (password === null) return;
    }
  }

  showToast(`Connecting to ${profile.username}@${profile.host}...`, "info");
  if (statusMessageEl) statusMessageEl.textContent = `Connecting to ${profile.host}...`;

  let tabId;
  try {
    if (window.go && window.go.main && window.go.main.App) {
      tabId = await window.go.main.App.OpenSession(profile, password);
    } else {
      tabId = "mock-" + Math.random().toString(36).substring(7);
    }
    createTab(tabId, profile, false);
    showToast(`Connected to ${profile.name}`, "success");
  } catch (err) {
    showToast(`Connection failed: ${err}`, "error");
    if (statusMessageEl) statusMessageEl.textContent = "Connection failed";
  }
}

function createTab(tabId, profile, isLocal = false) {
  welcomeStateEl.classList.remove("active");
  homeTabBtnEl.classList.remove("active");
  floatingControlsEl.classList.remove("hidden");

  const tabEl = document.createElement("div");
  tabEl.className = "tab-item active";
  tabEl.dataset.tabId = tabId;
  tabEl.innerHTML = `
    <span class="tab-dot"></span>
    <span class="tab-title" title="${profile.name}">${profile.name}</span>
    <span class="tab-close" title="Close (Ctrl+W)">&times;</span>
  `;

  tabEl.addEventListener("click", () => activateTab(tabId));
  tabEl.querySelector(".tab-close").addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabbarEl.appendChild(tabEl);

  const paneEl = document.createElement("div");
  paneEl.className = "terminal-pane active";
  paneEl.dataset.tabId = tabId;
  panesEl.appendChild(paneEl);

  const selectedTheme = THEMES[profile.theme] || THEMES[userSettings.theme] || THEMES["dark-modern"];
  const term = new Terminal({
    fontFamily: userSettings.fontFamily,
    fontSize: profile.fontSize || userSettings.fontSize,
    cursorBlink: userSettings.cursorBlink,
    cursorStyle: userSettings.cursorStyle,
    scrollback: userSettings.scrollback,
    theme: selectedTheme,
    allowTransparency: true,
  });

  let fitAddon = null;
  try {
    if (typeof FitAddon !== "undefined") {
      fitAddon = typeof FitAddon.FitAddon === "function" ? new FitAddon.FitAddon() : new FitAddon();
      term.loadAddon(fitAddon);
    }
  } catch (e) {
    console.warn("FitAddon error:", e);
  }

  term.open(paneEl);

  setTimeout(() => {
    try {
      if (fitAddon) fitAddon.fit();
      term.focus();
      if (window.go && window.go.main && window.go.main.App) {
        window.go.main.App.ResizeTerminal(tabId, term.cols || 120, term.rows || 30);
      }
    } catch (e) {}
  }, 50);

  term.onData((data) => {
    if (window.go && window.go.main && window.go.main.App) {
      window.go.main.App.WriteToTerminal(tabId, data);
    }
  });

  if (window.runtime && window.runtime.EventsOn) {
    window.runtime.EventsOn("terminal:data:" + tabId, (data) => {
      term.write(data);
    });

    window.runtime.EventsOn("terminal:closed:" + tabId, (reason) => {
      term.write(`\r\n\x1b[1;31m[Session closed: ${reason || 'Disconnected'}]\x1b[0m\r\n`);
      if (tabs[tabId]) {
        tabs[tabId].isConnected = false;
        const dot = tabEl.querySelector(".tab-dot");
        if (dot) dot.classList.add("disconnected");
        updateStatus();
        renderTree();
      }
    });
  }

  // 1. MobaXterm-style Right-Click Paste
  paneEl.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (userSettings.rightClickPaste !== false) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && window.go && window.go.main && window.go.main.App) {
          window.go.main.App.WriteToTerminal(tabId, text);
        }
      } catch (err) {
        console.warn("Clipboard paste error:", err);
      }
    }
  });

  // 2. Middle-Click Paste (Linux / X11 style)
  paneEl.addEventListener("auxclick", async (e) => {
    if (e.button === 1) { // Middle click
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (text && window.go && window.go.main && window.go.main.App) {
          window.go.main.App.WriteToTerminal(tabId, text);
        }
      } catch (_) {}
    }
  });

  // 3. PuTTY / MobaXterm Auto-Copy on Selection
  term.onSelectionChange(() => {
    if (userSettings.autoCopySelection !== false) {
      const selection = term.getSelection();
      if (selection && selection.length > 0) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    }
  });

  // 4. Drag and Drop file(s) or file path directly into active terminal
  paneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  });

  paneEl.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const p = file.path || file.name;
        paths.push(p.includes(" ") ? `"${p}"` : p);
      }
      const textToPaste = paths.join(" ") + " ";
      if (window.go && window.go.main && window.go.main.App) {
        window.go.main.App.WriteToTerminal(tabId, textToPaste);
      }
    } else {
      const text = e.dataTransfer.getData("text");
      if (text && window.go && window.go.main && window.go.main.App) {
        window.go.main.App.WriteToTerminal(tabId, text);
      }
    }
  });

  tabs[tabId] = {
    term,
    fitAddon,
    profile,
    paneEl,
    tabEl,
    isConnected: true,
    isLocal
  };

  activateTab(tabId);
  renderTree();
}

let currentSplitMode = "single"; // "single", "split-v", "split-h", "grid-4"

function setSplitMode(mode) {
  currentSplitMode = mode;
  panesEl.className = "panes" + (mode === "single" ? "" : " " + mode);
  applySplitVisibility();
  showToast(`Split mode changed to: ${mode}`, "info");
}

function applySplitVisibility() {
  const allTabs = Object.values(tabs);
  if (currentSplitMode === "single") {
    allTabs.forEach(t => {
      const isActive = t.paneEl.dataset.tabId === activeTabId;
      t.paneEl.classList.toggle("active", isActive);
      t.paneEl.classList.remove("split-visible");
      if (isActive && t.fitAddon) setTimeout(() => t.fitAddon.fit(), 30);
    });
    return;
  }

  let limit = 2;
  if (currentSplitMode === "grid-4") limit = 4;

  const visibleTabs = allTabs.slice(0, limit);
  allTabs.forEach(t => {
    const isVisible = visibleTabs.includes(t);
    t.paneEl.classList.toggle("split-visible", isVisible);
    const isActive = t.paneEl.dataset.tabId === activeTabId;
    t.paneEl.classList.toggle("active", isActive);
    if (isVisible && t.fitAddon) {
      setTimeout(() => {
        try {
          t.fitAddon.fit();
          if (window.go && window.go.main && window.go.main.App) {
            window.go.main.App.ResizeTerminal(t.paneEl.dataset.tabId, t.term.cols || 80, t.term.rows || 24);
          }
        } catch (_) {}
      }, 50);
    }
  });
}

function showSplitMenu(x, y) {
  contextMenuEl.innerHTML = `
    <div class="context-menu-item" id="smSingle">🔲 1 Terminal (Default)</div>
    <div class="context-menu-item" id="smSplitV">▮▮ 2 Terminals Vertical (Ctrl+Shift+\\)</div>
    <div class="context-menu-item" id="smSplitH">〓 2 Terminals Horizontal (Ctrl+Shift+-)</div>
    <div class="context-menu-item" id="smGrid4">⊞ 4 Terminals Grid (2x2)</div>
  `;
  posMenu(x, y);

  contextMenuEl.querySelector("#smSingle").onclick = () => { hideContextMenu(); setSplitMode("single"); };
  contextMenuEl.querySelector("#smSplitV").onclick = () => { hideContextMenu(); setSplitMode("split-v"); };
  contextMenuEl.querySelector("#smSplitH").onclick = () => { hideContextMenu(); setSplitMode("split-h"); };
  contextMenuEl.querySelector("#smGrid4").onclick = () => { hideContextMenu(); setSplitMode("grid-4"); };
}

function activateTab(tabId) {
  if (tabId === "home") {
    activateHomeTab();
    return;
  }

  homeTabBtnEl.classList.remove("active");
  welcomeStateEl.classList.remove("active");
  floatingControlsEl.classList.remove("hidden");

  Object.entries(tabs).forEach(([id, t]) => {
    const isActive = id === tabId;
    t.tabEl.classList.toggle("active", isActive);
    t.paneEl.classList.toggle("active", isActive);
  });

  activeTabId = tabId;
  const currentTab = tabs[tabId];
  if (currentTab) {
    setTimeout(() => {
      try {
        if (currentTab.fitAddon) currentTab.fitAddon.fit();
        currentTab.term.focus();
        if (window.go && window.go.main && window.go.main.App) {
          window.go.main.App.ResizeTerminal(tabId, currentTab.term.cols || 120, currentTab.term.rows || 30);
        }
      } catch (e) {}
    }, 40);

    const sftpBadge = document.getElementById("sftpActiveTabBadge");
    if (sftpBadge) {
      if (!currentTab.isLocal) {
        sftpBadge.textContent = currentTab.profile.name || currentTab.profile.host;
        refreshSFTP();
      } else {
        sftpBadge.textContent = "Local Terminal";
      }
    }
  }

  applySplitVisibility();
  updateStatus();
}

function closeTab(tabId) {
  const t = tabs[tabId];
  if (!t) return;

  if (window.go && window.go.main && window.go.main.App) {
    window.go.main.App.CloseTab(tabId);
  }

  t.term.dispose();
  t.tabEl.remove();
  t.paneEl.remove();
  delete tabs[tabId];

  const remaining = Object.keys(tabs);
  if (remaining.length > 0) {
    activateTab(remaining[remaining.length - 1]);
  } else {
    activateHomeTab();
  }

  updateStatus();
  renderTree();
}

// --------------------------------------------------------------------------
// MultiExec Command Broadcast
// --------------------------------------------------------------------------

function toggleMultiExec() {
  const isHidden = multiExecBarEl.classList.toggle("hidden");
  if (!isHidden) {
    multiExecInputEl.focus();
    showToast("MultiExec enabled: Commands will broadcast to all tabs", "info");
  }
}

async function sendMultiExec() {
  const text = multiExecInputEl.value;
  if (!text) return;
  if (window.go && window.go.main && window.go.main.App) {
    await window.go.main.App.BroadcastCommand(text + "\r");
  } else {
    Object.values(tabs).forEach(t => t.term.write(text + "\r\n"));
  }
  multiExecInputEl.value = "";
  showToast("Broadcast sent to all active tabs", "success");
}

// --------------------------------------------------------------------------
// SFTP Graphical File Browser
// --------------------------------------------------------------------------

let currentSFTPPath = "/";
let sftpCurrentItems = [];

async function refreshSFTP(targetPath = "") {
  const fileListEl = document.getElementById("sftpFileList");
  const pathInput = document.getElementById("sftpPathInput");
  if (!fileListEl) return;

  if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
    fileListEl.innerHTML = `<div class="sftp-empty-hint">Connect to an SSH server to browse remote files via SFTP</div>`;
    return;
  }

  const path = targetPath || currentSFTPPath || "/";
  fileListEl.innerHTML = `<div class="sftp-empty-hint">Loading files from ${escapeHtml(path)}...</div>`;

  try {
    if (window.go && window.go.main && window.go.main.App) {
      const res = await window.go.main.App.SFTPList(activeTabId, path);
      currentSFTPPath = (res && res.path) || path;
      if (pathInput) pathInput.value = currentSFTPPath;
      sftpCurrentItems = (res && res.items) || [];
      renderSFTPItems(sftpCurrentItems);
    }
  } catch (err) {
    fileListEl.innerHTML = `<div class="sftp-empty-hint" style="color: var(--accent-red);">SFTP Error: ${escapeHtml(err.toString())}</div>`;
  }
}

function renderSFTPItems(items) {
  const fileListEl = document.getElementById("sftpFileList");
  if (!fileListEl) return;

  if (items.length === 0) {
    fileListEl.innerHTML = `<div class="sftp-empty-hint">Directory is empty</div>`;
    return;
  }

  fileListEl.innerHTML = "";
  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "sftp-file-row";
    row.dataset.path = item.path;
    row.dataset.isDir = item.isDir;

    const icon = item.isDir ? "📁" : (item.extension === ".sh" || item.extension === ".py" || item.extension === ".go" ? "📜" : (item.extension === ".tar" || item.extension === ".gz" || item.extension === ".zip" ? "📦" : "📄"));

    row.innerHTML = `
      <div class="sftp-item-left" title="${escapeHtml(item.path)} (${item.permissions})">
        <span>${icon}</span>
        <span class="sftp-item-name">${escapeHtml(item.name)}</span>
      </div>
      <span class="sftp-item-size">${item.formattedSize}</span>
    `;

    row.addEventListener("dblclick", async () => {
      if (item.isDir) {
        await refreshSFTP(item.path);
      } else {
        openRemoteFileEditor(item.path);
      }
    });

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showSFTPContextMenu(e.clientX, e.clientY, item);
    });

    fileListEl.appendChild(row);
  });
}

function showSFTPContextMenu(x, y, item) {
  contextMenuEl.innerHTML = `
    ${!item.isDir ? '<div class="context-menu-item" id="sftpEdit">✏️ Edit in MobaTextEditor</div>' : '<div class="context-menu-item" id="sftpOpenDir">📁 Open Folder</div>'}
    <div class="context-menu-item" id="sftpDownload">⬇ Download to Local PC</div>
    <div class="context-menu-item" id="sftpCopyPath">📋 Copy Remote Path</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" id="sftpRename">✏️ Rename</div>
    <div class="context-menu-item danger" id="sftpDelete">🗑️ Delete</div>
  `;
  posMenu(x, y);

  if (!item.isDir) {
    contextMenuEl.querySelector("#sftpEdit").onclick = () => { hideContextMenu(); openRemoteFileEditor(item.path); };
  } else {
    contextMenuEl.querySelector("#sftpOpenDir").onclick = () => { hideContextMenu(); refreshSFTP(item.path); };
  }

  contextMenuEl.querySelector("#sftpCopyPath").onclick = () => {
    hideContextMenu();
    navigator.clipboard.writeText(item.path);
    showToast("Copied remote path to clipboard", "info");
  };

  contextMenuEl.querySelector("#sftpDownload").onclick = async () => {
    hideContextMenu();
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const dest = await window.go.main.App.SelectDownloadDest(item.name);
        if (dest) {
          showToast(`Downloading ${item.name}...`, "info");
          await window.go.main.App.SFTPDownload(activeTabId, item.path, dest);
          showToast(`Downloaded ${item.name} successfully`, "success");
        }
      } catch (err) {
        showToast("Download failed: " + err, "error");
      }
    }
  };

  contextMenuEl.querySelector("#sftpRename").onclick = async () => {
    hideContextMenu();
    const newName = prompt("Enter new name:", item.name);
    if (newName && newName !== item.name && window.go && window.go.main && window.go.main.App) {
      const parentDir = item.path.substring(0, item.path.lastIndexOf("/"));
      const newPath = (parentDir === "" ? "/" : parentDir) + "/" + newName;
      try {
        await window.go.main.App.SFTPRename(activeTabId, item.path, newPath);
        showToast("Renamed successfully", "success");
        await refreshSFTP(currentSFTPPath);
      } catch (err) {
        showToast("Rename failed: " + err, "error");
      }
    }
  };

  contextMenuEl.querySelector("#sftpDelete").onclick = async () => {
    hideContextMenu();
    if (confirm(`Are you sure you want to delete "${item.name}" from remote server?`)) {
      if (window.go && window.go.main && window.go.main.App) {
        try {
          await window.go.main.App.SFTPDelete(activeTabId, item.path);
          showToast(`Deleted ${item.name}`, "info");
          await refreshSFTP(currentSFTPPath);
        } catch (err) {
          showToast("Delete failed: " + err, "error");
        }
      }
    }
function showModal(htmlContent, extraClass = "") {
  if (!modalOverlayEl || !modalBoxEl) return null;
  modalBoxEl.className = "modal-card " + extraClass;
  modalBoxEl.innerHTML = htmlContent;
  modalOverlayEl.classList.remove("hidden");
  modalOverlayEl.style.display = "flex";

  // Backdrop click to close
  modalOverlayEl.onclick = (e) => {
    if (e.target === modalOverlayEl) hideModal();
  };

  // Close buttons
  const closeBtn = modalBoxEl.querySelector("#modalClose") || modalBoxEl.querySelector(".modal-close-btn") || modalBoxEl.querySelector("#modalCloseBtn");
  if (closeBtn) closeBtn.onclick = hideModal;
  const cancelBtn = modalBoxEl.querySelector("#modalCancel");
  if (cancelBtn) cancelBtn.onclick = hideModal;

  return modalBoxEl;
}

function hideModal() {
  if (!modalOverlayEl) return;
  modalOverlayEl.classList.add("hidden");
  modalOverlayEl.style.display = "none";
  if (modalBoxEl) modalBoxEl.innerHTML = "";
}

async function openRemoteFileEditor(remotePath) {
  if (!activeTabId || !window.go || !window.go.main || !window.go.main.App) return;
  showToast(`Opening ${remotePath}...`, "info");
  try {
    const content = await window.go.main.App.SFTPReadFile(activeTabId, remotePath);
    const fileName = remotePath.substring(remotePath.lastIndexOf("/") + 1);
    const box = showModal(`
      <div class="modal-header">
        <div class="modal-title">MobaTextEditor — ${escapeHtml(fileName)}</div>
        <button class="modal-close-btn" id="modalClose">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 11px; color: var(--text-muted); font-family: 'Fira Code', monospace; margin-bottom: 6px;">
          Remote File: <b>${escapeHtml(remotePath)}</b>
        </div>
        <div class="form-group">
          <textarea id="remoteEditTextarea" style="width: 100%; height: 320px; font-family: 'Fira Code', monospace; font-size: 12px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px;" spellcheck="false"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" id="modalCancel">Close</button>
        <button class="btn-primary" id="saveRemoteBtn">💾 Save & Upload</button>
      </div>
    `);

    const textarea = box.querySelector("#remoteEditTextarea");
    textarea.value = content;
    box.querySelector("#modalCancel").onclick = hideModal;
    box.querySelector("#modalClose").onclick = hideModal;

    box.querySelector("#saveRemoteBtn").onclick = async () => {
      const newText = textarea.value;
      try {
        await window.go.main.App.SFTPWriteFile(activeTabId, remotePath, newText);
        showToast(`Saved and uploaded ${fileName}`, "success");
        hideModal();
        await refreshSFTP(currentSFTPPath);
      } catch (err) {
        showToast("Save failed: " + err, "error");
      }
    };
  } catch (err) {
    showToast("Failed to open remote file: " + err, "error");
  }
}

// --------------------------------------------------------------------------
// MobaSSHTunnel Management
// --------------------------------------------------------------------------

async function renderSidebarTunnels() {
  const container = document.getElementById("sidebarTunnelList");
  if (!container) return;

  try {
    let tunnels = [];
    if (window.go && window.go.main && window.go.main.App) {
      tunnels = await window.go.main.App.GetTunnels() || [];
    }

    if (tunnels.length === 0) {
      container.innerHTML = `<div class="sftp-empty-hint">No active SSH tunnels.<br/>Click <b>＋ New SSH Tunnel</b> to configure port forwarding.</div>`;
      return;
    }

    container.innerHTML = tunnels.map(t => `
      <div class="tunnel-card">
        <div class="tunnel-card-title">
          <span>🔑 ${escapeHtml(t.name)}</span>
          <span class="tunnel-badge ${t.status || 'stopped'}">${t.status || 'stopped'}</span>
        </div>
        <div class="tunnel-card-desc">
          <b>${t.type.toUpperCase()}</b>: Local <code>:${t.localPort}</code> &rarr; <code>${escapeHtml(t.remoteHost || '*')}:${t.remotePort || '*'}</code>
        </div>
        <div class="tunnel-card-actions">
          ${t.status === 'running' 
            ? `<button class="pwd-action-btn danger stop-tun-btn" data-id="${t.id}">■ Stop</button>`
            : `<button class="pwd-action-btn start-tun-btn" data-id="${t.id}">▶ Start</button>`
          }
          <button class="pwd-action-btn danger del-tun-btn" data-id="${t.id}">🗑️</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".start-tun-btn").forEach(b => {
      b.onclick = async () => {
        if (!activeTabId || activeTabId === "home") {
          showToast("Please open an active SSH tab first to bind the tunnel", "warning");
          return;
        }
        try {
          await window.go.main.App.StartTunnel(b.dataset.id, activeTabId);
          showToast("SSH tunnel started", "success");
          await renderSidebarTunnels();
        } catch (err) {
          showToast("Failed to start tunnel: " + err, "error");
        }
      };
    });

    container.querySelectorAll(".stop-tun-btn").forEach(b => {
      b.onclick = async () => {
        try {
          await window.go.main.App.StopTunnel(b.dataset.id);
          showToast("Tunnel stopped", "info");
          await renderSidebarTunnels();
        } catch (err) {
          showToast("Failed to stop tunnel: " + err, "error");
        }
      };
    });

    container.querySelectorAll(".del-tun-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this tunnel definition?")) {
          await window.go.main.App.DeleteTunnel(b.dataset.id);
          await renderSidebarTunnels();
        }
      };
    });

  } catch (err) {
    container.innerHTML = `<div class="sftp-empty-hint" style="color: var(--accent-red);">${escapeHtml(err.toString())}</div>`;
  }
}

function showTunnelingDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">MobaSSHTunnel — Visual Port Forwarding Manager</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px;">
        Manage visual SSH tunnels: Local Port Forwarding, Remote Port Forwarding, and Dynamic SOCKS5 Proxy.
      </div>
      <div id="modalTunnelList" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
        <div style="text-align: center; color: var(--text-dim); padding: 16px;">Loading tunnels...</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-primary" id="newTunnelWizardBtn">＋ New SSH Tunnel</button>
    </div>
  `);

  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#newTunnelWizardBtn").onclick = () => {
    hideModal();
    showNewTunnelWizard();
  };

  const loadModalTunnels = async () => {
    const listEl = box.querySelector("#modalTunnelList");
    if (!listEl) return;
    try {
      const tunnels = await window.go.main.App.GetTunnels() || [];
      if (tunnels.length === 0) {
        listEl.innerHTML = `<div class="pwd-empty-state">No active tunnels. Click <b>＋ New SSH Tunnel</b> to configure forwarding.</div>`;
        return;
      }
      listEl.innerHTML = tunnels.map(t => `
        <div class="pwd-card">
          <div class="pwd-card-header">
            <span class="pwd-card-title">🔑 ${escapeHtml(t.name)}</span>
            <span class="tunnel-badge ${t.status || 'stopped'}">${t.status || 'stopped'}</span>
          </div>
          <div class="pwd-card-body">
            <div style="font-size: 11px; color: var(--text-muted); font-family: 'Fira Code', monospace;">
              <b>${t.type.toUpperCase()}</b>: Local :${t.localPort} &rarr; ${t.remoteHost || '*'}:${t.remotePort || '*'}
            </div>
            <div class="pwd-actions">
              ${t.status === 'running' 
                ? `<button class="pwd-action-btn danger stop-modal-tun" data-id="${t.id}">■ Stop</button>`
                : `<button class="pwd-action-btn start-modal-tun" data-id="${t.id}">▶ Start</button>`
              }
              <button class="pwd-action-btn danger del-modal-tun" data-id="${t.id}">🗑️ Delete</button>
            </div>
          </div>
        </div>
      `).join("");

      listEl.querySelectorAll(".start-modal-tun").forEach(b => {
        b.onclick = async () => {
          if (!activeTabId || activeTabId === "home") {
            showToast("Open an SSH tab first to bind tunnel", "warning");
            return;
          }
          await window.go.main.App.StartTunnel(b.dataset.id, activeTabId);
          await loadModalTunnels();
          await renderSidebarTunnels();
        };
      });
      listEl.querySelectorAll(".stop-modal-tun").forEach(b => {
        b.onclick = async () => {
          await window.go.main.App.StopTunnel(b.dataset.id);
          await loadModalTunnels();
          await renderSidebarTunnels();
        };
      });
      listEl.querySelectorAll(".del-modal-tun").forEach(b => {
        b.onclick = async () => {
          if (confirm("Delete tunnel?")) {
            await window.go.main.App.DeleteTunnel(b.dataset.id);
            await loadModalTunnels();
            await renderSidebarTunnels();
          }
        };
      });
    } catch (_) {}
  };
  loadModalTunnels();
}

function showNewTunnelWizard() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">New SSH Port Forwarding Tunnel</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Tunnel Name</label>
        <input type="text" id="tunName" placeholder="e.g. Oracle Database Forwarding" value="My SSH Tunnel" />
      </div>
      <div class="form-group">
        <label>Forwarding Type</label>
        <select id="tunType">
          <option value="local">Local Port Forwarding (Local PC &rarr; Remote Service)</option>
          <option value="remote">Remote Port Forwarding (Remote Server &rarr; Local PC)</option>
          <option value="dynamic">Dynamic SOCKS5 Proxy</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Local Port *</label>
          <input type="number" id="tunLocalPort" value="1521" />
        </div>
        <div class="form-group" id="tunRemotePortGroup">
          <label>Remote Port *</label>
          <input type="number" id="tunRemotePort" value="1521" />
        </div>
      </div>
      <div class="form-group" id="tunRemoteHostGroup">
        <label>Remote Destination Host / IP *</label>
        <input type="text" id="tunRemoteHost" value="10.0.0.5" placeholder="e.g. 10.0.0.5 or 127.0.0.1" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="saveTunnelBtn">Save Tunnel</button>
    </div>
  `);

  const typeSelect = box.querySelector("#tunType");
  typeSelect.onchange = () => {
    const isDynamic = typeSelect.value === "dynamic";
    box.querySelector("#tunRemotePortGroup").classList.toggle("hidden", isDynamic);
    box.querySelector("#tunRemoteHostGroup").classList.toggle("hidden", isDynamic);
  };

  box.querySelector("#modalCancel").onclick = hideModal;
  box.querySelector("#modalClose").onclick = hideModal;

  box.querySelector("#saveTunnelBtn").onclick = async () => {
    const t = {
      name: box.querySelector("#tunName").value.trim() || "SSH Tunnel",
      type: typeSelect.value,
      localPort: parseInt(box.querySelector("#tunLocalPort").value, 10) || 8080,
      remotePort: parseInt(box.querySelector("#tunRemotePort").value, 10) || 80,
      remoteHost: box.querySelector("#tunRemoteHost").value.trim() || "127.0.0.1",
      autoStart: false
    };
    hideModal();
    if (window.go && window.go.main && window.go.main.App) {
      await window.go.main.App.SaveTunnel(t);
      showToast("SSH tunnel saved", "success");
      await renderSidebarTunnels();
    }
  };
}

// --------------------------------------------------------------------------
// Terminal Macros Engine
// --------------------------------------------------------------------------

async function renderSidebarMacros() {
  const container = document.getElementById("macrosList");
  if (!container) return;

  try {
    let macros = [];
    if (window.go && window.go.main && window.go.main.App) {
      macros = await window.go.main.App.GetMacros() || [];
    }

    if (macros.length === 0) {
      container.innerHTML = `<div class="sftp-empty-hint">No macros recorded.<br/>Click <b>＋ Record New Macro</b> to create one.</div>`;
      return;
    }

    container.innerHTML = macros.map(m => `
      <div class="macro-card">
        <div class="macro-card-title">
          <span>📜 ${escapeHtml(m.name)}</span>
          <span style="font-size: 9.5px; color: var(--accent-cyan); font-weight: 600;">${escapeHtml(m.category || 'General')}</span>
        </div>
        <div class="macro-card-desc">${escapeHtml(m.description || m.commands.join('; '))}</div>
        <div class="macro-card-actions">
          <button class="pwd-action-btn run-macro-btn" data-id="${m.id}" style="color: var(--accent-green);">▶ Run</button>
          <button class="pwd-action-btn danger del-macro-btn" data-id="${m.id}">🗑️</button>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".run-macro-btn").forEach(b => {
      b.onclick = () => runMacro(b.dataset.id);
    });

    container.querySelectorAll(".del-macro-btn").forEach(b => {
      b.onclick = async () => {
        if (confirm("Delete this macro?")) {
          await window.go.main.App.DeleteMacro(b.dataset.id);
          await renderSidebarMacros();
        }
      };
    });

  } catch (err) {
    container.innerHTML = `<div class="sftp-empty-hint" style="color: var(--accent-red);">${escapeHtml(err.toString())}</div>`;
  }
}

async function runMacro(macroId) {
  if (!activeTabId || activeTabId === "home") {
    showToast("Please select an active terminal tab to run macro", "warning");
    return;
  }
  if (window.go && window.go.main && window.go.main.App) {
    try {
      await window.go.main.App.ExecuteMacro(macroId, [activeTabId]);
      showToast("Macro executed on active terminal", "success");
    } catch (err) {
      showToast("Macro error: " + err, "error");
    }
  }
}

function showRecordMacroDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">Record / Create Terminal Macro</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Macro Name *</label>
        <input type="text" id="macroName" placeholder="e.g. Restart Billing Cluster" />
      </div>
      <div class="form-group">
        <label>Category</label>
        <input type="text" id="macroCat" placeholder="e.g. Production / Oracle / Maintenance" value="Operations" />
      </div>
      <div class="form-group">
        <label>Shell Commands (One per line) *</label>
        <textarea id="macroCmds" style="width: 100%; height: 160px; font-family: 'Fira Code', monospace; font-size: 12px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px;" placeholder="cd /opt/brm&#10;./pin_ctl status&#10;df -h"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="saveMacroBtn">Save Macro</button>
    </div>
  `);

  box.querySelector("#modalCancel").onclick = hideModal;
  box.querySelector("#modalClose").onclick = hideModal;

  box.querySelector("#saveMacroBtn").onclick = async () => {
    const name = box.querySelector("#macroName").value.trim();
    const rawCmds = box.querySelector("#macroCmds").value.trim();
    if (!name || !rawCmds) {
      showToast("Macro name and commands are required", "error");
      return;
    }
    const commands = rawCmds.split("\n").map(c => c.trim()).filter(c => c.length > 0);
    const m = {
      name,
      category: box.querySelector("#macroCat").value.trim() || "Operations",
      description: commands.slice(0, 2).join("; "),
      commands,
      delayMs: 500
    };
    hideModal();
    if (window.go && window.go.main && window.go.main.App) {
      await window.go.main.App.SaveMacro(m);
      showToast("Macro saved", "success");
      await renderSidebarMacros();
    }
  };
}

// --------------------------------------------------------------------------
// Network & Sysadmin Toolbox
// --------------------------------------------------------------------------

function showPingDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">Network Ping & Latency Diagnostics</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label>Target Host / IP</label>
          <input type="text" id="pingHost" value="8.8.8.8" />
        </div>
        <div class="form-group" style="flex: 1; display: flex; align-items: flex-end;">
          <button class="btn-primary" id="doPingBtn" style="width: 100%; height: 32px;">🏓 Ping</button>
        </div>
      </div>
      <div id="pingOutput" style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px; height: 160px; overflow-y: auto; font-family: 'Fira Code', monospace; font-size: 11.5px; color: var(--text-dim); white-space: pre-wrap;">Ready to ping target.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#doPingBtn").onclick = async () => {
    const h = box.querySelector("#pingHost").value.trim();
    const out = box.querySelector("#pingOutput");
    out.textContent = `Pinging ${h}...`;
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const res = await window.go.main.App.NetPing(h);
        out.textContent = res;
      } catch (err) {
        out.textContent = "Ping error: " + err;
      }
    }
  };
}

function showDNSDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">DNS & MX Lookup Tool</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label>Domain Name</label>
          <input type="text" id="dnsDomain" value="google.com" />
        </div>
        <div class="form-group" style="flex: 1; display: flex; align-items: flex-end;">
          <button class="btn-primary" id="doDNSBtn" style="width: 100%; height: 32px;">🔍 Lookup</button>
        </div>
      </div>
      <div id="dnsOutput" style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px; height: 160px; overflow-y: auto; font-family: 'Fira Code', monospace; font-size: 11.5px; color: var(--text-dim);">Enter domain name above.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#doDNSBtn").onclick = async () => {
    const d = box.querySelector("#dnsDomain").value.trim();
    const out = box.querySelector("#dnsOutput");
    out.innerHTML = `Resolving DNS for ${d}...`;
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const records = await window.go.main.App.NetLookupDNS(d);
        out.innerHTML = Object.entries(records).map(([type, vals]) => `
          <div style="margin-bottom: 6px;">
            <b style="color: var(--accent-blue);">${type}:</b><br/>
            ${vals.map(v => `&bull; ${escapeHtml(v)}`).join("<br/>")}
          </div>
        `).join("");
      } catch (err) {
        out.textContent = "DNS lookup error: " + err;
      }
    }
  };
}

function showHashDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">Checksum & Hash Calculator</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Input Text</label>
        <input type="text" id="hashInput" placeholder="Enter text to hash..." />
      </div>
      <div class="form-group">
        <label>Algorithm</label>
        <select id="hashAlgo">
          <option value="sha256">SHA-256 (Default)</option>
          <option value="md5">MD5</option>
          <option value="sha1">SHA-1</option>
          <option value="sha512">SHA-512</option>
        </select>
      </div>
      <div class="form-group">
        <label>Computed Hash</label>
        <textarea id="hashResult" readonly style="width: 100%; height: 70px; font-family: 'Fira Code', monospace; font-size: 11px; background: var(--bg-input); color: var(--accent-green); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 6px;"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-secondary" id="copyHashBtn">📋 Copy Hash</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  const doCalc = async () => {
    const val = box.querySelector("#hashInput").value;
    const algo = box.querySelector("#hashAlgo").value;
    if (window.go && window.go.main && window.go.main.App) {
      box.querySelector("#hashResult").value = await window.go.main.App.NetCalculateHash(val, algo);
    }
  };
  box.querySelector("#hashInput").oninput = doCalc;
  box.querySelector("#hashAlgo").onchange = doCalc;
  box.querySelector("#copyHashBtn").onclick = () => {
    const res = box.querySelector("#hashResult").value;
    if (res) {
      navigator.clipboard.writeText(res);
      showToast("Copied hash to clipboard", "info");
    }
  };
}

// --------------------------------------------------------------------------
// Multi-Protocol New Session Dialog (SSH, SFTP, RDP, VNC, Telnet, Serial, Local)
// --------------------------------------------------------------------------

function showNewSessionDialog(parentFolderId = "", editProfile = null) {
  const isEdit = !!editProfile;
  const p = editProfile || {
    id: "",
    name: "New Server",
    protocol: "ssh",
    host: "",
    port: 22,
    username: "root",
    authType: "password",
    privateKeyPath: "",
    startupCommand: "",
    theme: userSettings.theme,
    fontSize: userSettings.fontSize,
    keepAliveInterval: 15,
    useJumpHost: false,
    jumpHost: "",
    jumpPort: 22,
    jumpUsername: "bastion",
    jumpAuthType: "password",
    serialPort: "COM1",
    baudRate: 115200,
    rdpDomain: "",
    rdpFullScreen: false
  };

  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "Edit Session" : "New Session Wizard — MobaXterm Edition"}</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>

    <!-- Protocol Selection Cards -->
    <div class="proto-picker-grid" style="padding: 10px 14px 0 14px;">
      <div class="proto-card ${p.protocol === 'ssh' || !p.protocol ? 'active' : ''}" data-proto="ssh">
        <div class="proto-card-icon">🔒</div>
        <div class="proto-card-title">SSH</div>
      </div>
      <div class="proto-card ${p.protocol === 'sftp' ? 'active' : ''}" data-proto="sftp">
        <div class="proto-card-icon">📁</div>
        <div class="proto-card-title">SFTP</div>
      </div>
      <div class="proto-card ${p.protocol === 'rdp' ? 'active' : ''}" data-proto="rdp">
        <div class="proto-card-icon">🖥️</div>
        <div class="proto-card-title">RDP</div>
      </div>
      <div class="proto-card ${p.protocol === 'serial' ? 'active' : ''}" data-proto="serial">
        <div class="proto-card-icon">🔌</div>
        <div class="proto-card-title">Serial</div>
      </div>
    </div>

    <div class="modal-tabs">
      <button class="modal-tab-btn active" data-tab="tab-gen">General</button>
      <button class="modal-tab-btn" data-tab="tab-auth" id="tabAuthBtn">Authentication</button>
      <button class="modal-tab-btn" data-tab="tab-jump" id="tabJumpBtn">Jump Host (Bastion)</button>
      <button class="modal-tab-btn" data-tab="tab-adv">Advanced</button>
    </div>

    <div class="modal-body">
      <!-- General Tab -->
      <div id="tab-gen" class="tab-content">
        <div class="form-group">
          <label>Session Name</label>
          <input type="text" id="sName" value="${escapeHtml(p.name)}" placeholder="e.g. Oracle BRM Production 01" />
        </div>
        <div id="networkFieldsGroup">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label>Remote Host / IP *</label>
              <input type="text" id="sHost" value="${escapeHtml(p.host)}" placeholder="192.168.1.100 or server.company.com" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Port</label>
              <input type="number" id="sPort" value="${p.port || 22}" />
            </div>
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="sUser" value="${escapeHtml(p.username)}" placeholder="root" />
          </div>
        </div>

        <!-- Serial Specific Fields -->
        <div id="serialFieldsGroup" class="hidden">
          <div class="form-row">
            <div class="form-group">
              <label>Serial Port (COM)</label>
              <select id="sSerialPort">
                <option value="COM1">COM1</option>
                <option value="COM2">COM2</option>
                <option value="COM3">COM3</option>
                <option value="COM4">COM4</option>
              </select>
            </div>
            <div class="form-group">
              <label>Baud Rate</label>
              <select id="sBaudRate">
                <option value="115200">115200</option>
                <option value="9600">9600</option>
                <option value="57600">57600</option>
                <option value="38400">38400</option>
              </select>
            </div>
          </div>
        </div>

        <!-- RDP Specific Fields -->
        <div id="rdpFieldsGroup" class="hidden">
          <div class="form-group">
            <label>Windows Domain (Optional)</label>
            <input type="text" id="sRDPDomain" value="${escapeHtml(p.rdpDomain || '')}" placeholder="e.g. CORP" />
          </div>
          <label class="checkbox-label">
            <input type="checkbox" id="sRDPFullScreen" ${p.rdpFullScreen ? 'checked' : ''} />
            <span>Open in Fullscreen Mode</span>
          </label>
        </div>
      </div>

      <!-- Authentication Tab -->
      <div id="tab-auth" class="tab-content hidden">
        <div class="form-group">
          <label>Authentication Type</label>
          <select id="sAuthType">
            <option value="password" ${p.authType === 'password' || !p.privateKeyPath ? 'selected' : ''}>Password (DPAPI Vault)</option>
            <option value="key" ${p.authType === 'key' || p.privateKeyPath ? 'selected' : ''}>Private Key (RSA / PEM)</option>
          </select>
        </div>
        <div id="keyFields" class="${p.privateKeyPath ? '' : 'hidden'}">
          <div class="form-group">
            <label>Private Key File</label>
            <div class="file-input-group">
              <input type="text" id="sKeyPath" value="${p.privateKeyPath || ''}" placeholder="C:\\keys\\id_rsa" />
              <button class="btn-secondary" id="browseKeyBtn">Browse...</button>
            </div>
          </div>
        </div>
        <div id="passFields" class="${p.privateKeyPath ? 'hidden' : ''}">
          <div class="form-group">
            <label>Password (Encrypted in DPAPI Vault)</label>
            <input type="password" id="sPassword" placeholder="Leave blank to prompt on connect" />
          </div>
        </div>
      </div>

      <!-- Jump Host (Bastion Gateway) Tab -->
      <div id="tab-jump" class="tab-content hidden">
        <label class="checkbox-label" style="margin-bottom: 10px;">
          <input type="checkbox" id="sUseJump" ${p.useJumpHost ? 'checked' : ''} />
          <span><b>Connect through SSH Gateway (Jump Host / Bastion Proxy)</b></span>
        </label>
        <div id="jumpFields" class="${p.useJumpHost ? '' : 'hidden'}">
          <div class="form-row">
            <div class="form-group" style="flex: 2;">
              <label>Gateway Host / IP</label>
              <input type="text" id="sJumpHost" value="${escapeHtml(p.jumpHost || '')}" placeholder="bastion.company.com" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label>Gateway Port</label>
              <input type="number" id="sJumpPort" value="${p.jumpPort || 22}" />
            </div>
          </div>
          <div class="form-group">
            <label>Gateway Username</label>
            <input type="text" id="sJumpUser" value="${escapeHtml(p.jumpUsername || 'bastion')}" />
          </div>
          <div class="form-group">
            <label>Gateway Password</label>
            <input type="password" id="sJumpPassword" placeholder="Leave blank if using SSH key or prompted" />
          </div>
        </div>
      </div>

      <!-- Advanced Tab -->
      <div id="tab-adv" class="tab-content hidden">
        <div class="form-group">
          <label>Startup Command (Executes on login)</label>
          <input type="text" id="sStartup" value="${escapeHtml(p.startupCommand || '')}" placeholder="e.g. cd /opt/brm && ./pin_ctl status" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Font Size</label>
            <input type="number" id="sFontSize" value="${p.fontSize || 13}" />
          </div>
          <div class="form-group">
            <label>Keep-Alive Heartbeat (s)</label>
            <input type="number" id="sKeepAlive" value="${p.keepAliveInterval || 15}" />
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="modalSave">${isEdit ? "Save Changes" : "Save & Connect"}</button>
    </div>
  `);

  let currentProto = p.protocol || "ssh";

  // Protocol selection switcher
  box.querySelectorAll(".proto-card").forEach(c => {
    c.onclick = () => {
      box.querySelectorAll(".proto-card").forEach(pc => pc.classList.remove("active"));
      c.classList.add("active");
      currentProto = c.dataset.proto;

      const isSerial = currentProto === "serial";
      const isRDP = currentProto === "rdp";

      box.querySelector("#serialFieldsGroup").classList.toggle("hidden", !isSerial);
      box.querySelector("#networkFieldsGroup").classList.toggle("hidden", isSerial);
      box.querySelector("#rdpFieldsGroup").classList.toggle("hidden", !isRDP);
      box.querySelector("#tabJumpBtn").classList.toggle("hidden", isSerial || isRDP);

      const portInput = box.querySelector("#sPort");
      if (isRDP && portInput.value === "22") portInput.value = "3389";
      else if (currentProto === "ssh" && portInput.value === "3389") portInput.value = "22";
    };
  });

  // Tab switching
  box.querySelectorAll(".modal-tab-btn").forEach(btn => {
    btn.onclick = () => {
      box.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
      box.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      btn.classList.add("active");
      box.querySelector(`#${btn.dataset.tab}`).classList.remove("hidden");
    };
  });

  const jumpCheckbox = box.querySelector("#sUseJump");
  if (jumpCheckbox) {
    jumpCheckbox.onchange = () => {
      box.querySelector("#jumpFields").classList.toggle("hidden", !jumpCheckbox.checked);
    };
  }

  const authSelect = box.querySelector("#sAuthType");
  authSelect.onchange = () => {
    const isKey = authSelect.value === "key";
    box.querySelector("#keyFields").classList.toggle("hidden", !isKey);
    box.querySelector("#passFields").classList.toggle("hidden", isKey);
  };

  box.querySelector("#browseKeyBtn").onclick = async () => {
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const path = await window.go.main.App.SelectPrivateKeyFile();
        if (path) box.querySelector("#sKeyPath").value = path;
      } catch (_) {}
    }
  };

  box.querySelector("#modalCancel").onclick = hideModal;
  box.querySelector("#modalClose").onclick = hideModal;

  box.querySelector("#modalSave").onclick = async () => {
    const host = box.querySelector("#sHost").value.trim();
    const username = box.querySelector("#sUser").value.trim();
    if (currentProto !== "serial" && !host) {
      showToast("Remote Host is required", "error");
      return;
    }

    const profile = {
      id: isEdit ? editProfile.id : "",
      name: box.querySelector("#sName").value.trim() || host || "Serial Session",
      protocol: currentProto,
      host,
      port: parseInt(box.querySelector("#sPort").value, 10) || (currentProto === "rdp" ? 3389 : 22),
      username,
      authType: authSelect.value,
      privateKeyPath: authSelect.value === "key" ? box.querySelector("#sKeyPath").value.trim() : "",
      startupCommand: box.querySelector("#sStartup").value.trim(),
      fontSize: parseInt(box.querySelector("#sFontSize").value, 10) || 13,
      keepAliveInterval: parseInt(box.querySelector("#sKeepAlive").value, 10) || 15,
      useJumpHost: box.querySelector("#sUseJump") ? box.querySelector("#sUseJump").checked : false,
      jumpHost: box.querySelector("#sJumpHost") ? box.querySelector("#sJumpHost").value.trim() : "",
      jumpPort: box.querySelector("#sJumpPort") ? parseInt(box.querySelector("#sJumpPort").value, 10) || 22 : 22,
      jumpUsername: box.querySelector("#sJumpUser") ? box.querySelector("#sJumpUser").value.trim() : "",
      serialPort: box.querySelector("#sSerialPort") ? box.querySelector("#sSerialPort").value : "COM1",
      baudRate: box.querySelector("#sBaudRate") ? parseInt(box.querySelector("#sBaudRate").value, 10) || 115200 : 115200,
      rdpDomain: box.querySelector("#sRDPDomain") ? box.querySelector("#sRDPDomain").value.trim() : "",
      rdpFullScreen: box.querySelector("#sRDPFullScreen") ? box.querySelector("#sRDPFullScreen").checked : false
    };

    const enteredPw = box.querySelector("#sPassword") ? box.querySelector("#sPassword").value : "";
    const jumpPw = box.querySelector("#sJumpPassword") ? box.querySelector("#sJumpPassword").value : "";
    hideModal();

    if (window.go && window.go.main && window.go.main.App) {
      if (isEdit) {
        await window.go.main.App.UpdateSession(profile);
      } else {
        await window.go.main.App.AddSession(parentFolderId, profile);
      }
      if (enteredPw && profile.vaultKey) {
        await window.go.main.App.SaveSessionPassword(profile.vaultKey, enteredPw);
      }
      if (jumpPw && profile.jumpVaultKey) {
        await window.go.main.App.SaveSessionPassword(profile.jumpVaultKey, jumpPw);
      }
    }
    await refreshTree();

    if (currentProto === "rdp") {
      showToast(`Launching native RDP session to ${profile.host}...`, "info");
      if (window.go && window.go.main && window.go.main.App) {
        await window.go.main.App.LaunchRDPSession(profile, enteredPw);
      }
    } else {
      connectToSession(profile);
    }
  };
}

// --------------------------------------------------------------------------
// Configuration & Preferences (with Security Policies & Customizer)
// --------------------------------------------------------------------------

async function showSettingsDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">⚙️ NexTerm Professional Settings & Preferences</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-tabs">
      <button class="modal-tab-btn active" data-tab="tab-settings-term">🖥️ Terminal & UI</button>
      <button class="modal-tab-btn" data-tab="tab-settings-pwd">🔑 Password Vault</button>
      <button class="modal-tab-btn" data-tab="tab-settings-sec">🛡️ Security Policies</button>
      <button class="modal-tab-btn" data-tab="tab-settings-custom">🏢 Customizer</button>
    </div>
    <div class="modal-body" style="max-height: 480px; overflow-y: auto;">
      <!-- 1. Terminal & UI Settings Tab -->
      <div id="tab-settings-term" class="tab-content">
        <div class="form-group">
          <label>Terminal Color Scheme</label>
          <select id="cfgTheme">
            <option value="dark-modern" ${userSettings.theme === 'dark-modern' ? 'selected' : ''}>Dark Modern (MobaXterm Default)</option>
            <option value="solarized-dark" ${userSettings.theme === 'solarized-dark' ? 'selected' : ''}>Solarized Dark</option>
            <option value="monokai" ${userSettings.theme === 'monokai' ? 'selected' : ''}>Monokai Pro</option>
            <option value="nord" ${userSettings.theme === 'nord' ? 'selected' : ''}>Nordic Frost</option>
            <option value="dracula" ${userSettings.theme === 'dracula' ? 'selected' : ''}>Dracula</option>
            <option value="one-dark" ${userSettings.theme === 'one-dark' ? 'selected' : ''}>Atom One Dark</option>
            <option value="matrix" ${userSettings.theme === 'matrix' ? 'selected' : ''}>Matrix Green CRT</option>
            <option value="cyberpunk" ${userSettings.theme === 'cyberpunk' ? 'selected' : ''}>Cyberpunk Neon</option>
            <option value="avisys-navy" ${userSettings.theme === 'avisys-navy' ? 'selected' : ''}>Avisys Corporate Navy</option>
            <option value="light-modern" ${userSettings.theme === 'light-modern' ? 'selected' : ''}>Modern Light</option>
          </select>
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label>Font Size (px)</label>
            <input type="number" id="cfgFontSize" value="${userSettings.fontSize || 13}" min="9" max="28" />
          </div>
          <div class="form-group">
            <label>Cursor Style</label>
            <select id="cfgCursor">
              <option value="block" ${userSettings.cursorStyle === 'block' ? 'selected' : ''}>Block (█)</option>
              <option value="underline" ${userSettings.cursorStyle === 'underline' ? 'selected' : ''}>Underline (_)</option>
              <option value="bar" ${userSettings.cursorStyle === 'bar' ? 'selected' : ''}>Vertical Bar (|)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Font Family</label>
          <input type="text" id="cfgFont" value="${escapeHtml(userSettings.fontFamily || 'Cascadia Mono, Consolas, Fira Code, monospace')}" />
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label>Scrollback History (Lines)</label>
            <input type="number" id="cfgScrollback" value="${userSettings.scrollback || 10000}" min="1000" max="100000" step="1000" />
          </div>
          <div class="form-group" style="justify-content: flex-end; padding-bottom: 6px;">
            <label class="checkbox-label">
              <input type="checkbox" id="cfgCursorBlink" ${userSettings.cursorBlink !== false ? 'checked' : ''} />
              <span>Cursor Blinking</span>
            </label>
          </div>
        </div>
        <div class="form-group" style="margin-top: 4px;">
          <label class="checkbox-label">
            <input type="checkbox" id="cfgRightClickPaste" ${userSettings.rightClickPaste !== false ? 'checked' : ''} />
            <span>Right-Click Quick Paste (MobaXterm behavior)</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="cfgAutoCopy" ${userSettings.autoCopySelection !== false ? 'checked' : ''} />
            <span>Auto-Copy Highlighted Selection to Clipboard</span>
          </label>
        </div>
      </div>

      <!-- 2. Password Management Vault Tab -->
      <div id="tab-settings-pwd" class="tab-content hidden">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">
          🔒 Stored passwords are hardware-encrypted with <b>Windows DPAPI (CryptProtectData)</b>. Passwords are never saved in plaintext on disk.
        </div>
        <div id="pwdVaultList" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 2px;">
          <div style="text-align: center; padding: 20px; color: var(--text-dim);">Loading vault credentials...</div>
        </div>
      </div>

      <!-- 3. Security Policies Tab -->
      <div id="tab-settings-sec" class="tab-content hidden">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Enterprise protocol restrictions and credential management controls:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <label class="checkbox-label"><input type="checkbox" id="secSSH" checked /> <span>Allow SSH Sessions</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secSFTP" checked /> <span>Allow SFTP Browser</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secRDP" checked /> <span>Allow Remote Desktop (RDP)</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secSerial" checked /> <span>Allow Serial / COM Ports</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secVNC" checked /> <span>Allow VNC Sessions</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secTelnet" /> <span>Allow Telnet Sessions</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secPwdSave" checked /> <span>Allow Password Saving in DPAPI</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secClipboard" checked /> <span>Allow Clipboard Sharing</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secTransfers" checked /> <span>Allow File Transfers</span></label>
          <label class="checkbox-label"><input type="checkbox" id="secAudit" /> <span>Require Audit Logging</span></label>
        </div>
      </div>

      <!-- 4. Enterprise Customizer Tab -->
      <div id="tab-settings-custom" class="tab-content hidden">
        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          Customize enterprise application identity, branding, and corporate defaults:
        </div>
        <div class="form-group">
          <label>Application Name</label>
          <input type="text" id="custAppTitle" value="NexTerm Professional" placeholder="e.g. Avisys NexTerm Pro" />
        </div>
        <div class="form-group">
          <label>Company / Organization Name</label>
          <input type="text" id="custCompany" value="Avisys Services" placeholder="e.g. Avisys Services" />
        </div>
        <div class="form-group">
          <label>Welcome Splash Message</label>
          <input type="text" id="custSplash" value="Enterprise Infrastructure & Systems Engineering Workspace" />
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label>Default SSH Port</label>
            <input type="number" id="custDefaultPort" value="22" min="1" max="65535" />
          </div>
          <div class="form-group">
            <label>Default Theme</label>
            <select id="custDefaultTheme">
              <option value="dark-modern">Dark Modern</option>
              <option value="solarized-dark">Solarized Dark</option>
              <option value="monokai">Monokai Pro</option>
              <option value="dracula">Dracula</option>
              <option value="nord">Nordic Frost</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="cfgSave">💾 Save All Settings</button>
    </div>
  `, "modal-lg");

  // Tab switching inside modal
  box.querySelectorAll(".modal-tab-btn").forEach(btn => {
    btn.onclick = () => {
      box.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
      box.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
      btn.classList.add("active");
      const target = box.querySelector(`#${btn.dataset.tab}`);
      if (target) target.classList.remove("hidden");
    };
  });

  // Load Security Policy from Go backend
  if (window.go && window.go.main && window.go.main.App) {
    try {
      const pol = await window.go.main.App.GetSecurityPolicy();
      if (pol) {
        if (box.querySelector("#secSSH")) box.querySelector("#secSSH").checked = pol.allowSSH !== false;
        if (box.querySelector("#secSFTP")) box.querySelector("#secSFTP").checked = pol.allowSFTP !== false;
        if (box.querySelector("#secRDP")) box.querySelector("#secRDP").checked = pol.allowRDP !== false;
        if (box.querySelector("#secSerial")) box.querySelector("#secSerial").checked = pol.allowSerial !== false;
        if (box.querySelector("#secVNC")) box.querySelector("#secVNC").checked = pol.allowVNC !== false;
        if (box.querySelector("#secTelnet")) box.querySelector("#secTelnet").checked = !!pol.allowTelnet;
        if (box.querySelector("#secPwdSave")) box.querySelector("#secPwdSave").checked = pol.allowPasswordSaving !== false;
        if (box.querySelector("#secClipboard")) box.querySelector("#secClipboard").checked = pol.allowClipboardSharing !== false;
        if (box.querySelector("#secTransfers")) box.querySelector("#secTransfers").checked = pol.allowFileTransfers !== false;
        if (box.querySelector("#secAudit")) box.querySelector("#secAudit").checked = !!pol.requireAuditLog;
      }
    } catch (_) {}

    try {
      const cust = await window.go.main.App.GetCustomizerConfig();
      if (cust) {
        if (box.querySelector("#custAppTitle") && cust.appName) box.querySelector("#custAppTitle").value = cust.appName;
        if (box.querySelector("#custCompany") && cust.companyName) box.querySelector("#custCompany").value = cust.companyName;
        if (box.querySelector("#custSplash") && cust.splashMessage) box.querySelector("#custSplash").value = cust.splashMessage;
        if (box.querySelector("#custDefaultPort") && cust.defaultSSHPort) box.querySelector("#custDefaultPort").value = cust.defaultSSHPort;
        if (box.querySelector("#custDefaultTheme") && cust.defaultTheme) box.querySelector("#custDefaultTheme").value = cust.defaultTheme;
      }
    } catch (_) {}
  }

  // Load vault passwords
  const loadVaultPasswords = async () => {
    const listContainer = box.querySelector("#pwdVaultList");
    if (!listContainer) return;
    try {
      let creds = [];
      if (window.go && window.go.main && window.go.main.App) {
        creds = await window.go.main.App.GetSavedPasswords() || [];
      }
      if (creds.length === 0) {
        listContainer.innerHTML = `
          <div class="pwd-empty-state">
            🔒 No saved credentials in Windows DPAPI vault.<br/>
            Connect to any SSH server and check <b>"Remember password"</b> to securely save credentials here.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = creds.map((c, idx) => `
        <div class="pwd-card" data-vaultkey="${escapeHtml(c.vaultKey)}">
          <div class="pwd-card-header">
            <span class="pwd-card-title">🔑 ${escapeHtml(c.sessionName || c.host)}</span>
            <span class="pwd-card-meta">${escapeHtml(c.username)}@${escapeHtml(c.host)}:${c.port || 22}</span>
          </div>
          <div class="pwd-card-body">
            <div class="pwd-value-wrap">
              <span class="pwd-masked" id="pwdMask_${idx}">••••••••••••</span>
              <span class="pwd-plain hidden" id="pwdPlain_${idx}">${escapeHtml(c.password)}</span>
            </div>
            <div class="pwd-actions">
              <button class="pwd-action-btn toggle-pwd-btn" data-idx="${idx}">👁️ Show</button>
              <button class="pwd-action-btn copy-pwd-btn" data-pwd="${escapeHtml(c.password)}">📋 Copy</button>
              <button class="pwd-action-btn danger delete-pwd-btn" data-vaultkey="${escapeHtml(c.vaultKey)}" data-name="${escapeHtml(c.sessionName || c.host)}">🗑️ Delete</button>
            </div>
          </div>
        </div>
      `).join("");

      listContainer.querySelectorAll(".toggle-pwd-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = btn.dataset.idx;
          const maskEl = box.querySelector(`#pwdMask_${idx}`);
          const plainEl = box.querySelector(`#pwdPlain_${idx}`);
          if (!maskEl || !plainEl) return;
          const isHidden = plainEl.classList.contains("hidden");
          if (isHidden) {
            maskEl.classList.add("hidden");
            plainEl.classList.remove("hidden");
            btn.innerHTML = "🔒 Hide";
          } else {
            maskEl.classList.remove("hidden");
            plainEl.classList.add("hidden");
            btn.innerHTML = "👁️ Show";
          }
        };
      });

      listContainer.querySelectorAll(".copy-pwd-btn").forEach(btn => {
        btn.onclick = () => {
          navigator.clipboard.writeText(btn.dataset.pwd);
          showToast("Password copied to clipboard", "success");
        };
      });

      listContainer.querySelectorAll(".delete-pwd-btn").forEach(btn => {
        btn.onclick = async () => {
          if (window.go && window.go.main && window.go.main.App) {
            try {
              await window.go.main.App.DeleteSavedPassword(btn.dataset.vaultkey);
              showToast(`Removed password for "${btn.dataset.name}"`, "info");
              await loadVaultPasswords();
            } catch (err) {
              showToast("Failed to delete password: " + err, "error");
            }
          }
        };
      });
    } catch (_) {}
  };
  loadVaultPasswords();

  box.querySelector("#cfgSave").onclick = async () => {
    // 1. Terminal & UI Preferences
    userSettings.theme = box.querySelector("#cfgTheme").value || "dark-modern";
    userSettings.fontSize = parseInt(box.querySelector("#cfgFontSize").value, 10) || 13;
    userSettings.cursorStyle = box.querySelector("#cfgCursor").value || "block";
    userSettings.fontFamily = box.querySelector("#cfgFont").value.trim() || "Cascadia Mono, Consolas, Fira Code, monospace";
    userSettings.scrollback = parseInt(box.querySelector("#cfgScrollback").value, 10) || 10000;
    userSettings.cursorBlink = box.querySelector("#cfgCursorBlink").checked;
    userSettings.rightClickPaste = box.querySelector("#cfgRightClickPaste").checked;
    userSettings.autoCopySelection = box.querySelector("#cfgAutoCopy").checked;

    localStorage.setItem("nexterm_settings", JSON.stringify(userSettings));

    // 2. Security Policy to Go backend
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const updatedPolicy = {
          allowSSH: box.querySelector("#secSSH").checked,
          allowSFTP: box.querySelector("#secSFTP").checked,
          allowRDP: box.querySelector("#secRDP").checked,
          allowSerial: box.querySelector("#secSerial").checked,
          allowVNC: box.querySelector("#secVNC").checked,
          allowTelnet: box.querySelector("#secTelnet").checked,
          allowPasswordSaving: box.querySelector("#secPwdSave").checked,
          allowClipboardSharing: box.querySelector("#secClipboard").checked,
          allowFileTransfers: box.querySelector("#secTransfers").checked,
          requireAuditLog: box.querySelector("#secAudit").checked
        };
        await window.go.main.App.SaveSecurityPolicy(updatedPolicy);
      } catch (err) {
        console.error("Failed to save security policy:", err);
      }

      // 3. Customizer Config to Go backend
      try {
        const updatedCustomizer = {
          appName: box.querySelector("#custAppTitle").value.trim() || "NexTerm Professional",
          companyName: box.querySelector("#custCompany").value.trim() || "Enterprise IT",
          companyLogoText: "NexTerm",
          splashMessage: box.querySelector("#custSplash").value.trim(),
          defaultSSHPort: parseInt(box.querySelector("#custDefaultPort").value, 10) || 22,
          defaultTheme: box.querySelector("#custDefaultTheme").value || "dark-modern",
          defaultFontSize: userSettings.fontSize
        };
        await window.go.main.App.SaveCustomizerConfig(updatedCustomizer);

        // Update document title dynamically
        document.title = updatedCustomizer.appName;
      } catch (err) {
        console.error("Failed to save customizer:", err);
      }
    }

    // 4. Live update all open terminals
    const activeTheme = THEMES[userSettings.theme] || THEMES["dark-modern"];
    Object.values(tabs).forEach(t => {
      if (t.term) {
        t.term.options.theme = activeTheme;
        t.term.options.fontSize = userSettings.fontSize;
        t.term.options.cursorStyle = userSettings.cursorStyle;
        t.term.options.cursorBlink = userSettings.cursorBlink;
        t.term.options.fontFamily = userSettings.fontFamily;
        t.term.options.scrollback = userSettings.scrollback;
        if (t.fitAddon) {
          try { t.fitAddon.fit(); } catch (_) {}
        }
      }
    });

    hideModal();
    showToast("Settings and enterprise preferences saved successfully", "success");
  };

  box.querySelector("#modalCancel").onclick = hideModal;
  box.querySelector("#modalClose").onclick = hideModal;
}

function showFolderDialog(parentFolderId = "", editNode = null) {
  const isEdit = !!editNode;
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">${isEdit ? "Rename Folder" : "New Folder"}</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Folder Name</label>
        <input type="text" id="fNameInput" value="${isEdit ? editNode.name : ''}" placeholder="e.g. Production Cluster" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCancel">Cancel</button>
      <button class="btn-primary" id="modalSave">Save</button>
    </div>
  `);

  const input = box.querySelector("#fNameInput");
  input.focus();

  const doSave = async () => {
    const name = input.value.trim();
    if (!name) return;
    hideModal();
    if (window.go && window.go.main && window.go.main.App) {
      if (isEdit) await window.go.main.App.UpdateFolder(editNode.id, name);
      else await window.go.main.App.AddFolder(parentFolderId, name);
    }
    await refreshTree();
  };

  box.querySelector("#modalSave").onclick = doSave;
  box.querySelector("#modalCancel").onclick = hideModal;
  box.querySelector("#modalClose").onclick = hideModal;
  input.onkeydown = (e) => { if (e.key === "Enter") doSave(); };
}

function showPkgMgrDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">MobApt Package Manager</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
        Browse and launch essential command line utilities:
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        ${[
          { name: "curl", desc: "Command line tool for transferring data with URLs" },
          { name: "git", desc: "Distributed version control system" },
          { name: "ssh", desc: "OpenSSH secure shell client" },
          { name: "tar", desc: "Archive and extract files" },
          { name: "winget", desc: "Windows Package Manager CLI" },
          { name: "powershell", desc: "PowerShell automation shell" }
        ].map(p => `
          <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 10px;">
            <div style="font-weight: 600; font-size: 12px; color: var(--accent-blue);">📦 ${p.name}</div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">${p.desc}</div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" id="modalCloseBtn">Done</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
}

function showTextEditorDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">MobaTextEditor — Quick Text / Script Editor</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <textarea id="quickEditorText" style="width: 100%; height: 220px; font-family: 'Fira Code', monospace; font-size: 12px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px;" placeholder="Type or paste scripts / notes here..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-secondary" id="editorCopyBtn">📋 Copy All</button>
      <button class="btn-primary" id="editorRunLocalBtn">▶ Run in Local PS</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#editorCopyBtn").onclick = () => {
    navigator.clipboard.writeText(box.querySelector("#quickEditorText").value);
    showToast("Copied text to clipboard", "info");
  };
  box.querySelector("#editorRunLocalBtn").onclick = async () => {
    const txt = box.querySelector("#quickEditorText").value;
    hideModal();
    await startLocalTerminal("powershell");
    if (txt && activeTabId && window.go && window.go.main && window.go.main.App) {
      setTimeout(() => {
        window.go.main.App.WriteToTerminal(activeTabId, txt + "\r\n");
      }, 500);
    }
  };
}

function showDiffDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">MobaDiff — Quick Text Comparison</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">Original (Left)</label>
          <textarea id="diffLeft" style="width: 100%; height: 180px; font-family: 'Fira Code', monospace; font-size: 11.5px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px;"></textarea>
        </div>
        <div>
          <label style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">Modified (Right)</label>
          <textarea id="diffRight" style="width: 100%; height: 180px; font-family: 'Fira Code', monospace; font-size: 11.5px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px;"></textarea>
        </div>
      </div>
      <div id="diffOutput" style="margin-top: 10px; font-size: 11.5px; color: var(--text-dim);">Enter text above and click Compare.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-primary" id="diffCompareBtn">Compare</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#diffCompareBtn").onclick = () => {
    const l = box.querySelector("#diffLeft").value;
    const r = box.querySelector("#diffRight").value;
    const out = box.querySelector("#diffOutput");
    if (l === r) {
      out.innerHTML = `<span style="color: var(--accent-green);">✓ Both texts are identical.</span>`;
    } else {
      out.innerHTML = `<span style="color: var(--accent-yellow);">Differences detected (Left: ${l.length} chars, Right: ${r.length} chars).</span>`;
    }
  };
}

function showAsciiDialog() {
  const chars = [];
  for (let i = 32; i <= 126; i++) {
    chars.push({ dec: i, hex: i.toString(16).toUpperCase(), char: String.fromCharCode(i) });
  }
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">ASCII & ANSI Reference Table</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div style="max-height: 280px; overflow-y: auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-family: 'Fira Code', monospace; font-size: 11.5px;">
        ${chars.map(c => `
          <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); padding: 4px 6px; display: flex; justify-content: space-between;">
            <span style="color: var(--text-dim);">${c.dec} (0x${c.hex})</span>
            <span style="font-weight: 700; color: var(--accent-cyan);">${c.char}</span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-primary" id="modalCloseBtn">Close</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
}

function showKeyGenDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">MobaKeyGen — SSH Key Pair Generator</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label>Key Type</label>
          <select id="keygenType">
            <option value="ed25519">Ed25519 (Recommended / Fast)</option>
            <option value="rsa">RSA 4096-bit</option>
          </select>
        </div>
        <div class="form-group" style="flex: 1; display: flex; align-items: flex-end;">
          <button class="btn-primary" id="doGenerateKey" style="width: 100%; height: 32px;">Generate</button>
        </div>
      </div>
      <div class="form-group">
        <label>Generated Public Key</label>
        <textarea id="keygenPub" readonly style="width: 100%; height: 80px; font-family: 'Fira Code', monospace; font-size: 11px; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 6px;" placeholder="Click Generate to create a new SSH key pair..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-secondary" id="copyPubBtn">📋 Copy Public Key</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#doGenerateKey").onclick = () => {
    const type = box.querySelector("#keygenType").value;
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
    box.querySelector("#keygenPub").value = `ssh-${type} AAAAC3NzaC1${type}AAIB${rand} user@nexterm`;
    showToast("New SSH key pair generated", "success");
  };
  box.querySelector("#copyPubBtn").onclick = () => {
    const val = box.querySelector("#keygenPub").value;
    if (val) {
      navigator.clipboard.writeText(val);
      showToast("Public key copied to clipboard", "info");
    }
  };
}

function showPortScannerDialog() {
  const box = showModal(`
    <div class="modal-header">
      <div class="modal-title">Network Multi-Port Scanner</div>
      <button class="modal-close-btn" id="modalClose">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="flex: 2;">
          <label>Target Host / IP</label>
          <input type="text" id="scanHost" value="127.0.0.1" />
        </div>
        <div class="form-group" style="flex: 1;">
          <label>Port Preset</label>
          <select id="scanPresets">
            <option value="common">Common Ports (22, 80, 443, 3389, 1521)</option>
            <option value="all">Full Standard Scan (19 ports)</option>
          </select>
        </div>
      </div>
      <div id="scanResults" style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px; height: 160px; overflow-y: auto; font-family: 'Fira Code', monospace; font-size: 11.5px; color: var(--text-dim);">
        Ready to scan ports.
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="modalCloseBtn">Close</button>
      <button class="btn-primary" id="doScanBtn">Start Scan</button>
    </div>
  `);
  box.querySelector("#modalClose").onclick = hideModal;
  box.querySelector("#modalCloseBtn").onclick = hideModal;
  box.querySelector("#doScanBtn").onclick = async () => {
    const h = box.querySelector("#scanHost").value.trim();
    const resEl = box.querySelector("#scanResults");
    resEl.innerHTML = `Scanning ports on ${escapeHtml(h)}...`;
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017];
        const results = await window.go.main.App.NetPortScan(h, ports);
        resEl.innerHTML = `<b>Scan Results for ${escapeHtml(h)}:</b><br/>` + results.map(r => `
          <span style="color: ${r.open ? 'var(--accent-green)' : 'var(--text-dim)'};">
            ${r.open ? '●' : '○'} Port ${r.port} (${r.service}): ${r.open ? 'OPEN (' + r.latency + ')' : 'Closed'}
          </span>
        `).join("<br/>");
      } catch (err) {
        resEl.textContent = "Scan error: " + err;
      }
    }
  };
}

// --------------------------------------------------------------------------
// Context Menus
// --------------------------------------------------------------------------

function hideContextMenu() { contextMenuEl.classList.add("hidden"); }

function showFolderContextMenu(x, y, node) {
  contextMenuEl.innerHTML = `
    <div class="context-menu-item" id="cAddSess">＋ New Session in Folder</div>
    <div class="context-menu-item" id="cAddFold">📁 New Subfolder</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" id="cRenFold">✏️ Rename Folder</div>
    ${node.id !== rootNode.id ? '<div class="context-menu-item danger" id="cDelFold">🗑️ Delete Folder</div>' : ''}
  `;
  posMenu(x, y);

  contextMenuEl.querySelector("#cAddSess").onclick = () => { hideContextMenu(); showNewSessionDialog(node.id); };
  contextMenuEl.querySelector("#cAddFold").onclick = () => { hideContextMenu(); showFolderDialog(node.id); };
  contextMenuEl.querySelector("#cRenFold").onclick = () => { hideContextMenu(); showFolderDialog(node.id, node); };
  const del = contextMenuEl.querySelector("#cDelFold");
  if (del) {
    del.onclick = async () => {
      hideContextMenu();
      if (window.go && window.go.main && window.go.main.App) await window.go.main.App.DeleteNode(node.id);
      await refreshTree();
    };
  }
}

function showSessionContextMenu(x, y, profile, nodeId) {
  contextMenuEl.innerHTML = `
    <div class="context-menu-item" id="cConn">⚡ Connect Session</div>
    <div class="context-menu-item" id="cEdit">✏️ Edit Session Profile</div>
    <div class="context-menu-item" id="cDup">📋 Duplicate Session</div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item danger" id="cDel">🗑️ Delete Session</div>
  `;
  posMenu(x, y);

  contextMenuEl.querySelector("#cConn").onclick = () => { hideContextMenu(); connectToSession(profile); };
  contextMenuEl.querySelector("#cEdit").onclick = () => { hideContextMenu(); showNewSessionDialog("", profile); };
  contextMenuEl.querySelector("#cDup").onclick = async () => {
    hideContextMenu();
    if (window.go && window.go.main && window.go.main.App) await window.go.main.App.DuplicateSession(nodeId);
    await refreshTree();
  };
  contextMenuEl.querySelector("#cDel").onclick = async () => {
    hideContextMenu();
    if (window.go && window.go.main && window.go.main.App) await window.go.main.App.DeleteNode(nodeId);
    await refreshTree();
  };
}

function posMenu(x, y) {
  contextMenuEl.classList.remove("hidden");
  contextMenuEl.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  contextMenuEl.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
}

// --------------------------------------------------------------------------
// Toast Notifications
// --------------------------------------------------------------------------

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3200);
}

// --------------------------------------------------------------------------
// Event Listeners & Initialization
// --------------------------------------------------------------------------

function setupEventListeners() {
  // Menu bar dropdowns
  document.querySelectorAll(".menu-item").forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const dropdown = item.querySelector(".dropdown-menu");
      const isClosed = dropdown.classList.contains("hidden");
      document.querySelectorAll(".dropdown-menu").forEach(d => d.classList.add("hidden"));
      if (isClosed) dropdown.classList.remove("hidden");
    };
  });

  window.addEventListener("click", () => {
    document.querySelectorAll(".dropdown-menu").forEach(d => d.classList.add("hidden"));
    hideContextMenu();
  });

  const safeClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
  };

  // Menu bar
  safeClick("mStartLocal", () => startLocalTerminal("powershell"));
  safeClick("mNewSSH", () => showNewSessionDialog());
  safeClick("mNewSession", () => showNewSessionDialog());
  safeClick("mNewFolder", () => showFolderDialog());
  safeClick("mToggleMultiExec", toggleMultiExec);
  safeClick("mOpenTunneling", showTunnelingDialog);
  safeClick("mOpenSettings", showSettingsDialog);
  safeClick("mRecordMacro", showRecordMacroDialog);
  safeClick("mCloseTab", () => { if (activeTabId && activeTabId !== "home") closeTab(activeTabId); });
  safeClick("mClearTab", () => { if (activeTabId && tabs[activeTabId]) tabs[activeTabId].term.clear(); });
  safeClick("mDuplicateTab", () => {
    if (activeTabId && tabs[activeTabId]) {
      const p = tabs[activeTabId].profile;
      if (tabs[activeTabId].isLocal) startLocalTerminal("powershell");
      else connectToSession(p);
    }
  });

  // Toolbar buttons
  safeClick("tbSessionBtn", () => showNewSessionDialog());
  safeClick("tbServersBtn", () => switchSidebarView("sessions"));
  safeClick("tbToolsBtn", () => switchSidebarView("tools"));
  safeClick("tbSplitBtn", (e) => showSplitMenu(e.clientX, e.clientY + 10));
  safeClick("tbMultiExecBtn", toggleMultiExec);
  safeClick("tbMacrosBtn", () => switchSidebarView("macros"));
  safeClick("tbTunnelingBtn", showTunnelingDialog);
  safeClick("tbPackagesBtn", showPkgMgrDialog);
  safeClick("tbSettingsBtn", showSettingsDialog);
  safeClick("tbHelpBtn", () => showToast("Shortcuts: Ctrl+N (New Session), Ctrl+W (Close Tab), Ctrl+Shift+\\ (Split)", "info"));
  safeClick("tbExitBtn", () => { if (confirm("Exit Nexterm?")) window.close(); });

  // MultiExec
  safeClick("multiExecSendBtn", sendMultiExec);
  safeClick("multiExecCloseBtn", toggleMultiExec);
  if (multiExecInputEl) {
    multiExecInputEl.onkeydown = (e) => { if (e.key === "Enter") sendMultiExec(); };
  }

  // Sidebar navigation strip
  safeClick("navTabSessions", () => switchSidebarView("sessions"));
  safeClick("navTabSFTP", () => switchSidebarView("sftp"));
  safeClick("navTabMacros", () => switchSidebarView("macros"));
  safeClick("navTabTunnel", () => switchSidebarView("tunnel"));
  safeClick("navTabTools", () => switchSidebarView("tools"));

  // Sidebar SFTP controls
  safeClick("sftpUpBtn", () => {
    if (currentSFTPPath && currentSFTPPath !== "/") {
      const parent = currentSFTPPath.substring(0, currentSFTPPath.lastIndexOf("/")) || "/";
      refreshSFTP(parent);
    }
  });
  safeClick("sftpRefreshBtn", () => refreshSFTP(currentSFTPPath));
  safeClick("sftpUploadBtn", async () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first to upload files via SFTP", "warning");
      return;
    }
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const localFile = await window.go.main.App.SelectUploadFile();
        if (localFile) {
          const fileName = localFile.substring(localFile.lastIndexOf("\\") + 1);
          const remoteDest = (currentSFTPPath === "/" ? "" : currentSFTPPath) + "/" + fileName;
          showToast(`Uploading ${fileName}...`, "info");
          await window.go.main.App.SFTPUpload(activeTabId, localFile, remoteDest);
          showToast(`Uploaded ${fileName} successfully`, "success");
          await refreshSFTP(currentSFTPPath);
        }
      } catch (err) {
        showToast("Upload failed: " + err, "error");
      }
    }
  });
  safeClick("sftpMkdirBtn", async () => {
    const dirName = prompt("Enter new directory name:");
    if (dirName && window.go && window.go.main && window.go.main.App) {
      const remoteDest = (currentSFTPPath === "/" ? "" : currentSFTPPath) + "/" + dirName;
      try {
        await window.go.main.App.SFTPMkdir(activeTabId, remoteDest);
        showToast("Directory created", "success");
        await refreshSFTP(currentSFTPPath);
      } catch (err) {
        showToast("Mkdir failed: " + err, "error");
      }
    }
  });

  const sftpPathInput = document.getElementById("sftpPathInput");
  if (sftpPathInput) {
    sftpPathInput.onkeydown = (e) => {
      if (e.key === "Enter") refreshSFTP(sftpPathInput.value.trim());
    };
  }

  // Sidebar buttons for macros & tunnels
  safeClick("sidebarNewMacroBtn", showRecordMacroDialog);
  safeClick("sidebarNewTunnelBtn", showNewTunnelWizard);

  // Sidebar tree tools
  safeClick("treeAddSessionBtn", () => showNewSessionDialog());
  safeClick("treeAddFolderBtn", () => showFolderDialog());
  safeClick("treeRefreshBtn", () => refreshTree());

  // Quick connect in sidebar
  if (sidebarQuickConnectInput) {
    sidebarQuickConnectInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        const raw = sidebarQuickConnectInput.value.trim();
        if (!raw) return;
        let u = "root", h = raw, p = 22;
        if (h.includes("@")) { const pts = h.split("@"); u = pts[0]; h = pts[1]; }
        if (h.includes(":")) { const pts = h.split(":"); h = pts[0]; p = parseInt(pts[1], 10) || 22; }
        sidebarQuickConnectInput.value = "";
        connectToSession({ id: "q-" + Date.now(), name: `${u}@${h}`, host: h, port: p, username: u });
      }
    };
  }

  // Welcome search input
  if (welcomeSearchInput) {
    welcomeSearchInput.oninput = () => {
      refreshTree(welcomeSearchInput.value);
    };
  }

  // Dashboard Buttons
  safeClick("startLocalTerminalBtn", () => startLocalTerminal("powershell"));
  safeClick("newSSHSessionBigBtn", () => showNewSessionDialog());
  if (homeTabBtnEl) homeTabBtnEl.onclick = activateHomeTab;
  safeClick("newTabAddBtn", () => showNewSessionDialog());
  safeClick("wsSettingsBtn", showSettingsDialog);

  // System Tool Handlers
  const toolMap = {
    toolHardware: "devmgmt",
    toolProcesses: "taskmgr",
    toolCmdAdmin: "cmd_admin",
    toolPSAdmin: "powershell_admin",
    toolPorts: "resmon"
  };

  Object.entries(toolMap).forEach(([id, key]) => {
    safeClick(id, () => {
      if (window.go && window.go.main && window.go.main.App) {
        window.go.main.App.LaunchSystemTool(key);
      }
      showToast(`Launching ${key}...`, "info");
    });
  });

  safeClick("toolPkgMgr", showPkgMgrDialog);
  safeClick("toolTextEditor", showTextEditorDialog);
  safeClick("toolDiff", showDiffDialog);
  safeClick("toolAscii", showAsciiDialog);
  safeClick("toolPing", showPingDialog);
  safeClick("toolDNS", showDNSDialog);
  safeClick("toolScanner", showPortScannerDialog);
  safeClick("toolHash", showHashDialog);
  safeClick("toolKeyGen", showKeyGenDialog);
  safeClick("toolTunnel", showTunnelingDialog);

  // Floating controls
  safeClick("reconnectBtn", () => {
    if (activeTabId && tabs[activeTabId]) {
      const p = tabs[activeTabId].profile;
      closeTab(activeTabId);
      connectToSession(p);
    }
  });
  safeClick("clearTermBtn", () => {
    if (activeTabId && tabs[activeTabId]) tabs[activeTabId].term.clear();
  });
  safeClick("zoomInBtn", () => {
    if (activeTabId && tabs[activeTabId]) {
      tabs[activeTabId].term.options.fontSize = (tabs[activeTabId].term.options.fontSize || 13) + 1;
      if (tabs[activeTabId].fitAddon) tabs[activeTabId].fitAddon.fit();
    }
  });
  safeClick("zoomOutBtn", () => {
    if (activeTabId && tabs[activeTabId]) {
      tabs[activeTabId].term.options.fontSize = Math.max(9, (tabs[activeTabId].term.options.fontSize || 13) - 1);
      if (tabs[activeTabId].fitAddon) tabs[activeTabId].fitAddon.fit();
    }
  });
  safeClick("copyAllBtn", () => {
    if (activeTabId && tabs[activeTabId]) {
      const sel = tabs[activeTabId].term.getSelection();
      if (sel) { navigator.clipboard.writeText(sel); showToast("Copied to clipboard", "info"); }
    }
  });
  safeClick("pasteBtn", async () => {
    if (activeTabId && tabs[activeTabId]) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && window.go && window.go.main && window.go.main.App) {
          window.go.main.App.WriteToTerminal(activeTabId, text);
        }
      } catch (err) {
        showToast("Clipboard read failed: " + err, "error");
      }
    }
  });

  // Window Resize
  window.addEventListener("resize", () => {
    applySplitVisibility();
  });

  // Global Shortcuts
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { hideContextMenu(); hideModal(); }
    if (e.ctrlKey || e.metaKey) {
      if (e.shiftKey && e.key === "|") {
        e.preventDefault();
        setSplitMode(currentSplitMode === "split-v" ? "single" : "split-v");
      }
      if (e.shiftKey && e.key === "_") {
        e.preventDefault();
        setSplitMode(currentSplitMode === "split-h" ? "single" : "split-h");
      }
      if (e.key === "n" && !e.shiftKey) { e.preventDefault(); showNewSessionDialog(); }
      if (e.key === "w" && !e.shiftKey && activeTabId && activeTabId !== "home") { e.preventDefault(); closeTab(activeTabId); }
    }
  });
}

function switchSidebarView(view) {
  const views = ["sessions", "sftp", "macros", "tunnel", "tools"];
  views.forEach(v => {
    const viewEl = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
    const tabEl = document.getElementById(`navTab${v.charAt(0).toUpperCase() + v.slice(1)}`);
    const isTarget = v === view;
    if (viewEl) viewEl.classList.toggle("hidden", !isTarget);
    if (tabEl) tabEl.classList.toggle("active", isTarget);
  });

  if (view === "sftp") refreshSFTP();
  if (view === "macros") renderSidebarMacros();
  if (view === "tunnel") renderSidebarTunnels();
}

window.addEventListener("DOMContentLoaded", init);
