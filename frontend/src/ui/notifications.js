// ==========================================================================
// Nexterm — UI Notifications & Status Bar Subsystem
// Handles toast alerts, status bar updates, and HTML sanitization.
// ==========================================================================

import { getTabs, getActiveTabId, getStateLabel } from "../state/tabState.js";

let renderConnectedServersCallback = null;

export function registerRenderConnectedServers(cb) {
  renderConnectedServersCallback = cb;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function updateStatus() {
  const tabs = getTabs();
  const activeTabId = getActiveTabId();
  const tabCount = Object.keys(tabs).length;

  const activeSessionsCountEl = document.getElementById("activeSessionsCount");
  const activeTargetTextEl = document.getElementById("activeTargetText");
  const statusMessageEl = document.getElementById("statusMessage");

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
        activeTargetTextEl.textContent = t.isLocal ? "Local Terminal" : `SSH • ${t.profile?.username || 'user'}@${t.profile?.host || 'remote'}`;
      }
      if (statusMessageEl) {
        if (t.isLocal) {
          statusMessageEl.textContent = t.isConnected ? "Local Terminal Active" : "Local Terminal Closed";
        } else {
          const st = t.connectionState || (t.isConnected ? "Connected" : "Closed");
          if (st === "Connected") {
            statusMessageEl.textContent = `● Connected: ${t.profile?.name || 'Session'} (${t.profile?.host || ''})`;
          } else if (st === "Connecting") {
            statusMessageEl.textContent = `● Connecting to ${t.profile?.host}...`;
          } else if (st === "Authenticating") {
            statusMessageEl.textContent = `● Authenticating ${t.profile?.username}@${t.profile?.host}...`;
          } else if (st === "Reconnecting") {
            statusMessageEl.textContent = `● Reconnecting to ${t.profile?.host}...`;
          } else if (st === "Closing") {
            statusMessageEl.textContent = `● Closing connection to ${t.profile?.host}...`;
          } else if (st === "Failed") {
            if (t.errorInfo?.category === "Authentication failure") {
              statusMessageEl.textContent = `● Authentication failed for ${t.profile?.username}@${t.profile?.host}`;
            } else if (t.errorInfo?.category === "Server closed connection") {
              statusMessageEl.textContent = `● Connection lost: ${t.profile?.host}`;
            } else {
              statusMessageEl.textContent = `● Connection failed: ${t.errorInfo?.category || 'Failed'} (${t.errorInfo?.message || t.profile?.host})`;
            }
          } else if (st === "Closed") {
            if (t.errorInfo?.category === "Server closed connection" || (t.stateMessage && t.stateMessage.toLowerCase().includes("lost"))) {
              statusMessageEl.textContent = `● Connection lost: ${t.profile?.host}`;
            } else {
              statusMessageEl.textContent = `● Disconnected: ${t.profile?.name || ''}`;
            }
          } else {
            statusMessageEl.textContent = `● Disconnected: ${t.profile?.name || ''}`;
          }
        }
      }
    }
  }

  if (typeof renderConnectedServersCallback === "function") {
    renderConnectedServersCallback();
  }
}
