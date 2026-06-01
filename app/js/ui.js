export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

const uiRuntimeState = {
  dbState: { label: "Preparando…", state: "loading" },
  status: { message: "La base todavía no se ha cargado.", type: "warn" },
  save: { message: "Preparando guardado…", type: "saving", detail: "Sin cambios todavía." }
};

function applyUiRuntimeState() {
  const stateEl = $("#dbState");
  if (stateEl) {
    stateEl.textContent = uiRuntimeState.dbState.label;
    stateEl.className = `state-pill state-${uiRuntimeState.dbState.state}`;
  }
  const statusEl = $("#statusBox");
  if (statusEl) {
    statusEl.textContent = uiRuntimeState.status.message;
    statusEl.className = `status-box ${uiRuntimeState.status.type === "ok" ? "ok" : uiRuntimeState.status.type === "err" ? "err" : uiRuntimeState.status.type === "warn" ? "warn" : ""}`;
  }
  const indicator = $("#saveIndicator");
  if (indicator) {
    indicator.textContent = uiRuntimeState.save.message;
    indicator.className = `save-indicator ${uiRuntimeState.save.type}`;
  }
  const detailEl = $("#lastSavedInfo");
  if (detailEl) detailEl.textContent = uiRuntimeState.save.detail || "";
}

document.addEventListener("DOMContentLoaded", applyUiRuntimeState);
document.addEventListener("swiftremo:lazyViewReady", applyUiRuntimeState);

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
  if (stack) {
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3600);
  } else {
    console[type === "err" ? "error" : type === "warn" ? "warn" : "info"](`[SwiftRemo] ${message}`);
  }
}
export function setState(label, state = "clean") {
  uiRuntimeState.dbState = { label, state };
  applyUiRuntimeState();
}
export function setStatus(message, type = "ok") {
  uiRuntimeState.status = { message, type };
  applyUiRuntimeState();
}
export function setSaveIndicator(message, type = "ok", detail = "") {
  uiRuntimeState.save = { message, type, detail };
  applyUiRuntimeState();
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
export function jsonSafeReplacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `[Uint8Array ${value.byteLength} bytes]`;
  if (value instanceof ArrayBuffer) return `[ArrayBuffer ${value.byteLength} bytes]`;
  return value;
}
export function safeJsonStringify(obj, space = 2) {
  return JSON.stringify(obj, jsonSafeReplacer, space);
}
export function downloadJson(filename, obj) {
  downloadBlob(filename, new Blob([safeJsonStringify(obj, 2)], { type: "application/json;charset=utf-8" }));
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
