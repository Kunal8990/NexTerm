// ==========================================================================
// Nexterm — Command History (searchable, cross-session)
// Every SSH command you run is logged; search and re-run any of them.
// Storage: nexterm_cmd_history = [{ cmd, host, ts }] (newest first, capped)
// ==========================================================================

import { showModal, hideModal } from "../ui/modal.js";
import { showToast, escapeHtml } from "../ui/notifications.js";
import { getActiveTabId, getTabs } from "../state/tabState.js";

const KEY = "nexterm_cmd_history";
const CAP = 800;

function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }

export function pushHistory(host, cmd) {
  const c = (cmd || "").trim();
  if (!c) return;
  let a = load();
  // avoid consecutive duplicates
  if (a[0] && a[0].cmd === c && a[0].host === (host || "")) return;
  a.unshift({ cmd: c, host: host || "", ts: Date.now() });
  if (a.length > CAP) a = a.slice(0, CAP);
  save(a);
}

function runOnActive(cmd) {
  const id = getActiveTabId();
  const t = getTabs()[id];
  if (!id || id === "home" || !t) { showToast("Focus a terminal first", "warning"); return; }
  const App = window.go && window.go.main && window.go.main.App;
  if (!App || !App.WriteToTerminal) { showToast("Needs the built app (run.bat)", "error"); return; }
  App.WriteToTerminal(id, cmd + "\r");
}

export function showHistoryDialog() {
  showModal(`<div id="histRoot"></div>`, "modal-plain");
  renderHistory("");
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60); if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

function renderHistory(q) {
  const root = document.getElementById("histRoot");
  if (!root) return;
  const all = load();
  const ql = (q || "").trim().toLowerCase();
  const items = ql ? all.filter(h => h.cmd.toLowerCase().includes(ql) || (h.host || "").toLowerCase().includes(ql)) : all;
  const shown = items.slice(0, 300);

  const rows = shown.length === 0
    ? `<div class="sched-empty">${all.length === 0 ? "No commands recorded yet. Run some commands over SSH and they'll appear here." : "No matches."}</div>`
    : shown.map((h, i) => `
      <div class="hist-row" data-i="${i}">
        <span class="hist-cmd">${escapeHtml(h.cmd)}</span>
        <span class="hist-meta">${escapeHtml(h.host || "")} · ${timeAgo(h.ts)}</span>
        <span class="hist-acts">
          <button class="sx-btn sm primary hist-run" data-cmd="${escapeHtml(h.cmd)}" title="Run on active terminal">▶</button>
          <button class="sx-btn sm hist-copy" data-cmd="${escapeHtml(h.cmd)}" title="Copy">⧉</button>
        </span>
      </div>`).join("");

  root.innerHTML = `
    <div class="sx-card">
      <div class="sx-head">
        <div class="sx-title"><span class="sx-ico">🕘</span> Command History</div>
        <button class="sx-x" id="histClose">&times;</button>
      </div>
      <div class="hist-search-row">
        <input type="text" id="histSearch" class="sx-input" placeholder="Search commands or hosts…" value="${escapeHtml(q || "")}" />
        <button class="sx-btn danger" id="histClear" title="Clear all history">Clear</button>
      </div>
      <div class="hist-list">${rows}</div>
    </div>`;

  root.querySelector("#histClose").onclick = () => hideModal();
  const search = root.querySelector("#histSearch");
  search.oninput = () => { const v = search.value; renderHistory(v); const s2 = document.getElementById("histSearch"); if (s2) { s2.focus(); s2.setSelectionRange(v.length, v.length); } };
  root.querySelector("#histClear").onclick = () => { if (confirm("Clear all command history?")) { save([]); renderHistory(""); } };
  root.querySelectorAll(".hist-run").forEach(b => b.onclick = () => { hideModal(); runOnActive(b.getAttribute("data-cmd")); });
  root.querySelectorAll(".hist-copy").forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.getAttribute("data-cmd")); showToast("Copied", "success"); } catch (_) {}
  });
  setTimeout(() => { const s = document.getElementById("histSearch"); if (s) s.focus(); }, 30);
}
