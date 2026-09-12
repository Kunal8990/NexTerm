// ==========================================================================
// Nexterm — Command Scheduler / Auto-run
// Schedule a command or a saved recording to run on the active terminal —
// once after a delay, or repeating every N seconds.
// Storage: nexterm_schedules = [{ id, name, mode, command, recordingId,
//   repeat, everySec, enabled, nextRun }]
// ==========================================================================

import { showModal, hideModal } from "../ui/modal.js";
import { showToast, escapeHtml } from "../ui/notifications.js";
import { getActiveTabId, getTabs } from "../state/tabState.js";

const KEY = "nexterm_schedules";
let timer = null;

function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
function recordings() { try { const v = JSON.parse(localStorage.getItem("nexterm_recordings")); return Array.isArray(v) ? v : []; } catch (_) { return []; } }

function runItem(s) {
  const id = getActiveTabId();
  const t = getTabs()[id];
  if (!id || id === "home" || !t) return false;
  const App = window.go && window.go.main && window.go.main.App;
  if (!App || !App.WriteToTerminal) return false;
  if (s.mode === "recording") {
    const rec = recordings().find(r => r.id === s.recordingId);
    if (!rec) return false;
    let i = 0;
    const send = () => { if (i >= rec.commands.length) return; try { App.WriteToTerminal(id, rec.commands[i] + "\r"); } catch (_) {} i++; setTimeout(send, rec.delayMs || 600); };
    send();
  } else {
    try { App.WriteToTerminal(id, (s.command || "") + "\r"); } catch (_) {}
  }
  return true;
}

export function initScheduler() {
  if (timer) return;
  timer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    const list = load();
    list.forEach(s => {
      if (!s.enabled) return;
      if (!s.nextRun) { s.nextRun = now + Math.max(5, s.everySec || 60) * 1000; changed = true; return; }
      if (now >= s.nextRun) {
        runItem(s);
        if (s.repeat) { s.nextRun = now + Math.max(5, s.everySec || 60) * 1000; }
        else { s.enabled = false; s.nextRun = null; }
        changed = true;
      }
    });
    if (changed) save(list);
    if (document.getElementById("schedRoot")) renderSchedList();
  }, 1000);
}

export function showSchedulerDialog() {
  showModal(`<div id="schedRoot"></div>`, "modal-plain");
  renderScheduler();
}

function fmtCountdown(ms) {
  if (ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60), r = s % 60;
  return m + "m " + (r ? r + "s" : "");
}

function schedRowsHtml() {
  const list = load();
  const recs = recordings();
  const now = Date.now();
  if (list.length === 0) {
    return `<div class="sched-empty">No scheduled tasks yet. Create one above — it runs on whichever terminal is focused when it fires.</div>`;
  }
  return list.map(s => {
    const target = s.mode === "recording"
      ? "▶ " + escapeHtml((recs.find(r => r.id === s.recordingId) || {}).name || "(missing recording)")
      : "$ " + escapeHtml(s.command || "");
    const when = s.enabled ? (s.repeat ? `every ${s.everySec}s · next in ${fmtCountdown((s.nextRun || now) - now)}` : `once · in ${fmtCountdown((s.nextRun || now) - now)}`) : "paused";
    return `
      <div class="sched-row">
        <div class="sched-main">
          <div class="sched-name">${escapeHtml(s.name || "Task")}</div>
          <div class="sched-sub">${target}</div>
          <div class="sched-when">${when}</div>
        </div>
        <div class="sched-acts">
          <button class="sx-btn sm ${s.enabled ? 'primary' : ''} sched-toggle" data-id="${s.id}">${s.enabled ? "❚❚" : "▶"}</button>
          <button class="sx-btn sm sched-run" data-id="${s.id}" title="Run now">⚡</button>
          <button class="sx-btn sm danger sched-del" data-id="${s.id}" title="Delete">🗑️</button>
        </div>
      </div>`;
  }).join("");
}

// Refresh only the list (used by the 1s tick so the Add-task form isn't wiped)
function renderSchedList() {
  const root = document.getElementById("schedRoot");
  if (!root) return;
  const listEl = root.querySelector(".sched-list");
  if (!listEl) return;
  listEl.innerHTML = schedRowsHtml();
  listEl.querySelectorAll(".sched-toggle").forEach(b => b.onclick = () => {
    const list = load(); const s = list.find(x => x.id === b.getAttribute("data-id"));
    if (s) { s.enabled = !s.enabled; if (s.enabled) s.nextRun = Date.now() + Math.max(5, s.everySec || 60) * 1000; }
    save(list); renderSchedList();
  });
  listEl.querySelectorAll(".sched-run").forEach(b => b.onclick = () => {
    const s = load().find(x => x.id === b.getAttribute("data-id"));
    if (s) { if (runItem(s)) showToast(`Ran "${s.name}"`, "info"); else showToast("Focus a terminal first", "warning"); }
  });
  listEl.querySelectorAll(".sched-del").forEach(b => b.onclick = () => {
    save(load().filter(x => x.id !== b.getAttribute("data-id"))); renderSchedList();
  });
}

function renderScheduler() {
  const root = document.getElementById("schedRoot");
  if (!root) return;
  const recs = recordings();
  const recOptions = recs.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");

  root.innerHTML = `
    <div class="sx-card sched-card">
      <div class="sx-head">
        <div class="sx-title"><span class="sx-ico">⏱️</span> Command Scheduler</div>
        <button class="sx-x" id="schedClose">&times;</button>
      </div>
      <div class="sched-form">
        <input type="text" id="schedName" class="sx-input" placeholder="Task name" />
        <div class="sched-form-row">
          <select id="schedMode" class="sx-input">
            <option value="command">Run a command</option>
            <option value="recording" ${recs.length === 0 ? "disabled" : ""}>Run a recording</option>
          </select>
          <input type="text" id="schedCommand" class="sx-input mono" placeholder="e.g. uptime" />
          <select id="schedRec" class="sx-input" style="display:none">${recOptions}</select>
        </div>
        <div class="sched-form-row">
          <label class="sched-inline"><input type="checkbox" id="schedRepeat" checked /> Repeat</label>
          <label class="sched-inline">every <input type="number" id="schedEvery" class="sx-input tiny" value="60" min="5" /> sec</label>
          <button class="sx-btn primary" id="schedAdd">Add task</button>
        </div>
      </div>
      <div class="sched-list"></div>
    </div>`;

  root.querySelector("#schedClose").onclick = () => hideModal();
  const modeSel = root.querySelector("#schedMode");
  const cmdIn = root.querySelector("#schedCommand");
  const recSel = root.querySelector("#schedRec");
  modeSel.onchange = () => {
    const rec = modeSel.value === "recording";
    recSel.style.display = rec ? "" : "none";
    cmdIn.style.display = rec ? "none" : "";
  };
  root.querySelector("#schedAdd").onclick = () => {
    const mode = modeSel.value;
    const everySec = Math.max(5, parseInt(root.querySelector("#schedEvery").value, 10) || 60);
    const repeat = root.querySelector("#schedRepeat").checked;
    const s = {
      id: "sch_" + Date.now(),
      name: (root.querySelector("#schedName").value || "").trim() || (mode === "recording" ? "Recording task" : "Command task"),
      mode,
      command: mode === "command" ? (cmdIn.value || "").trim() : "",
      recordingId: mode === "recording" ? recSel.value : "",
      repeat, everySec, enabled: true,
      nextRun: Date.now() + everySec * 1000
    };
    if (mode === "command" && !s.command) { showToast("Enter a command", "warning"); return; }
    if (mode === "recording" && !s.recordingId) { showToast("Pick a recording", "warning"); return; }
    const list = load(); list.unshift(s); save(list);
    showToast(`Scheduled "${s.name}"`, "success");
    root.querySelector("#schedName").value = "";
    if (cmdIn) cmdIn.value = "";
    renderSchedList();
  };
  renderSchedList();
}
