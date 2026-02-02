// Add window: writes to the same localStorage state as the main app.
const STORAGE_KEY = "fy1_tracker_batch11_v1";

const closeBtn = document.getElementById("closeBtn");

// Job form
const jobTemplate = document.getElementById("jobTemplate");
const jobForm = document.getElementById("jobForm");
const ward = document.getElementById("ward");
const bed = document.getElementById("bed");
const summary = document.getElementById("summary");
const tasks = document.getElementById("tasks");

// Bleep form
const bleepForm = document.getElementById("bleepForm");
const bleepFrom = document.getElementById("bleepFrom");
const bleepLocation = document.getElementById("bleepLocation");
const bleepSummary = document.getElementById("bleepSummary");
const bleepUrgency = document.getElementById("bleepUrgency");
const bleepTime = document.getElementById("bleepTime");
const bleepCalledBack = document.getElementById("bleepCalledBack");

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseTasks(text) {
  return (text || "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function timeFromDatetimeLocal(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function ensureProgress(item) {
  if (!Array.isArray(item.progressLog)) item.progressLog = [];
}

function addProgress(item, text) {
  const t = (text || "").trim();
  if (!t) return;
  ensureProgress(item);
  item.progressLog.push({ t: Date.now(), text: t });
}

function applyTemplate(v) {
  if (!v) return;
  if (v === "bloods") {
    summary.value = summary.value || "Bloods/cannula";
    tasks.value = tasks.value || "Bloods, cannula, document, update senior if abnormal";
  } else if (v === "review") {
    summary.value = summary.value || "Review patient";
    tasks.value = tasks.value || "Review obs, examine, plan, update nurse/senior";
  } else if (v === "imaging") {
    summary.value = summary.value || "Chase imaging";
    tasks.value = tasks.value || "Chase report, inform senior, act on result";
  } else if (v === "discharge") {
    summary.value = summary.value || "Discharge tasks";
    tasks.value = tasks.value || "TTO, meds, letters, follow-up, inform patient";
  }
}

jobTemplate?.addEventListener("change", () => applyTemplate(jobTemplate.value));

jobForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const st = loadState();
  const item = {
    id: uid(),
    type: "job",
    ward: (ward.value || "").trim(),
    bed: (bed.value || "").trim(),
    summary: (summary.value || "").trim(),
    tasks: parseTasks(tasks.value || ""),
    done: false,
    createdAt: Date.now(),
    nextActions: "",
    progressLog: [],
    pinned: false
  };
  addProgress(item, "Created");
  st.items.unshift(item);
  saveState(st);
  jobForm.reset();
  ward.focus();
  alert("Job added.");
});

bleepForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!bleepFrom.value || !bleepFrom.value.trim()) {
    alert("Please enter the bleep/extension number.");
    bleepFrom.focus();
    return;
  }
  const st = loadState();
  const receivedAt = timeFromDatetimeLocal(bleepTime.value || "") ?? Date.now();
  const item = {
    id: uid(),
    type: "bleep",
    from: (bleepFrom.value || "").trim(),
    location: (bleepLocation.value || "").trim(),
    summary: (bleepSummary.value || "").trim(),
    urgency: (bleepUrgency.value || "amber"),
    calledBack: !!bleepCalledBack.checked,
    done: false,
    receivedAt,
    createdAt: Date.now(),
    nextActions: "",
    progressLog: [],
    pinned: false
  };
  addProgress(item, "Received");
  if (item.calledBack) addProgress(item, "Called back");
  st.items.unshift(item);
  saveState(st);
  bleepForm.reset();
  bleepFrom.focus();
  alert("Bleep added.");
});

closeBtn?.addEventListener("click", () => {
  try { window.close(); } catch {}
  history.back();
});
