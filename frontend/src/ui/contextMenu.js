// ==========================================================================
// Nexterm — UI Context Menu Subsystem
// Handles positioning, display, and hiding of context menus.
// ==========================================================================

import { setSplitMode, getWorkspaceLayout } from "../state/workspaceState.js";

export function getContextMenuEl() {
  return document.getElementById("contextMenu");
}

export function hideContextMenu() {
  const el = getContextMenuEl();
  if (el) el.classList.add("hidden");
}

export function posMenu(x, y) {
  const m = getContextMenuEl();
  if (!m) return;
  m.classList.remove("hidden");
  m.style.visibility = "hidden";
  m.style.left = "0px";
  m.style.top = "0px";
  const menuWidth = m.offsetWidth || 230;
  const menuHeight = m.offsetHeight || 380;
  const left = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const top = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));
  m.style.left = left + "px";
  m.style.top = top + "px";
  m.style.visibility = "visible";
}

export function showSplitMenu(x, y) {
  let menu = document.getElementById("splitLayoutMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "splitLayoutMenu";
    menu.className = "split-layout-menu";
    document.body.appendChild(menu);
  }

  const currentLayout = getWorkspaceLayout();

  menu.innerHTML = `
    <div class="split-layout-title">Terminal Layout Presets</div>
    <div class="split-layout-grid">
      <div class="layout-card ${currentLayout === 'single' ? 'active' : ''}" data-layout="single">
        <div class="card-preview pv-single"><div class="pv-box"></div></div>
        <span class="card-label">1 Terminal</span>
      </div>
      <div class="layout-card ${currentLayout === 'split-v' ? 'active' : ''}" data-layout="split-v">
        <div class="card-preview pv-split-v"><div class="pv-box"></div><div class="pv-box"></div></div>
        <span class="card-label">2 Vertical</span>
      </div>
      <div class="layout-card ${currentLayout === 'split-h' ? 'active' : ''}" data-layout="split-h">
        <div class="card-preview pv-split-h"><div class="pv-box"></div><div class="pv-box"></div></div>
        <span class="card-label">2 Horizontal</span>
      </div>
      <div class="layout-card ${currentLayout === '2-top-1-bot' ? 'active' : ''}" data-layout="2-top-1-bot">
        <div class="card-preview pv-2-top-1-bot">
          <div class="pv-box"></div>
          <div class="pv-box"></div>
          <div class="pv-box b3"></div>
        </div>
        <span class="card-label">2 Top + 1 Bottom</span>
      </div>
      <div class="layout-card ${currentLayout === '1-top-2-bot' ? 'active' : ''}" data-layout="1-top-2-bot">
        <div class="card-preview pv-1-top-2-bot">
          <div class="pv-box b1"></div>
          <div class="pv-box"></div>
          <div class="pv-box"></div>
        </div>
        <span class="card-label">1 Top + 2 Bottom</span>
      </div>
      <div class="layout-card ${currentLayout === 'grid-4' ? 'active' : ''}" data-layout="grid-4">
        <div class="card-preview pv-grid-4">
          <div class="pv-box"></div><div class="pv-box"></div>
          <div class="pv-box"></div><div class="pv-box"></div>
        </div>
        <span class="card-label">4 Grid (2x2)</span>
      </div>
      <div class="layout-card ${currentLayout === '3-cols' ? 'active' : ''}" data-layout="3-cols">
        <div class="card-preview pv-3-cols">
          <div class="pv-box"></div><div class="pv-box"></div><div class="pv-box"></div>
        </div>
        <span class="card-label">3 Columns</span>
      </div>
    </div>
  `;

  menu.style.left = Math.min(x, window.innerWidth - 310) + "px";
  menu.style.top = y + "px";
  menu.classList.remove("hidden");

  menu.querySelectorAll(".layout-card").forEach(card => {
    card.addEventListener("click", () => {
      const layout = card.dataset.layout;
      setSplitMode(layout);
      menu.classList.add("hidden");
    });
  });

  const closeMenuHandler = (e) => {
    if (!menu.contains(e.target) && e.target.id !== "tbSplitBtn" && !e.target.closest("#tbSplitBtn")) {
      menu.classList.add("hidden");
      document.removeEventListener("mousedown", closeMenuHandler);
    }
  };
  setTimeout(() => document.addEventListener("mousedown", closeMenuHandler), 10);
}
