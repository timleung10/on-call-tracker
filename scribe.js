// Arrest Scribe — local-only, no identifiers.
// Separate window/page from tracker.

const scribeStartBtn = document.getElementById("scribeStartBtn");
const scribeStopBtn = document.getElementById("scribeStopBtn");
const scribeResetBtn = document.getElementById("scribeResetBtn");
const scribeCopyBtn = document.getElementById("scribeCopyBtn");

const scribeTimer = document.getElementById("scribeTimer");
const scribeLocation = document.getElementById("scribeLocation");
const scribeTeam = document.getElementById("scribeTeam");

const scribeForm = document.getElementById("scribeForm");
const scribeEventText = document.getElementById("scribeEventText");

const scribeLog = document.getElementById("scribeLog");
const scribeEmpty = document.getElementById("scribeEmpty");

let scribeState = {
  active: false,
  startedAt: null,
  stoppedAt: null,
  location: "",
  team: "",
  events: [] // { t: ms, label: string }
};

let interval = null;

function pad2(n) { return String(n).padStart(2, "0"); }

function fmtElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function now() { return Date.now(); }

function elapsed(atMs) {
  if (!scribeState.startedAt) return 0;
  return atMs - scribeState.startedAt;
}

function setButtons() {
  const active = scribeState.active;
  if (scribeStartBtn) scribeStartBtn.disabled = active;
  if (scribeStopBtn) scribeStopBtn.disabled = !active;
  if (scribeResetBtn) scribeResetBtn.disabled = active ? true : !scribeState.startedAt;
  if (scribeCopyBtn) scribeCopyBtn.disabled = !scribeState.startedAt;
}

function tick() {
  if (!scribeTimer) return;
  if (!scribeState.startedAt) { scribeTimer.textContent = "00:00"; return; }
  const ref = scribeState.active ? now() : (scribeState.stoppedAt || now());
  scribeTimer.textContent = fmtElapsed(elapsed(ref));
}

function addEvent(label) {
  if (!scribeState.startedAt) {
    scribeState.startedAt = now();
    scribeState.active = true;
    scribeState.stoppedAt = null;
    if (interval) clearInterval(interval);
    interval = setInterval(tick, 500);
  }
  scribeState.events.push({ t: now(), label });
}

function render() {
  if (!scribeLog) return;
  scribeLog.innerHTML = "";

  if (scribeEmpty) scribeEmpty.hidden = !(scribeState.startedAt && scribeState.events.length === 0);

  const sorted = [...scribeState.events].sort((a, b) => a.t - b.t);

  for (const ev of sorted) {
    const li = document.createElement("li");
    li.className = "item";
    const e = fmtElapsed(elapsed(ev.t));
    li.innerHTML = `
      <div class="itemHead">
        <div><strong>${e}</strong> <span class="muted">(${new Date(ev.t).toLocaleTimeString()})</span></div>
        <span class="badge">Event</span>
      </div>
      <div class="meta">${escapeHtml(ev.label)}</div>
      <div class="actions">
        <button class="btn btn-ghost" type="button" data-action="del" data-ts="${ev.t}">Delete</button>
      </div>
    `;
    scribeLog.appendChild(li);
  }

  setButtons();
  tick();
}

function start() {
  if (scribeState.active) return;

  scribeState.active = true;
  scribeState.startedAt = now();
  scribeState.stoppedAt = null;
  scribeState.location = (scribeLocation?.value || "").trim();
  scribeState.team = (scribeTeam?.value || "").trim();
  scribeState.events = [];

  if (interval) clearInterval(interval);
  interval = setInterval(tick, 500);

  addEvent("Scribe started");
  render();
}

function stop() {
  if (!scribeState.active) return;
  scribeState.active = false;
  scribeState.stoppedAt = now();
  addEvent("Scribe stopped");
  if (interval) clearInterval(interval);
  interval = null;
  render();
}

function reset() {
  if (!confirm("Reset scribe log? This clears the current session.")) return;
  if (interval) clearInterval(interval);
  interval = null;
  scribeState = { active: false, startedAt: null, stoppedAt: null, location: "", team: "", events: [] };
  if (scribeEventText) scribeEventText.value = "";
  render();
}

function buildTextLog() {
  if (!scribeState.startedAt) return "No scribe session.";

  const lines = [];
  lines.push("CARDIAC ARREST SCRIBE LOG (local note)");
  lines.push(`Started: ${new Date(scribeState.startedAt).toLocaleString()}`);
  if (scribeState.location) lines.push(`Location: ${scribeState.location}`);
  if (scribeState.team) lines.push(`Team/notes: ${scribeState.team}`);
  lines.push("");

  const sorted = [...scribeState.events].sort((a, b) => a.t - b.t);
  for (const ev of sorted) {
    lines.push(`${fmtElapsed(elapsed(ev.t))}  ${ev.label}`);
  }
  return lines.join("\n");
}

async function copyLog() {
  const text = buildTextLog();
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied scribe log to clipboard.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert("Copied scribe log to clipboard.");
  }
}

scribeStartBtn?.addEventListener("click", start);
scribeStopBtn?.addEventListener("click", stop);
scribeResetBtn?.addEventListener("click", reset);
scribeCopyBtn?.addEventListener("click", copyLog);

scribeForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = (scribeEventText?.value || "").trim();
  if (!txt) return;
  addEvent(txt);
  scribeEventText.value = "";
  render();
});

document.addEventListener("click", (e) => {
  const quick = e.target.closest("button[data-scribe]");
  if (quick) {
    const label = quick.getAttribute("data-scribe");
    if (label) addEvent(label);
    render();
    return;
  }
  const del = e.target.closest("button[data-action='del']");
  if (del) {
    const ts = Number(del.getAttribute("data-ts"));
    scribeState.events = scribeState.events.filter(ev => ev.t !== ts);
    render();
  }
});

render();
