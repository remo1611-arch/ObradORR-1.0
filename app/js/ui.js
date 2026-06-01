export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function fmtNumber(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-ES", { maximumFractionDigits: digits });
}
export function fmtMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}
export function toast(message, type = "ok") {
  const stack = $("#toastStack");
  const el = document.createElement("div");
  el.className = `toast ${type === "err" ? "err" : type === "warn" ? "warn" : ""}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}
export function setState(label, state = "clean") {
  const el = $("#dbState");
  el.textContent = label;
  el.className = `state-pill state-${state}`;
}
export function setStatus(message, type = "ok") {
  const el = $("#statusBox");
  el.textContent = message;
  el.className = `status-box ${type === "ok" ? "ok" : type === "err" ? "err" : type === "warn" ? "warn" : ""}`;
}
export function setSaveIndicator(message, type = "ok", detail = "") {
  const indicator = $("#saveIndicator");
  const detailEl = $("#lastSavedInfo");
  indicator.textContent = message;
  indicator.className = `save-indicator ${type}`;
  detailEl.textContent = detail;
}
export function table(headers, rows, opts = {}) {
  if (!rows?.length) return "<p class='small'>Sin datos.</p>";
  return `<table><thead><tr>${headers.map(h => `<th>${esc(h.label)}</th>`).join("")}</tr></thead><tbody>${
    rows.map(row => `<tr ${opts.rowAttrs ? opts.rowAttrs(row) : ""}>${
      headers.map(h => `<td>${h.render ? h.render(row) : esc(row[h.key])}</td>`).join("")
    }</tr>`).join("")
  }</tbody></table>`;
}
export function fillSelect(select, rows, { value = "id", label = "name", empty = "—", blank = null } = {}) {
  if (!select) return;
  const emptyText = blank ?? empty;
  select.innerHTML = `<option value="">${esc(emptyText)}</option>` + rows.map(r => {
    const rawText = typeof label === "function" ? label(r) : (r.symbol ? `${r.symbol} · ${r[label]}` : r[label]);
    return `<option value="${esc(r[value])}">${esc(rawText)}</option>`;
  }).join("");
}
export function downloadBytes(filename, bytes, mime = "application/octet-stream") {
  downloadBlob(filename, new Blob([bytes], { type: mime }));
}
export function downloadJson(filename, obj) {
  downloadBlob(filename, new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" }));
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
