import { $, fmtNumber, table, toast } from "./ui.js?v=6730";
import { printBakeryRecipe } from "./print-service-v6-3.js?v=6730";

let db = null;

function coreDb() {
  const core = window.SwiftRemoCore;
  if (!core?.swiftDb?.isLoaded?.()) throw new Error("La base principal de SwiftRemo no está cargada.");
  return core.swiftDb;
}

async function waitForCoreDb() {
  if (window.SwiftRemoCore?.swiftDb?.isLoaded?.()) return coreDb();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("swiftremo:coreReady", onReady);
      reject(new Error("La base principal de SwiftRemo no terminó de cargar."));
    }, 15000);
    function onReady() {
      clearTimeout(timeout);
      window.removeEventListener("swiftremo:coreReady", onReady);
      resolve();
    }
    window.addEventListener("swiftremo:coreReady", onReady, { once: true });
  });
  return coreDb();
}

async function autosaveCore(reason, backup = true) {
  const core = window.SwiftRemoCore;
  if (!core?.autosave) throw new Error("El autosave principal de SwiftRemo no está disponible.");
  await core.autosave({ backup, reason });
}


let currentRecipeId = null;
let lines = [];
let validation = null;
let doughTotals = null;
let preferment = null;
let initialized = false;
let bakeryIngredients = [];
let editingLineId = null;

window.addEventListener("DOMContentLoaded", () => {
  const tabButton = document.querySelector('[data-tab="bakery"]');
  if (tabButton) {
    tabButton.addEventListener("click", () => {
      if (!initialized) initBakeryV37();
    });
  }

  if (document.querySelector("#tab-bakery.active")) {
    initBakeryV37();
  }
});

window.addEventListener("swiftremo:bakeryChanged", async event => {
  try {
    if (!initialized) {
      await initBakeryV37();
      return;
    }

    await loadDb({ keepSelection: true });

    if (event?.detail?.message) {
      toast(event.detail.message);
    }
  } catch (err) {
    console.error(err);
    toast("No se pudo recalcular Panadería tras el cambio.", "err");
  }
});

async function initBakeryV37() {
  if (initialized) return;
  initialized = true;

  try {
    bind();
    await loadDb();
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
    const box = $("#bakeryValidationV37");
    if (box) box.innerHTML = `<span class="err-text-v37">${esc(err.message)}</span>`;
  }
}

function bind() {
  $("#bakeryReloadV37").addEventListener("click", () => loadDb({ keepSelection: true }));
  $("#bakeryRecipeSelectV37").addEventListener("change", () => {
    currentRecipeId = $("#bakeryRecipeSelectV37").value;
    renderRecipe();
  });

  [
    "bakeryProductionModeV37",
    "bakeryFlourAmountV37",
    "bakeryDoughAmountV37",
    "bakeryPiecesCountV37",
    "bakeryPieceWeightV37",
    "bakeryInputUnitV37"
  ].forEach(id => {
    $("#" + id).addEventListener("input", renderProduction);
    $("#" + id).addEventListener("change", renderProduction);
  });

  $("#bakeryNewRecipeV40").addEventListener("click", newRecipeForm);
  $("#bakerySaveRecipeV40").addEventListener("click", saveRecipeFromForm);
  $("#bakeryLineFormV40").addEventListener("submit", saveLineFromForm);
  $("#bakeryClearLineV40").addEventListener("click", clearLineForm);
  $("#bakeryDeleteLineV40").addEventListener("click", deleteCurrentLine);
  $("#bakeryAddSelectionV623")?.addEventListener("click", addCurrentToSelection);
  $("#bakeryPrintRecipeV40").addEventListener("click", printCurrentRecipe);
}

async function loadDb({ keepSelection = false } = {}) {
  db = await waitForCoreDb();
  const previousId = keepSelection ? currentRecipeId : null;

  ensureViews();
  bakeryIngredients = db.query(`
    SELECT id, name, bakery_role
    FROM ingredients
    WHERE active=1 AND use_bakery=1
    ORDER BY name;
  `);
  populateBakeryIngredientSelect();

  const recipes = db.query("SELECT id, name FROM bakery_recipes WHERE active=1 ORDER BY name;");
  $("#bakeryRecipeSelectV37").innerHTML = recipes.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");

  if (previousId && recipes.some(r => r.id === previousId)) {
    currentRecipeId = previousId;
  } else {
    currentRecipeId = $("#bakeryRecipeSelectV37").value || recipes[0]?.id || null;
  }

  if (!currentRecipeId) throw new Error("No hay formulaciones panaderas activas.");

  $("#bakeryRecipeSelectV37").value = currentRecipeId;
  renderRecipe();
}
function ensureViews() {
  const row = db.query("SELECT name FROM sqlite_schema WHERE name='v_bakery_formula_validation';")[0];
  if (!row) {
    throw new Error("La base SQLite no contiene las vistas panaderas v3.5. Regenera la base con schema.sql + seed.sql actualizados.");
  }
}

function renderRecipe() {
  validation = one("SELECT * FROM v_bakery_formula_validation WHERE recipe_id=$id;", { $id: currentRecipeId });
  doughTotals = one("SELECT * FROM v_bakery_dough_totals_v35 WHERE recipe_id=$id;", { $id: currentRecipeId });
  preferment = one("SELECT * FROM v_bakery_preferment_totals_v35 WHERE recipe_id=$id;", { $id: currentRecipeId });
  lines = db.query("SELECT * FROM v_bakery_formula_lines_v35 WHERE recipe_id=$id ORDER BY sort_order, ingredient;", { $id: currentRecipeId });

  renderRecipeEditor();
  renderFormulaEditor();
  renderValidation();
  renderSummary();
  renderProduction();
}

function renderRecipeEditor() {
  const recipe = one("SELECT * FROM bakery_recipes WHERE id=$id;", { $id: currentRecipeId });
  if (!recipe) return;
  setValue("bakeryRecipeIdV40", recipe.id);
  setValue("bakeryRecipeNameV40", recipe.name);
  setValue("bakeryBaseFlourV40", recipe.base_flour_g ?? 1000);
  setValue("bakeryBasePiecesV40", recipe.base_pieces);
  setValue("bakeryPieceRawWeightV40", recipe.base_raw_piece_weight_g);
  setValue("bakeryBakingLossV40", recipe.baking_loss_pct ?? 0);
  setValue("bakeryTargetTempV40", recipe.target_dough_temp_c);
  setValue("bakeryStatusV40", recipe.status ?? "draft");
  setValue("bakeryRecipeNotesV40", recipe.notes);
  $("#bakeryActiveV40").checked = Number(recipe.active ?? 1) === 1;
  clearLineForm(false);
}

function renderFormulaEditor() {
  const rows = db.query(`
    SELECT brl.id, i.name AS ingredient, brl.bakery_role, brl.baker_pct, brl.sort_order, brl.technical_note
    FROM bakery_recipe_lines brl
    JOIN ingredients i ON i.id = brl.ingredient_id
    WHERE brl.recipe_id=$id AND COALESCE(brl.line_group,'dough')='dough'
    ORDER BY brl.sort_order, i.name;
  `, { $id: currentRecipeId });

  $("#bakeryFormulaEditTableV40").innerHTML = table([
    { label: "Ingrediente", render: r => `<button type="button" class="link-btn" data-bakery-line-edit="${esc(r.id)}">${esc(r.ingredient)}</button>` },
    { label: "Rol", key: "bakery_role" },
    { label: "% panadero", render: r => fmtNumber(r.baker_pct, 3) },
    { label: "Orden", key: "sort_order" },
    { label: "Nota", key: "technical_note" }
  ], rows);

  document.querySelectorAll("[data-bakery-line-edit]").forEach(btn => {
    btn.addEventListener("click", () => loadLineForm(btn.dataset.bakeryLineEdit));
  });
}

function renderValidation() {
  if (!validation) {
    $("#bakeryValidationV37").innerHTML = "<span class='err-text-v37'>Sin validación.</span>";
    return;
  }

  const flour = Number(validation.flour_pct_total || 0);
  const splitErrors = Number(validation.split_error_count || 0);
  let status = "";

  if (Number(validation.no_flour_error)) {
    status = `<span class="err-text-v37">Error: la fórmula no tiene harinas de masa.</span>`;
  } else if (Number(validation.flour_pct_error)) {
    const delta = Number(validation.flour_pct_delta || 0);
    status = `<span class="warn-text-v37">Harinas ${fmtNumber(flour,2)} %. ${delta > 0 ? "Faltan" : "Sobran"} ${fmtNumber(Math.abs(delta),2)} puntos.</span>`;
  } else if (splitErrors > 0) {
    status = `<span class="warn-text-v37">Hay ${splitErrors} línea(s) donde prefermento + masa final no coincide con el total.</span>`;
  } else {
    status = `<span class="ok-text-v37">Harinas 100 % · reparto correcto.</span>`;
  }

  $("#bakeryValidationV37").innerHTML = `
    ${status}
    <div class="small" style="margin-top:6px">
      Total masa: ${fmtNumber(validation.dough_pct_total,2)} % ·
      Hidratación real: ${fmtNumber(validation.real_hydration_pct,2)} % ·
      Harina prefermentada: ${fmtNumber(validation.preferment_flour_pct_total,2)} %
    </div>
  `;
}

function renderSummary() {
  $("#bakerySummaryV37").innerHTML = `
    <div class="kpi"><span>Harinas</span><b>${fmtNumber(validation?.flour_pct_total,2)} %</b></div>
    <div class="kpi"><span>Total masa</span><b>${fmtNumber(validation?.dough_pct_total,2)} %</b></div>
    <div class="kpi"><span>Hidratación real</span><b>${fmtNumber(validation?.real_hydration_pct,2)} %</b></div>
    <div class="kpi"><span>Prefermento</span><b>${esc(preferment?.preferment_type ?? "—")}</b></div>
  `;
}

function renderProduction() {
  if (!validation || !lines.length) return;

  const mode = $("#bakeryProductionModeV37").value;
  const unitFactor = $("#bakeryInputUnitV37").value === "kg" ? 1000 : 1;
  const doughPct = Number(validation.dough_pct_total || 0);

  let flourTotalG = 0;
  let doughTargetG = 0;

  $("#bakeryFlourWrapV37").style.display = mode === "flour" ? "" : "none";
  $("#bakeryDoughWrapV37").style.display = mode === "dough" ? "" : "none";
  $("#bakeryPiecesWrapV37").style.display = mode === "pieces" ? "" : "none";
  $("#bakeryPieceWeightWrapV37").style.display = mode === "pieces" ? "" : "none";
  $("#bakeryInputUnitWrapV37").style.display = mode === "pieces" ? "none" : "";

  if (doughPct <= 0) {
    $("#bakeryProductionSummaryV37").innerHTML = `<span class="err-text-v37">No se puede escalar: el porcentaje total de masa es 0.</span>`;
    return;
  }

  if (mode === "flour") {
    flourTotalG = num($("#bakeryFlourAmountV37").value) * unitFactor;
    doughTargetG = flourTotalG * doughPct / 100;
  } else if (mode === "dough") {
    doughTargetG = num($("#bakeryDoughAmountV37").value) * unitFactor;
    flourTotalG = doughTargetG * 100 / doughPct;
  } else {
    const pieces = Math.trunc(num($("#bakeryPiecesCountV37").value));
    const pieceWeight = num($("#bakeryPieceWeightV37").value);
    doughTargetG = pieces * pieceWeight;
    flourTotalG = doughTargetG * 100 / doughPct;
  }

  $("#bakeryAutoDoughTotalV37").value = formatMass(doughTargetG);

  const factor = flourTotalG / Number(doughTotals?.preview_total_flour_g || 1000);
  const doughRows = [];
  const prefRows = [];
  const finalRows = [];
  const extraRows = [];

  for (const line of lines) {
    const group = line.line_group;
    const totalG = Number(line.preview_total_g || 0) * factor;
    const prefG = Number(line.preview_preferment_g || 0) * factor;
    const finalG = Number(line.preview_final_dough_g || 0) * factor;

    if (group === "dough") {
      doughRows.push(rowLine(line, totalG, line.baker_pct, "Total fórmula"));
      if (prefG > 0.0001) prefRows.push(rowLine(line, prefG, line.preferment_pct, "Prefermento"));
      if (finalG > 0.0001) finalRows.push(rowLine(line, finalG, line.final_dough_pct, "Masa final"));
    } else {
      extraRows.push(calcExtraLine(line, flourTotalG, doughTargetG));
    }
  }

  const prefTotal = prefRows.reduce((a, r) => a + r.grams, 0);
  if (prefTotal > 0) {
    finalRows.unshift({ ingredient: "Prefermento elaborado", role: "proceso", pct: "", grams: prefTotal, note: "Se incorpora elaborado; no duplica pedido." });
  }

  $("#bakeryProductionSummaryV37").innerHTML = `
    Harinas totales calculadas: <b>${formatMass(flourTotalG)}</b> ·
    Masa total: <b>${formatMass(doughTargetG)}</b> ·
    Factor de escala: <b>${fmtNumber(factor,4)}</b>
  `;

  renderLineTable("#bakeryDoughLinesV37", doughRows);
  renderLineTable("#bakeryPrefermentLinesV37", prefRows);
  renderLineTable("#bakeryFinalDoughLinesV37", finalRows);
  renderLineTable("#bakeryExtraLinesV37", extraRows);
}

function rowLine(line, grams, pct, note) {
  return { ingredient: line.ingredient, role: line.bakery_role, pct, grams, note };
}

function calcExtraLine(line, flourTotalG, doughTargetG) {
  const base = line.calculation_base;
  const value = Number(line.quantity_value || 0);
  let grams = 0;
  let note = "";

  if (base === "flour_pct") {
    grams = flourTotalG * value / 100;
    note = `${fmtNumber(value,2)} % sobre harinas`;
  } else if (base === "dough_pct") {
    grams = doughTargetG * value / 100;
    note = `${fmtNumber(value,2)} % sobre masa`;
  } else if (base === "per_piece") {
    const pieces = Math.trunc(num($("#bakeryPiecesCountV37").value));
    grams = pieces * value;
    note = `${formatMass(value)} por pieza`;
  } else if (base === "fixed") {
    grams = value;
    note = "cantidad fija";
  } else {
    grams = 0;
    note = "base no aplicable fuera de masa";
  }

  return { ingredient: line.ingredient, role: line.line_group, pct: value, grams, note };
}

function renderLineTable(selector, rows) {
  $(selector).innerHTML = table([
    { label: "Ingrediente", key: "ingredient" },
    { label: "Rol/grupo", key: "role" },
    { label: "%/valor", render: r => r.pct === "" ? "" : fmtNumber(r.pct, 3) },
    { label: "Cantidad", render: r => formatMass(r.grams) },
    { label: "Nota", key: "note" }
  ], rows);
}

function populateBakeryIngredientSelect() {
  const sel = $("#bakeryLineIngredientV40");
  sel.innerHTML = `<option value="">Selecciona ingrediente</option>` + bakeryIngredients.map(i => `<option value="${esc(i.id)}" data-role="${esc(i.bakery_role || "other")}">${esc(i.name)}</option>`).join("");
  if (sel.dataset.bakeryIngredientBound !== "1") {
    sel.addEventListener("change", () => {
      const opt = sel.selectedOptions?.[0];
      const role = opt?.dataset?.role;
      if (role) setValue("bakeryLineRoleV40", role);
    });
    sel.dataset.bakeryIngredientBound = "1";
  }
}

function newRecipeForm() {
  const name = prompt("Nombre de la nueva formulación panadera:");
  if (!name?.trim()) return;
  const id = slugRecipeIdFromName(name);
  currentRecipeId = id;
  db.exec(`
    INSERT INTO bakery_recipes (id, name, base_flour_g, preferment_type, status, active)
    VALUES ($id, $name, 1000, 'Sin prefermento', 'draft', 1);
    INSERT OR IGNORE INTO bakery_preferments (recipe_id, preset_id, preferment_type, calculation_mode, hydration_pct, flour_prefermented_pct, preferment_total_pct, yeast_type_id, yeast_pct, yeast_pct_base)
    VALUES ($id, 'PREF_NONE', 'Sin prefermento', 'none', 0, 0, 0, 'YEAST_NONE', 0, 'total_flour');
  `, { $id: id, $name: name.trim() });
  persistBakeryChange("Nueva formulación creada.");
}

async function saveRecipeFromForm() {
  try {
    const id = $("#bakeryRecipeIdV40").value || slugRecipeIdFromName($("#bakeryRecipeNameV40").value);
    const name = $("#bakeryRecipeNameV40").value.trim();
    const baseFlour = num($("#bakeryBaseFlourV40").value, 1000);
    if (!name) throw new Error("El nombre de la formulación es obligatorio.");
    if (baseFlour <= 0) throw new Error("La harina base debe ser mayor que 0.");
    const bakingLoss = num($("#bakeryBakingLossV40").value, 0);
    if (bakingLoss < 0 || bakingLoss >= 100) throw new Error("La merma de cocción debe estar entre 0 y 99,99 %. ");

    db.exec("BEGIN TRANSACTION;");
    try {
      const exists = one("SELECT id FROM bakery_recipes WHERE id=$id;", { $id: id });
      const bind = {
        $id: id,
        $name: name,
        $base_flour_g: baseFlour,
        $base_pieces: nullIfEmptyNumber($("#bakeryBasePiecesV40").value),
        $base_raw_piece_weight_g: nullIfEmptyNumber($("#bakeryPieceRawWeightV40").value),
        $baking_loss_pct: bakingLoss,
        $target_dough_temp_c: nullIfEmptyNumber($("#bakeryTargetTempV40").value),
        $status: $("#bakeryStatusV40").value,
        $notes: nullIfEmpty($("#bakeryRecipeNotesV40").value),
        $active: $("#bakeryActiveV40").checked ? 1 : 0
      };
      if (exists) {
        db.exec(`
          UPDATE bakery_recipes SET
            name=$name,
            base_flour_g=$base_flour_g,
            base_pieces=$base_pieces,
            base_raw_piece_weight_g=$base_raw_piece_weight_g,
            baking_loss_pct=$baking_loss_pct,
            target_dough_temp_c=$target_dough_temp_c,
            status=$status,
            notes=$notes,
            active=$active,
            updated_at=CURRENT_TIMESTAMP
          WHERE id=$id;
        `, bind);
      } else {
        db.exec(`
          INSERT INTO bakery_recipes (
            id, name, base_flour_g, base_pieces, base_raw_piece_weight_g,
            baking_loss_pct, target_dough_temp_c, status, notes, active
          ) VALUES (
            $id, $name, $base_flour_g, $base_pieces, $base_raw_piece_weight_g,
            $baking_loss_pct, $target_dough_temp_c, $status, $notes, $active
          );
        `, bind);
      }
      db.exec("COMMIT;");
      currentRecipeId = id;
      await persistBakeryChange("Ficha panadera guardada.");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

function loadLineForm(id) {
  const line = one("SELECT * FROM bakery_recipe_lines WHERE id=$id;", { $id: id });
  if (!line) return toast("No se encontró la línea.", "err");
  editingLineId = id;
  setValue("bakeryLineIdV40", line.id);
  setValue("bakeryLineIngredientV40", line.ingredient_id);
  setValue("bakeryLineRoleV40", line.bakery_role);
  setValue("bakeryLinePctV40", line.baker_pct);
  setValue("bakeryLineSortV40", line.sort_order);
  setValue("bakeryLineNoteV40", line.technical_note);
}

function clearLineForm(render = true) {
  editingLineId = null;
  const form = $("#bakeryLineFormV40");
  if (form) form.reset();
  setValue("bakeryLineIdV40", "");
  setValue("bakeryLineSortV40", "100");
  if (render && currentRecipeId) renderFormulaEditor();
}

async function saveLineFromForm(ev) {
  ev.preventDefault();
  try {
    if (!currentRecipeId) throw new Error("Selecciona una formulación.");
    const ingredientId = $("#bakeryLineIngredientV40").value;
    const role = $("#bakeryLineRoleV40").value;
    const pct = num($("#bakeryLinePctV40").value, NaN);
    if (!ingredientId) throw new Error("Selecciona un ingrediente.");
    if (!Number.isFinite(pct) || pct < 0) throw new Error("El porcentaje panadero debe ser un número mayor o igual que 0.");

    const id = $("#bakeryLineIdV40").value || `${currentRecipeId}_L${Date.now()}`;
    const bind = {
      $id: id,
      $recipe_id: currentRecipeId,
      $ingredient_id: ingredientId,
      $bakery_role: role,
      $baker_pct: pct,
      $preferment_pct: 0,
      $final_dough_pct: pct,
      $unit_id: "UNIT_G",
      $technical_note: nullIfEmpty($("#bakeryLineNoteV40").value),
      $sort_order: Math.trunc(num($("#bakeryLineSortV40").value, 100))
    };

    db.exec("BEGIN TRANSACTION;");
    try {
      const exists = one("SELECT id FROM bakery_recipe_lines WHERE id=$id;", { $id: id });
      if (exists) {
        const old = one("SELECT preferment_pct FROM bakery_recipe_lines WHERE id=$id;", { $id: id });
        const prefPct = Number(old?.preferment_pct || 0);
        bind.$preferment_pct = Math.min(prefPct, pct);
        bind.$final_dough_pct = pct - bind.$preferment_pct;
        db.exec(`
          UPDATE bakery_recipe_lines SET
            ingredient_id=$ingredient_id,
            bakery_role=$bakery_role,
            baker_pct=$baker_pct,
            preferment_pct=$preferment_pct,
            final_dough_pct=$final_dough_pct,
            unit_id=$unit_id,
            technical_note=$technical_note,
            sort_order=$sort_order,
            line_group='dough',
            calculation_base='baker_pct',
            quantity_value=0,
            quantity_unit_id='UNIT_G',
            include_in_dough=1
          WHERE id=$id;
        `, bind);
      } else {
        db.exec(`
          INSERT INTO bakery_recipe_lines (
            id, recipe_id, ingredient_id, bakery_role, baker_pct, preferment_pct, final_dough_pct,
            unit_id, technical_note, sort_order, line_group, calculation_base, quantity_value, quantity_unit_id, include_in_dough
          ) VALUES (
            $id, $recipe_id, $ingredient_id, $bakery_role, $baker_pct, $preferment_pct, $final_dough_pct,
            $unit_id, $technical_note, $sort_order, 'dough', 'baker_pct', 0, 'UNIT_G', 1
          );
        `, bind);
      }
      db.exec("COMMIT;");
      editingLineId = id;
      await persistBakeryChange("Línea de fórmula guardada.");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

async function deleteCurrentLine() {
  const id = $("#bakeryLineIdV40").value || editingLineId;
  if (!id) return toast("Selecciona una línea primero.", "warn");
  const line = one(`
    SELECT i.name AS ingredient
    FROM bakery_recipe_lines brl
    JOIN ingredients i ON i.id=brl.ingredient_id
    WHERE brl.id=$id;
  `, { $id: id });
  if (!line) return;
  if (!confirm(`¿Eliminar la línea de ${line.ingredient}?`)) return;
  db.exec("DELETE FROM bakery_recipe_lines WHERE id=$id;", { $id: id });
  clearLineForm(false);
  await persistBakeryChange("Línea eliminada.");
}

async function persistBakeryChange(message) {
  await autosaveCore("panaderia", true);
  await loadDb({ keepSelection: true });
  window.dispatchEvent(new CustomEvent("swiftremo:databaseChanged", { detail: { message } }));
  toast(message);
}

async function printCurrentRecipe() {
  try {
    if (!currentRecipeId) return toast("Selecciona una formulación primero.", "warn");
    printBakeryRecipe(db, currentRecipeId);
    await autosaveCore("historial impresión panadería", false);
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo abrir la impresión.", "err");
  }
}

async function addCurrentToSelection() {
  try {
    if (!currentRecipeId) return toast("Selecciona una formulación primero.", "warn");
    const r = one("SELECT base_flour_g, base_pieces, base_raw_piece_weight_g FROM bakery_recipes WHERE id=$id;", { $id: currentRecipeId });
    await window.SwiftRemoCore.addWorkSelectionItem({
      item_type: "bakery",
      bakery_recipe_id: currentRecipeId,
      production_mode: "flour",
      flour_g: Number(r?.base_flour_g || 1000),
      pieces: null,
      piece_weight_g: null,
      notes: "Añadido desde Panadería"
    });
  } catch (err) { console.error(err); toast(err.message || "No se pudo añadir a la práctica actual.", "err"); }
}

function htmlTable(headers, rows) {
  return `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function formatMass(g) {
  const n = Number(g);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1000) return `${formatMax(n / 1000, 2)} kg`;
  return `${formatMax(n, 1)} g`;
}

function formatMax(value, maxDigits) {
  return Number(value).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: maxDigits });
}

function one(sql, bind = {}) {
  return db.query(sql, bind)[0] ?? null;
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function nullIfEmpty(value) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function nullIfEmptyNumber(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
}

function setValue(id, value) {
  const el = $("#" + id);
  if (el) el.value = value ?? "";
}

function slugRecipeIdFromName(name) {
  const clean = String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 42);
  return "PAN_" + (clean || Date.now());
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function statusLabel(value) {
  return ({ draft: "Borrador", reviewed: "Revisada", validated: "Validada", archived: "Archivada" })[value] || value || "—";
}
