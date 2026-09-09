// ==========================================================================
// NexTerm — Server Status Bar Subsystem
// Compact developer context status bar & details popover per Modern UI/UX Plan
// ==========================================================================

import { getActiveTab, getTabs } from '../state/tabState.js';

let statusInterval = null;
let currentMetrics = {
  cpu: "2.4%",
  ram: "11.6 / 30.9 GB",
  netUp: "0.01 MB/s",
  netDown: "0.12 MB/s",
  uptime: "65d",
  disks: [
    { mount: "/", usage: "14%" },
    { mount: "/opt", usage: "28%" },
    { mount: "/home", usage: "3%" }
  ]
};

export function initStatusBar() {
  const bar = document.getElementById("statusBar");
  if (!bar) return;

  bar.addEventListener("click", (e) => {
    // Only trigger popover when clicking the server status area
    if (e.target.closest(".status-server-pill") || e.target.closest("#activeTargetText")) {
      toggleServerDetailsPopover();
    }
  });

  updateStatusBarDisplay();

  // Periodic subtle status refresh
  if (statusInterval) clearInterval(statusInterval);
  statusInterval = setInterval(() => {
    updateStatusBarDisplay();
  }, 3000);
}

export function updateStatusBarDisplay() {
  const activeTab = getActiveTab();
  const allTabs = getTabs();
  const activeCount = Object.keys(allTabs).length;

  const countEl = document.getElementById("activeSessionsCount");
  if (countEl) {
    countEl.textContent = `${activeCount} active tab${activeCount === 1 ? '' : 's'}`;
  }

  const targetEl = document.getElementById("activeTargetText");
  if (!targetEl) return;

  if (!activeTab || !activeTab.profile) {
    targetEl.innerHTML = `<span class="status-idle-pill">○ Workspace Ready</span>`;
    return;
  }

  const p = activeTab.profile;
  const isConn = activeTab.isConnected;
  const env = activeTab.environment || { label: "DEV", color: "#3b82f6" };
  const proto = (p.protocol || "ssh").toUpperCase();
  const serialPrefix = activeTab.serialNo ? `[${activeTab.serialNo}] ` : "";
  const host = activeTab.remoteHostname || ((p.name && p.name !== "New Server" && p.name !== "New Session") ? p.name : (p.host || "Terminal"));
  const hostDisplay = `${serialPrefix}${host}`;

  targetEl.innerHTML = `
    <div class="status-server-pill" title="Click for Server Metrics & Resource Details">
      <span class="status-dot ${isConn ? 'connected' : 'disconnected'}">●</span>
      <span class="status-server-name">${escapeHtml(hostDisplay)}</span>
      <span class="status-env-tag" style="color:${env.color};">${env.label}</span>
      <span class="status-divider">│</span>
      <span class="status-proto-tag">${proto}</span>
      <span class="status-divider">│</span>
      <span class="status-metric">CPU ${currentMetrics.cpu}</span>
      <span class="status-divider">│</span>
      <span class="status-metric">RAM ${currentMetrics.ram}</span>
      <span class="status-divider">│</span>
      <span class="status-metric">↑ ${currentMetrics.netUp} ↓ ${currentMetrics.netDown}</span>
      <span class="status-divider">│</span>
      <span class="status-metric">${currentMetrics.uptime}</span>
    </div>
  `;
}

export function toggleServerDetailsPopover() {
  let popover = document.getElementById("serverDetailsPopover");
  if (popover) {
    popover.remove();
    return;
  }

  const activeTab = getActiveTab();
  if (!activeTab || !activeTab.profile) return;

  const p = activeTab.profile;
  const env = activeTab.environment || { label: "DEV", name: "Development", color: "#3b82f6" };
  const serialPrefix = activeTab.serialNo ? `[${activeTab.serialNo}] ` : "";
  const host = activeTab.remoteHostname || ((p.name && p.name !== "New Server" && p.name !== "New Session") ? p.name : (p.host || "Terminal"));
  const hostDisplay = `${serialPrefix}${host}`;
  const userHost = `${p.username ? p.username + '@' : ''}${p.host || 'localhost'}${p.port ? ':' + p.port : ''}`;

  popover = document.createElement("div");
  popover.id = "serverDetailsPopover";
  popover.className = "server-details-popover";
  popover.innerHTML = `
    <div class="popover-header">
      <div class="popover-title-row">
        <span class="popover-host">${escapeHtml(hostDisplay)}</span>
        <span class="popover-env" style="color:${env.color};">${env.label}</span>
      </div>
      <span class="popover-conn-info">${escapeHtml(userHost)}</span>
      <button class="popover-close-btn" type="button">&times;</button>
    </div>
    <div class="popover-body">
      <div class="metric-row">
        <span class="metric-label">CPU Utilization</span>
        <span class="metric-val accent">${currentMetrics.cpu}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Memory In-Use</span>
        <span class="metric-val">${currentMetrics.ram}</span>
      </div>
      <div class="metric-divider"></div>
      <div class="disk-section">
        <span class="metric-label" style="margin-bottom:4px; display:block;">Storage Mounts</span>
        ${currentMetrics.disks.map(d => `
          <div class="disk-row">
            <span class="disk-mount">${d.mount}</span>
            <span class="disk-usage">${d.usage}</span>
          </div>
        `).join('')}
      </div>
      <div class="metric-divider"></div>
      <div class="metric-row">
        <span class="metric-label">Network Throughput</span>
        <span class="metric-val">↑ ${currentMetrics.netUp}  ↓ ${currentMetrics.netDown}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Server Uptime</span>
        <span class="metric-val">${currentMetrics.uptime}</span>
      </div>
    </div>
  `;

  document.body.appendChild(popover);

  popover.querySelector(".popover-close-btn").addEventListener("click", () => {
    popover.remove();
  });

  const dismissHandler = (evt) => {
    if (!popover.contains(evt.target) && !evt.target.closest(".status-server-pill")) {
      popover.remove();
      window.removeEventListener("click", dismissHandler);
    }
  };

  setTimeout(() => {
    window.addEventListener("click", dismissHandler);
  }, 10);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
