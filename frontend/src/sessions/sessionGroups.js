// ==========================================================================
// Nexterm — Session Groups ("workspaces")
// Save the set of currently open servers as a named group and reopen them all
// in one click — optionally auto-opening a group when the app starts
// ("open my morning set"). Stored per-machine in localStorage.
// ==========================================================================

import { rootNode } from '../state/sessionState.js';
import { tabs } from '../state/tabState.js';
import { connectToSession } from '../terminal/terminalManager.js';
import { showModal, hideModal } from '../ui/modal.js';
import { showToast, escapeHtml } from '../ui/notifications.js';

const STORE_KEY = 'nexterm_session_groups';

function getGroups() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function saveGroups(groups) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(groups)); } catch (_) {}
}

function findProfileById(id) {
  let found = null;
  (function walk(node) {
    if (!node || found) return;
    if (node.session && node.session.id === id) { found = node.session; return; }
    if (node.children) node.children.forEach(walk);
  })(rootNode);
  return found;
}

// Server entries currently open (connected or connecting) that map to a saved profile.
function collectOpenServers() {
  const seen = new Set();
  const out = [];
  Object.values(tabs).forEach(t => {
    if (t && t.profile && t.profile.id && !t.isLocal && !seen.has(t.profile.id)) {
      seen.add(t.profile.id);
      out.push({ id: t.profile.id, name: t.profile.name || t.profile.host || 'Server' });
    }
  });
  return out;
}

export function promptSaveGroup() {
  const servers = collectOpenServers();
  if (servers.length === 0) {
    showToast('No open server tabs to save. Connect to some servers first.', 'warning');
    return;
  }
  const name = prompt(`Save these ${servers.length} open server(s) as a group named:`, 'My Workspace');
  if (!name || !name.trim()) return;
  const groups = getGroups();
  const existingIdx = groups.findIndex(g => g.name.toLowerCase() === name.trim().toLowerCase());
  const entry = { name: name.trim(), ids: servers.map(s => s.id), autoStart: existingIdx >= 0 ? groups[existingIdx].autoStart : false };
  if (existingIdx >= 0) groups[existingIdx] = entry; else groups.push(entry);
  saveGroups(groups);
  showToast(`Saved group "${entry.name}" (${entry.ids.length} servers)`, 'success');
}

export async function openGroup(name) {
  const group = getGroups().find(g => g.name === name);
  if (!group) { showToast(`Group "${name}" not found`, 'error'); return; }
  let opened = 0, missing = 0;
  for (const id of group.ids) {
    const profile = findProfileById(id);
    if (profile) { connectToSession(profile, true); opened++; }
    else missing++;
  }
  showToast(`Opening group "${name}": ${opened} server(s)${missing ? `, ${missing} no longer saved` : ''}`, opened ? 'success' : 'warning');
}

// Called once at startup; opens any group flagged autoStart.
export async function maybeAutoStartGroups() {
  const autos = getGroups().filter(g => g.autoStart);
  for (const g of autos) {
    await openGroup(g.name);
  }
}

export function showGroupsDialog() {
  render();

  function render() {
    const groups = getGroups();
    const openCount = collectOpenServers().length;
    const rows = groups.length ? groups.map((g, i) => `
      <div class="grp-row">
        <div class="grp-info">
          <div class="grp-name">${escapeHtml(g.name)}</div>
          <div class="grp-sub">${g.ids.length} server(s)</div>
        </div>
        <label class="grp-auto" title="Open this group automatically when Nexterm starts">
          <input type="checkbox" data-auto="${i}" ${g.autoStart ? 'checked' : ''} /> Auto-start
        </label>
        <div class="grp-actions">
          <button class="btn btn-sm btn-primary" data-open="${i}">▶ Open</button>
          <button class="btn btn-sm btn-outline" data-del="${i}">🗑️</button>
        </div>
      </div>`).join('') : `<div class="mon-empty">No saved groups yet. Open some servers, then click "Save current open tabs".</div>`;

    showModal(`
      <div class="modal-header">
        <div class="modal-title" style="display:flex; align-items:center; gap:8px;"><span>🗂️</span> Session Groups</div>
        <button class="modal-close" id="grpClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="grp-list">${rows}</div>
        <div style="margin-top:14px; display:flex; gap:8px;">
          <button class="btn btn-primary" id="grpSaveCurrent" ${openCount ? '' : 'disabled'}>💾 Save current open tabs (${openCount})</button>
        </div>
      </div>
    `, 'modal-lg');

    const close = document.getElementById('grpClose');
    if (close) close.onclick = hideModal;

    const saveBtn = document.getElementById('grpSaveCurrent');
    if (saveBtn) saveBtn.onclick = () => { promptSaveGroup(); render(); };

    document.querySelectorAll('[data-open]').forEach(b => {
      b.onclick = () => { const g = getGroups()[+b.getAttribute('data-open')]; if (g) { hideModal(); openGroup(g.name); } };
    });
    document.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = () => {
        const groups = getGroups();
        const idx = +b.getAttribute('data-del');
        if (groups[idx] && confirm(`Delete group "${groups[idx].name}"?`)) {
          groups.splice(idx, 1);
          saveGroups(groups);
          render();
        }
      };
    });
    document.querySelectorAll('[data-auto]').forEach(cb => {
      cb.onchange = () => {
        const groups = getGroups();
        const idx = +cb.getAttribute('data-auto');
        if (groups[idx]) { groups[idx].autoStart = cb.checked; saveGroups(groups); }
      };
    });
  }
}
