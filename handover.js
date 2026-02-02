// Printable handover sheet — reads from localStorage (local-only).
// It tries multiple keys so it stays compatible across versions.

const KEYS = [
  "fy1_tracker_batch11_v1",
  "fy1_tracker_batch9_v1",
  "fy1_tracker_batch8_v1",
  "fy1_tracker_batch4_v1",
  "fy1_tracker_batch3_v1",
  "fy1_tracker_batch2_v1",
  "fy1_tracker_batch1_v1"
];

let raw = null;
let usedKey = null;

for (const k of KEYS) {
  const r = localStorage.getItem(k);
  if (r) { raw = r; usedKey = k; break; }
}

function safeParse() {
  try { return raw ? JSON.parse(raw) : { items: [] }; }
  catch { return { items: [] }; }
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatWhen(ms) {
  if (!ms) return "Time unknown";
  return new Date(ms).toLocaleString();
}

function urgencyRank(u) {
  if (u === "red") return 0;
  if (u === "amber") return 1;
  return 2;
}

function itemTime(item) {
  return item.type === "bleep"
    ? (item.receivedAt || item.createdAt || 0)
    : (item.createdAt || 0);
}

function isReviewItem(item) {
  return !item.done && item.nextActions && item.nextActions.trim().length > 0;
}

function progressLast(item) {
  if (!Array.isArray(item.progressLog) || item.progressLog.length === 0) return "";
  const last = item.progressLog.reduce((a, b) => (a.t > b.t ? a : b));
  return last?.text || "";
}

function badgeForUrgency(u) {
  const val = u || "amber";
  return `<span class="badge ${escapeHtml(val)}">${escapeHtml(val)}</span>`;
}

function cardHTMLForItem(i) {
  if (i.type === "bleep") {
    const parts = [];
    parts.push(`<div class="itemHead"><div><strong>📟 ${escapeHtml(i.from || "Unknown")}</strong></div><div class="row">${badgeForUrgency(i.urgency)}</div></div>`);
    if (i.location) parts.push(`<div class="meta">${escapeHtml(i.location)}</div>`);
    if (i.summary) parts.push(`<div class="meta"><strong>Task:</strong> ${escapeHtml(i.summary)}</div>`);
    parts.push(`<div class="metaRow"><span>Received: ${escapeHtml(formatWhen(i.receivedAt || i.createdAt))}</span><span>Called back: <strong>${i.calledBack ? "Yes" : "No"}</strong></span></div>`);
    const last = progressLast(i);
    if (last) parts.push(`<div class="meta"><strong>Latest:</strong> ${escapeHtml(last)}</div>`);
    if (i.nextActions) parts.push(`<div class="meta"><strong>Next:</strong> ${escapeHtml(i.nextActions)}</div>`);
    return `<div class="item">${parts.join("")}</div>`;
  }

  const head = `${escapeHtml(i.ward || "Ward?")}${i.bed ? " • Bed " + escapeHtml(i.bed) : ""}`;
  const parts = [];
  parts.push(`<div class="itemHead"><div><strong>📝 ${head}</strong></div><span class="badge">${i.done ? "Done" : "Open"}</span></div>`);
  if (i.summary) parts.push(`<div class="meta">${escapeHtml(i.summary)}</div>`);
  if (Array.isArray(i.tasks) && i.tasks.length) parts.push(`<div class="meta"><strong>Tasks:</strong> ${escapeHtml(i.tasks.join(", "))}</div>`);
  const last = progressLast(i);
  if (last) parts.push(`<div class="meta"><strong>Latest:</strong> ${escapeHtml(last)}</div>`);
  if (i.nextActions) parts.push(`<div class="meta"><strong>Next:</strong> ${escapeHtml(i.nextActions)}</div>`);
  return `<div class="item">${parts.join("")}</div>`;
}

function renderList(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<p class="muted small">None</p>';
    return;
  }
  el.innerHTML = items.map(cardHTMLForItem).join("");
}

function buildText(items) {
  const lines = [];
  lines.push("FY1 TRACKER — PRINT HANDOVER (local note)");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("Reminder: do not include patient identifiers.");
  lines.push("");

  const openBleeps = items.filter(i => i.type === "bleep" && !i.done);
  const uncalled = openBleeps.filter(i => !i.calledBack);
  const called = openBleeps.filter(i => i.calledBack);
  const openJobs = items.filter(i => i.type === "job" && !i.done);
  const review = items.filter(isReviewItem);

  const fmtB = (i) => {
    const parts = [];
    parts.push(`Bleep ${i.from || "Unknown"} (${i.urgency || "amber"})`);
    if (i.location) parts.push(i.location);
    if (i.summary) parts.push(i.summary);
    const last = progressLast(i);
    if (last) parts.push("Latest: " + last);
    if (i.nextActions) parts.push("Next: " + i.nextActions);
    parts.push("Called back: " + (i.calledBack ? "Yes" : "No"));
    parts.push("Received: " + formatWhen(i.receivedAt || i.createdAt));
    return "- " + parts.join(" | ");
  };

  const fmtJ = (i) => {
    const parts = [];
    parts.push(`Job ${i.ward || "Ward?"}${i.bed ? " Bed " + i.bed : ""}`);
    if (i.summary) parts.push(i.summary);
    if (Array.isArray(i.tasks) && i.tasks.length) parts.push("Tasks: " + i.tasks.join(", "));
    const last = progressLast(i);
    if (last) parts.push("Latest: " + last);
    if (i.nextActions) parts.push("Next: " + i.nextActions);
    return "- " + parts.join(" | ");
  };

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

const data = safeParse();
const items = Array.isArray(data.items) ? data.items : [];

const now = new Date();
const generatedAt = document.getElementById("generatedAt");
if (generatedAt) generatedAt.textContent = now.toLocaleString();

const keyUsed = document.getElementById("keyUsed");
if (keyUsed) keyUsed.textContent = usedKey ? `Data source: ${usedKey}` : "No stored data found.";

const openBleeps = items.filter(i => i.type === "bleep" && !i.done);
const uncalled = openBleeps.filter(i => !i.calledBack);
const called = openBleeps.filter(i => i.calledBack);
const openJobs = items.filter(i => i.type === "job" && !i.done);
const review = items.filter(isReviewItem);

const counts = document.getElementById("counts");
if (counts) {
  counts.innerHTML = `
    <span>Uncalled bleeps: <strong>${uncalled.length}</strong></span>
    <span>Other open bleeps: <strong>${called.length}</strong></span>
    <span>Open jobs: <strong>${openJobs.length}</strong></span>
    <span>Review: <strong>${review.length}</strong></span>
  `;
}

renderList("uncalled", uncalled.sort((a,b)=>urgencyRank(a.urgency)-urgencyRank(b.urgency) || itemTime(a)-itemTime(b)));
renderList("called", called.sort((a,b)=>urgencyRank(a.urgency)-urgencyRank(b.urgency) || itemTime(a)-itemTime(b)));
renderList("jobs", openJobs.sort((a,b)=>itemTime(a)-itemTime(b)));
renderList("review", review);

document.getElementById("printBtn")?.addEventListener("click", () => window.print());
document.getElementById("copyBtn")?.addEventListener("click", async () => {
  const text = buildText(items);
  await copyToClipboard(text);
});
