// FY1 Tracker — local-only PWA (Batch 11 tidy rebuild)
// Stores everything on THIS device only (localStorage). No server.
// Do not enter identifiable patient info.

const STORAGE_KEY = "fy1_tracker_batch11_v1";
const AUTO_WIPE_KEY = "fy1_tracker_autowipe_at";

// ---------- Elements (home) ----------
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const filterEl = document.getElementById("filter");
const sortEl = document.getElementById("sort");
const overdueMinsEl = document.getElementById("overdueMins");
const doNowBtn = document.getElementById("doNowBtn");
const blurBtn = document.getElementById("privacyBlurBtn");

const openDrawerBtn = document.getElementById("openDrawerBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");

const fabAdd = document.getElementById("fabAdd");
const clearAllBtn = document.getElementById("clearAllBtn");
const wipeBtn = document.getElementById("wipeBtn");
const handoverBtn = document.getElementById("handoverBtn");
const printHandoverBtn = document.getElementById("printHandoverBtn");
const shiftPresetEl = document.getElementById("shiftPreset");

// ---------- State ----------
const state = loadState();

// ---------- Utilities ----------
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function escapeHtml(str) {
  return (str ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseTasks(text) {
  return (text || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function urgencyLabel(u) {
  if (u === "red") return "Red";
  if (u === "amber") return "Amber";
  return "Green";
}

function urgencyRank(u) {
  if (u === "red") return 0;
  if (u === "amber") return 1;
  return 2;
}

function formatWhen(ms) {
  if (!ms) return "Time unknown";
  return new Date(ms).toLocaleString();
}

function itemTime(item) {
  return item.type === "bleep"
    ? (item.receivedAt || item.createdAt || 0)
    : (item.createdAt || 0);
}

function isReviewItem(item) {
  return !item.done && !!(item.nextActions && item.nextActions.trim().length);
}

function getOverdueMins() {
  const v = Number(overdueMinsEl?.value);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

function isOverdueBleep(item) {
  if (item.type !== "bleep") return false;
  if (item.done) return false;
  if (item.calledBack) return false;
  const mins = getOverdueMins();
  const t = item.receivedAt || item.createdAt || 0;
  return (Date.now() - t) > mins * 60_000;
}

function ensureProgress(item) {
  if (!Array.isArray(item.progressLog)) item.progressLog = [];
}

function addProgressEntry(id, text) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  const t = (text || "").trim();
  if (!t) return;
  ensureProgress(item);
  item.progressLog.push({ t: Date.now(), text: t });
  saveState();
  render();
}

function deleteProgressEntry(id, ts) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  ensureProgress(item);
  item.progressLog = item.progressLog.filter(e => e.t !== ts);
  saveState();
  render();
}

function progressSummary(item) {
  if (!Array.isArray(item.progressLog) || item.progressLog.length === 0) return "";
  const last = item.progressLog.reduce((a,b) => (a.t > b.t ? a : b));
  return last?.text || "";
}

// ---------- Storage ----------
function loadState() {
  // try current key; if empty, fall back to older batch keys for continuity
  const keys = [
    STORAGE_KEY,
    "fy1_tracker_batch10_v1",
    "fy1_tracker_batch9_v1",
    "fy1_tracker_batch8_v1",
    "fy1_tracker_batch7_v1",
    "fy1_tracker_batch6_v1",
    "fy1_tracker_batch5_v1"
  ];

  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) continue;

      // normalize + migrate minimally
      const items = parsed.items.map(x => {
        const createdAt = Number.isFinite(x.createdAt) ? x.createdAt : Date.now();
        const item = {
          id: x.id || uid(),
          type: x.type === "bleep" ? "bleep" : "job",
          done: !!x.done,
          createdAt,
          pinned: !!x.pinned,
          nextActions: typeof x.nextActions === "string" ? x.nextActions : "",
          editing: false
        };

        if (item.type === "bleep") {
          item.from = typeof x.from === "string" ? x.from : "";
          item.location = typeof x.location === "string" ? x.location : "";
          item.summary = typeof x.summary === "string" ? x.summary : "";
          item.urgency = (x.urgency === "red" || x.urgency === "amber" || x.urgency === "green") ? x.urgency : "amber";
          item.calledBack = !!x.calledBack;
          item.receivedAt = Number.isFinite(x.receivedAt) ? x.receivedAt : createdAt;
        } else {
          item.ward = typeof x.ward === "string" ? x.ward : "";
          item.bed = typeof x.bed === "string" ? x.bed : "";
          item.summary = typeof x.summary === "string" ? x.summary : "";
          item.tasks = Array.isArray(x.tasks) ? x.tasks.filter(Boolean) : parseTasks(x.tasks || "");
        }

        // progress migration
        if (Array.isArray(x.progressLog)) {
          item.progressLog = x.progressLog
            .filter(e => e && typeof e.text === "string")
            .map(e => ({ t: Number.isFinite(e.t) ? e.t : createdAt, text: e.text }));
        } else if (typeof x.doneNotes === "string" && x.doneNotes.trim().length) {
          item.progressLog = [{ t: createdAt, text: x.doneNotes.trim() }];
        } else {
          item.progressLog = [];
        }
        return item;
      });

      const state = { items };
      // If loaded from older key, persist under new key once.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch {
      // continue
    }
  }
  return { items: [] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
}

// ---------- Drawer ----------
function openDrawer() {
  if (!drawer || !drawerBackdrop) return;
  drawer.hidden = false;
  drawerBackdrop.hidden = false;
  drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  if (!drawer || !drawerBackdrop) return;
  drawer.hidden = true;
  drawerBackdrop.hidden = true;
  drawer.setAttribute("aria-hidden", "true");
}

openDrawerBtn?.addEventListener("click", openDrawer);
closeDrawerBtn?.addEventListener("click", closeDrawer);
drawerBackdrop?.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---------- Blur ----------
let blurred = false;
blurBtn?.addEventListener("click", () => {
  blurred = !blurred;
  document.body.classList.toggle("blurActive", blurred);
});

// ---------- Auto-wipe (24h) ----------
function scheduleAutoWipe(hours = 24) {
  const at = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(AUTO_WIPE_KEY, String(at));
}
function checkAutoWipe() {
  const at = Number(localStorage.getItem(AUTO_WIPE_KEY));
  if (Number.isFinite(at) && Date.now() > at) {
    localStorage.removeItem(AUTO_WIPE_KEY);
    alert("End-of-shift auto wipe triggered.");
    state.items = [];
    saveState();
    render();
  }
}
setInterval(checkAutoWipe, 60_000);
if (!localStorage.getItem(AUTO_WIPE_KEY)) scheduleAutoWipe(24);

// ---------- Handover ----------
function buildHandoverText() {
  const items = state.items || [];
  const openBleeps = items.filter(i => i.type === "bleep" && !i.done);
  const uncalled = openBleeps.filter(i => !i.calledBack);
  const called = openBleeps.filter(i => i.calledBack);
  const openJobs = items.filter(i => i.type === "job" && !i.done);
  const review = items.filter(isReviewItem);

  const fmtB = (b) => {
    const parts = [];
    parts.push(`Bleep ${b.from || "Unknown"} (${b.urgency || "amber"})`);
    if (b.location) parts.push(b.location);
    if (b.summary) parts.push(b.summary);
    const last = progressSummary(b);
    if (last) parts.push("Latest: " + last);
    if (b.nextActions) parts.push("Next: " + b.nextActions);
    parts.push("Called back: " + (b.calledBack ? "Yes" : "No"));
    parts.push("Received: " + formatWhen(b.receivedAt || b.createdAt));
    return "- " + parts.join(" | ");
  };

  const fmtJ = (j) => {
    const parts = [];
    parts.push(`Job ${j.ward || "Ward?"}${j.bed ? " Bed " + j.bed : ""}`);
    if (j.summary) parts.push(j.summary);
    if (Array.isArray(j.tasks) && j.tasks.length) parts.push("Tasks: " + j.tasks.join(", "));
    const last = progressSummary(j);
    if (last) parts.push("Latest: " + last);
    if (j.nextActions) parts.push("Next: " + j.nextActions);
    return "- " + parts.join(" | ");
  };

  const lines = [];
  lines.push("FY1 TRACKER — HANDOVER (local note)");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("UNCALLED BLEEPS");
  lines.push(uncalled.length ? uncalled.sort((a,b)=>urgencyRank(a.urgency)-urgencyRank(b.urgency)).map(fmtB).join("\n") : "- None");
  lines.push("");
  lines.push("OTHER OPEN BLEEPS");
  lines.push(called.length ? called.sort((a,b)=>urgencyRank(a.urgency)-urgencyRank(b.urgency)).map(fmtB).join("\n") : "- None");
  lines.push("");
  lines.push("OPEN JOBS");
  lines.push(openJobs.length ? openJobs.sort((a,b)=>itemTime(a)-itemTime(b)).map(fmtJ).join("\n") : "- None");
  lines.push("");
  lines.push("REVIEW QUEUE");
  lines.push(review.length ? review.map(i => i.type === "bleep" ? fmtB(i) : fmtJ(i)).join("\n") : "- None");
  lines.push("");
  lines.push("Reminder: do not include patient identifiers.");
  return lines.join("\n");
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert("Copied to clipboard.");
  }
}

handoverBtn?.addEventListener("click", async () => {
  await copyToClipboard(buildHandoverText());
  closeDrawer();
});
printHandoverBtn?.addEventListener("click", () => {
  window.open("handover.html", "_blank", "noopener");
  closeDrawer();
});

// ---------- Shift presets ----------
shiftPresetEl?.addEventListener("change", () => {
  const v = shiftPresetEl.value;
  if (v === "night") {
    if (overdueMinsEl) overdueMinsEl.value = 5;
    if (sortEl) sortEl.value = "priority";
    if (filterEl) filterEl.value = "open";
  } else if (v === "twilight") {
    if (overdueMinsEl) overdueMinsEl.value = 8;
    if (sortEl) sortEl.value = "triage";
  } else {
    if (overdueMinsEl) overdueMinsEl.value = 10;
    if (sortEl) sortEl.value = "newest";
    if (filterEl) filterEl.value = "all";
  }
  syncChips();
  render();
  closeDrawer();
});

// ---------- Actions ----------
let undoItem = null;
function showUndo(item) {
  undoItem = item;
  const bar = document.createElement("div");
  bar.className = "snackbar";
  bar.innerHTML = `Item deleted <button class="btn btn-ghost btn-small" type="button">Undo</button>`;
  document.body.appendChild(bar);
  bar.querySelector("button").onclick = () => {
    if (undoItem) {
      state.items.unshift(undoItem);
      undoItem = null;
      saveState();
      render();
    }
    bar.remove();
  };
  setTimeout(() => {
    try { bar.remove(); } catch {}
  }, 5000);
}

function deleteItem(id) {
  const idx = state.items.findIndex(x => x.id === id);
  if (idx === -1) return;
  const [deleted] = state.items.splice(idx, 1);
  saveState();
  render();
  showUndo(deleted);
}

function toggleDone(id) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  const markingDone = !item.done;
  if (markingDone && item.nextActions && item.nextActions.trim().length > 0) {
    const ok = confirm("This item still has Next actions/review notes. Mark as done anyway?");
    if (!ok) return;
  }
  item.done = !item.done;
  if (item.done) addProgressEntry(item.id, "Marked as done");
  saveState();
  render();
}

function toggleCalledBack(id) {
  const item = state.items.find(x => x.id === id);
  if (!item || item.type !== "bleep") return;
  item.calledBack = !item.calledBack;
  if (item.calledBack) addProgressEntry(item.id, "Called back");
  saveState();
  render();
}

function startEdit(id) {
  state.items.forEach(i => i.editing = false);
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  item.editing = true;
  saveState();
  render();
}

function cancelEdit(id) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;
  item.editing = false;
  saveState();
  render();
}

function saveEdit(id, updates) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;

  if (typeof updates.nextActions === "string") item.nextActions = updates.nextActions.trim();

  if (item.type === "bleep") {
    if (typeof updates.location === "string") item.location = updates.location.trim();
    if (typeof updates.summary === "string") item.summary = updates.summary.trim();
    if (updates.urgency === "red" || updates.urgency === "amber" || updates.urgency === "green") item.urgency = updates.urgency;
    if (typeof updates.calledBack === "boolean") item.calledBack = updates.calledBack;
  } else {
    if (typeof updates.ward === "string") item.ward = updates.ward.trim();
    if (typeof updates.bed === "string") item.bed = updates.bed.trim();
    if (typeof updates.summary === "string") item.summary = updates.summary.trim();
    if (typeof updates.tasks === "string") item.tasks = parseTasks(updates.tasks);
  }

  item.editing = false;
  saveState();
  render();
}

function buildItemSummary(item) {
  const lines = [];
  lines.push("FY1 TRACKER — ITEM SUMMARY (local note)");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (item.type === "bleep") {
    lines.push(`Type: Bleep`);
    lines.push(`From: ${item.from || "Unknown"}`);
    lines.push(`Urgency: ${item.urgency || "amber"}`);
    if (item.location) lines.push(`Location: ${item.location}`);
    if (item.summary) lines.push(`Task: ${item.summary}`);
    lines.push(`Called back: ${item.calledBack ? "Yes" : "No"}`);
    lines.push(`Received: ${formatWhen(item.receivedAt || item.createdAt)}`);
  } else {
    lines.push(`Type: Job`);
    lines.push(`Ward/bed: ${(item.ward || "Ward?")}${item.bed ? " Bed " + item.bed : ""}`);
    if (item.summary) lines.push(`Summary: ${item.summary}`);
    if (Array.isArray(item.tasks) && item.tasks.length) lines.push(`Tasks: ${item.tasks.join(", ")}`);
    lines.push(`Created: ${formatWhen(item.createdAt)}`);
  }
  lines.push(`Status: ${item.done ? "Done" : "Open"}`);
  lines.push("");

  if (Array.isArray(item.progressLog) && item.progressLog.length) {
    lines.push("Progress (time-stamped):");
    const sorted = [...item.progressLog].sort((a,b)=>a.t-b.t);
    for (const e of sorted) lines.push(`- ${new Date(e.t).toLocaleString()} — ${e.text}`);
    lines.push("");
  }
  if (item.nextActions && item.nextActions.trim().length) {
    lines.push(`Next actions/review: ${item.nextActions.trim()}`);
  }
  lines.push("");
  lines.push("Reminder: do not include patient identifiers.");
  return lines.join("\n");
}

// ---------- Filtering / Sorting ----------
function matchesSearch(item, q) {
  if (!q) return true;
  const blob = [
    item.type,
    item.type === "bleep" ? item.from : item.ward,
    item.bed,
    item.location,
    item.summary,
    Array.isArray(item.tasks) ? item.tasks.join(" ") : "",
    item.nextActions,
    ...(Array.isArray(item.progressLog) ? item.progressLog.map(e => e.text) : [])
  ].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(q);
}

function getVisibleItems() {
  const q = (searchEl?.value || "").trim().toLowerCase();
  const filter = filterEl?.value || "all";
  const sort = sortEl?.value || "newest";

  let items = (state.items || []).slice();

  items = items.filter(item => matchesSearch(item, q));

  items = items.filter(item => {
    if (filter === "open") return !item.done;
    if (filter === "done") return !!item.done;
    if (filter === "review") return isReviewItem(item);
    if (filter === "bleeps") return item.type === "bleep";
    if (filter === "jobs") return item.type === "job";
    if (filter === "uncalled") return item.type === "bleep" && !item.done && !item.calledBack;
    if (filter === "overdue") return isOverdueBleep(item);
    return true;
  });

  const pinFirst = (a,b) => (b.pinned === true) - (a.pinned === true);

  if (sort === "triage") {
    items.sort((a,b) => {
      const pa = a.type === "bleep" ? urgencyRank(a.urgency) : 3;
      const pb = b.type === "bleep" ? urgencyRank(b.urgency) : 3;
      if (pinFirst(a,b) !== 0) return pinFirst(a,b);
      if (pa !== pb) return pa - pb;
      return itemTime(b) - itemTime(a);
    });
  } else if (sort === "priority") {
    items.sort((a,b) => {
      if (pinFirst(a,b) !== 0) return pinFirst(a,b);
      const key = (i) => {
        if (i.type === "bleep") {
          const uncalled = (!i.done && !i.calledBack) ? 0 : 1;
          return [0, uncalled, urgencyRank(i.urgency), itemTime(i)];
        }
        return [1, 0, 9, itemTime(i)];
      };
      const ka = key(a), kb = key(b);
      for (let idx = 0; idx < ka.length; idx++) {
        if (ka[idx] !== kb[idx]) return ka[idx] - kb[idx];
      }
      return 0;
    });
  } else {
    items.sort((a,b) => {
      if (pinFirst(a,b) !== 0) return pinFirst(a,b);
      return itemTime(b) - itemTime(a);
    });
  }

  return items;
}

// ---------- Render ----------
function sectionHeaderLi(title) {
  const li = document.createElement("li");
  li.className = "item";
  li.innerHTML = `<div class="itemHead"><div><strong>${escapeHtml(title)}</strong></div><span class="badge">Group</span></div>`;
  return li;
}

function buildEditBlock(item) {
  const next = item.nextActions ? escapeHtml(item.nextActions) : "";
  const progress = Array.isArray(item.progressLog) ? item.progressLog.slice().sort((a,b)=>a.t-b.t) : [];
  const progressHtml = progress.map(e => `
    <li class="progressItem">
      <div class="progressMeta">${new Date(e.t).toLocaleString()}</div>
      <div class="progressText">${escapeHtml(e.text)}</div>
      <div class="actions">
        <button class="btn btn-ghost btn-small" type="button" data-action="delProgress" data-id="${item.id}" data-ts="${e.t}">Delete</button>
      </div>
    </li>
  `).join("");

  if (item.type === "bleep") {
    return `
      <div class="inlineEdit" style="width:100%;">
        <strong>Edit bleep</strong>
        <label>Location (optional)
          <input data-edit="location" data-id="${item.id}" type="text" value="${escapeHtml(item.location || "")}" />
        </label>
        <label>Task summary (optional)
          <input data-edit="summary" data-id="${item.id}" type="text" value="${escapeHtml(item.summary || "")}" />
        </label>
        <label>Urgency
          <select data-edit="urgency" data-id="${item.id}">
            <option value="red" ${item.urgency === "red" ? "selected" : ""}>🔴 Red</option>
            <option value="amber" ${item.urgency === "amber" ? "selected" : ""}>🟠 Amber</option>
            <option value="green" ${item.urgency === "green" ? "selected" : ""}>🟢 Green</option>
          </select>
        </label>
        <label class="row checkboxRow" style="margin-top:10px;">
          <input data-edit="calledBack" data-id="${item.id}" type="checkbox" ${item.calledBack ? "checked" : ""} />
          Called back?
        </label>

        <label>Add progress (time-stamped)
          <input data-progress="input" data-id="${item.id}" type="text" placeholder="e.g. Called back, reviewed, discussed with reg" />
        </label>
        <div class="row">
          <button class="btn btn-ghost btn-small" type="button" data-action="addProgress" data-id="${item.id}">Add progress</button>
        </div>

        <ul class="progressList">${progressHtml}</ul>

        <label>Next actions / review
          <textarea data-edit="nextActions" data-id="${item.id}" rows="2" placeholder="e.g. Recheck U&Es 2pm, chase CT report">${next}</textarea>
        </label>

        <div class="row">
          <button class="btn btn-primary btn-small" type="button" data-action="saveEdit" data-id="${item.id}">Save</button>
          <button class="btn btn-ghost btn-small" type="button" data-action="cancelEdit" data-id="${item.id}">Cancel</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="inlineEdit" style="width:100%;">
      <strong>Edit job</strong>
      <div class="grid">
        <label>Ward
          <input data-edit="ward" data-id="${item.id}" type="text" value="${escapeHtml(item.ward || "")}" />
        </label>
        <label>Bed
          <input data-edit="bed" data-id="${item.id}" type="text" value="${escapeHtml(item.bed || "")}" />
        </label>
      </div>

      <label>Summary
        <input data-edit="summary" data-id="${item.id}" type="text" value="${escapeHtml(item.summary || "")}" />
      </label>

      <label>Tasks (comma separated)
        <input data-edit="tasks" data-id="${item.id}" type="text" value="${escapeHtml((item.tasks || []).join(", "))}" />
      </label>

      <label>Add progress (time-stamped)
        <input data-progress="input" data-id="${item.id}" type="text" placeholder="e.g. Bloods taken, spoke to reg" />
      </label>
      <div class="row">
        <button class="btn btn-ghost btn-small" type="button" data-action="addProgress" data-id="${item.id}">Add progress</button>
      </div>

      <ul class="progressList">${progressHtml}</ul>

      <label>Next actions / review
        <textarea data-edit="nextActions" data-id="${item.id}" rows="2" placeholder="e.g. Review afternoon labs, chase imaging">${next}</textarea>
      </label>

      <div class="row">
        <button class="btn btn-primary btn-small" type="button" data-action="saveEdit" data-id="${item.id}">Save</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="cancelEdit" data-id="${item.id}">Cancel</button>
      </div>
    </div>
  `;
}

function render() {
  checkAutoWipe();

  const items = getVisibleItems();
  listEl.innerHTML = "";
  emptyEl.hidden = (state.items || []).length !== 0;

  const sortMode = sortEl?.value || "newest";
  let lastGroup = null;

  for (const item of items) {
    if (sortMode === "priority") {
      const group = (() => {
        if (item.type === "bleep") {
          if (!item.done && !item.calledBack && isOverdueBleep(item)) return "🔴 Overdue uncalled bleeps";
          if (!item.done && !item.calledBack) return "📞 Uncalled bleeps";
          return "📟 Other bleeps";
        }
        return "📝 Jobs";
      })();
      if (group !== lastGroup) {
        listEl.appendChild(sectionHeaderLi(group));
        lastGroup = group;
      }
    }

    const li = document.createElement("li");
    li.className = "item" + (item.done ? " done" : "") + (isOverdueBleep(item) ? " overdue" : "") + (item.pinned ? " pinned" : "") + (item.editing ? " expanded" : "");

    const latest = progressSummary(item);
    const subtitle = (item.type === "bleep")
      ? (item.summary && item.summary.trim().length
          ? escapeHtml(item.summary)
          : `<em class="muted">No job details yet — add after calling back</em>`)
      : escapeHtml(item.summary || "—");

    const badge = (item.type === "bleep")
      ? `<span class="badge ${escapeHtml(item.urgency)}">${urgencyLabel(item.urgency)}</span>`
      : `<span class="badge">${item.done ? "Done" : "Open"}</span>`;

    const title = (item.type === "bleep")
      ? `📟 ${escapeHtml(item.from || "Unknown")}`
      : `📝 ${escapeHtml(item.ward || "Ward?")}${item.bed ? " • Bed " + escapeHtml(item.bed) : ""}`;

    const meta = [];
    if (item.type === "bleep") {
      meta.push(`<span>🕒 ${escapeHtml(formatWhen(item.receivedAt || item.createdAt))}</span>`);
      meta.push(`<span>📞 ${item.calledBack ? "Called back" : "Not called back"}</span>`);
      if (item.location) meta.push(`<span>📍 ${escapeHtml(item.location)}</span>`);
    } else {
      if (Array.isArray(item.tasks) && item.tasks.length) meta.push(`<span>✅ ${escapeHtml(item.tasks.join(", "))}</span>`);
    }
    if (item.pinned) meta.push(`<span>📌 Pinned</span>`);

    li.innerHTML = `
      <div class="itemMain">
        <div style="flex:1;">
          <div class="itemTitle">${title}</div>
          <div class="itemSub">${subtitle}</div>
        </div>
        <div class="row" style="gap:8px; align-items:flex-start;">
          ${badge}
          <button class="moreBtn" type="button" data-action="toggleExpand" data-id="${item.id}" aria-label="More">⋯</button>
        </div>
      </div>

      ${meta.length ? `<div class="metaRow">${meta.join("")}</div>` : ""}

      ${latest ? `<div class="meta" style="margin-top:8px;"><strong>Latest:</strong> ${escapeHtml(latest)}</div>` : ""}
      ${(item.nextActions && item.nextActions.trim().length) ? `<div class="meta"><strong>Next:</strong> ${escapeHtml(item.nextActions)}</div>` : ""}

      <div class="itemActions">
        <button class="btn btn-ghost btn-small" type="button" data-action="pin" data-id="${item.id}">${item.pinned ? "Unpin" : "Pin"}</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="copyItem" data-id="${item.id}">Copy summary</button>
        ${item.type === "bleep" ? `<button class="btn btn-ghost btn-small" type="button" data-action="calledback" data-id="${item.id}">${item.calledBack ? "Mark not called back" : "Mark called back"}</button>` : ""}
        <button class="btn btn-ghost btn-small" type="button" data-action="edit" data-id="${item.id}">Edit / progress</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="done" data-id="${item.id}">${item.done ? "Mark open" : "Mark done"}</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="delete" data-id="${item.id}">Delete</button>
        ${item.editing ? buildEditBlock(item) : ""}
      </div>
    `;
    listEl.appendChild(li);
  }
}

// ---------- List interaction ----------
listEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  const li = e.target.closest("li.item");

  if (!btn) {
    if (li) li.classList.toggle("expanded");
    return;
  }

  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  const item = state.items.find(x => x.id === id);

  if (action === "toggleExpand") {
    li?.classList.toggle("expanded");
    return;
  }
  if (!item) return;

  if (action === "done") return toggleDone(id);
  if (action === "delete") return deleteItem(id);
  if (action === "calledback") return toggleCalledBack(id);
  if (action === "pin") {
    item.pinned = !item.pinned;
    saveState();
    render();
    return;
  }
  if (action === "copyItem") {
    copyToClipboard(buildItemSummary(item));
    return;
  }
  if (action === "edit") return startEdit(id);
  if (action === "cancelEdit") return cancelEdit(id);

  if (action === "addProgress") {
    const input = document.querySelector(`input[data-progress="input"][data-id="${id}"]`);
    addProgressEntry(id, input?.value || "");
    if (input) input.value = "";
    return;
  }

  if (action === "delProgress") {
    const ts = Number(btn.getAttribute("data-ts"));
    if (Number.isFinite(ts)) deleteProgressEntry(id, ts);
    return;
  }

  if (action === "saveEdit") {
    const getInput = (field) => document.querySelector(`input[data-edit="${field}"][data-id="${id}"]`);
    const getSelect = (field) => document.querySelector(`select[data-edit="${field}"][data-id="${id}"]`);
    const getText = (field) => document.querySelector(`textarea[data-edit="${field}"][data-id="${id}"]`);
    const getCheck = (field) => document.querySelector(`input[type="checkbox"][data-edit="${field}"][data-id="${id}"]`);

    saveEdit(id, {
      nextActions: getText("nextActions")?.value || "",
      location: getInput("location")?.value,
      summary: getInput("summary")?.value,
      urgency: getSelect("urgency")?.value,
      calledBack: getCheck("calledBack") ? getCheck("calledBack").checked : undefined,
      ward: getInput("ward")?.value,
      bed: getInput("bed")?.value,
      tasks: getInput("tasks")?.value
    });
    return;
  }
});

// ---------- Chips ----------
function syncChips() {
  const v = filterEl?.value || "all";
  document.querySelectorAll("button.chip[data-chip]").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-chip") === v);
  });
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest("button.chip[data-chip]");
  if (!chip) return;
  const v = chip.getAttribute("data-chip");
  if (filterEl) filterEl.value = v;
  syncChips();
  render();
});

// ---------- Controls ----------
searchEl?.addEventListener("input", render);
overdueMinsEl?.addEventListener("change", render);

filterEl?.addEventListener("change", () => { syncChips(); render(); closeDrawer(); });
sortEl?.addEventListener("change", () => { render(); closeDrawer(); });

fabAdd?.addEventListener("click", () => window.open("add.html", "_blank", "noopener"));

clearAllBtn?.addEventListener("click", () => {
  const ok = confirm("Clear ALL items? This cannot be undone.");
  if (!ok) return;
  state.items = [];
  saveState();
  render();
  closeDrawer();
});

wipeBtn?.addEventListener("click", () => {
  const ok = confirm("End shift wipe? This clears all items on this device.");
  if (!ok) return;
  state.items = [];
  saveState();
  scheduleAutoWipe(24); // reset wipe timer after wipe
  render();
  closeDrawer();
});

doNowBtn?.addEventListener("click", () => {
  const open = state.items.filter(i => !i.done);
  if (!open.length) return alert("Nothing pending 🎉");
  // Prefer uncalled bleeps, then overdue, then newest
  open.sort((a,b) => {
    const au = (a.type === "bleep" && !a.calledBack) ? 0 : 1;
    const bu = (b.type === "bleep" && !b.calledBack) ? 0 : 1;
    if (au !== bu) return au - bu;
    const ao = isOverdueBleep(a) ? 0 : 1;
    const bo = isOverdueBleep(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return itemTime(b) - itemTime(a);
  });
  const next = open[0];
  alert("Suggested next:\n\n" + (next.type === "bleep" ? `Bleep: ${next.from || "Unknown"}` : `Job: ${next.ward || "Ward?"}`));
});

// ---------- Service worker ----------
window.addEventListener("load", async () => {
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("./sw.js");
    }
  } catch {}
});

// Initial
syncChips();
render();
