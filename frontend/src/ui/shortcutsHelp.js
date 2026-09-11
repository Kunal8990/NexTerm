// ==========================================================================
// Nexterm — Keyboard Shortcuts Cheat-Sheet Overlay
// A quick reference of all keyboard shortcuts. Opened from Help → Keyboard
// Shortcuts, or by pressing F1 / Shift+? anywhere in the app.
// ==========================================================================

import { showModal, hideModal } from './modal.js';

const GROUPS = [
  {
    title: 'Sessions & Tabs', items: [
      ['Ctrl + N', 'New SSH session'],
      ['Ctrl + W', 'Close current tab'],
      ['Ctrl + K', 'Command palette / quick search'],
      ['Alt + M', 'Toggle MultiExec broadcast bar'],
      ['Ctrl+Alt + B', 'Broadcast command to servers']
    ]
  },
  {
    title: 'Workspace & Split', items: [
      ['Ctrl+Shift + E', 'Split right (vertical)'],
      ['Ctrl+Shift + O', 'Split down (horizontal)'],
      ['Ctrl+Shift + M', 'Maximize / restore active pane'],
      ['Ctrl+Shift + \\', 'Toggle vertical split'],
      ['Ctrl+Shift + -', 'Toggle horizontal split']
    ]
  },
  {
    title: 'Terminal', items: [
      ['Ctrl+Shift + F', 'Find in terminal scrollback'],
      ['Ctrl + F', 'Find in terminal'],
      ['Ctrl + B', 'Toggle sidebar'],
      ['Esc', 'Close dialog / palette / menu']
    ]
  },
  {
    title: 'Help', items: [
      ['F1  or  Shift + ?', 'Show this shortcuts sheet']
    ]
  }
];

export function showShortcutsOverlay() {
  const cols = GROUPS.map(g => `
    <div class="ks-group">
      <div class="ks-group-title">${g.title}</div>
      ${g.items.map(([k, d]) => `
        <div class="ks-row">
          <span class="ks-keys">${k.split(/\s+\+\s+|\s+or\s+/).map(part =>
            /^(or)$/i.test(part) ? part : `<kbd>${part.replace(/\+/g, '</kbd>+<kbd>')}</kbd>`).join(' ')}</span>
          <span class="ks-desc">${d}</span>
        </div>`).join('')}
    </div>`).join('');

  showModal(`
    <div class="modal-header">
      <div class="modal-title" style="display:flex; align-items:center; gap:8px;"><span>⌨️</span> Keyboard Shortcuts</div>
      <button class="modal-close" id="ksClose">✕</button>
    </div>
    <div class="modal-body">
      <div class="ks-grid">${cols}</div>
    </div>
  `, 'modal-lg');

  const c = document.getElementById('ksClose');
  if (c) c.onclick = hideModal;
}
