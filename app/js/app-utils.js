import { esc, fmtNumber } from "./ui.js?v=1152v152";

export function readPageSizeValue(value, fallback = 50) {
  return String(value) === "all" ? "all" : Math.max(1, Number(value) || fallback);
}

export function pageWindow(total, rawPageSize, currentPage, fallback = 50) {
  const all = String(rawPageSize) === "all";
  const size = all ? Math.max(total, 1) : Math.max(1, Number(rawPageSize) || fallback);
  const totalPages = all ? 1 : Math.max(1, Math.ceil(total / size));
  const page = all ? 1 : Math.min(Math.max(1, Number(currentPage) || 1), totalPages);
  const start = all ? 0 : (page - 1) * size;
  const count = all ? total : Math.min(size, Math.max(total - start, 0));
  return { all, size, totalPages, page, start, count };
}

export function pagerHtml({ total, start, count, page, totalPages, all, attr, label = "registros" }) {
  const from = total ? start + 1 : 0;
  const to = start + count;
  if (all) {
    return `<span class="library-range-666b">Mostrando <b>todas</b>: <b>${fmtNumber(total, 0)}</b> ${esc(label)}</span>`;
  }
  const disabledPrev = page <= 1 ? "disabled" : "";
  const disabledNext = page >= totalPages ? "disabled" : "";
  return `
    <span class="library-range-666b">Mostrando <b>${fmtNumber(from, 0)}–${fmtNumber(to, 0)}</b> de <b>${fmtNumber(total, 0)}</b> · página ${fmtNumber(page, 0)}/${fmtNumber(totalPages, 0)}</span>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledPrev} ${attr}="1">Inicio</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledPrev} ${attr}="${page - 1}">Anterior</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledNext} ${attr}="${page + 1}">Siguiente</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledNext} ${attr}="${totalPages}">Final</button>`;
}

export function dateSlug(date = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

export function formatDate(value) {
  try { return new Date(value).toLocaleString("es-ES"); }
  catch { return ""; }
}

export function setInputValue($, id, value) {
  const node = $("#" + id);
  if (node) node.value = value ?? "";
}

export function badgeHtml(text, type = "ok") {
  return `<span class="badge ${type}">${esc(text)}</span>`;
}

export function roleLabel(role) {
  const labels = { flour: "Harina", liquid: "Líquido", yeast: "Levadura", salt: "Sal", fat: "Grasa", sugar: "Azúcar", egg: "Huevo", dairy: "Lácteo", aroma: "Aroma", seed: "Semilla", inclusion: "Inclusión", other: "Otro" };
  return labels[role] || role || "";
}

export function nullIfEmpty(value) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

export function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
