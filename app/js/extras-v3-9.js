import { $, table, toast } from "./ui.js?v=100rc3";

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
let ingredients = [];
let selectedLineId = null;
let initialized = false;

window.addEventListener("DOMContentLoaded", () => {
  const bakeryTab = document.querySelector('[data-tab="bakery"]');
  if (bakeryTab) {
    bakeryTab.addEventListener("click", () => setTimeout(initExtras, 350));
  }
  setTimeout(initExtras, 1000);
});

async function initExtras() {
  if (initialized) return;
  if (!document.querySelector("#extraFormV39")) return;

  initialized = true;

  try {
    await loadDb();
    ensureSchema();
    bindEvents();
    loadCatalogs();
    loadCurrentRecipe();
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

async function loadDb() {
  db = await waitForCoreDb();
}
function ensureSchema() {
  const col = db.query(`
    SELECT name
    FROM pragma_table_info('bakery_recipe_lines')
    WHERE name='line_group';
  `)[0];

  if (!col) {
    throw new Error("La base no contiene columnas v3.5 para líneas fuera de masa.");
  }
}

function bindEvents() {
  bindOnce("#extraFormV39", "submit", saveExtra);
  bindOnce("#extraNewV39", "click", clearForm);
  bindOnce("#extraClearV39", "click", clearForm);
  bindOnce("#extraDeleteV39", "click", deleteExtra);

  const recipeSelect = $("#bakeryRecipeSelectV37");
  if (recipeSelect && !recipeSelect.dataset.extras39Watch) {
    recipeSelect.addEventListener("change", async () => {
      currentRecipeId = recipeSelect.value;
      await loadDb();
      loadCatalogs();
      renderExtras();
      clearForm();
    });
    recipeSelect.dataset.extras39Watch = "1";
  }
}

function bindOnce(selector, eventName, handler) {
  const el = document.querySelector(selector);
  if (!el || el.dataset.extra39Bound === "1") return;
  el.addEventListener(eventName, handler);
  el.dataset.extra39Bound = "1";
}

function loadCatalogs() {
  ingredients = db.query(`
    SELECT id, name
    FROM ingredients
    WHERE active=1
    ORDER BY name;
  `);

  const select = $("#extraIngredientV39");
  if (select) {
    select.innerHTML = `<option value="">Selecciona ingrediente</option>` +
      ingredients.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");
  }
}

function loadCurrentRecipe() {
  const select = $("#bakeryRecipeSelectV37");
  currentRecipeId = select?.value || db.query(`
    SELECT id
    FROM bakery_recipes
    WHERE active=1
    ORDER BY name
    LIMIT 1;
  `)[0]?.id;

  if (!currentRecipeId) return;

  renderExtras();
  clearForm();
}

function renderExtras() {
  if (!currentRecipeId) return;

  const rows = db.query(`
    SELECT
      brl.id,
      brl.ingredient_id,
      i.name AS ingredient,
      brl.line_group,
      brl.calculation_base,
      brl.quantity_value,
      brl.sort_order,
      brl.technical_note
    FROM bakery_recipe_lines brl
    JOIN ingredients i ON i.id = brl.ingredient_id
    WHERE brl.recipe_id=$recipe_id
      AND COALESCE(brl.line_group, 'dough') <> 'dough'
    ORDER BY brl.sort_order, i.name;
  `, { $recipe_id: currentRecipeId });

  $("#extrasTableV39").innerHTML = table([
    {
      label: "Ingrediente",
      render: r => `<button type="button" class="link-btn" data-extra-edit="${esc(r.id)}">${esc(r.ingredient)}</button>`
    },
    { label: "Grupo", render: r => labelGroup(r.line_group) },
    { label: "Base", render: r => labelBase(r.calculation_base) },
    { label: "Valor", render: r => formatValue(r.quantity_value, r.calculation_base) },
    { label: "Orden", key: "sort_order" },
    { label: "Nota", key: "technical_note" }
  ], rows);

  document.querySelectorAll("[data-extra-edit]").forEach(btn => {
    btn.addEventListener("click", () => loadExtra(btn.dataset.extraEdit));
  });
}

function loadExtra(id) {
  const line = db.query(`
    SELECT *
    FROM bakery_recipe_lines
    WHERE id=$id;
  `, { $id: id })[0];

  if (!line) return toast("No se encontró la línea.", "err");

  selectedLineId = id;
  setVal("extraLineIdV39", line.id);
  setVal("extraIngredientV39", line.ingredient_id);
  setVal("extraGroupV39", line.line_group || "filling");
  setVal("extraCalcBaseV39", line.calculation_base || "per_piece");
  setVal("extraValueV39", line.quantity_value ?? "");
  setVal("extraSortV39", line.sort_order ?? "100");
  setVal("extraNoteV39", line.technical_note || "");
}

function clearForm() {
  selectedLineId = null;
  setVal("extraLineIdV39", "");
  setVal("extraIngredientV39", "");
  setVal("extraGroupV39", "filling");
  setVal("extraCalcBaseV39", "per_piece");
  setVal("extraValueV39", "");
  setVal("extraSortV39", "100");
  setVal("extraNoteV39", "");
}

async function saveExtra(ev) {
  ev.preventDefault();

  try {
    if (!currentRecipeId) throw new Error("No hay formulación seleccionada.");

    const ingredientId = $("#extraIngredientV39").value;
    if (!ingredientId) throw new Error("Selecciona un ingrediente.");

    const value = num($("#extraValueV39").value);
    if (value < 0) throw new Error("El valor no puede ser negativo.");

    const lineId = selectedLineId || makeLineId(currentRecipeId);
    const lineGroup = $("#extraGroupV39").value;
    const calcBase = $("#extraCalcBaseV39").value;
    const sortOrder = Math.trunc(num($("#extraSortV39").value) || 100);
    const note = nullIfEmpty($("#extraNoteV39").value);

    const exists = db.query(`
      SELECT id
      FROM bakery_recipe_lines
      WHERE id=$id;
    `, { $id: lineId })[0];

    if (exists) {
      db.exec(`
        UPDATE bakery_recipe_lines
        SET ingredient_id=$ingredient_id,
            line_group=$line_group,
            calculation_base=$calculation_base,
            quantity_value=$quantity_value,
            quantity_unit_id='UNIT_G',
            include_in_dough=0,
            bakery_role='other',
            baker_pct=0,
            preferment_pct=0,
            final_dough_pct=0,
            technical_note=$technical_note,
            sort_order=$sort_order
        WHERE id=$id;
      `, {
        $id: lineId,
        $ingredient_id: ingredientId,
        $line_group: lineGroup,
        $calculation_base: calcBase,
        $quantity_value: value,
        $technical_note: note,
        $sort_order: sortOrder
      });
    } else {
      db.exec(`
        INSERT INTO bakery_recipe_lines (
          id, recipe_id, ingredient_id, bakery_role,
          baker_pct, preferment_pct, final_dough_pct,
          unit_id, technical_note, sort_order,
          line_group, calculation_base, quantity_value,
          quantity_unit_id, include_in_dough
        ) VALUES (
          $id, $recipe_id, $ingredient_id, 'other',
          0, 0, 0,
          'UNIT_G', $technical_note, $sort_order,
          $line_group, $calculation_base, $quantity_value,
          'UNIT_G', 0
        );
      `, {
        $id: lineId,
        $recipe_id: currentRecipeId,
        $ingredient_id: ingredientId,
        $line_group: lineGroup,
        $calculation_base: calcBase,
        $quantity_value: value,
        $technical_note: note,
        $sort_order: sortOrder
      });
    }

    await autosaveCore("fuera de masa", true);

    selectedLineId = lineId;
    renderExtras();
    notifyBakeryChangedV40("Línea fuera de masa guardada y producción recalculada.");
    toast("Línea fuera de masa guardada.");
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

async function deleteExtra() {
  try {
    if (!selectedLineId) return toast("Selecciona una línea primero.", "warn");

    if (!confirm("¿Eliminar esta línea fuera de masa?")) return;

    db.exec(`
      DELETE FROM bakery_recipe_lines
      WHERE id=$id
        AND COALESCE(line_group, 'dough') <> 'dough';
    `, { $id: selectedLineId });

    await autosaveCore("eliminar fuera de masa", true);

    clearForm();
    renderExtras();
    notifyBakeryChangedV40("Línea fuera de masa eliminada y producción recalculada.");
    toast("Línea fuera de masa eliminada.");
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

function labelGroup(value) {
  return {
    filling: "Relleno",
    topping: "Cobertura / acabado",
    decoration: "Decoración",
    other: "Otro"
  }[value] || value || "";
}

function labelBase(value) {
  return {
    per_piece: "g por pieza",
    flour_pct: "% sobre harinas",
    dough_pct: "% sobre masa",
    fixed: "cantidad fija"
  }[value] || value || "";
}

function formatValue(value, base) {
  const n = Number(value || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 });

  if (base === "per_piece") return `${n} g/pieza`;
  if (base === "flour_pct") return `${n} % harinas`;
  if (base === "dough_pct") return `${n} % masa`;
  if (base === "fixed") return `${n} g fijo`;
  return n;
}

function makeLineId(recipeId) {
  return `${recipeId}_EXTRA_${Date.now()}`;
}

function setVal(id, value) {
  const el = $("#" + id);
  if (el) el.value = value ?? "";
}

function num(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function nullIfEmpty(value) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function notifyBakeryChangedV40(message) {
  window.dispatchEvent(new CustomEvent("swiftremo:bakeryChanged", {
    detail: { source: "extras-v3-9", message }
  }));
}

