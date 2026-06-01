import { $, esc, fmtMoney, fmtNumber, table, fillSelect, toast } from "./ui.js";
import { printCulinaryRecipe } from "./print-service-v6-1.js";
import { slugCulinaryRecipeIdFromName, slugCulinaryLineId } from "./repositories.js";

let selectedRecipeId = null;
let selectedLineId = null;
let readyBound = false;

window.addEventListener("DOMContentLoaded", initCulinaryUi);
window.addEventListener("swiftremo:coreReady", () => renderCulinaryUi());
window.addEventListener("swiftremo:render", () => renderCulinaryUi());

function core() { return window.SwiftRemoCore; }
function repo() { return core()?.repo; }

function initCulinaryUi() {
  if (!$("#culinaryRecipeSelectV51")) return;
  bindOnce("#culinaryRecipeSelectV51", "change", () => loadRecipe($("#culinaryRecipeSelectV51").value));
  bindOnce("#culinaryNewRecipeV51", "click", newRecipe);
  bindOnce("#culinarySaveRecipeV51", "click", saveRecipe);
  bindOnce("#culinaryAddSelectionV623", "click", addCurrentToSelection);
  bindOnce("#culinaryPrintRecipeV51", "click", printRecipe);
  bindOnce("#culinaryClearLineV51", "click", clearLineForm);
  bindOnce("#culinaryClearLineFormV51", "click", clearLineForm);
  bindOnce("#culinaryLineFormV51", "submit", saveLine);
  bindOnce("#culinaryDeleteLineV51", "click", deleteLine);
  readyBound = true;
  renderCulinaryUi();
}

function bindOnce(selector, eventName, handler) {
  const el = $(selector);
  if (!el || el.dataset.culinary51Bound === "1") return;
  el.dataset.culinary51Bound = "1";
  el.addEventListener(eventName, handler);
}

function renderCulinaryUi() {
  if (!readyBound || !repo()) return;
  populateCatalogs();
  renderRecipeSelect();
  if (!selectedRecipeId) {
    const first = repo().culinaryRecipes()[0];
    if (first) selectedRecipeId = first.id;
  }
  if (selectedRecipeId) loadRecipe(selectedRecipeId, false);
  else newRecipe(false);
}

function populateCatalogs() {
  const cats = repo().catalogs();
  const families = cats.families.filter(f => f.area === "culinary");
  fillSelect($("#culinaryFamilyV51"), families, { value: "id", label: "name", blank: "Sin familia" });
  fillSelect($("#culinarySubfamilyV51"), cats.subfamilies, { value: "id", label: r => r.name, blank: "Sin subfamilia" });
  fillSelect($("#culinaryLineIngredientV51"), repo().culinaryIngredients(), { value: "id", label: "name", blank: "Selecciona ingrediente" });
  fillSelect($("#culinaryLineUnitV51"), cats.units, { value: "id", label: r => `${r.symbol} · ${r.name}`, blank: "Unidad" });
}

function renderRecipeSelect() {
  const rows = repo().culinaryRecipes();
  fillSelect($("#culinaryRecipeSelectV51"), rows, { value: "id", label: r => `${r.name}${r.active ? "" : " · inactiva"}`, blank: "Selecciona ficha" });
  if (selectedRecipeId) $("#culinaryRecipeSelectV51").value = selectedRecipeId;
  $("#culinaryCountV51").textContent = `${rows.filter(r => r.active).length} fichas culinarias activas`;
}

function loadRecipe(id, refreshSelect = true) {
  const r = repo().culinaryRecipeById(id);
  if (!r) return;
  selectedRecipeId = id;
  selectedLineId = null;
  setVal("culinaryRecipeSelectV51", id);
  setVal("culinaryRecipeIdV51", r.id);
  setVal("culinaryNameV51", r.name || "");
  setVal("culinaryFamilyV51", r.family_id || "");
  setVal("culinarySubfamilyV51", r.subfamily_id || "");
  setVal("culinaryServingsV51", r.base_servings ?? 10);
  setVal("culinaryServingWeightV51", r.serving_weight_g ?? "");
  setVal("culinaryStatusV51", r.status || "draft");
  setVal("culinaryLaborMinutesV51", r.labor_minutes ?? 0);
  setVal("culinaryLaborCostV51", r.labor_cost_per_hour ?? 0);
  setVal("culinaryOverheadPctV51", r.overhead_pct ?? 0);
  setVal("culinaryMarginPctV51", r.target_margin_pct ?? 0);
  setVal("culinaryProcessV51", r.process || "");
  setVal("culinaryServiceNotesV51", r.service_notes || "");
  setVal("culinaryAppccNotesV51", r.appcc_notes || "");
  setVal("culinaryNotesV51", r.notes || "");
  $("#culinaryActiveV51").checked = !!r.active;
  renderSummary();
  renderLines();
  clearLineForm(false);
  if (refreshSelect) renderRecipeSelect();
}

function newRecipe(showToast = true) {
  selectedRecipeId = null;
  selectedLineId = null;
  setVal("culinaryRecipeSelectV51", "");
  setVal("culinaryRecipeIdV51", "");
  setVal("culinaryNameV51", "");
  setVal("culinaryFamilyV51", "");
  setVal("culinarySubfamilyV51", "");
  setVal("culinaryServingsV51", 10);
  setVal("culinaryServingWeightV51", "");
  setVal("culinaryStatusV51", "draft");
  setVal("culinaryLaborMinutesV51", 0);
  setVal("culinaryLaborCostV51", 0);
  setVal("culinaryOverheadPctV51", 0);
  setVal("culinaryMarginPctV51", 0);
  setVal("culinaryProcessV51", "");
  setVal("culinaryServiceNotesV51", "");
  setVal("culinaryAppccNotesV51", "");
  setVal("culinaryNotesV51", "");
  $("#culinaryActiveV51").checked = true;
  $("#culinarySummaryV51").innerHTML = `<p class="small">Guarda la ficha para añadir ingredientes.</p>`;
  $("#culinaryLinesTableV51").innerHTML = `<p class="small">Sin ficha seleccionada.</p>`;
  clearLineForm(false);
  if (showToast) toast("Nueva ficha culinaria preparada.");
}

async function saveRecipe() {
  try {
    const name = $("#culinaryNameV51").value.trim();
    if (!name) throw new Error("El nombre de la ficha es obligatorio.");
    const id = $("#culinaryRecipeIdV51").value || slugCulinaryRecipeIdFromName(name);
    const data = {
      $id: id,
      $name: name,
      $family_id: nullIfEmpty($("#culinaryFamilyV51").value),
      $subfamily_id: nullIfEmpty($("#culinarySubfamilyV51").value),
      $base_servings: positiveNum($("#culinaryServingsV51").value, "Las raciones base deben ser mayores que 0."),
      $serving_weight_g: nullableNum($("#culinaryServingWeightV51").value),
      $status: $("#culinaryStatusV51").value,
      $labor_minutes: nonNegativeNum($("#culinaryLaborMinutesV51").value),
      $labor_cost_per_hour: nonNegativeNum($("#culinaryLaborCostV51").value),
      $overhead_pct: nonNegativeNum($("#culinaryOverheadPctV51").value),
      $target_margin_pct: nonNegativeNum($("#culinaryMarginPctV51").value),
      $process: nullIfEmpty($("#culinaryProcessV51").value),
      $service_notes: nullIfEmpty($("#culinaryServiceNotesV51").value),
      $appcc_notes: nullIfEmpty($("#culinaryAppccNotesV51").value),
      $notes: nullIfEmpty($("#culinaryNotesV51").value),
      $active: $("#culinaryActiveV51").checked ? 1 : 0
    };
    core().swiftDb.exec("BEGIN TRANSACTION;");
    try { repo().saveCulinaryRecipe(data); core().swiftDb.exec("COMMIT;"); }
    catch (err) { core().swiftDb.exec("ROLLBACK;"); throw err; }
    selectedRecipeId = id;
    await core().autosave({ backup: false, reason: "ficha culinaria" });
    renderRecipeSelect(); loadRecipe(id, false); core().renderAll();
    toast("Ficha culinaria guardada.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

function renderSummary() {
  const row = repo().culinaryRecipes().find(r => r.id === selectedRecipeId);
  if (!row) return;
  const cells = [
    ["Raciones base", fmtNumber(row.base_servings, 0)],
    ["Coste ingredientes", fmtMoney(row.ingredient_cost_total)],
    ["Coste total", fmtMoney(row.total_cost)],
    ["Coste/ración", fmtMoney(row.cost_per_serving)],
    ["Venta sugerida", fmtMoney(row.suggested_sale_price_total)],
    ["Estado", statusLabel(row.status)]
  ];
  $("#culinarySummaryV51").innerHTML = cells.map(([k,v]) => `<div class="kpi"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("");
}

function renderLines() {
  if (!selectedRecipeId) return;
  const rows = repo().culinaryRecipeLines(selectedRecipeId);
  $("#culinaryLinesTableV51").innerHTML = table([
    { label: "Ingrediente", render: r => `<button type="button" class="link-btn" data-cul-line="${esc(r.id)}">${esc(r.ingredient || r.ingredient_id)}</button>` },
    { label: "Cantidad", render: r => `${fmtNumber(r.quantity, 2)} ${esc(r.unit || "g")}` },
    { label: "Merma %", render: r => fmtNumber(r.waste_pct, 1) },
    { label: "Coste", render: r => fmtMoney(r.estimated_cost) },
    { label: "Orden", key: "sort_order" },
    { label: "Nota", key: "technical_note" }
  ], rows);
  document.querySelectorAll("[data-cul-line]").forEach(btn => btn.addEventListener("click", () => loadLine(btn.dataset.culLine)));
}

function loadLine(id) {
  const line = repo().culinaryLineById(id);
  if (!line) return;
  if (line.line_type === "subrecipe") {
    toast("Esta línea es una subelaboración heredada. Edita sus ingredientes desde su propia ficha técnica.", "warn");
    return;
  }
  selectedLineId = id;
  setVal("culinaryLineIdV51", line.id);
  setVal("culinaryLineIngredientV51", line.ingredient_id || "");
  setVal("culinaryLineQuantityV51", line.quantity ?? 0);
  setVal("culinaryLineUnitV51", line.unit_id || "UNIT_G");
  setVal("culinaryLineWasteV51", line.waste_pct ?? 0);
  setVal("culinaryLineSortV51", line.sort_order ?? 100);
  setVal("culinaryLineNoteV51", line.technical_note || "");
}

function clearLineForm(showToast = true) {
  selectedLineId = null;
  setVal("culinaryLineIdV51", "");
  setVal("culinaryLineIngredientV51", "");
  setVal("culinaryLineQuantityV51", "");
  setVal("culinaryLineUnitV51", "UNIT_G");
  setVal("culinaryLineWasteV51", 0);
  setVal("culinaryLineSortV51", 100);
  setVal("culinaryLineNoteV51", "");
  if (showToast) toast("Línea culinaria preparada.");
}

async function saveLine(event) {
  event.preventDefault();
  try {
    if (!selectedRecipeId) throw new Error("Guarda o selecciona una ficha antes de añadir ingredientes.");
    const ingredientId = $("#culinaryLineIngredientV51").value;
    if (!ingredientId) throw new Error("Selecciona un ingrediente.");
    const data = {
      $id: $("#culinaryLineIdV51").value || slugCulinaryLineId(selectedRecipeId),
      $recipe_id: selectedRecipeId,
      $ingredient_id: ingredientId,
      $quantity: positiveNum($("#culinaryLineQuantityV51").value, "La cantidad debe ser mayor que 0."),
      $unit_id: $("#culinaryLineUnitV51").value || "UNIT_G",
      $waste_pct: nonNegativeNum($("#culinaryLineWasteV51").value),
      $technical_note: nullIfEmpty($("#culinaryLineNoteV51").value),
      $sort_order: Math.trunc(num($("#culinaryLineSortV51").value, 100))
    };
    core().swiftDb.exec("BEGIN TRANSACTION;");
    try { repo().saveCulinaryLine(data); core().swiftDb.exec("COMMIT;"); }
    catch (err) { core().swiftDb.exec("ROLLBACK;"); throw err; }
    selectedLineId = data.$id;
    await core().autosave({ backup: false, reason: "línea culinaria" });
    renderLines(); renderSummary(); core().renderAll();
    toast("Ingrediente de ficha guardado.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function deleteLine() {
  try {
    if (!selectedLineId) return toast("Selecciona una línea.", "warn");
    if (!confirm("¿Eliminar esta línea de la ficha culinaria?")) return;
    repo().deleteCulinaryLine(selectedLineId);
    selectedLineId = null;
    await core().autosave({ backup: false, reason: "eliminar línea culinaria" });
    clearLineForm(false); renderLines(); renderSummary(); core().renderAll();
    toast("Línea eliminada.", "warn");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function printRecipe() {
  try {
    if (!selectedRecipeId) return toast("Selecciona una ficha culinaria.", "warn");
    printCulinaryRecipe(core().swiftDb, selectedRecipeId);
    await core().autosave({ backup: false, reason: "historial impresión ficha culinaria" });
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo abrir la impresión.", "err");
  }
}

async function addCurrentToSelection() {
  try {
    if (!selectedRecipeId) return toast("Selecciona una ficha culinaria.", "warn");
    const r = repo().culinaryRecipeById(selectedRecipeId);
    if (!r) throw new Error("No se encontró la ficha seleccionada.");
    const defaultMode = r.default_production_mode || (r.production_kind === "technical_yield" ? "yield" : "servings");
    await core().addWorkSelectionItem({
      item_type: "culinary",
      culinary_recipe_id: selectedRecipeId,
      production_mode: defaultMode === "yield" ? "yield" : "servings",
      servings: defaultMode === "yield" ? null : Number(r.base_servings || 10),
      main_qty: defaultMode === "yield" ? Number(r.yield_quantity || 1) : null,
      notes: "Añadido desde Fichas técnicas"
    });
  } catch (err) { console.error(err); toast(err.message || "No se pudo añadir a la práctica actual.", "err"); }
}

function setVal(id, value) { const el = $("#" + id); if (el) el.value = value ?? ""; }
function nullIfEmpty(value) { const v = String(value ?? "").trim(); return v ? v : null; }
function num(value, fallback = 0) { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : fallback; }
function nullableNum(value) { const v = String(value ?? "").trim(); if (!v) return null; const n = num(v, NaN); return Number.isFinite(n) ? n : null; }
function nonNegativeNum(value) { const n = num(value, 0); return n >= 0 ? n : 0; }
function positiveNum(value, message) { const n = num(value, NaN); if (!Number.isFinite(n) || n <= 0) throw new Error(message); return n; }

function statusLabel(value) {
  return ({ draft: "Borrador", reviewed: "Revisada", validated: "Validada", archived: "Archivada" })[value] || value || "";
}
