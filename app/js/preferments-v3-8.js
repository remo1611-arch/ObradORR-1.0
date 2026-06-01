import { $, toast } from "./ui.js?v=6729";

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
let yeastTypes = [];
let presets = [];
let initialized = false;

window.addEventListener("DOMContentLoaded", () => {
  const bakeryTab = document.querySelector('[data-tab="bakery"]');
  if (bakeryTab) {
    bakeryTab.addEventListener("click", () => setTimeout(initPreferments, 350));
  }
  setTimeout(initPreferments, 900);
});

async function initPreferments() {
  if (initialized) return;
  if (!document.querySelector("#prefermentPresetV38")) return;

  initialized = true;

  try {
    await loadDb();
    ensureSchema();
    loadCatalogs();
    bindEvents();
    loadCurrentRecipe();
  } catch (err) {
    console.error(err);
    const box = $("#prefermentPreviewV38");
    if (box) box.innerHTML = `<span class="err-text-v37">${esc(err.message)}</span>`;
  }
}

async function loadDb() {
  db = await waitForCoreDb();
}
function ensureSchema() {
  const view = db.query("SELECT name FROM sqlite_schema WHERE name='v_bakery_formula_validation';")[0];
  if (!view) throw new Error("La base no contiene las vistas panaderas v3.5.");
}

function bindEvents() {
  bindOnce("#bakerySavePrefermentV38", "click", savePreferment);
  bindOnce("#prefermentPresetV38", "change", applyPreset);

  [
    "prefermentModeV38",
    "prefermentFlourPctV38",
    "prefermentTotalPctV38",
    "prefermentHydrationPctV38",
    "prefermentYeastTypeV38",
    "prefermentYeastPctV38",
    "prefermentYeastBaseV38",
    "prefermentTimeHoursV38",
    "prefermentTemperatureV38"
  ].forEach(id => {
    bindOnce("#" + id, "input", renderPreview);
    bindOnce("#" + id, "change", renderPreview);
  });
}

function bindOnce(selector, eventName, handler) {
  const el = document.querySelector(selector);
  if (!el || el.dataset.pref38Bound === "1") return;
  el.addEventListener(eventName, handler);
  el.dataset.pref38Bound = "1";
}

function loadCatalogs() {
  yeastTypes = db.query(`
    SELECT id, name, factor_to_instant
    FROM yeast_types
    WHERE active=1
    ORDER BY sort_order, name;
  `);

  presets = db.query(`
    SELECT *
    FROM preferment_presets
    WHERE active=1
    ORDER BY sort_order, name;
  `);

  const yeast = $("#prefermentYeastTypeV38");
  if (yeast) {
    yeast.innerHTML = yeastTypes
      .map(y => `<option value="${esc(y.id)}">${esc(y.name)}</option>`)
      .join("");
  }

  const preset = $("#prefermentPresetV38");
  if (preset) {
    preset.innerHTML = `<option value="">— Práctica actual manual —</option>` +
      presets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  }
}

function loadCurrentRecipe() {
  const select = $("#bakeryRecipeSelectV37");
  currentRecipeId = select?.value || db.query(`
    SELECT id FROM bakery_recipes WHERE active=1 ORDER BY name LIMIT 1;
  `)[0]?.id;

  if (!currentRecipeId) return;

  if (select && !select.dataset.pref38Watch) {
    select.addEventListener("change", async () => {
      currentRecipeId = select.value;
      await loadDb();
      loadCatalogs();
      loadPrefermentForm();
    });
    select.dataset.pref38Watch = "1";
  }

  loadPrefermentForm();
}

function loadPrefermentForm() {
  const cfg = db.query(`
    SELECT *
    FROM bakery_preferments
    WHERE recipe_id=$id;
  `, { $id: currentRecipeId })[0] || {};

  setVal("prefermentPresetV38", cfg.preset_id || "");
  setVal("prefermentTypeV38", cfg.preferment_type || "Sin prefermento");
  setVal("prefermentModeV38", cfg.calculation_mode || "none");
  setVal("prefermentFlourPctV38", cfg.flour_prefermented_pct ?? "");
  setVal("prefermentTotalPctV38", cfg.preferment_total_pct ?? "");
  setVal("prefermentHydrationPctV38", cfg.hydration_pct ?? "");
  setVal("prefermentYeastTypeV38", cfg.yeast_type_id || "YEAST_INSTANT_DRY");
  setVal("prefermentYeastPctV38", cfg.yeast_pct ?? "0");
  setVal("prefermentYeastBaseV38", cfg.yeast_pct_base || "total_flour");
  setVal("prefermentTimeHoursV38", cfg.time_hours ?? "");
  setVal("prefermentTemperatureV38", cfg.temperature_c ?? "");
  setVal("prefermentNotesV38", cfg.notes || "");

  renderPreview();
}

function applyPreset() {
  const id = $("#prefermentPresetV38")?.value;
  const p = presets.find(x => x.id === id);
  if (!p) return renderPreview();

  setVal("prefermentTypeV38", p.name);
  setVal("prefermentModeV38", p.calculation_mode_default || "none");
  setVal("prefermentFlourPctV38", p.flour_prefermented_pct_default ?? "");
  setVal("prefermentTotalPctV38", p.preferment_total_pct_default ?? "");
  setVal("prefermentHydrationPctV38", p.hydration_pct_default ?? "");
  setVal("prefermentYeastTypeV38", p.yeast_type_id || "YEAST_INSTANT_DRY");
  setVal("prefermentYeastPctV38", p.yeast_pct_default ?? "0");
  setVal("prefermentYeastBaseV38", p.yeast_pct_base_default || "total_flour");
  setVal("prefermentTimeHoursV38", p.time_hours_default ?? "");
  setVal("prefermentTemperatureV38", p.temperature_c_default ?? "");
  setVal("prefermentNotesV38", p.notes || "");

  renderPreview();
}

function renderPreview() {
  toggleFields();

  const form = formData();
  const plan = calcPlan(form, 1000);
  const box = $("#prefermentPreviewV38");
  if (!box) return;

  box.innerHTML = plan.html;
}

function toggleFields() {
  const mode = $("#prefermentModeV38")?.value || "none";
  const flour = $("#prefermentFlourPctV38")?.closest("label");
  const total = $("#prefermentTotalPctV38")?.closest("label");

  if (flour) flour.style.display = mode === "flour_prefermented_pct" ? "" : "none";
  if (total) total.style.display = mode === "preferment_total_pct" ? "" : "none";
}

function calcPlan(form, totalFlourG) {
  if (form.mode === "none") {
    return { html: "Sin prefermento.", prefFlourG: 0, prefWaterG: 0, yeastG: 0 };
  }

  const hydration = form.hydrationPct / 100;
  let prefFlourG = 0;
  let prefWaterG = 0;

  if (form.mode === "flour_prefermented_pct") {
    prefFlourG = totalFlourG * form.flourPct / 100;
    prefWaterG = prefFlourG * hydration;
  } else {
    const prefTotalG = totalFlourG * form.totalPct / 100;
    prefFlourG = prefTotalG / (1 + hydration);
    prefWaterG = prefTotalG - prefFlourG;
  }

  const yeastBaseG = form.yeastBase === "preferment_flour" ? prefFlourG : totalFlourG;
  const yeastInstantEqG = yeastBaseG * form.yeastPct / 100;
  const yeastType = yeastTypes.find(y => y.id === form.yeastTypeId);
  const factor = Number(yeastType?.factor_to_instant ?? 1);
  const yeastG = yeastInstantEqG * factor;

  const warnings = [];
  if (prefFlourG > totalFlourG) warnings.push("La harina del prefermento supera la harina total.");
  if (hydration < 0) warnings.push("La hidratación no puede ser negativa.");
  if (form.yeastPct < 0) warnings.push("La levadura no puede ser negativa.");

  return {
    prefFlourG,
    prefWaterG,
    yeastG,
    html: `
      <b>Previsualización sobre 1 kg de harinas</b><br>
      Harina al prefermento: <b>${formatMass(prefFlourG)}</b> ·
      Agua al prefermento: <b>${formatMass(prefWaterG)}</b> ·
      Levadura: <b>${formatMass(yeastG)}</b> (${esc(yeastType?.name || "sin tipo")})<br>
      Prefermento total aprox.: <b>${formatMass(prefFlourG + prefWaterG + yeastG)}</b>
      ${warnings.length ? `<div class="warn-text-v37">${warnings.map(esc).join("<br>")}</div>` : ""}
    `
  };
}

async function savePreferment() {
  try {
    if (!currentRecipeId) throw new Error("No hay formulación seleccionada.");

    const form = formData();

    db.exec(`
      INSERT INTO bakery_preferments (
        recipe_id, preset_id, preferment_type, calculation_mode,
        hydration_pct, flour_prefermented_pct, preferment_total_pct,
        yeast_type_id, yeast_pct, yeast_pct_base,
        time_hours, temperature_c, notes, active, updated_at
      ) VALUES (
        $recipe_id, $preset_id, $preferment_type, $calculation_mode,
        $hydration_pct, $flour_prefermented_pct, $preferment_total_pct,
        $yeast_type_id, $yeast_pct, $yeast_pct_base,
        $time_hours, $temperature_c, $notes, 1, CURRENT_TIMESTAMP
      )
      ON CONFLICT(recipe_id) DO UPDATE SET
        preset_id=excluded.preset_id,
        preferment_type=excluded.preferment_type,
        calculation_mode=excluded.calculation_mode,
        hydration_pct=excluded.hydration_pct,
        flour_prefermented_pct=excluded.flour_prefermented_pct,
        preferment_total_pct=excluded.preferment_total_pct,
        yeast_type_id=excluded.yeast_type_id,
        yeast_pct=excluded.yeast_pct,
        yeast_pct_base=excluded.yeast_pct_base,
        time_hours=excluded.time_hours,
        temperature_c=excluded.temperature_c,
        notes=excluded.notes,
        active=1,
        updated_at=CURRENT_TIMESTAMP;
    `, {
      $recipe_id: currentRecipeId,
      $preset_id: nullIfEmpty(form.presetId),
      $preferment_type: form.type || "Sin prefermento",
      $calculation_mode: form.mode,
      $hydration_pct: form.hydrationPct,
      $flour_prefermented_pct: form.mode === "flour_prefermented_pct" ? form.flourPct : null,
      $preferment_total_pct: form.mode === "preferment_total_pct" ? form.totalPct : null,
      $yeast_type_id: form.yeastTypeId,
      $yeast_pct: form.yeastPct,
      $yeast_pct_base: form.yeastBase,
      $time_hours: nullableNumber($("#prefermentTimeHoursV38")?.value),
      $temperature_c: nullableNumber($("#prefermentTemperatureV38")?.value),
      $notes: nullIfEmpty($("#prefermentNotesV38")?.value)
    });

    applySplit(form);

    await autosaveCore("prefermento panadero", true);

    notifyBakeryChangedV40("Prefermento guardado y Panadería recalculada.");
    toast("Prefermento guardado.");
    loadPrefermentForm();
  } catch (err) {
    console.error(err);
    toast(err.message, "err");
  }
}

function applySplit(form) {
  if (form.mode === "none") {
    db.exec(`
      UPDATE bakery_recipe_lines
      SET preferment_pct = 0,
          final_dough_pct = baker_pct
      WHERE recipe_id=$recipe_id AND line_group='dough';
    `, { $recipe_id: currentRecipeId });
    return;
  }

  const validation = db.query(`
    SELECT *
    FROM v_bakery_formula_validation
    WHERE recipe_id=$id;
  `, { $id: currentRecipeId })[0];

  const lines = db.query(`
    SELECT *
    FROM v_bakery_formula_lines_v35
    WHERE recipe_id=$id;
  `, { $id: currentRecipeId });

  const totalFlourPct = Number(validation?.flour_pct_total || 100);

  const prefFlourPct = form.mode === "flour_prefermented_pct"
    ? form.flourPct
    : form.totalPct / (1 + form.hydrationPct / 100);

  const hydration = form.hydrationPct / 100;
  const waterPctNeeded = prefFlourPct * hydration;

  const flourLines = lines.filter(l => l.line_group === "dough" && l.bakery_role === "flour");
  const liquidLines = lines.filter(l => l.line_group === "dough" && l.bakery_role === "liquid");
  const yeastLines = lines.filter(l => l.line_group === "dough" && l.bakery_role === "yeast");

  for (const l of flourLines) {
    const share = totalFlourPct ? Number(l.baker_pct || 0) / totalFlourPct : 0;
    const pref = prefFlourPct * share;
    updateLine(l.line_id, pref, Number(l.baker_pct || 0) - pref);
  }

  liquidLines.forEach((l, idx) => {
    const total = Number(l.baker_pct || 0);
    const pref = idx === 0 ? Math.min(waterPctNeeded, total) : 0;
    updateLine(l.line_id, pref, total - pref);
  });

  const yeastLine = yeastLines[0];
  if (yeastLine) {
    const total = Number(yeastLine.baker_pct || 0);
    const pref = form.yeastBase === "preferment_flour"
      ? Math.min(total, prefFlourPct * form.yeastPct / 100)
      : Math.min(total, form.yeastPct);
    updateLine(yeastLine.line_id, pref, total - pref);
  }
}

function updateLine(id, pref, final) {
  db.exec(`
    UPDATE bakery_recipe_lines
    SET preferment_pct=$pref, final_dough_pct=$final
    WHERE id=$id;
  `, { $id: id, $pref: round6(pref), $final: round6(final) });
}

function formData() {
  return {
    presetId: $("#prefermentPresetV38")?.value || "",
    type: $("#prefermentTypeV38")?.value || "",
    mode: $("#prefermentModeV38")?.value || "none",
    flourPct: num($("#prefermentFlourPctV38")?.value),
    totalPct: num($("#prefermentTotalPctV38")?.value),
    hydrationPct: num($("#prefermentHydrationPctV38")?.value),
    yeastTypeId: $("#prefermentYeastTypeV38")?.value || "YEAST_INSTANT_DRY",
    yeastPct: num($("#prefermentYeastPctV38")?.value),
    yeastBase: $("#prefermentYeastBaseV38")?.value || "total_flour"
  };
}

function setVal(id, value) {
  const el = $("#" + id);
  if (el) el.value = value ?? "";
}

function nullableNumber(value) {
  const v = String(value ?? "").trim();
  return v ? num(v) : null;
}

function nullIfEmpty(value) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function num(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round6(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000;
}

function formatMass(g) {
  const n = Number(g);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} kg`;
  }
  return `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} g`;
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
    detail: { source: "preferments-v3-8", message }
  }));
}

