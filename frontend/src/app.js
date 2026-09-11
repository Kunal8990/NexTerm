// ==========================================================================
// Nexterm — Professional Desktop SSH Client Controller (Application Root)
// ==========================================================================

import { userSettings, applyUITheme, showThemePickerDialog, showSettingsDialog } from './settings/settings.js';
import { hideContextMenu, showSplitMenu } from './ui/contextMenu.js';
import {
  showModal,
  hideModal,
  showTunnelingDialog,
  showRecordMacroDialog,
  showNewTunnelWizard,
  showPkgMgrDialog,
  showTextEditorDialog,
  showDiffDialog,
  showAsciiDialog,
  showPingDialog,
  showDNSDialog,
  showPortScannerDialog,
  showHashDialog,
  showKeyGenDialog,
  showAuthChallengeModal,
  showHostKeyVerificationModal
} from './ui/modal.js';
import { showToast, updateStatus } from './ui/notifications.js';
import { tabs, activeTabId } from './state/tabState.js';
import { rootNode } from './state/sessionState.js';
import {
  workspaceState,
  initWorkspace,
  splitPane,
  toggleMaximizePane,
  refitAllTerminals,
  setSplitMode,
  registerWorkspaceTabActions
} from './state/workspaceState.js';
import { openTerminalSearch, closeTerminalSearch, syncSFTPToCurrentTerminalCwd } from './terminal/terminal.js';
import {
  startLocalTerminal,
  connectToSession,
  activateHomeTab,
  activateTab,
  closeTab,
  toggleMultiExec,
  sendMultiExec,
  startReconnectionSequence,
  executeReconnectAttempt,
  showTabContextMenu,
  duplicateTab
} from './terminal/terminalManager.js';
import { showMultiExecutionModal } from './terminal/multiExecution.js';
import { openBroadcastDialog } from './terminal/broadcast.js';
import { openServerMonitor } from './monitor/serverMonitor.js';
import { promptSaveGroup, showGroupsDialog, maybeAutoStartGroups } from './sessions/sessionGroups.js';
import { showSnippetsDialog } from './terminal/snippets.js';
import { showShortcutsOverlay } from './ui/shortcutsHelp.js';
import { toggleSessionLogging, isAutoLogEnabled, setAutoLog } from './terminal/terminalManager.js';
import { showNewSessionDialog, showFolderDialog } from './sessions/sessionDialog.js';
import { showMultiServerConnectDialog } from './sessions/multiServerConnect.js';
import { refreshTree, switchSidebarView, parseQuickConnect } from './sessions/sessionTree.js';
import {
  refreshSFTP,
  currentSFTPPath,
  selectedSFTPItem,
  sftpCurrentItems,
  sftpSortColumn,
  sftpSortOrder,
  showHiddenSFTPFiles,
  setSFTPSortColumn,
  setSFTPSortOrder,
  setShowHiddenSFTPFiles,
  toggleSFTPPathDropdown,
  closeSFTPPathDropdown,
  renderSFTPItems
} from './sftp/sftpPanel.js';
import { openRemoteFileEditor, handleExternalFileModified } from './sftp/fileBrowser.js';
import { applyDesignTokens } from './design/themeManager.js';
import { openCommandPalette, closeCommandPalette, registerCommandPaletteActions } from './commandPalette/commandPalette.js';
import { initStatusBar, updateStatusBarDisplay } from './statusBar/statusBar.js';
import { initModernNavigation } from './navigation/navigation.js';

// Hook up workspace tab actions
registerWorkspaceTabActions({
  activateTab,
  closeTab,
  showNewSessionDialog,
  showTabContextMenu,
  activateHomeTab
});

// Setup Command Palette Actions
registerCommandPaletteActions([
  {
    id: "cmd-new-session",
    category: "Sessions",
    title: "New Session...",
    subtitle: "Create a new SSH, Telnet, Serial or VNC session",
    icon: "＋",
    shortcut: "Ctrl+N",
    action: () => showNewSessionDialog()
  },
  {
    id: "cmd-new-folder",
    category: "Sessions",
    title: "New Folder...",
    subtitle: "Create an environment or organization folder",
    icon: "📁",
    action: () => showFolderDialog()
  },
  {
    id: "cmd-home",
    category: "Navigation",
    title: "Go to Home Dashboard",
    subtitle: "View recent sessions and tools",
    icon: "🏠",
    action: () => activateHomeTab()
  },
  {
    id: "cmd-local-term",
    category: "Sessions",
    title: "New Local Terminal",
    subtitle: "Start a local PowerShell or Command Prompt tab",
    icon: "💻",
    action: () => startLocalTerminal("powershell")
  },
  {
    id: "cmd-split-vert",
    category: "Workspace",
    title: "Split Right (Vertical Split)",
    subtitle: "Split active pane side-by-side",
    icon: "◫",
    shortcut: "Ctrl+Shift+E",
    action: () => splitPane(workspaceState.activePaneId, "right")
  },
  {
    id: "cmd-split-horiz",
    category: "Workspace",
    title: "Split Down (Horizontal Split)",
    subtitle: "Split active pane top and bottom",
    icon: "⬒",
    shortcut: "Ctrl+Shift+O",
    action: () => splitPane(workspaceState.activePaneId, "down")
  },
  {
    id: "cmd-single-pane",
    category: "Workspace",
    title: "Single Pane Mode",
    subtitle: "Reset workspace to one active pane",
    icon: "◻",
    action: () => setSplitMode("single")
  },
  {
    id: "cmd-grid-pane",
    category: "Workspace",
    title: "2x2 Grid Workspace",
    subtitle: "Split terminal workspace into 4 quadrants",
    icon: "⊞",
    action: () => setSplitMode("grid")
  },
  {
    id: "cmd-sftp",
    category: "Tools",
    title: "Open SFTP File Browser",
    subtitle: "Browse local and remote files with dual-pane transfer",
    icon: "📂",
    action: () => switchSidebarView("sftp")
  },
  {
    id: "cmd-broadcast",
    category: "Tools",
    title: "Broadcast Command...",
    subtitle: "Send a command to all or selected connected servers",
    icon: "⚡",
    shortcut: "Ctrl+Alt+B",
    action: () => openBroadcastDialog("all")
  },
  {
    id: "cmd-multiexec",
    category: "Tools",
    title: "Toggle MultiExec Bar",
    subtitle: "Simultaneous keystroke streaming bar",
    icon: "⚡",
    shortcut: "Alt+M",
    action: () => showMultiExecutionModal()
  },
  {
    id: "cmd-find-term",
    category: "Terminal",
    title: "Find in Terminal...",
    subtitle: "Search terminal scrollback buffer",
    icon: "🔍",
    shortcut: "Ctrl+Shift+F",
    action: () => {
      if (activeTabId && tabs[activeTabId]) openTerminalSearch(activeTabId);
    }
  },
  {
    id: "cmd-tunneling",
    category: "Network",
    title: "Nexterm Tunnel Manager...",
    subtitle: "SSH local/remote/dynamic port forwarding",
    icon: "🔑",
    action: () => showTunnelingDialog()
  },
  {
    id: "cmd-settings",
    category: "System",
    title: "Preferences & Settings...",
    subtitle: "Configure themes, fonts, credentials and audit logging",
    icon: "⚙",
    action: () => showSettingsDialog()
  },
  {
    id: "cmd-theme",
    category: "Appearance",
    title: "Choose UI Theme...",
    subtitle: "Select between Dark Modern, One Dark, Nord, or Dracula",
    icon: "🎨",
    action: () => showThemePickerDialog()
  }
]);

// --------------------------------------------------------------------------
// Event Listeners & UI Binding
// --------------------------------------------------------------------------

export function setupEventListeners() {
  // Menu bar dropdowns
  document.querySelectorAll(".menu-item").forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      const dropdown = item.querySelector(".dropdown-menu");
      if (!dropdown) return;
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

  // Menu bar items
  safeClick("mStartLocal", () => startLocalTerminal("powershell"));
  safeClick("mNewSSH", () => showNewSessionDialog());
  safeClick("mNewSession", () => showNewSessionDialog());
  safeClick("mNewFolder", () => showFolderDialog());
  safeClick("mToggleMultiExec", showMultiExecutionModal);
  safeClick("mOpenCommandPalette", openCommandPalette);
  safeClick("mSwitchTheme", showThemePickerDialog);
  safeClick("mOpenTunneling", showTunnelingDialog);
  safeClick("mOpenSettings", showSettingsDialog);
  safeClick("mRecordMacro", showRecordMacroDialog);
  safeClick("mStartXServer", async () => {
    if (!(window.go && window.go.main && window.go.main.App && window.go.main.App.LaunchXServer)) {
      showToast("X Server support requires rebuilding the app (run.bat)", "error");
      return;
    }
    try {
      const msg = await window.go.main.App.LaunchXServer();
      showToast(msg || "X server started", "success");
    } catch (err) {
      showToast("X Server: " + err, "warning");
    }
  });
  safeClick("mImportSessions", () => { const b = document.getElementById("treeImportBtn"); if (b) b.click(); });
  safeClick("mExportSessions", () => { const b = document.getElementById("treeExportBtn"); if (b) b.click(); });
  safeClick("mSaveGroup", () => promptSaveGroup());
  safeClick("mManageGroups", () => showGroupsDialog());
  safeClick("mCloseTab", () => { if (activeTabId && activeTabId !== "home") closeTab(activeTabId); });
  safeClick("mClearTab", () => { if (activeTabId && tabs[activeTabId]) tabs[activeTabId].term.clear(); });
  safeClick("mFindInTerm", () => {
    if (activeTabId && tabs[activeTabId]) openTerminalSearch(activeTabId);
  });
  safeClick("mDuplicateTab", () => {
    if (activeTabId && tabs[activeTabId]) {
      duplicateTab(activeTabId);
    }
  });

  // Session logging + snippets
  safeClick("mSnippets", () => showSnippetsDialog());
  safeClick("mShortcuts", () => showShortcutsOverlay());
  safeClick("mToggleLogging", () => {
    if (activeTabId && activeTabId !== "home") toggleSessionLogging(activeTabId);
    else showToast("Open a terminal tab first", "warning");
  });
  const refreshAutoLogLabel = () => {
    const el = document.getElementById("mAutoLogState");
    if (el) el.textContent = isAutoLogEnabled() ? "On" : "Off";
  };
  refreshAutoLogLabel();
  safeClick("mToggleAutoLog", () => {
    setAutoLog(!isAutoLogEnabled());
    refreshAutoLogLabel();
    showToast(isAutoLogEnabled() ? "New sessions will be auto-logged" : "Auto-logging disabled", "info");
  });
  safeClick("mOpenLogsFolder", () => {
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.OpenSessionLogFolder) {
      window.go.main.App.OpenSessionLogFolder();
    }
  });

  // Toolbar buttons
  safeClick("tbSessionBtn", () => showNewSessionDialog());
  safeClick("tbServersBtn", async () => {
    switchSidebarView("sessions");
    if (window.go && window.go.main && window.go.main.App && window.go.main.App.ExpandAllFolders) {
      try { await window.go.main.App.ExpandAllFolders(true); } catch (_) {}
    }
    await refreshTree();
  });
  safeClick("tbToolsBtn", () => switchSidebarView("tools"));
  safeClick("tbSplitBtn", (e) => showSplitMenu(e.clientX, e.clientY + 10));
  safeClick("tbMultiExecBtn", showMultiExecutionModal);
  safeClick("tbBroadcastBtn", () => openBroadcastDialog("all"));
  safeClick("connectedBroadcastBtn", () => openBroadcastDialog("all"));
  safeClick("tbMacrosBtn", () => switchSidebarView("macros"));
  safeClick("tbTunnelingBtn", showTunnelingDialog);
  safeClick("tbPackagesBtn", showPkgMgrDialog);
  safeClick("tbThemeBtn", showThemePickerDialog);
  safeClick("tbSettingsBtn", showSettingsDialog);
  safeClick("tbCommandPaletteBtn", openCommandPalette);
  safeClick("tbMonitorBtn", () => openServerMonitor());
  safeClick("tbXServerBtn", async () => {
    if (!(window.go && window.go.main && window.go.main.App && window.go.main.App.LaunchXServer)) {
      showToast("X Server support requires rebuilding the app (run.bat)", "error");
      return;
    }
    try {
      const msg = await window.go.main.App.LaunchXServer();
      showToast(msg || "X server started", "success");
    } catch (err) {
      showToast("X Server: " + err, "warning");
    }
  });
  safeClick("tbExitBtn", () => { if (confirm("Exit Nexterm?")) window.close(); });

  // MultiExec
  safeClick("multiExecSendBtn", sendMultiExec);
  safeClick("multiExecMatrixBtn", showMultiExecutionModal);
  safeClick("multiExecCloseBtn", toggleMultiExec);
  const multiExecInputEl = document.getElementById("multiExecInput");
  if (multiExecInputEl) {
    multiExecInputEl.onkeydown = (e) => { if (e.key === "Enter") sendMultiExec(); };
  }

  // Sidebar navigation strip
  safeClick("navTabSessions", () => switchSidebarView("sessions"));
  safeClick("navTabSFTP", () => switchSidebarView("sftp"));
  safeClick("navTabMacros", () => switchSidebarView("macros"));
  safeClick("navTabTunnel", () => switchSidebarView("tunnel"));
  safeClick("navTabTools", () => switchSidebarView("tools"));

  // Nexterm SFTP Toolbar Controls
  safeClick("sftpFollowTermBtn", () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first", "warning");
      return;
    }
    const chk = document.getElementById("sftpFollowTermCheckbox");
    if (chk && !chk.checked) {
      chk.checked = true;
    }
    syncSFTPToCurrentTerminalCwd(activeTabId);
    showToast(`SFTP synchronized with terminal folder (${tabs[activeTabId].sftpPath || currentSFTPPath})`, "success");
  });

  safeClick("sftpDownloadBtn", async () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first to download files", "warning");
      return;
    }
    if (!selectedSFTPItem) {
      showToast("Please select a file to download", "warning");
      return;
    }
    if (selectedSFTPItem.isDir) {
      showToast("Folder download not supported directly; please select a file", "warning");
      return;
    }
    if (window.go && window.go.main && window.go.main.App) {
      try {
        const dest = await window.go.main.App.SelectDownloadDest(selectedSFTPItem.name);
        if (dest) {
          showToast(`Downloading ${selectedSFTPItem.name}...`, "info");
          await window.go.main.App.SFTPDownload(activeTabId, selectedSFTPItem.path, dest);
          showToast(`Downloaded ${selectedSFTPItem.name} successfully`, "success");
        }
      } catch (err) {
        showToast("Download failed: " + err, "error");
      }
    }
  });

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

  safeClick("sftpRefreshBtn", () => refreshSFTP(currentSFTPPath));

  safeClick("sftpMkdirBtn", async () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first to create folders", "warning");
      return;
    }
    const dirName = prompt("Enter new folder name:");
    if (dirName && window.go && window.go.main && window.go.main.App) {
      const remoteDest = (currentSFTPPath === "/" ? "" : currentSFTPPath) + "/" + dirName.trim();
      try {
        await window.go.main.App.SFTPMkdir(activeTabId, remoteDest);
        showToast(`Folder "${dirName}" created`, "success");
        await refreshSFTP(currentSFTPPath);
      } catch (err) {
        showToast("Mkdir failed: " + err, "error");
      }
    }
  });

  safeClick("sftpNewFileBtn", async () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first to create files", "warning");
      return;
    }
    const fileName = prompt("Enter new file name (e.g. test.txt, script.sh, main.c):");
    if (fileName && window.go && window.go.main && window.go.main.App) {
      const remoteDest = (currentSFTPPath === "/" ? "" : currentSFTPPath) + "/" + fileName.trim();
      try {
        await window.go.main.App.SFTPCreateFile(activeTabId, remoteDest);
        showToast(`File "${fileName}" created`, "success");
        await refreshSFTP(currentSFTPPath);
      } catch (err) {
        showToast("Create file failed: " + err, "error");
      }
    }
  });

  safeClick("sftpDeleteBtn", async () => {
    if (!activeTabId || activeTabId === "home" || !tabs[activeTabId] || tabs[activeTabId].isLocal) {
      showToast("Open an SSH connection first", "warning");
      return;
    }
    if (!selectedSFTPItem) {
      showToast("Please select a file or folder to delete", "warning");
      return;
    }
    if (confirm(`Are you sure you want to delete "${selectedSFTPItem.name}" from remote server?`)) {
      if (window.go && window.go.main && window.go.main.App) {
        try {
          await window.go.main.App.SFTPDelete(activeTabId, selectedSFTPItem.path);
          showToast(`Deleted ${selectedSFTPItem.name}`, "info");
          await refreshSFTP(currentSFTPPath);
        } catch (err) {
          showToast("Delete failed: " + err, "error");
        }
      }
    }
  });

  safeClick("sftpEditBtn", () => {
    if (!selectedSFTPItem || selectedSFTPItem.isDir) {
      showToast("Please select a file to edit in Nexterm Editor", "warning");
      return;
    }
    openRemoteFileEditor(selectedSFTPItem.path);
  });

  safeClick("sftpToggleHiddenBtn", () => {
    setShowHiddenSFTPFiles(!showHiddenSFTPFiles);
    showToast(showHiddenSFTPFiles ? "Showing hidden files (.*)" : "Hiding hidden files", "info");
    renderSFTPItems(sftpCurrentItems, currentSFTPPath);
  });

  safeClick("sftpSyncBtn", () => {
    const chk = document.getElementById("sftpFollowTermCheckbox");
    if (chk) {
      chk.checked = !chk.checked;
      showToast(chk.checked ? "Automatic Terminal-SFTP Directory Sync: ON" : "Automatic Terminal-SFTP Directory Sync: OFF", chk.checked ? "success" : "info");
      if (chk.checked && activeTabId && tabs[activeTabId] && !tabs[activeTabId].isLocal) {
        syncSFTPToCurrentTerminalCwd(activeTabId);
      }
    }
  });

  const followCheckbox = document.getElementById("sftpFollowTermCheckbox");
  if (followCheckbox) {
    followCheckbox.addEventListener("change", () => {
      showToast(followCheckbox.checked ? "Follow terminal folder: ON" : "Follow terminal folder: OFF", followCheckbox.checked ? "success" : "info");
      if (followCheckbox.checked && activeTabId && tabs[activeTabId] && !tabs[activeTabId].isLocal) {
        syncSFTPToCurrentTerminalCwd(activeTabId);
      }
    });
  }

  // Path Combobox Dropdown Button & Menu Items
  safeClick("sftpPathDropdownBtn", (e) => {
    e.stopPropagation();
    toggleSFTPPathDropdown();
  });

  document.querySelectorAll(".moba-path-item").forEach(item => {
    item.addEventListener("click", () => {
      closeSFTPPathDropdown();
      const p = item.dataset.path;
      if (p) refreshSFTP(p);
    });
  });

  const sftpPathInput = document.getElementById("sftpPathInput");
  if (sftpPathInput) {
    sftpPathInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        closeSFTPPathDropdown();
        refreshSFTP(sftpPathInput.value.trim());
      }
    };
  }

  // Column Sorting Handlers
  safeClick("sftpSortNameBtn", () => {
    if (sftpSortColumn === "name") {
      setSFTPSortOrder(sftpSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSFTPSortColumn("name");
      setSFTPSortOrder("asc");
    }
    const arrow = document.getElementById("sftpSortArrow");
    if (arrow) arrow.textContent = sftpSortOrder === "asc" ? "▲" : "▼";
    renderSFTPItems(sftpCurrentItems, currentSFTPPath);
  });

  safeClick("sftpSortSizeBtn", () => {
    if (sftpSortColumn === "size") {
      setSFTPSortOrder(sftpSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSFTPSortColumn("size");
      setSFTPSortOrder("asc");
    }
    renderSFTPItems(sftpCurrentItems, currentSFTPPath);
  });

  // Sidebar buttons for macros & tunnels
  safeClick("sidebarNewMacroBtn", showRecordMacroDialog);
  safeClick("sidebarNewTunnelBtn", showNewTunnelWizard);

  // Sidebar tree tools
  safeClick("treeMultiConnectBtn", () => showMultiServerConnectDialog());
  safeClick("treeAddSessionBtn", () => showNewSessionDialog());
  safeClick("treeAddFolderBtn", () => showFolderDialog());
  safeClick("treeExpandAllBtn", async () => {
    if (window.go && window.go.main && window.go.main.App) {
      await window.go.main.App.ExpandAllFolders(true);
    }
    await refreshTree();
  });
  safeClick("treeCollapseAllBtn", async () => {
    if (window.go && window.go.main && window.go.main.App) {
      await window.go.main.App.ExpandAllFolders(false);
    }
    await refreshTree();
  });
  safeClick("treeRefreshBtn", () => refreshTree());

  // Export all saved sessions/folders to a JSON file
  safeClick("treeExportBtn", async () => {
    if (!(window.go && window.go.main && window.go.main.App)) return;
    try {
      const savedPath = await window.go.main.App.ExportSessionsToFile();
      if (savedPath) {
        showToast(`Sessions exported to ${savedPath}`, "success");
      }
    } catch (err) {
      showToast("Export failed: " + err, "error");
    }
  });

  // Import saved sessions/folders from a JSON file
  safeClick("treeImportBtn", async () => {
    if (!(window.go && window.go.main && window.go.main.App)) return;
    try {
      await window.go.main.App.ImportSessionsFromFile();
      await refreshTree();
      showToast("Sessions imported successfully", "success");
    } catch (err) {
      showToast("Import failed: " + err, "error");
    }
  });

  // ------------------------------------------------------------------------
  // Quick Connect (Toolbar Fast Connection Bar & Sidebar)
  // Supports:
  //   ssh user@host
  //   ssh user@host:2222
  //   user@host
  //   user@host:2222
  //   ssh -p 2222 user@host
  // ------------------------------------------------------------------------
  const executeQuickConnect = async (inputEl) => {
    if (!inputEl) return;
    const raw = inputEl.value.trim();
    if (!raw) {
      showToast("Please enter a connection string (e.g. ssh user@192.168.1.20)", "warning");
      inputEl.focus();
      return;
    }
    const parsed = parseQuickConnect(raw);
    if (!parsed || !parsed.host) {
      showToast(`Invalid quick connect address: "${raw}"`, "error");
      inputEl.focus();
      return;
    }
    inputEl.value = "";

    const proto = parsed.protocol || "ssh";
    const port = parsed.port || 22;
    const portStr = (port !== 22) ? `:${port}` : "";
    const username = parsed.username || "";
    const title = username
      ? `${username}@${parsed.host}${portStr}`
      : `${parsed.host}${portStr}`;

    showToast(`Quick connecting to ${title}...`, "info");

    // 1. Check if an existing saved session matches this host and username in the tree
    let matchedProfile = null;
    const findMatchingNode = (node) => {
      if (!node || matchedProfile) return;
      if (node.session) {
        const s = node.session;
        if (s.host === parsed.host && (s.port || 22) === port) {
          if (!username || !s.username || s.username === username) {
            matchedProfile = s;
            return;
          }
        }
      }
      if (node.children) {
        for (const ch of node.children) {
          findMatchingNode(ch);
          if (matchedProfile) return;
        }
      }
    };
    findMatchingNode(rootNode);

    if (matchedProfile) {
      const connProfile = { ...matchedProfile };
      if (username && !connProfile.username) {
        connProfile.username = username;
      }
      connectToSession(connProfile);
      return;
    }

    // 2. New connection: deterministic vault key
    const safeHost = parsed.host.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeUser = (username || "user").replace(/[^a-zA-Z0-9_-]/g, "_");
    const detKey = `session_${safeUser}_${safeHost}_${port}`;

    const profileId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('sess-' + Date.now());
    const newProfile = {
      id: profileId,
      vaultKey: profileId,
      name: title,
      protocol: proto,
      host: parsed.host,
      port: port,
      username: username,
      initialDir: parsed.initialDir || "",
      authType: "password"
    };

    // Auto-save to session tree so login info and host are preserved in sidebar
    if (window.go?.main?.App?.AddSession) {
      try {
        await window.go.main.App.AddSession("", newProfile);
        await refreshTree();
      } catch (err) {
        console.warn("Auto-saving quick connect session failed:", err);
      }
    }

    connectToSession(newProfile);
  };

  const quickConnectInput = document.getElementById("quickConnectInput");
  const quickConnectBtn = document.getElementById("quickConnectBtn");
  if (quickConnectInput) {
    quickConnectInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        executeQuickConnect(quickConnectInput);
      }
    });
  }
  if (quickConnectBtn) {
    quickConnectBtn.addEventListener("click", () => {
      executeQuickConnect(quickConnectInput);
    });
  }

  const sidebarQuickConnectInput = document.getElementById("sidebarQuickConnectInput") || document.getElementById("sidebarQuickConnect");
  if (sidebarQuickConnectInput) {
    sidebarQuickConnectInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        executeQuickConnect(sidebarQuickConnectInput);
      }
    });
  }

  // Welcome search input
  const welcomeSearchInput = document.getElementById("welcomeSearchInput");
  if (welcomeSearchInput) {
    welcomeSearchInput.oninput = () => {
      refreshTree(welcomeSearchInput.value);
    };
  }

  // Dashboard Buttons
  safeClick("startLocalTerminalBtn", () => startLocalTerminal("powershell"));
  safeClick("newSSHSessionBigBtn", () => showNewSessionDialog());
  safeClick("homeMultiConnectBtn", () => showMultiServerConnectDialog());
  safeClick("homeBroadcastConnectBtn", () => showMultiServerConnectDialog());
  safeClick("homeAddServerBtn", () => showNewSessionDialog());
  safeClick("homeToolSSH", () => showNewSessionDialog());
  safeClick("homeToolSFTP", () => {
    switchSidebarView("sftp");
    showToast("Switched to SFTP Browser in sidebar", "info");
  });
  safeClick("homeToolTunnel", showTunnelingDialog);
  safeClick("homeToolMacros", () => {
    switchSidebarView("macros");
    showToast("Switched to Macros in sidebar", "info");
  });
  safeClick("homeToolTaskMgr", () => {
    if (window.go && window.go.main && window.go.main.App) {
      window.go.main.App.LaunchSystemTool("taskmgr");
    }
  });
  safeClick("homeToolScanner", showPortScannerDialog);

  const homeTabBtnEl = document.getElementById("homeTabBtn");
  if (homeTabBtnEl) homeTabBtnEl.onclick = activateHomeTab;
  safeClick("newTabAddBtn", () => {
    showNewSessionDialog();
  });
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
  safeClick("toolTextEditor", () => openRemoteFileEditor(""));
  safeClick("toolDiff", showDiffDialog);
  safeClick("toolAscii", showAsciiDialog);
  safeClick("toolPing", showPingDialog);
  safeClick("toolDNS", showDNSDialog);
  safeClick("toolScanner", showPortScannerDialog);
  safeClick("toolHash", showHashDialog);
  safeClick("toolKeyGen", showKeyGenDialog);
  safeClick("toolTunnel", showTunnelingDialog);

  // Window Resize
  window.addEventListener("resize", () => {
    refitAllTerminals();
  });

  // Resizable Left Panel (sidebar) — drag the divider to adjust width,
  // double-click to reset. Width is remembered across launches.
  const sidebarEl = document.getElementById("sidebar");
  const sidebarResizer = document.getElementById("sidebarResizer");
  if (sidebarEl && sidebarResizer) {
    const SIDEBAR_MIN = 180;
    const SIDEBAR_MAX = 640;
    const SIDEBAR_DEFAULT = 290;
    try {
      const savedW = parseInt(localStorage.getItem("nexterm_sidebar_width"), 10);
      if (savedW && savedW >= SIDEBAR_MIN && savedW <= SIDEBAR_MAX) {
        sidebarEl.style.width = savedW + "px";
      }
    } catch (_) {}

    let sbDragging = false;
    sidebarResizer.addEventListener("mousedown", (e) => {
      sbDragging = true;
      sidebarResizer.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!sbDragging) return;
      const left = sidebarEl.getBoundingClientRect().left;
      let w = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX - left));
      sidebarEl.style.width = w + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!sbDragging) return;
      sbDragging = false;
      sidebarResizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("nexterm_sidebar_width", String(parseInt(sidebarEl.style.width, 10) || SIDEBAR_DEFAULT));
      } catch (_) {}
      refitAllTerminals();
    });
    sidebarResizer.addEventListener("dblclick", () => {
      sidebarEl.style.width = SIDEBAR_DEFAULT + "px";
      try { localStorage.setItem("nexterm_sidebar_width", String(SIDEBAR_DEFAULT)); } catch (_) {}
      refitAllTerminals();
    });
  }

  // Global Shortcuts
  window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        hideContextMenu();
        hideModal();
        closeCommandPalette();
      }
      // F1 or Shift+? → keyboard cheat-sheet (ignore while typing in a field)
      const typingInField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
      if ((e.key === "F1" || (e.shiftKey && e.key === "?")) && !typingInField) {
        e.preventDefault();
        showShortcutsOverlay();
      }
      if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        showMultiExecutionModal();
      }
      if ((e.altKey && (e.key === "b" || e.key === "B")) || ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === "b" || e.key === "B"))) {
        e.preventDefault();
        openBroadcastDialog("all");
      }
      if (e.ctrlKey || e.metaKey) {
        if ((e.key === "k" || e.key === "K") && !e.shiftKey) {
          e.preventDefault();
          openCommandPalette();
        }
        if ((e.shiftKey && (e.key === "F" || e.key === "f")) || (!e.shiftKey && (e.key === "f" || e.key === "F"))) {
          if (activeTabId && tabs[activeTabId]) {
            e.preventDefault();
            openTerminalSearch(activeTabId);
          }
        }
        if (e.shiftKey && (e.key === "E" || e.key === "e")) {
          e.preventDefault();
          splitPane(workspaceState.activePaneId, "right");
        }
        if (e.shiftKey && (e.key === "O" || e.key === "o")) {
          e.preventDefault();
          splitPane(workspaceState.activePaneId, "down");
        }
        if (e.shiftKey && (e.key === "M" || e.key === "m")) {
          e.preventDefault();
          toggleMaximizePane(workspaceState.activePaneId);
        }
        if (e.shiftKey && (e.key === "|" || e.key === "\\")) {
          e.preventDefault();
          setSplitMode(workspaceState.layout === "split-v" ? "single" : "split-v");
        }
        if (e.shiftKey && (e.key === "_" || e.key === "-")) {
          e.preventDefault();
          setSplitMode(workspaceState.layout === "split-h" ? "single" : "split-h");
        }
        if (e.key === "n" && !e.shiftKey) {
          e.preventDefault();
          showNewSessionDialog();
        }
        if (e.key === "w" && !e.shiftKey && activeTabId && activeTabId !== "home") {
          e.preventDefault();
          closeTab(activeTabId);
        }
      }
    });
}

// --------------------------------------------------------------------------
// Initialization & Lifecycle
// --------------------------------------------------------------------------

export async function init() {
  const savedSettings = localStorage.getItem("nexterm_settings");
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      Object.assign(userSettings, parsed);
    } catch (e) {}
  }

  // Apply saved or default UI theme immediately
  applyUITheme(userSettings.uiTheme || userSettings.theme || "dark-modern", false);

  if (window.go && window.go.main && window.go.main.App) {
    try {
      const custom = await window.go.main.App.GetCustomizerConfig();
      if (custom && custom.appName) {
        document.title = custom.appName;
      }
    } catch (_) {}
  }

  setupEventListeners();

  if (window.runtime && window.runtime.EventsOn) {
    window.runtime.EventsOn("sftp:file:modified", (info) => {
      handleExternalFileModified(info);
    });
    window.runtime.EventsOn("ssh:hostkey:verify_request", (data) => {
      showHostKeyVerificationModal(data);
    });
    window.runtime.EventsOn("ssh:auth:challenge_request", (data) => {
      showAuthChallengeModal(data);
    });
  }

  await refreshTree();
  initWorkspace();
  activateHomeTab();
  updateStatus();

  // Modern UI/UX Subsystems Initialization
  applyDesignTokens();
  initStatusBar();
  initModernNavigation({
    onOpenHome: activateHomeTab,
    onOpenSessions: () => switchSidebarView("sessions"),
    onOpenSFTP: () => switchSidebarView("sftp"),
    onOpenBroadcast: () => openBroadcastDialog("all"),
    onOpenMultiExec: showMultiExecutionModal,
    onOpenTunneling: showTunnelingDialog,
    onOpenSettings: showSettingsDialog
  });

  // Auto-open any session groups flagged "auto-start" (after the tree is loaded
  // so saved profiles can be resolved). Small delay lets the workspace settle.
  setTimeout(() => { try { maybeAutoStartGroups(); } catch (_) {} }, 1200);
}

// Auto-run on DOMContentLoaded
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
