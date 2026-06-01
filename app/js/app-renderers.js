import { esc, fmtMoney, fmtNumber } from "./ui.js?v=150v15";
import { roleLabel } from "./app-utils.js?v=150v15";

export function kpiGridHtml(items = []) {
  return items.map(item => `<div class="kpi"><span>${esc(item.label || "")}</span><b>${item.value ?? ""}</b></div>`).join("");
}

export function rangeHintHtml({ total = 0, from = 1, to = 0, label = "registros", all = false }) {
  if (all) return `<div class="view-hint-618 strong">Mostrando todos los ${esc(label)}: ${fmtNumber(total, 0)}.</div>`;
  return `<div class="view-hint-618 strong">Mostrando ${fmtNumber(from, 0)}–${fmtNumber(to, 0)} de ${fmtNumber(total, 0)} ${esc(label)}.</div>`;
}

export function archiveSummaryKpisHtml({ total = 0, complete = 0, review = 0, poor = 0, archived = 0, ingredients = 0, scope = "" }) {
  return kpiGridHtml([
    { label: "Resultados", value: fmtNumber(total, 0) },
    { label: `Completas${scope}`, value: fmtNumber(complete, 0) },
    { label: `Revisables${scope}`, value: fmtNumber(review, 0) },
    { label: `Pobres${scope}`, value: fmtNumber(poor, 0) },
    { label: `Archivadas${scope}`, value: fmtNumber(archived, 0) },
    { label: `Ingredientes${scope}`, value: fmtNumber(ingredients, 0) }
  ]);
}

export function elaborationsSummaryKpisHtml(summary = {}) {
  return kpiGridHtml([
    { label: "Resultados", value: fmtNumber(summary.total, 0) },
    { label: "Cocina/Pastelería", value: fmtNumber(summary.culinary, 0) },
    { label: "Panadería", value: fmtNumber(summary.bakery, 0) },
    { label: "Subelaboraciones", value: fmtNumber(summary.technical, 0) }
  ]);
}

export function elaborationCardHtml(r, { badge, statusLabel }) {
  const typeBadge = r.source_type === "bakery"
    ? badge("Panadería", "warn")
    : badge("Cocina/Pastelería", "ok");
  const modelBadge = badge(r.production_label || r.production_model || "Modelo", r.source_type === "bakery" ? "warn" : "off");
  const activeCls = r.active ? "" : " inactive";
  return `
    <article class="elaboration-card-625${activeCls}">
      <div class="elaboration-title-625">
        <b>${esc(r.name)}</b>
        ${badge(statusLabel(r.status), r.status === "validated" ? "ok" : r.status === "archived" ? "off" : "warn")}
      </div>
      <div class="elaboration-meta-625">
        <span>${esc(r.family || "Sin familia")}</span>
        <span>${esc(r.subfamily || "Sin subfamilia")}</span>
      </div>
      <div class="elaboration-badges-625">
        ${typeBadge}
        ${modelBadge}
        ${r.production_kind === "dual" ? badge("Dual", "warn") : ""}
      </div>
      <div class="elaboration-base-625">${esc(r.base_label || "Sin base definida")} · Coste base: <b>${fmtMoney(r.total_cost || 0)}</b></div>
      <div class="elaboration-actions-625">
        <button type="button" class="btn primary" data-open-elaboration="${esc(r.uid)}">Abrir / editar</button>
        <button type="button" class="btn ghost" data-add-elaboration-work="${esc(r.uid)}">Añadir a la práctica</button>
      </div>
    </article>`;
}

export function ingredientCardsHtml(rows, { page = null, selectedIngredientId = null, badge }) {
  if (!rows?.length) return "<p class='small'>Sin ingredientes con estos filtros.</p>";
  const total = page?.total ?? rows.length;
  const from = page ? page.offset + 1 : 1;
  const to = page ? page.offset + rows.length : rows.length;
  const note = rangeHintHtml({ total, from, to, label: "ingredientes", all: Boolean(page?.all) });
  return `${note}<div class="ingredient-card-grid-618">${
    rows.map(r => `
      <article class="ingredient-card-618 ${r.id === selectedIngredientId ? "selected" : ""}">
        <button type="button" class="ingredient-title-618" data-edit-ing="${esc(r.id)}">${esc(r.name)}</button>
        <div class="ingredient-meta-618">
          <span>${esc(r.family || "Sin familia")}</span>
          <span>${esc(r.base_unit || "—")}</span>
          <span>${fmtMoney(r.cost_per_base_unit_after_waste)}</span>
        </div>
        <div class="ingredient-badges-618">
          ${badge(r.active ? "Activo" : "Inactivo", r.active ? "ok" : "off")}
          ${badge(r.use_culinary ? "Cocina" : "No cocina", r.use_culinary ? "ok" : "off")}
          ${badge(r.use_bakery ? "Panadería" : "No panadería", r.use_bakery ? "ok" : "off")}
          ${r.bakery_role ? badge(roleLabel(r.bakery_role), "warn") : ""}
        </div>
      </article>
    `).join("")
  }</div>`;
}
