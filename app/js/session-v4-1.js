import { $, esc, fmtMoney, fmtNumber, table, fillSelect, toast } from "./ui.js";
import { printClassSession, printClassOrder } from "./print-service-v6-1.js";
import { slugSessionIdFromTitle, slugSessionItemId } from "./repositories.js";

let selectedSessionId = null;
let selectedItemId = null;
let readyBound = false;

const DEFAULT_RESPONSIBLE = "Remo J. Pereira González";

window.addEventListener("DOMContentLoaded", initSessionUi);
window.addEventListener("swiftremo:coreReady", () => renderSessionUi());

function core() { return window.SwiftRemoCore; }
function repo() { return core()?.repo; }

function initSessionUi() {
  if (!$("#classSessionFormV41")) return;
  bindOnce("#classNewSessionV41", "click", () => newSession(true));
  bindOnce("#classSaveSessionV41", "click", saveSession);
  bindOnce("#classAddItemV41", "click", saveItem);
  bindOnce("#classClearItemV41", "click", clearItemForm);
  bindOnce("#classDeleteItemV41", "click", deleteItem);
  bindOnce("#classDuplicateItemV65", "click", duplicateItem);
  bindOnce("#classPrintSessionV41", "click", printSession);
  bindOnce("#classPrintOrderV61", "click", printSelectedOrder);
  bindOnce("#classRecipeTypeV41", "change", () => { populateRecipeSelect(); applyRecipeDefaults(); updateItemModeVisibility(); });
  bindOnce("#classRecipeSelectV41", "change", applyRecipeDefaults);
  bindOnce("#classProductionModeV41", "change", updateItemModeVisibility);
  bindOnce("#classCycleV41", "change", () => { populateModuleSelect(); suggestGroupFromModule(); });
  bindOnce("#classModuleV41", "change", suggestGroupFromModule);
  bindOnce("#classGroupPresetV65", "change", applyGroupPreset);
  bindOnce("#classUseSessionDataV66", "change", syncSessionDetailsToggle);
  bindOnce("#classUseOrganizationV66", "change", () => { syncOrganizationToggle(); applyRecipeDefaults(); });
  bindOnce("#classSessionSelectV65", "change", ev => { if (ev.target.value) loadSession(ev.target.value); });

  ["classTeamCountV627", "classPeoplePerTeamV627", "classStudentCountV65", "classPiecesPerStudentV65", "classServingsPerStudentV65", "classSafetyMarginV65"].forEach(id => {
    bindOnce("#" + id, "input", () => { syncQuantityPlanning(); applyRecipeDefaults(); });
    bindOnce("#" + id, "change", () => { syncQuantityPlanning(); applyRecipeDefaults(); });
  });

  readyBound = true;
  renderSessionUi();
}

function bindOnce(selector, eventName, handler) {
  const el = $(selector);
  if (!el) return;
  const key = `sessionBound_${eventName}`;
  if (el.dataset[key] === "1") return;
  el.dataset[key] = "1";
  el.addEventListener(eventName, handler);
}

function renderSessionUi() {
  if (!readyBound || !repo()) return;
  populateStaticSelects();
  renderSessions();
  if (!selectedSessionId) {
    const first = repo().classSessions()[0];
    if (first) selectedSessionId = first.id;
  }
  if (selectedSessionId) loadSession(selectedSessionId, false);
  else newSession(false);
}

function populateStaticSelects() {
  fillSelect($("#classCycleV41"), repo().cycles(), { value: "id", label: r => r.name, blank: "Sin ciclo / seleccionar" });
  populateModuleSelect();
  populateRecipeSelect();
  syncSessionDetailsToggle();
  syncOrganizationToggle();
}

function populateModuleSelect() {
  const cycleId = $("#classCycleV41")?.value || null;
  const current = $("#classModuleV41")?.value || "";
  const rows = repo().modules(cycleId);
  fillSelect($("#classModuleV41"), rows, { value: "id", label: r => `${r.module_code || ""} · ${r.module_name}`, blank: "Sin módulo / seleccionar" });
  if (current && rows.some(r => r.id === current)) $("#classModuleV41").value = current;
}

function populateRecipeSelect() {
  const typeFilter = $("#classRecipeTypeV41")?.value || "all";
  const search = "";
  const rows = allRecipeOptions(typeFilter);
  const current = $("#classRecipeSelectV41")?.value || "";

  let ordered = rows;
  let matches = [];
  if (search) {
    matches = rows.filter(r => norm(`${r.name} ${r.typeLabel}`).includes(search));
    const matchKeys = new Set(matches.map(r => `${r.type}:${r.id}`));
    ordered = [...matches, ...rows.filter(r => !matchKeys.has(`${r.type}:${r.id}`))];
  }

  const select = $("#classRecipeSelectV41");
  if (select) {
    select.innerHTML = `<option value="">Selecciona elaboración</option>` + ordered.map(r => {
      const key = `${r.type}:${r.id}`;
      const mark = search && matches.some(m => `${m.type}:${m.id}` === key) ? "★ " : "";
      return `<option value="${esc(key)}">${esc(mark + r.name)} · ${esc(r.typeLabel)}</option>`;
    }).join("");

    if (current && ordered.some(r => `${r.type}:${r.id}` === current)) {
      select.value = current;
    } else if (search && matches.length) {
      select.value = `${matches[0].type}:${matches[0].id}`;
    }
  }

  const msg = $("#classRecipeEmptyV65");
  if (msg) {
    if (!rows.length) msg.textContent = "No hay elaboraciones disponibles con el tipo seleccionado.";
    else msg.textContent = `${rows.length} elaboración(es) disponible(s). Busca en la barra del desplegable o pulsa ▾ para ver todas.`;
  }
}

function allRecipeOptions(typeFilter = "all") {
  const out = [];
  if (typeFilter === "all" || typeFilter === "bakery") {
    out.push(...repo().bakeryRecipeOptions().map(r => ({ ...r, type: "bakery", typeLabel: "Panadería" })));
  }
  if (typeFilter === "all" || typeFilter === "culinary") {
    out.push(...repo().culinaryRecipeOptions().map(r => ({
      ...r,
      type: "culinary",
      typeLabel: culinaryProductionLabel(r)
    })));
  }
  return out.sort((a,b) => a.name.localeCompare(b.name, "es"));
}

function selectedRecipeRef() {
  const raw = $("#classRecipeSelectV41")?.value || "";
  if (!raw) return { type: null, recipeId: null };
  if (raw.includes(":")) {
    const [type, ...rest] = raw.split(":");
    return { type, recipeId: rest.join(":") };
  }
  const type = $("#classRecipeTypeV41")?.value === "culinary" ? "culinary" : "bakery";
  return { type, recipeId: raw };
}

function selectedCulinaryRecipe() {
  const { type, recipeId } = selectedRecipeRef();
  if (type !== "culinary" || !recipeId || !repo()) return null;
  return repo().culinaryRecipeOptions().find(r => r.id === recipeId) || null;
}

function culinaryProductionKind(recipe) {
  return recipe?.production_kind || (recipe?.is_technical_subrecipe ? "technical_yield" : "final_servings");
}

function culinaryIsTechnical(recipe) {
  return culinaryProductionKind(recipe) === "technical_yield";
}

function culinaryIsDual(recipe) {
  return culinaryProductionKind(recipe) === "dual";
}

function culinaryDefaultMode(recipe) {
  const mode = recipe?.default_production_mode;
  if (mode === "yield" || mode === "servings") return mode;
  return culinaryIsTechnical(recipe) ? "yield" : "servings";
}

function culinaryProductionLabel(recipe) {
  const kind = culinaryProductionKind(recipe);
  if (kind === "technical_yield") return "Subelaboración técnica";
  if (kind === "dual") return "Elaboración dual";
  return "Cocina/Pastelería";
}

function allowedProductionModes(type, culinaryRecipe = null) {
  if (type === "bakery") return ["flour", "raw_dough", "pieces"];
  if (type === "culinary" && culinaryIsTechnical(culinaryRecipe)) return ["yield"];
  if (type === "culinary" && culinaryIsDual(culinaryRecipe)) return ["servings", "yield"];
  if (type === "culinary") return ["servings"];
  return [];
}

function productionModeLabel(mode) {
  return ({ flour: "Harina", raw_dough: "Masa cruda", pieces: "Piezas", servings: "Raciones", yield: "Rendimiento técnico" })[mode] || mode || "";
}

function setRecipeSelectValue(type, recipeId) {
  const typeSel = $("#classRecipeTypeV41");
  if (typeSel) typeSel.value = type;
  populateRecipeSelect();
  const select = $("#classRecipeSelectV41");
  if (!select) return;
  select.value = `${type}:${recipeId}`;
  if (!select.value) select.value = recipeId;
}
function applyRecipeDefaults() {
  if (selectedItemId) return;
  const { type, recipeId } = selectedRecipeRef();
  if (!recipeId || !repo()) { updateQuantityHint("Selecciona una elaboración para calcular una propuesta."); return; }

  const useOrg = $("#classUseOrganizationV66")?.checked;
  const students = useOrg ? Math.max(0, num($("#classStudentCountV65")?.value, 0)) : 0;
  const margin = useOrg ? (1 + Math.max(0, num($("#classSafetyMarginV65")?.value, 0)) / 100) : 1;

  if (type === "bakery") {
    const recipe = repo().bakeryRecipeOptions().find(r => r.id === recipeId);
    if (!recipe) return;
    const piecesPerStudent = Math.max(0, num($("#classPiecesPerStudentV65")?.value, 1));
    const suggestedPieces = students > 0 ? Math.ceil(students * piecesPerStudent * margin) : null;
    if (recipe.base_pieces && recipe.base_raw_piece_weight_g) {
      setVal("classProductionModeV41", "pieces");
      setVal("classPiecesV41", suggestedPieces || recipe.base_pieces);
      setVal("classPieceWeightV41", recipe.base_raw_piece_weight_g);
      setVal("classFlourGV41", recipe.base_flour_g || 1000);
      updateQuantityHint(useOrg && suggestedPieces ? `Propuesta calculada: ${fmtNumber(suggestedPieces,0)} piezas · ${fmtNumber(recipe.base_raw_piece_weight_g,0)} g/pieza.` : `Propuesta de ficha: ${fmtNumber(recipe.base_pieces,0)} piezas · ${fmtNumber(recipe.base_raw_piece_weight_g,0)} g/pieza.`);
    } else {
      setVal("classProductionModeV41", "flour");
      setVal("classFlourGV41", recipe.base_flour_g || 1000);
      updateQuantityHint(`Propuesta: producción por harina total. Base ${fmtNumber(recipe.base_flour_g || 1000,0)} g.`);
    }
  } else if (type === "culinary") {
    const recipe = repo().culinaryRecipeOptions().find(r => r.id === recipeId);
    const defaultMode = culinaryDefaultMode(recipe);
    const servingsPerStudent = Math.max(0, num($("#classServingsPerStudentV65")?.value, 1));
    const suggestedServings = students > 0 ? Math.ceil(students * servingsPerStudent * margin) : null;
    if (defaultMode === "yield") {
      setVal("classProductionModeV41", "yield");
      setVal("classYieldQtyV621", recipe?.yield_quantity || 1);
      const prefix = culinaryIsDual(recipe) ? "Elaboración dual" : "Subelaboración técnica";
      updateQuantityHint(`${prefix}: producción por rendimiento (${fmtNumber(recipe?.yield_quantity || 1,3)} ${recipe?.yield_unit || ""}). Puedes cambiar a raciones si está clasificada como dual.`);
    } else {
      setVal("classProductionModeV41", "servings");
      setVal("classServingsV41", suggestedServings || recipe?.base_servings || 10);
      updateQuantityHint(useOrg && suggestedServings ? `Propuesta calculada: ${fmtNumber(suggestedServings,0)} raciones.` : `Ficha final: producción por raciones. Base ${fmtNumber(recipe?.base_servings || 10,0)} raciones.`);
    }
  }
  updateItemModeVisibility();
}
function renderSessions() {
  const rows = repo().classSessions();
  const select = $("#classSessionSelectV65");
  if (select) {
    select.innerHTML = `<option value="">Nueva sesión / sin seleccionar</option>` + rows.map(r => {
      const label = [r.practice_date, r.title || r.id, r.group_name].filter(Boolean).join(" · ");
      return `<option value="${esc(r.id)}">${esc(label)}</option>`;
    }).join("");
    if (selectedSessionId && rows.some(r => r.id === selectedSessionId)) select.value = selectedSessionId;
  }
  const tableBox = $("#classSessionsTableV41");
  if (tableBox) {
    tableBox.innerHTML = table([
      { label: "Sesión", render: r => `<button type="button" class="link-btn" data-session41="${esc(r.id)}">${esc(r.title || r.id)}</button>` },
      { label: "Fecha", key: "practice_date" },
      { label: "Grupo", key: "group_name" },
      { label: "Elab.", key: "total_items" },
      { label: "Pedido", render: r => fmtMoney(r.estimated_order_cost) }
    ], rows);
    document.querySelectorAll("[data-session41]").forEach(btn => btn.addEventListener("click", () => loadSession(btn.dataset.session41)));
  }
}

function loadSession(id, renderList = true) {
  const s = repo().classSessionById(id);
  if (!s) return;
  selectedSessionId = id;
  selectedItemId = null;
  setVal("classSessionIdV41", s.id);
  setVal("classTitleV41", s.title || "");
  setVal("classDateV41", s.practice_date || today());
  setVal("classCycleV41", s.cycle_id || "");
  populateModuleSelect();
  setVal("classModuleV41", s.module_id || "");
  setVal("classGroupV41", s.group_name || "");
  setGroupPresetFromValue(s.group_name || "");
  setVal("classTeamCountV627", s.team_count ?? "");
  setVal("classPeoplePerTeamV627", s.people_per_team ?? "");
  setVal("classStudentCountV65", s.total_students ?? "");
  setVal("classPiecesPerStudentV65", s.pieces_per_student ?? "1");
  setVal("classServingsPerStudentV65", s.servings_per_person ?? "1");
  setVal("classSafetyMarginV65", s.safety_margin_pct ?? "0");
  setVal("classResponsibleV41", s.responsible || DEFAULT_RESPONSIBLE);
  setVal("classNotesV41", s.notes || "");
  const useSession = $("#classUseSessionDataV66");
  if (useSession) {
    const generatedTitle = /^Práctica \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(s.title || ""));
    useSession.checked = Boolean((s.title && !generatedTitle) || s.cycle_id || s.module_id || s.group_name || s.responsible || s.notes);
  }
  syncSessionDetailsToggle();
  clearItemForm(false);
  renderItems();
  renderClassOrder();
  renderActiveSummary();
  if (renderList) renderSessions();
}

function newSession(showToast = true) {
  selectedSessionId = null;
  selectedItemId = null;
  setVal("classSessionIdV41", "");
  setVal("classTitleV41", "");
  setVal("classDateV41", today());
  setVal("classCycleV41", "");
  populateModuleSelect();
  setVal("classModuleV41", "");
  setVal("classGroupPresetV65", "1º A");
  setVal("classGroupV41", "1º A");
  setVal("classTeamCountV627", "4");
  setVal("classPeoplePerTeamV627", "5");
  setVal("classStudentCountV65", "20");
  setVal("classPiecesPerStudentV65", "1");
  setVal("classServingsPerStudentV65", "1");
  setVal("classSafetyMarginV65", "0");
  applyGroupPreset();
  setVal("classResponsibleV41", DEFAULT_RESPONSIBLE);
  setVal("classNotesV41", "");
  const useSession = $("#classUseSessionDataV66"); if (useSession) useSession.checked = false;
  const useOrg = $("#classUseOrganizationV66"); if (useOrg) useOrg.checked = false;
  syncSessionDetailsToggle(); syncOrganizationToggle();
  clearItemForm(false);
  syncQuantityPlanning();
  const items = $("#classItemsTableV41");
  const order = $("#classOrderPreviewV41");
  if (items) items.innerHTML = `<p class="small">Guarda la sesión antes de añadir elaboraciones.</p>`;
  if (order) order.innerHTML = `<p class="small">Sin sesión seleccionada.</p>`;
  renderActiveSummary();
  renderSessions();
  if (showToast) toast("Nueva sesión preparada.");
}

async function saveSession() {
  try {
    const explicitTitle = $("#classTitleV41").value.trim();
    const date = nullIfEmpty($("#classDateV41").value) || today();
    const generated = `Práctica ${date} ${new Date().toTimeString().slice(0,8)}`;
    const title = explicitTitle || generated;
    const id = $("#classSessionIdV41").value || slugSessionIdFromTitle(title);
    const useSessionData = $("#classUseSessionDataV66")?.checked;
    const data = {
      $id: id,
      $title: title,
      $practice_date: date,
      $cycle_id: useSessionData ? nullIfEmpty($("#classCycleV41").value) : null,
      $module_id: useSessionData ? nullIfEmpty($("#classModuleV41").value) : null,
      $group_name: useSessionData ? nullIfEmpty($("#classGroupV41").value) : null,
      $responsible: useSessionData ? (nullIfEmpty($("#classResponsibleV41").value) || DEFAULT_RESPONSIBLE) : null,
      $notes: useSessionData ? nullIfEmpty($("#classNotesV41").value) : null,
      $team_count: nullableNum($("#classTeamCountV627")?.value),
      $people_per_team: nullableNum($("#classPeoplePerTeamV627")?.value),
      $total_students: nullableNum($("#classStudentCountV65")?.value),
      $servings_per_person: nullableNum($("#classServingsPerStudentV65")?.value),
      $pieces_per_student: nullableNum($("#classPiecesPerStudentV65")?.value),
      $safety_margin_pct: nullableNum($("#classSafetyMarginV65")?.value)
    };
    core().swiftDb.exec("BEGIN TRANSACTION;");
    try { repo().saveClassSession(data); core().swiftDb.exec("COMMIT;"); }
    catch (err) { core().swiftDb.exec("ROLLBACK;"); throw err; }
    selectedSessionId = id;
    await core().autosave({ backup: false, reason: "sesión de clase" });
    renderSessions(); loadSession(id, false); core().renderAll();
    toast("Sesión guardada.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

function renderItems() {
  if (!selectedSessionId) return;
  const rows = repo().classItems(selectedSessionId);
  $("#classItemsTableV41").innerHTML = table([
    { label: "Elaboración", render: r => `<button type="button" class="link-btn" data-item41="${esc(r.id)}">${esc(r.item_name || r.id)}</button>` },
    { label: "Tipo", render: r => r.item_type === "bakery" ? "Panadería" : "Cocina" },
    { label: "Modo", render: r => productionModeLabel(r.production_mode) },
    { label: "Harina g", render: r => fmtNumber(r.flour_g, 0) },
    { label: "Masa g", render: r => fmtNumber(r.raw_dough_g, 0) },
    { label: "Piezas", render: r => fmtNumber(r.pieces, 0) },
    { label: "Raciones", render: r => fmtNumber(r.servings, 0) },
    { label: "Cant. técnica", render: r => fmtNumber(r.main_qty, 3) },
    { label: "Acciones", render: r => `<button type="button" class="btn tiny" data-item41="${esc(r.id)}">Editar</button> <button type="button" class="btn tiny danger" data-delete-item41="${esc(r.id)}">Eliminar</button>` }
  ], rows);
  document.querySelectorAll("[data-item41]").forEach(btn => btn.addEventListener("click", () => loadItem(btn.dataset.item41)));
  document.querySelectorAll("[data-delete-item41]").forEach(btn => btn.addEventListener("click", async () => { selectedItemId = btn.dataset.deleteItem41; await deleteItem(); }));
}

function loadItem(id) {
  const it = repo().classItemById(id);
  if (!it) return;
  selectedItemId = id;
  setVal("classItemIdV41", it.id);
  setRecipeSelectValue(it.item_type, it.item_type === "bakery" ? it.bakery_recipe_id : it.culinary_recipe_id);
  setVal("classProductionModeV41", it.production_mode || (it.item_type === "bakery" ? "flour" : "servings"));
  setVal("classFlourGV41", it.flour_g ?? "");
  setVal("classRawDoughGV41", it.raw_dough_g ?? "");
  setVal("classPiecesV41", it.pieces ?? "");
  setVal("classPieceWeightV41", it.piece_weight_g ?? "");
  setVal("classServingsV41", it.servings ?? "");
  setVal("classYieldQtyV621", it.main_qty ?? "");
  setVal("classItemSortV41", it.sort_order ?? 100);
  const a4 = $("#classPrintA4V41"); if (a4) a4.value = it.print_a4 ? "1" : "0";
  setVal("classItemNotesV41", it.notes || "");
  updateItemModeVisibility();
  updateQuantityHint("Elaboración cargada para editar.");
}

function clearItemForm(showToast = true) {
  selectedItemId = null;
  setVal("classItemIdV41", "");
  setVal("classRecipeTypeV41", "all");
  populateRecipeSelect();
  setVal("classProductionModeV41", "flour");
  setVal("classFlourGV41", "1000");
  setVal("classRawDoughGV41", "");
  setVal("classPiecesV41", "");
  setVal("classPieceWeightV41", "");
  setVal("classServingsV41", "");
  setVal("classYieldQtyV621", "");
  setVal("classItemSortV41", "100");
  const a4 = $("#classPrintA4V41"); if (a4) a4.value = "1";
  setVal("classItemNotesV41", "");
  updateItemModeVisibility();
  updateQuantityHint("Formulario listo para añadir una elaboración.");
  if (showToast) toast("Formulario de elaboración limpio.");
}

async function saveItem() {
  try {
    if (!selectedSessionId) throw new Error("Guarda o selecciona una sesión antes de añadir elaboraciones.");
    const { type, recipeId } = selectedRecipeRef();
    if (!type || !recipeId) throw new Error("Selecciona una elaboración.");
    const productionMode = $("#classProductionModeV41").value;
    const data = {
      $id: $("#classItemIdV41").value || slugSessionItemId(selectedSessionId),
      $session_id: selectedSessionId,
      $item_type: type,
      $culinary_recipe_id: type === "culinary" ? recipeId : null,
      $bakery_recipe_id: type === "bakery" ? recipeId : null,
      $production_mode: productionMode,
      $main_qty: productionMode === "yield" ? nullableNum($("#classYieldQtyV621").value) : null,
      $servings: productionMode === "servings" ? nullableNum($("#classServingsV41").value) : null,
      $pieces: productionMode === "pieces" ? nullableNum($("#classPiecesV41").value) : null,
      $piece_weight_g: productionMode === "pieces" ? nullableNum($("#classPieceWeightV41").value) : null,
      $flour_g: productionMode === "flour" ? nullableNum($("#classFlourGV41").value) : null,
      $raw_dough_g: productionMode === "raw_dough" ? nullableNum($("#classRawDoughGV41").value) : null,
      $baking_loss_pct: null,
      $print_a4: $("#classPrintA4V41")?.value === "0" ? 0 : 1,
      $sort_order: Math.trunc(num($("#classItemSortV41").value, 100)),
      $notes: nullIfEmpty($("#classItemNotesV41").value)
    };
    const culinaryRecipe = type === "culinary" ? repo().culinaryRecipeOptions().find(r => r.id === recipeId) : null;
    const allowed = allowedProductionModes(type, culinaryRecipe);
    if (!allowed.includes(productionMode)) {
      throw new Error(type === "bakery"
        ? "Una formulación panadera no puede producirse por raciones. Usa harina, masa o piezas."
        : culinaryIsTechnical(culinaryRecipe)
          ? "Una subelaboración técnica debe producirse por rendimiento, no por raciones."
          : "Una ficha final de cocina/pastelería debe producirse por raciones.");
    }
    if (type === "bakery" && productionMode === "flour" && (!data.$flour_g || data.$flour_g <= 0)) throw new Error("Indica harina total mayor que 0 g.");
    if (type === "bakery" && productionMode === "raw_dough" && (!data.$raw_dough_g || data.$raw_dough_g <= 0)) throw new Error("Indica masa total mayor que 0 g.");
    if (type === "bakery" && productionMode === "pieces" && (!data.$pieces || !data.$piece_weight_g)) throw new Error("Indica piezas y peso por pieza.");
    if (type === "culinary" && productionMode === "servings" && (!data.$servings || data.$servings <= 0)) throw new Error("Indica raciones mayores que 0.");
    if (type === "culinary" && productionMode === "yield" && (!data.$main_qty || data.$main_qty <= 0)) throw new Error("Indica cantidad técnica mayor que 0.");
    core().swiftDb.exec("BEGIN TRANSACTION;");
    try { repo().saveClassItem(data); core().swiftDb.exec("COMMIT;"); }
    catch (err) { core().swiftDb.exec("ROLLBACK;"); throw err; }
    selectedItemId = data.$id;
    await core().autosave({ backup: false, reason: "elaboración de sesión" });
    renderItems(); renderClassOrder(); renderSessions(); renderActiveSummary(); core().renderAll();
    toast("Elaboración guardada en la sesión.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function duplicateItem() {
  try {
    if (!selectedSessionId) throw new Error("Selecciona una sesión.");
    if (!selectedItemId) throw new Error("Selecciona una elaboración para duplicar.");
    const it = repo().classItemById(selectedItemId);
    if (!it) throw new Error("No se encontró la elaboración seleccionada.");
    const data = {
      $id: slugSessionItemId(selectedSessionId),
      $session_id: selectedSessionId,
      $item_type: it.item_type,
      $culinary_recipe_id: it.culinary_recipe_id,
      $bakery_recipe_id: it.bakery_recipe_id,
      $production_mode: it.production_mode,
      $main_qty: it.main_qty,
      $servings: it.servings,
      $pieces: it.pieces,
      $piece_weight_g: it.piece_weight_g,
      $flour_g: it.flour_g,
      $raw_dough_g: it.raw_dough_g,
      $baking_loss_pct: it.baking_loss_pct,
      $print_a4: it.print_a4,
      $sort_order: Number(it.sort_order || 100) + 1,
      $notes: it.notes
    };
    repo().saveClassItem(data);
    selectedItemId = data.$id;
    await core().autosave({ backup: false, reason: "duplicar elaboración" });
    renderItems(); renderClassOrder(); renderSessions(); core().renderAll(); loadItem(data.$id);
    toast("Elaboración duplicada.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function deleteItem() {
  try {
    if (!selectedItemId) return toast("Selecciona una elaboración de la sesión.", "warn");
    if (!confirm("¿Eliminar esta elaboración de la sesión?")) return;
    repo().deleteClassItem(selectedItemId);
    selectedItemId = null;
    await core().autosave({ backup: false, reason: "eliminar elaboración de sesión" });
    clearItemForm(false); renderItems(); renderClassOrder(); renderSessions(); renderActiveSummary(); core().renderAll();
    toast("Elaboración eliminada de la sesión.", "warn");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

function renderClassOrder() {
  if (!selectedSessionId) return;
  const rows = repo().classOrder(selectedSessionId);
  $("#classOrderPreviewV41").innerHTML = table([
    { label: "Grupo", key: "order_group" },
    { label: "Ingrediente", key: "ingredient" },
    { label: "Cantidad", render: r => `${fmtNumber(r.purchase_quantity, 3)} ${esc(r.purchase_unit || "g")}` },
    { label: "Coste", render: r => fmtMoney(r.estimated_cost_total) },
    { label: "Usado en", key: "used_in" },
    { label: "Zona", key: "storage_zone" }
  ], rows);
}

async function printSession() {
  try {
    if (!selectedSessionId) return toast("Selecciona una sesión.", "warn");
    printClassSession(core().swiftDb, selectedSessionId, { includeOrder: true, includeItemSheets: false, includeSessionData: $("#classUseSessionDataV66")?.checked !== false });
    await core().autosave({ backup: false, reason: "historial impresión sesión" });
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo abrir la impresión.", "err");
  }
}

async function printSelectedOrder() {
  try {
    if (!selectedSessionId) return toast("Selecciona una sesión.", "warn");
    printClassOrder(core().swiftDb, selectedSessionId);
    await core().autosave({ backup: false, reason: "historial impresión pedido de sesión" });
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo abrir la impresión del pedido.", "err");
  }
}

function updateItemModeVisibility() {
  const selectedRef = selectedRecipeRef();
  const type = selectedRef.type || ($("#classRecipeTypeV41")?.value === "culinary" ? "culinary" : "bakery");
  const culinaryRecipe = selectedCulinaryRecipe();
  const modeSel = $("#classProductionModeV41");
  const allowed = allowedProductionModes(type, culinaryRecipe);
  if (modeSel) {
    Array.from(modeSel.options).forEach(opt => {
      opt.hidden = allowed.length ? !allowed.includes(opt.value) : false;
    });
    if (!allowed.includes(modeSel.value)) modeSel.value = allowed[0] || "flour";
  }
  const finalMode = modeSel?.value || "flour";
  showWrap("classFlourWrapV41", type === "bakery" && finalMode === "flour");
  showWrap("classRawDoughWrapV41", type === "bakery" && finalMode === "raw_dough");
  showWrap("classPiecesWrapV41", type === "bakery" && finalMode === "pieces");
  showWrap("classPieceWeightWrapV41", type === "bakery" && finalMode === "pieces");
  showWrap("classServingsWrapV41", type === "culinary" && finalMode === "servings");
  showWrap("classYieldWrapV621", type === "culinary" && finalMode === "yield");

  const yieldUnit = $("#classYieldUnitV621");
  if (yieldUnit) {
    yieldUnit.textContent = (culinaryIsTechnical(culinaryRecipe) || culinaryIsDual(culinaryRecipe))
      ? `Unidad de rendimiento: ${culinaryRecipe?.yield_unit || "unidad técnica"}.`
      : "Solo visible para subelaboraciones o elaboraciones duales con rendimiento técnico.";
  }

  const contract = $("#classProductionContractV621");
  if (contract) {
    contract.classList.remove("ok", "warn", "err");
    if (type === "bakery") {
      contract.textContent = "Contrato: panadería solo permite harina, masa o piezas. Raciones desactivadas.";
      contract.classList.add("ok");
    } else if (type === "culinary" && culinaryIsTechnical(culinaryRecipe)) {
      contract.textContent = `Contrato: subelaboración técnica por rendimiento (${fmtNumber(culinaryRecipe.yield_quantity,3)} ${culinaryRecipe.yield_unit || ""}).`;
      contract.classList.add("warn");
    } else if (type === "culinary" && culinaryIsDual(culinaryRecipe)) {
      contract.textContent = `Contrato: elaboración dual. Permite raciones o rendimiento técnico; modo recomendado: ${productionModeLabel(culinaryDefaultMode(culinaryRecipe))}.`;
      contract.classList.add("warn");
    } else if (type === "culinary") {
      contract.textContent = "Contrato: ficha final de cocina/pastelería por raciones. Modos panaderos desactivados.";
      contract.classList.add("ok");
    } else {
      contract.textContent = "Selecciona una elaboración para ver los modos permitidos.";
    }
  }
}

function suggestGroupFromModule() {
  const cycleId = $("#classCycleV41")?.value || null;
  const moduleId = $("#classModuleV41")?.value || "";
  const m = repo()?.modules(cycleId).find(x => x.id === moduleId);
  const suggested = m?.default_group || guessGroupFromModule(m) || "1º A";
  setVal("classGroupPresetV65", ["1º A", "1º B", "2º A", "2º B"].includes(suggested) ? suggested : "otro");
  if (!$("#classGroupV41")?.value || ["1º A", "1º B", "2º A", "2º B"].includes($("#classGroupV41").value)) {
    setVal("classGroupV41", suggested);
  }
}

function applyGroupPreset() {
  const v = $("#classGroupPresetV65")?.value || "";
  const custom = $("#classGroupCustomWrapV66");
  if (custom) custom.style.display = v === "otro" ? "" : "none";
  if (v && v !== "otro") setVal("classGroupV41", v);
  if (v === "otro" && !$("#classGroupV41")?.value) setVal("classGroupV41", "");
}

function setGroupPresetFromValue(v) {
  const known = ["1º A", "1º B", "2º A", "2º B"];
  setVal("classGroupPresetV65", known.includes(v) ? v : "otro");
  applyGroupPreset();
}

function guessGroupFromModule(m) {
  const hay = `${m?.module_code || ""} ${m?.module_name || ""}`.toLowerCase();
  if (/2|segundo|ii/.test(hay)) return "2º A";
  return "1º A";
}

function syncSessionDetailsToggle() {
  const check = $("#classUseSessionDataV66");
  const details = $("#classSessionDetailsV66");
  if (details && check) details.open = check.checked;
}

function syncOrganizationToggle() {
  const check = $("#classUseOrganizationV66");
  const details = $("#classQuantityDetailsV67");
  if (details && check) details.open = check.checked;
  syncQuantityPlanning();
}

function syncQuantityPlanning() {
  const useOrg = $("#classUseOrganizationV66")?.checked;
  const box = $("#classQuantityPlanHintV67");
  if (!box) return;
  if (!useOrg) {
    box.textContent = "Bloque desactivado: las cantidades se propondrán desde la ficha base de cada elaboración.";
    return;
  }
  const teams = Math.max(0, Math.trunc(num($("#classTeamCountV627")?.value, 0)));
  const peoplePerTeam = Math.max(0, Math.trunc(num($("#classPeoplePerTeamV627")?.value, 0)));
  let students = Math.max(0, Math.trunc(num($("#classStudentCountV65")?.value, 0)));
  if (teams > 0 && peoplePerTeam > 0) {
    students = teams * peoplePerTeam;
    setVal("classStudentCountV65", students);
  }
  const pieces = Math.max(0, num($("#classPiecesPerStudentV65")?.value, 1));
  const servings = Math.max(0, num($("#classServingsPerStudentV65")?.value, 1));
  const margin = Math.max(0, num($("#classSafetyMarginV65")?.value, 0));
  if (!students) {
    box.textContent = "Indica equipos/personas o número total de alumnado para calcular propuestas de piezas o raciones.";
    return;
  }
  const factor = 1 + margin / 100;
  const suggestedPieces = Math.ceil(students * pieces * factor);
  const suggestedServings = Math.ceil(students * servings * factor);
  const teamLabel = teams && peoplePerTeam ? `${teams} equipo(s) × ${peoplePerTeam} persona(s)` : `${students} alumno(s)`;
  box.textContent = `Propuesta activa: ${teamLabel} → ${students} alumno(s). ${fmtNumber(pieces,2)} pieza(s)/alumno = ${suggestedPieces} pieza(s); ${fmtNumber(servings,2)} ración(es)/alumno = ${suggestedServings} ración(es). Margen: ${fmtNumber(margin,1)} %. Ajusta manualmente cada elaboración si procede.`;
}

function renderActiveSummary() {
  const box = $("#classActiveSessionSummaryV65");
  if (!box) return;
  if (!selectedSessionId) { box.textContent = "Nueva sesión sin guardar."; return; }
  const s = repo()?.classSessionById(selectedSessionId);
  if (!s) { box.textContent = "Sin sesión seleccionada."; return; }
  const items = repo().classItems(selectedSessionId).length;
  box.innerHTML = `<b>${esc(s.title || s.id)}</b> · ${esc(s.practice_date || "sin fecha")} · ${esc(s.group_name || "sin grupo")} · ${s.team_count ? esc(String(s.team_count)) + " equipo(s) · " : ""}${s.total_students ? esc(String(s.total_students)) + " alumno(s) · " : ""}${items} elaboración(es)`;
}

window.SwiftRemoSession = {
  getSelectedSessionId: () => selectedSessionId
};

function showWrap(id, show) { const el = $("#" + id); if (el) el.style.display = show ? "" : "none"; }
function setVal(id, value) { const el = $("#" + id); if (el) el.value = value ?? ""; }
function nullIfEmpty(value) { const v = String(value ?? "").trim(); return v ? v : null; }
function num(value, fallback = 0) { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : fallback; }
function nullableNum(value) { const v = String(value ?? "").trim(); if (!v) return null; const n = num(v, NaN); return Number.isFinite(n) ? n : null; }
function today() { return new Date().toISOString().slice(0,10); }
function norm(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function updateQuantityHint(message) { const el = $("#classQuantityHintV65"); if (el) el.textContent = message || ""; }
