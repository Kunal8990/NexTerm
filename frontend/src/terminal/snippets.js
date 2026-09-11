// ==========================================================================
// Nexterm — Command Snippets Library
// A library of reusable commands with {{variable}} placeholders. Pick one, fill
// in the variables, and it is typed into the active terminal. Stored per-machine.
// ==========================================================================

import { tabs, activeTabId } from '../state/tabState.js';
import { showModal, hideModal } from '../ui/modal.js';
import { showToast, escapeHtml } from '../ui/notifications.js';

const STORE_KEY = 'nexterm_snippets';

const DEFAULT_SNIPPETS = [
  { name: 'Disk usage (human)', category: 'System', cmd: 'df -h' },
  { name: 'Top memory processes', category: 'System', cmd: 'ps aux --sort=-%mem | head -n 12' },
  { name: 'Tail a log file', category: 'Logs', cmd: 'tail -n {{lines:100}} -f {{path:/var/log/syslog}}' },
  { name: 'Restart a service', category: 'Services', cmd: 'sudo systemctl restart {{service}}' },
  { name: 'Service status', category: 'Services', cmd: 'systemctl status {{service}}' },
  { name: 'Find large files', category: 'System', cmd: "sudo find {{dir:/}} -type f -size +{{size:100M}} -exec ls -lh {} \\; 2>/dev/null" },
  { name: 'Open ports', category: 'Network', cmd: 'ss -tulnp' },
  { name: 'Ping host', category: 'Network', cmd: 'ping -c 4 {{host}}' },
  { name: 'Grep in files', category: 'Files', cmd: "grep -rn '{{pattern}}' {{dir:.}}" }
];

function getSnippets() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_SNIPPETS.slice();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : DEFAULT_SNIPPETS.slice();
  } catch (_) { return DEFAULT_SNIPPETS.slice(); }
}
function saveSnippets(arr) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (_) {}
}

// Parse {{name}} or {{name:default}} placeholders → ordered unique list.
function parseVars(cmd) {
  const re = /\{\{\s*([^}:]+?)\s*(?::([^}]*))?\}\}/g;
  const seen = new Map();
  let m;
  while ((m = re.exec(cmd)) !== null) {
    const name = m[1].trim();
    if (!seen.has(name)) seen.set(name, m[2] !== undefined ? m[2] : '');
  }
  return [...seen.entries()].map(([name, def]) => ({ name, def }));
}

function sendToActiveTerminal(cmd, execute) {
  if (!activeTabId || activeTabId === 'home' || !tabs[activeTabId]) {
    showToast('Open a terminal first to run a snippet', 'warning');
    return false;
  }
  if (!(window.go && window.go.main && window.go.main.App && window.go.main.App.WriteToTerminal)) {
    showToast('Cannot send command (WriteToTerminal unavailable)', 'error');
    return false;
  }
  window.go.main.App.WriteToTerminal(activeTabId, cmd + (execute ? '\r' : ''));
  return true;
}

function runSnippet(snip) {
  const vars = parseVars(snip.cmd);
  let cmd = snip.cmd;
  for (const v of vars) {
    const val = prompt(`Value for "${v.name}"${v.def ? ` (default: ${v.def})` : ''}:`, v.def || '');
    if (val === null) return; // cancelled
    const re = new RegExp('\\{\\{\\s*' + v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?::[^}]*)?\\}\\}', 'g');
    cmd = cmd.replace(re, val);
  }
  if (sendToActiveTerminal(cmd, true)) {
    hideModal();
    showToast('Snippet sent to terminal', 'success');
  }
}

export function showSnippetsDialog() {
  render();

  function render(editIdx = -1) {
    const snippets = getSnippets();
    const cats = [...new Set(snippets.map(s => s.category || 'General'))];
    const listHtml = cats.map(cat => `
      <div class="snip-cat">${escapeHtml(cat)}</div>
      ${snippets.map((s, i) => ({ s, i })).filter(x => (x.s.category || 'General') === cat).map(({ s, i }) => `
        <div class="snip-row">
          <div class="snip-info">
            <div class="snip-name">${escapeHtml(s.name)}</div>
            <div class="snip-cmd">${escapeHtml(s.cmd)}</div>
          </div>
          <div class="snip-actions">
            <button class="btn btn-sm btn-primary" data-run="${i}">▶ Run</button>
            <button class="btn btn-sm btn-outline" data-copy="${i}">⧉</button>
            <button class="btn btn-sm btn-outline" data-edit="${i}">✏️</button>
            <button class="btn btn-sm btn-outline" data-del="${i}">🗑️</button>
          </div>
        </div>`).join('')}
    `).join('') || '<div class="mon-empty">No snippets yet.</div>';

    const e = editIdx >= 0 ? getSnippets()[editIdx] : null;
    const isNew = editIdx === -2;
    const editor = (editIdx >= 0 || isNew) ? `
      <div class="snip-editor">
        <div class="snip-editor-title">${isNew ? 'New Snippet' : 'Edit Snippet'}</div>
        <input id="snipName" class="snip-input" placeholder="Name" value="${e ? escapeHtml(e.name) : ''}" />
        <input id="snipCat" class="snip-input" placeholder="Category" value="${e ? escapeHtml(e.category || 'General') : 'General'}" />
        <textarea id="snipCmd" class="snip-input snip-textarea" rows="3" placeholder="Command — use {{variable}} or {{variable:default}}">${e ? escapeHtml(e.cmd) : ''}</textarea>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-primary btn-sm" id="snipSave">Save</button>
          <button class="btn btn-outline btn-sm" id="snipCancelEdit">Cancel</button>
        </div>
      </div>` : '';

    showModal(`
      <div class="modal-header">
        <div class="modal-title" style="display:flex; align-items:center; gap:8px;"><span>📋</span> Command Snippets</div>
        <button class="modal-close" id="snipClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="snip-hint">Click <b>Run</b> to fill any <code>{{variables}}</code> and send the command to the active terminal.</div>
        <div class="snip-list">${listHtml}</div>
        ${editor}
        <div style="margin-top:12px;"><button class="btn btn-primary" id="snipNew">＋ New Snippet</button></div>
      </div>
    `, 'modal-lg');

    document.getElementById('snipClose').onclick = hideModal;
    document.getElementById('snipNew').onclick = () => render(-2);

    document.querySelectorAll('[data-run]').forEach(b => b.onclick = () => runSnippet(getSnippets()[+b.getAttribute('data-run')]));
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
      const s = getSnippets()[+b.getAttribute('data-copy')];
      if (sendToActiveTerminal(s.cmd, false)) { hideModal(); showToast('Snippet typed into terminal (not executed)', 'info'); }
    });
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => render(+b.getAttribute('data-edit')));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const arr = getSnippets();
      const idx = +b.getAttribute('data-del');
      if (arr[idx] && confirm(`Delete snippet "${arr[idx].name}"?`)) { arr.splice(idx, 1); saveSnippets(arr); render(); }
    });

    if (editIdx >= 0 || isNew) {
      document.getElementById('snipCancelEdit').onclick = () => render();
      document.getElementById('snipSave').onclick = () => {
        const name = document.getElementById('snipName').value.trim();
        const cmd = document.getElementById('snipCmd').value.trim();
        const category = document.getElementById('snipCat').value.trim() || 'General';
        if (!name || !cmd) { showToast('Name and command are required', 'warning'); return; }
        const arr = getSnippets();
        if (isNew) arr.push({ name, cmd, category });
        else arr[editIdx] = { name, cmd, category };
        saveSnippets(arr);
        render();
        showToast('Snippet saved', 'success');
      };
    }
  }
}
