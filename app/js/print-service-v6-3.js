import { esc, fmtMoney, fmtNumber } from "./ui.js?v=6729";

const PRINT_STYLE = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #202124; margin: 0; font-size: 10.2px; line-height: 1.28; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; padding: 10px 0; background: #fff; border-bottom: 1px solid #d7dce2; margin-bottom: 12px; }
  button { border: 1px solid #1f6feb; background: #1f6feb; color: #fff; padding: 7px 12px; border-radius: 8px; cursor: pointer; font-weight: 700; }
  .doc { max-width: 190mm; margin: 0 auto; }
  .sheet { page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .head { display: grid; grid-template-columns: 1fr auto; gap: 10px; border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
  .brand { font-size: 9.2px; color: #5f6b7a; text-transform: uppercase; letter-spacing: .025em; }
  h1 { margin: 3px 0 4px; font-size: 19px; line-height: 1.14; }
  h2, .section-title { margin: 13px 0 6px; font-size: 13.2px; border-bottom: 1px solid #cfd6dd; padding-bottom: 3px; break-after: avoid; page-break-after: avoid; }
  h3 { margin: 9px 0 5px; font-size: 11.5px; break-after: avoid; page-break-after: avoid; }
  .muted { color: #5f6b7a; }
  .right { text-align: right; padding-top: 2px; min-width: 42mm; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 7px 0; }
  .grid.three { grid-template-columns: repeat(3, 1fr); }
  .box { border: 1px solid #cfd6dd; border-radius: 8px; padding: 5px 6px; min-height: 34px; break-inside: avoid; page-break-inside: avoid; }
  .box b { display: block; font-size: 8.8px; color: #52606d; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 2px; }
  .box .value { font-size: 12.2px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 5px 0 8px; table-layout: fixed; break-inside: auto; page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th, td { border: 1px solid #cfd6dd; padding: 3px 4px; vertical-align: top; word-break: normal; overflow-wrap: break-word; }
  th { background: #eef2f6; font-size: 9px; text-align: left; }
  td.num, th.num { text-align: right; white-space: nowrap; overflow-wrap: normal; }
  .note { white-space: pre-wrap; border: 1px solid #d9dee5; border-radius: 8px; padding: 7px; min-height: 28px; background: #fbfcfd; }
  .recipe-photo-block { display: grid; grid-template-columns: minmax(0, 1fr) 44mm; gap: 8px; align-items: start; margin: 6px 0 8px; break-inside: avoid; page-break-inside: avoid; }
  .recipe-photo-block.only-photo { display: block; max-width: 58mm; margin-left: auto; margin-right: 0; }
  .recipe-photo-block img { display: block; width: 100%; max-height: 42mm; object-fit: contain; border: 1px solid #d7dce2; border-radius: 6px; background: #fff; }
  .recipe-photo-caption { margin-top: 3px; font-size: 8.2px; color: #5f6b7a; text-align: center; }
  .warn { border-left: 4px solid #d97706; padding: 6px 8px; background: #fff7ed; break-inside: avoid; page-break-inside: avoid; }
  .ok { border-left: 4px solid #14803c; padding: 6px 8px; background: #f0fdf4; break-inside: avoid; page-break-inside: avoid; }
  .page-break { page-break-before: always; break-before: page; }
  .order-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 6px 0 8px; break-inside: avoid; page-break-inside: avoid; }
  .order-sheet table { font-size: 9.2px; }
  .order-sheet .family-block { margin-top: 8px; break-inside: auto; page-break-inside: auto; }
  .order-sheet .family-title { margin: 10px 0 4px; padding: 4px 6px; border: 1px solid #cfd6dd; border-radius: 7px; background: #f6f8fa; font-size: 11.2px; font-weight: 800; break-after: avoid; page-break-after: avoid; }
  .order-sheet .clean-order-table th:nth-child(1), .order-sheet .clean-order-table td:nth-child(1) { width: 54%; }
  .order-sheet .clean-order-table th:nth-child(2), .order-sheet .clean-order-table td:nth-child(2) { width: 14%; }
  .order-sheet .clean-order-table th:nth-child(3), .order-sheet .clean-order-table td:nth-child(3) { width: 10%; }
  .order-sheet .clean-order-table th:nth-child(4), .order-sheet .clean-order-table td:nth-child(4) { width: 22%; }
  .technical-order-table th:nth-child(1), .technical-order-table td:nth-child(1) { width: 15%; }
  .technical-order-table th:nth-child(2), .technical-order-table td:nth-child(2) { width: 21%; }
  .technical-order-table th:nth-child(3), .technical-order-table td:nth-child(3) { width: 8%; }
  .technical-order-table th:nth-child(4), .technical-order-table td:nth-child(4) { width: 7%; }
  .technical-order-table th:nth-child(5), .technical-order-table td:nth-child(5) { width: 13%; }
  .technical-order-table th:nth-child(6), .technical-order-table td:nth-child(6) { width: 9%; }
  .technical-order-table th:nth-child(7), .technical-order-table td:nth-child(7) { width: 8%; }
  .technical-order-table th:nth-child(8), .technical-order-table td:nth-child(8) { width: 19%; }
  .elaboration-block { margin: 7px 0 10px; break-inside: avoid-page; page-break-inside: avoid; }
  .elaboration-block table { font-size: 9.2px; }
  .elaboration-block th:nth-child(1), .elaboration-block td:nth-child(1) { width: 72%; }
  .elaboration-block th:nth-child(2), .elaboration-block td:nth-child(2) { width: 28%; }
  .doc-kind-pill { display:inline-block; border:1px solid #1f2937; border-radius: 3px; padding: 2px 6px; font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 3px; }
  .teaching-sheet { break-inside: auto; page-break-inside: auto; }
  .teaching-sheet .head { margin-bottom: 8px; }
  .teaching-meta { display:grid; grid-template-columns: repeat(4, 1fr); gap:5px; margin: 7px 0 8px; }
  .teaching-note { color:#4b5563; font-size: 9.4px; margin: 5px 0 8px; }
  .recipe-table { font-size: 8.8px; table-layout: auto; }
  .recipe-table.cols-2 th:nth-child(1), .recipe-table.cols-2 td:nth-child(1) { width: 72%; }
  .recipe-table.cols-2 th:nth-child(2), .recipe-table.cols-2 td:nth-child(2) { width: 28%; }
  .recipe-table.cols-3 th:nth-child(1), .recipe-table.cols-3 td:nth-child(1) { width: 56%; }
  .recipe-table.cols-3 th:nth-child(2), .recipe-table.cols-3 td:nth-child(2) { width: 18%; }
  .recipe-table.cols-3 th:nth-child(3), .recipe-table.cols-3 td:nth-child(3) { width: 26%; }
  .recipe-table.cols-4 th:nth-child(1), .recipe-table.cols-4 td:nth-child(1) { width: 46%; }
  .recipe-table.cols-4 th:nth-child(2), .recipe-table.cols-4 td:nth-child(2) { width: 18%; }
  .recipe-table.cols-4 th:nth-child(3), .recipe-table.cols-4 td:nth-child(3) { width: 16%; }
  .recipe-table.cols-4 th:nth-child(4), .recipe-table.cols-4 td:nth-child(4) { width: 20%; }
  .recipe-table.cols-5 th:nth-child(1), .recipe-table.cols-5 td:nth-child(1) { width: 38%; }
  .recipe-table.cols-5 th:nth-child(2), .recipe-table.cols-5 td:nth-child(2) { width: 12%; }
  .recipe-table.cols-5 th:nth-child(3), .recipe-table.cols-5 td:nth-child(3) { width: 14%; }
  .recipe-table.cols-5 th:nth-child(4), .recipe-table.cols-5 td:nth-child(4) { width: 12%; }
  .recipe-table.cols-5 th:nth-child(5), .recipe-table.cols-5 td:nth-child(5) { width: 24%; }
  .technical-order-table { font-size: 8.2px; }
  .repeat-title th { background:#ffffff; color:#374151; font-size:9.4px; font-weight:800; text-transform:none; letter-spacing:.01em; }
  .unit-col { white-space: nowrap; }
  .process-list { margin: 4px 0 8px 18px; padding: 0; }
  .process-list li { margin: 2px 0; break-inside: avoid; page-break-inside: avoid; }
  .compact-muted { font-size: 8.8px; color: #6b7280; }
  .subrecipe-row td { background: #fff8ed; font-weight: 800; border-top: 1.5px solid #cfd6dd; }
  .subrecipe-child td { background: #fffdf8; }
  .subrecipe-child td:first-child { padding-left: 16px; }
  .subrecipe-child.depth-2 td:first-child { padding-left: 28px; }
  .subrecipe-child.depth-3 td:first-child { padding-left: 40px; }
  .tree-label { display: inline; }
  .block-note { margin: 4px 0 8px; color: #6b7280; font-size: 9px; border: 1px dashed #cfd6dd; border-radius: 7px; padding: 5px 7px; background:#fbfcfd; }
  @media print {
    .toolbar { display: none; }
    body { font-size: 9.4px; }
    h1 { font-size: 17px; }
    h2, .section-title { font-size: 12.4px; }
    th { font-size: 8.5px; }
    table { break-inside: auto; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr, .box { break-inside: avoid; page-break-inside: avoid; }
    .order-sheet table, .elaboration-block table { font-size: 8.6px; }
    .order-summary { break-inside: avoid; page-break-inside: avoid; }
  }

`;

const PRINT_DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatPrintDate(value = new Date()) {
  if (!value) return "—";
  if (value instanceof Date) return PRINT_DATE_FORMATTER.format(value);
  const raw = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : PRINT_DATE_FORMATTER.format(d);
}

function sentenceCaseEs(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin grupo";
  if (raw.toLocaleLowerCase("es") === "sin grupo") return "Sin grupo";
  const lower = raw.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}

export function printBakeryRecipe(db, recipeId) {
  const recipe = one(db, `
    SELECT br.*, tf.name AS family, tsf.name AS subfamily
    FROM bakery_recipes br
    LEFT JOIN technical_families tf ON tf.id=br.family_id
    LEFT JOIN technical_subfamilies tsf ON tsf.id=br.subfamily_id
    WHERE br.id=$id;
  `, { $id: recipeId });
  if (!recipe) throw new Error("No se encontró la formulación panadera.");

  const validation = one(db, "SELECT * FROM v_bakery_formula_validation WHERE recipe_id=$id;", { $id: recipeId }) || {};
  const totals = one(db, "SELECT * FROM v_bakery_dough_totals_v35 WHERE recipe_id=$id;", { $id: recipeId }) || {};
  const preferment = one(db, "SELECT * FROM v_bakery_preferment_totals_v35 WHERE recipe_id=$id;", { $id: recipeId }) || {};
  const margins = one(db, "SELECT * FROM v_bakery_recipe_margins WHERE recipe_id=$id;", { $id: recipeId }) || {};
  const doughRows = db.query(`
    SELECT ingredient, bakery_role, baker_pct, preferment_pct, final_dough_pct, preview_total_g, preview_preferment_g, preview_final_dough_g, effective_water_total_g
    FROM v_bakery_formula_lines_v35
    WHERE recipe_id=$id AND line_group='dough'
    ORDER BY sort_order, ingredient;
  `, { $id: recipeId });
  const extraRows = db.query(`
    SELECT ingredient, line_group, calculation_base, quantity_value, preview_total_g, sort_order
    FROM v_bakery_formula_lines_v35
    WHERE recipe_id=$id AND line_group<>'dough'
    ORDER BY sort_order, ingredient;
  `, { $id: recipeId });
  const process = db.query(`
    SELECT block, step_number, instruction, duration_min, temperature_c, notes
    FROM bakery_process_steps
    WHERE recipe_id=$id
    ORDER BY CASE block WHEN 'preferment' THEN 1 WHEN 'final_dough' THEN 2 WHEN 'other' THEN 3 WHEN 'baking' THEN 4 ELSE 5 END, step_number;
  `, { $id: recipeId });
  const allergens = allergensForBakery(db, recipeId);

  const quality = Math.abs(Number(validation.flour_pct_total || 0) - 100) <= 0.001
    ? `<div class="ok">Harinas al 100 %. Hidratación real: ${fmtPct(validation.real_hydration_pct)}.</div>`
    : `<div class="warn">Revisar fórmula: harinas = ${fmtPct(validation.flour_pct_total)}; deberían sumar 100 %.</div>`;

  const html = docHtml(`${recipe.name} · ficha panadera`, `
    <section class="sheet">
      ${header("Ficha técnica panadera", recipe.name, [recipe.family, recipe.subfamily].filter(Boolean).join(" · "))}
      ${recipeMediaBlock(db, "bakery", recipe.id)}
      <div class="grid">
        ${box("Harina base", mass(recipe.base_flour_g))}
        ${box("Masa total base", mass(totals.preview_dough_total_g))}
        ${box("Hidratación real", fmtPct(validation.real_hydration_pct))}
        ${box("Temp. masa", recipe.target_dough_temp_c ? `${fmtNumber(recipe.target_dough_temp_c,1)} °C` : "—")}
        ${box("Coste ingredientes", fmtMoney(margins.ingredient_cost_total))}
        ${box("Coste total", fmtMoney(margins.total_cost))}
        ${box("Precio sugerido", fmtMoney(margins.suggested_sale_price))}
        ${box("Estado", statusLabel(recipe.status))}
      </div>
      ${quality}
      <h2>Fórmula panadera</h2>
      ${tableHtml(["Ingrediente", "Rol", "%", "Prefermento", "Masa final", "Cantidad base", "Agua efectiva"], doughRows.map(r => [
        r.ingredient, role(r.bakery_role), fmtNumber(r.baker_pct,3), fmtNumber(r.preferment_pct,3), fmtNumber(r.final_dough_pct,3), mass(r.preview_total_g), mass(r.effective_water_total_g)
      ]), [2,3,4,5,6])}
      <h2>Prefermento</h2>
      <div class="grid three">
        ${box("Tipo", preferment.preferment_type || "Sin prefermento")}
        ${box("Harina prefermentada", fmtPct(preferment.actual_preferment_flour_pct))}
        ${box("Hidratación prefermento", fmtPct(preferment.actual_preferment_hydration_pct))}
        ${box("Tiempo", preferment.time_hours ? `${fmtNumber(preferment.time_hours,1)} h` : "—")}
        ${box("Temperatura", preferment.temperature_c ? `${fmtNumber(preferment.temperature_c,1)} °C` : "—")}
        ${box("Levadura", preferment.yeast_pct ? `${fmtNumber(preferment.yeast_pct,3)} %` : "—")}
      </div>
      <h2>Acabados / fuera de masa</h2>
      ${extraRows.length ? tableHtml(["Ingrediente", "Grupo", "Base cálculo", "Valor", "Cantidad base"], extraRows.map(r => [r.ingredient, groupName(r.line_group), baseName(r.calculation_base), fmtNumber(r.quantity_value,3), mass(r.preview_total_g)]), [3,4]) : `<p class="muted">Sin rellenos, coberturas, decoraciones ni otros elementos fuera de masa.</p>`}
      <h2>Proceso técnico</h2>
      ${process.length ? tableHtml(["Bloque", "Paso", "Instrucción", "Tiempo", "Temp.", "Notas"], process.map(p => [blockName(p.block), p.step_number, p.instruction, p.duration_min ? `${fmtNumber(p.duration_min,0)} min` : "", p.temperature_c ? `${fmtNumber(p.temperature_c,1)} °C` : "", p.notes || ""]), [1,3,4]) : `<p class="muted">Proceso no registrado.</p>`}
      <h2>Alérgenos y notas</h2>
      <div class="note"><b>Alérgenos declarados:</b> ${esc(allergens || "Sin alérgenos registrados en ingredientes.")}\n\n${esc(recipe.notes || "Sin notas técnicas.")}</div>
    </section>
  `);
  recordPrintJob(db, { sourceType: "recipe", sourceId: recipeId, profile: "docente", title: `Ficha panadera · ${recipe.name}`, totalCost: margins.total_cost || margins.ingredient_cost_total || 0, itemCount: 1, items: [{ itemType: "bakery", bakeryRecipeId: recipeId, itemName: recipe.name }] });
  openPrintWindow(html);
}

export function printCulinaryRecipe(db, recipeId) {
  const recipe = one(db, `
    SELECT cr.*, tf.name AS family, tsf.name AS subfamily
    FROM culinary_recipes cr
    LEFT JOIN technical_families tf ON tf.id=cr.family_id
    LEFT JOIN technical_subfamilies tsf ON tsf.id=cr.subfamily_id
    WHERE cr.id=$id;
  `, { $id: recipeId });
  if (!recipe) throw new Error("No se encontró la ficha culinaria.");
  const totals = one(db, "SELECT * FROM v_culinary_recipe_totals WHERE recipe_id=$id;", { $id: recipeId }) || {};
  const lines = db.query(`
    SELECT clc.ingredient, clc.quantity, clc.unit, clc.waste_pct, clc.estimated_cost, crl.technical_note, via.allergens
    FROM v_culinary_line_costs clc
    JOIN culinary_recipe_lines crl ON crl.id=clc.line_id
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=clc.ingredient_id
    WHERE clc.recipe_id=$id
    ORDER BY clc.sort_order, clc.ingredient;
  `, { $id: recipeId });
  const allergens = normalizeAllergens(lines.flatMap(l => splitSemi(l.allergens))).join("; ");

  const html = docHtml(`${recipe.name} · ficha culinaria`, `
    <section class="sheet">
      ${header("Ficha técnica de cocina/pastelería", recipe.name, [recipe.family, recipe.subfamily].filter(Boolean).join(" · "))}
      ${recipeMediaBlock(db, "culinary", recipe.id)}
      <div class="grid">
        ${box("Raciones base", fmtNumber(recipe.base_servings,0))}
        ${box("Peso/ración", recipe.serving_weight_g ? `${fmtNumber(recipe.serving_weight_g,0)} g` : "—")}
        ${box("Coste/ración", fmtMoney(totals.cost_per_serving))}
        ${box("Coste total", fmtMoney(totals.total_cost))}
        ${box("Ingredientes", fmtMoney(totals.ingredient_cost_total))}
        ${box("Mano de obra", fmtMoney(totals.labor_cost))}
        ${box("Gastos generales", fmtMoney(totals.overhead_cost))}
        ${box("Precio sugerido", fmtMoney(totals.suggested_sale_price_total))}
      </div>
      <h2>Escandallo</h2>
      ${tableHtml(["Ingrediente", "Cantidad base", "Merma", "Coste", "Alérgenos", "Nota"], lines.map(l => [
        l.ingredient, `${fmtNumber(l.quantity,2)} ${l.unit || "g"}`, fmtPct(l.waste_pct), fmtMoney(l.estimated_cost), l.allergens || "", l.technical_note || ""
      ]), [1,2,3])}
      <h2>Proceso técnico</h2><div class="note">${esc(recipe.process || "Sin proceso técnico descrito.")}</div>
      <h2>Servicio / conservación</h2><div class="note">${esc(recipe.service_notes || "Sin notas de servicio/conservación.")}</div>
      <h2>APPCC / puntos críticos</h2><div class="note">${esc(recipe.appcc_notes || "Sin puntos críticos descritos.")}</div>
      <h2>Alérgenos y observaciones</h2><div class="note"><b>Alérgenos declarados:</b> ${esc(allergens || "Sin alérgenos registrados en ingredientes.")}\n\n${esc(recipe.notes || "Sin observaciones.")}</div>
    </section>
  `);
  recordPrintJob(db, { sourceType: "recipe", sourceId: recipeId, profile: "docente", title: `Ficha culinaria · ${recipe.name}`, totalCost: totals.total_cost || totals.ingredient_cost_total || 0, itemCount: 1, items: [{ itemType: "culinary", culinaryRecipeId: recipeId, itemName: recipe.name }] });
  openPrintWindow(html);
}

export function printClassSession(db, sessionId, { includeOrder = true, includeItemSheets = false, includeSessionData = true, record = true, includeElaborations = true, subrecipeMode = "expanded", processMode = "show" } = {}) {
  const session = one(db, `
    SELECT cs.*, fc.name AS cycle, fm.module_code, fm.module_name
    FROM class_sessions cs
    LEFT JOIN fp_cycles fc ON fc.id=cs.cycle_id
    LEFT JOIN fp_modules fm ON fm.id=cs.module_id
    WHERE cs.id=$id;
  `, { $id: sessionId });
  if (!session) throw new Error("No se encontró la sesión.");
  const summary = one(db, "SELECT * FROM v_class_session_summary WHERE session_id=$id;", { $id: sessionId }) || {};
  const items = db.query("SELECT * FROM v_print_class_items WHERE session_id=$id ORDER BY sort_order, item_name;", { $id: sessionId });
  const order = classOrderRows(db, sessionId);
  const itemDetails = db.query(`
    SELECT session_item_id, recipe_name, item_type, ingredient, required_g, unit, estimated_cost
    FROM v_class_order_lines
    WHERE session_id=$id
    ORDER BY item_sort_order, recipe_name, ingredient;
  `, { $id: sessionId });
  const bakeryItemDetails = db.query(`
    SELECT bl.*, via.allergens
    FROM v_class_bakery_item_lines bl
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=bl.ingredient_id
    WHERE bl.session_id=$id
    ORDER BY bl.item_sort_order,
      CASE COALESCE(bl.line_group,'dough') WHEN 'dough' THEN 1 WHEN 'filling' THEN 2 WHEN 'topping' THEN 3 WHEN 'decoration' THEN 4 ELSE 5 END,
      bl.ingredient;
  `, { $id: sessionId });

  const byItem = groupBy(itemDetails, r => r.session_item_id);
  const bakeryByItem = groupBy(bakeryItemDetails, r => r.session_item_id);
  const generatedTitle = /^Práctica \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(session.title || ""));
  const printTitle = includeSessionData && session.title && !generatedTitle ? session.title : "Práctica de aula-taller";
  const practiceDateLabel = session.practice_date ? formatPrintDate(session.practice_date) : "Sin fecha";
  const subtitleParts = includeSessionData ? [practiceDateLabel, [session.module_code, session.module_name].filter(Boolean).join(" · ")].filter(Boolean) : [practiceDateLabel];
  let body = `
    <section class="sheet">
      ${header("Orden de producción", printTitle, subtitleParts.join(" · "))}
      <div class="grid">
        ${includeSessionData ? box("Ciclo", session.cycle || "—") : ""}
        ${includeSessionData ? box("Grupo", session.group_name || "—") : ""}
        ${includeSessionData ? box("Responsable", session.responsible || "—") : ""}
        ${box("Coste estimado", fmtMoney(summary.estimated_order_cost))}
        ${box("Elaboraciones", fmtNumber(summary.total_items,0))}
        ${box("Panadería", fmtNumber(summary.bakery_items,0))}
        ${box("Cocina/Pastelería", fmtNumber(summary.culinary_items,0))}
        ${box("Impresión", formatPrintDate())}
      </div>
      ${includeElaborations ? `
        <h2>Elaboraciones</h2>
        ${productionItemsTable(items)}
        <h2>Ingredientes por elaboración</h2>
        ${productionDetailBlocks(db, items, byItem, bakeryByItem, { subrecipeMode, processMode })}
      ` : ""}
      ${includeSessionData && meaningfulNote(session.notes) ? `<h2>Notas de la práctica</h2><div class="note">${esc(session.notes)}</div>` : ""}
    </section>
  `;
  if (includeOrder) body += orderSection(order, true);
  if (includeItemSheets) {
    for (const i of items.filter(x => x.print_a4)) {
      if (i.item_type === "bakery") body += bakerySheetForSession(db, i.item_name, i);
      if (i.item_type === "culinary") body += culinarySheetForSession(db, i.item_name, i);
    }
  }
  if (record) recordPrintJob(db, { sourceType: "session", sourceId: sessionId, profile: "docente", title: `Sesión · ${printTitle}`, totalCost: summary.estimated_order_cost || 0, itemCount: items.length, items: items.map(i => ({ itemType: i.item_type, culinaryRecipeId: i.culinary_recipe_id, bakeryRecipeId: i.bakery_recipe_id, itemName: i.item_name, productionMode: i.production_mode, quantityLabel: itemQty(i), notes: i.notes })) });
  openPrintWindow(docHtml(`${session.title} · sesión`, body));
}

export function printClassOrder(db, sessionId = null) {
  const order = classOrderRows(db, sessionId);
  const title = sessionId ? (one(db, "SELECT title FROM class_sessions WHERE id=$id;", { $id: sessionId })?.title || "Pedido de sesión") : "Pedido agrupado de clase";
  const body = orderSection(order, false, title);
  recordPrintJob(db, { sourceType: "order", sourceId: sessionId || "global", profile: "docente", title: `${title} · pedido`, totalCost: order.reduce((a,r)=>a+Number(r.estimated_cost_total||0),0), itemCount: order.length, items: [] });
  openPrintWindow(docHtml(`${title} · pedido`, body));
}


export function printWorkSelection(db, selectionId = "WORK_CURRENT", { includeOrder = true, includeElaborations = true, includePracticeData = true, profile = "docente", metadata = null, subrecipeMode = "expanded", processMode = "show" } = {}) {
  const rows = selectionRows(db, selectionId);
  if (!rows.length) throw new Error("La práctica actual está vacía.");
  if (!includeElaborations && !includeOrder) throw new Error("Selecciona elaboraciones, pedido o ambos para imprimir.");
  const tempId = `TMP_SELECTION_${Date.now()}`;
  const title = metadata?.title || "Práctica actual";
  createTempSessionFromSelection(db, tempId, rows, title, metadata);
  try {
    if (includeElaborations) {
      printClassSession(db, tempId, { includeOrder, includeItemSheets: false, includeSessionData: Boolean(metadata) && includePracticeData, includeElaborations: true, record: false, subrecipeMode, processMode });
    } else {
      const order = classOrderRows(db, tempId);
      openPrintWindow(docHtml(`${title} · pedido`, orderSection(order, false, `Pedido · ${title}`)));
    }
  } finally {
    db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  }
  const total = rows.reduce((a,r)=>a+Number(r.estimated_cost||0),0);
  recordPrintJob(db, { sourceType: "selection", sourceId: selectionId, profile, title: metadata?.title || "Práctica actual", totalCost: total, itemCount: rows.length, items: rows.map(r => ({ itemType: r.item_type, culinaryRecipeId: r.culinary_recipe_id, bakeryRecipeId: r.bakery_recipe_id, itemName: r.item_name, productionMode: r.production_mode, quantityLabel: itemQty(r), notes: r.notes })) });
}

export function printWorkSelectionOrder(db, selectionId = "WORK_CURRENT", { profile = "docente", metadata = null } = {}) {
  const rows = selectionRows(db, selectionId);
  if (!rows.length) throw new Error("La práctica actual está vacía.");
  const tempId = `TMP_SELECTION_${Date.now()}`;
  const title = metadata?.title || "Práctica actual";
  createTempSessionFromSelection(db, tempId, rows, title, metadata);
  let order = [];
  try {
    order = classOrderRows(db, tempId);
    openPrintWindow(docHtml(`${title} · pedido`, orderSection(order, false, `Pedido · ${title}`)));
  } finally {
    db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  }
  recordPrintJob(db, { sourceType: "selection", sourceId: selectionId, profile, title: `Pedido · ${title}`, totalCost: order.reduce((a,r)=>a+Number(r.estimated_cost_total||0),0), itemCount: rows.length, items: rows.map(r => ({ itemType: r.item_type, culinaryRecipeId: r.culinary_recipe_id, bakeryRecipeId: r.bakery_recipe_id, itemName: r.item_name, productionMode: r.production_mode, quantityLabel: itemQty(r), notes: r.notes })) });
}

export function printWorkSelectionTechnicalOrder(db, selectionId = "WORK_CURRENT", { profile = "pedido_tecnico", metadata = null } = {}) {
  const rows = selectionRows(db, selectionId);
  if (!rows.length) throw new Error("La práctica actual está vacía.");
  const tempId = `TMP_SELECTION_${Date.now()}`;
  const title = metadata?.title || "Práctica actual";
  createTempSessionFromSelection(db, tempId, rows, title, metadata);
  let order = [];
  try {
    order = classOrderRows(db, tempId);
    openPrintWindow(docHtml(`${title} · pedido técnico`, orderSection(order, false, `Pedido técnico · ${title}`, { technical: true })));
  } finally {
    db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  }
  recordPrintJob(db, { sourceType: "selection", sourceId: selectionId, profile, title: `Pedido técnico · ${title}`, totalCost: order.reduce((a,r)=>a+Number(r.estimated_cost_total||0),0), itemCount: rows.length, items: rows.map(r => ({ itemType: r.item_type, culinaryRecipeId: r.culinary_recipe_id, bakeryRecipeId: r.bakery_recipe_id, itemName: r.item_name, productionMode: r.production_mode, quantityLabel: itemQty(r), notes: r.notes })) });
}

export function printWorkSelectionTeachingSheets(db, selectionId = "WORK_CURRENT", { profile = "ficha_docente_completa", metadata = null, includePracticeData = true, subrecipeMode = "expanded", processMode = "show" } = {}) {
  const rows = selectionRows(db, selectionId);
  if (!rows.length) throw new Error("La práctica actual está vacía.");
  const tempId = `TMP_SELECTION_${Date.now()}`;
  const title = metadata?.title || "Práctica actual";
  createTempSessionFromSelection(db, tempId, rows, title, metadata);
  let body = "";
  let totalCost = 0;
  let items = [];
  try {
    const session = one(db, `
      SELECT cs.*, fc.name AS cycle, fm.module_code, fm.module_name
      FROM class_sessions cs
      LEFT JOIN fp_cycles fc ON fc.id=cs.cycle_id
      LEFT JOIN fp_modules fm ON fm.id=cs.module_id
      WHERE cs.id=$id;
    `, { $id: tempId }) || {};
    const summary = one(db, "SELECT * FROM v_class_session_summary WHERE session_id=$id;", { $id: tempId }) || {};
    items = db.query("SELECT * FROM v_print_class_items WHERE session_id=$id ORDER BY sort_order, item_name;", { $id: tempId });
    const lines = db.query(`
      SELECT ol.*, via.allergens
      FROM v_class_order_lines ol
      LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=ol.ingredient_id
      WHERE ol.session_id=$id
      ORDER BY ol.item_sort_order, ol.recipe_name, ol.ingredient;
    `, { $id: tempId });
    const bakeryLines = db.query(`
      SELECT bl.*, via.allergens
      FROM v_class_bakery_item_lines bl
      LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=bl.ingredient_id
      WHERE bl.session_id=$id
      ORDER BY bl.item_sort_order,
        CASE COALESCE(bl.line_group,'dough') WHEN 'dough' THEN 1 WHEN 'filling' THEN 2 WHEN 'topping' THEN 3 WHEN 'decoration' THEN 4 ELSE 5 END,
        bl.ingredient;
    `, { $id: tempId });
    const byItem = groupBy(lines, r => r.session_item_id);
    const bakeryByItem = groupBy(bakeryLines, r => r.session_item_id);
    totalCost = Number(summary.estimated_order_cost || 0);
    const practiceDateLabel = session.practice_date ? formatPrintDate(session.practice_date) : formatPrintDate();
    const moduleLabel = [session.module_code, session.module_name].filter(Boolean).join(" · ");
    const subtitle = includePracticeData ? [practiceDateLabel, session.group_name, moduleLabel].filter(Boolean).join(" · ") : practiceDateLabel;
    body += `
      <section class="sheet teaching-sheet">
        ${header("Ficha docente completa", includePracticeData ? title : "Práctica de aula-taller", subtitle)}
        <div class="grid">
          ${includePracticeData ? box("Ciclo", session.cycle || "—") : ""}
          ${includePracticeData ? box("Grupo", session.group_name || "—") : ""}
          ${includePracticeData ? box("Responsable", session.responsible || "—") : ""}
          ${box("Elaboraciones", fmtNumber(items.length,0))}
          ${box("Panadería", fmtNumber(items.filter(i => i.item_type === "bakery").length,0))}
          ${box("Cocina/Pastelería", fmtNumber(items.filter(i => i.item_type === "culinary").length,0))}
          ${box("Coste estimado", fmtMoney(totalCost))}
        </div>
        <p class="teaching-note">Perfil docente completo: incluye escandallo/formulación, coste por línea, alérgenos declarados y proceso técnico cuando existe en la ficha. Para pedido operativo usa el perfil “Pedido limpio”.</p>
        <h2>Elaboraciones incluidas</h2>
        ${productionItemsTable(items)}
      </section>`;
    for (const item of items) {
      body += item.item_type === "bakery"
        ? bakeryTeachingSheet(db, item, bakeryByItem[item.session_item_id] || byItem[item.session_item_id] || [], { processMode })
        : culinaryTeachingSheet(db, item, byItem[item.session_item_id] || [], { subrecipeMode, processMode });
    }
    openPrintWindow(docHtml(`${title} · ficha docente completa`, body));
  } finally {
    db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  }
  recordPrintJob(db, { sourceType: "selection", sourceId: selectionId, profile, title: `Ficha docente completa · ${title}`, totalCost, itemCount: items.length || rows.length, items: rows.map(r => ({ itemType: r.item_type, culinaryRecipeId: r.culinary_recipe_id, bakeryRecipeId: r.bakery_recipe_id, itemName: r.item_name, productionMode: r.production_mode, quantityLabel: itemQty(r), notes: r.notes })) });
}



export function printWorkSelectionTeachingSheetsWithOrder(db, selectionId = "WORK_CURRENT", { profile = "ficha_docente_mas_pedido", metadata = null, includePracticeData = true, subrecipeMode = "expanded", processMode = "show" } = {}) {
  const rows = selectionRows(db, selectionId);
  if (!rows.length) throw new Error("La práctica actual está vacía.");
  const tempId = `TMP_SELECTION_${Date.now()}`;
  const title = metadata?.title || "Práctica actual";
  createTempSessionFromSelection(db, tempId, rows, title, metadata);
  let body = "";
  let totalCost = 0;
  let items = [];
  let order = [];
  try {
    const session = one(db, `
      SELECT cs.*, fc.name AS cycle, fm.module_code, fm.module_name
      FROM class_sessions cs
      LEFT JOIN fp_cycles fc ON fc.id=cs.cycle_id
      LEFT JOIN fp_modules fm ON fm.id=cs.module_id
      WHERE cs.id=$id;
    `, { $id: tempId }) || {};
    const summary = one(db, "SELECT * FROM v_class_session_summary WHERE session_id=$id;", { $id: tempId }) || {};
    items = db.query("SELECT * FROM v_print_class_items WHERE session_id=$id ORDER BY sort_order, item_name;", { $id: tempId });
    const lines = db.query(`
      SELECT ol.*, via.allergens
      FROM v_class_order_lines ol
      LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=ol.ingredient_id
      WHERE ol.session_id=$id
      ORDER BY ol.item_sort_order, ol.recipe_name, ol.ingredient;
    `, { $id: tempId });
    const bakeryLines = db.query(`
      SELECT bl.*, via.allergens
      FROM v_class_bakery_item_lines bl
      LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=bl.ingredient_id
      WHERE bl.session_id=$id
      ORDER BY bl.item_sort_order,
        CASE COALESCE(bl.line_group,'dough') WHEN 'dough' THEN 1 WHEN 'filling' THEN 2 WHEN 'topping' THEN 3 WHEN 'decoration' THEN 4 ELSE 5 END,
        bl.ingredient;
    `, { $id: tempId });
    const byItem = groupBy(lines, r => r.session_item_id);
    const bakeryByItem = groupBy(bakeryLines, r => r.session_item_id);
    totalCost = Number(summary.estimated_order_cost || 0);
    const practiceDateLabel = session.practice_date ? formatPrintDate(session.practice_date) : formatPrintDate();
    const moduleLabel = [session.module_code, session.module_name].filter(Boolean).join(" · ");
    const subtitle = includePracticeData ? [practiceDateLabel, session.group_name, moduleLabel].filter(Boolean).join(" · ") : practiceDateLabel;
    body += `
      <section class="sheet teaching-sheet">
        ${header("Ficha técnica completa + pedido completo", includePracticeData ? title : "Práctica de aula-taller", subtitle)}
        <div class="grid">
          ${includePracticeData ? box("Ciclo", session.cycle || "—") : ""}
          ${includePracticeData ? box("Grupo", session.group_name || "—") : ""}
          ${includePracticeData ? box("Responsable", session.responsible || "—") : ""}
          ${box("Elaboraciones", fmtNumber(items.length,0))}
          ${box("Panadería", fmtNumber(items.filter(i => i.item_type === "bakery").length,0))}
          ${box("Cocina/Pastelería", fmtNumber(items.filter(i => i.item_type === "culinary").length,0))}
          ${box("Coste estimado", fmtMoney(totalCost))}
        </div>
        <p class="teaching-note">Dossier completo: incluye fichas técnicas con coste, unidades visibles, alérgenos y proceso; al final incorpora el pedido completo con proveedor, zona, coste y origen/usado en.</p>
        <h2>Elaboraciones incluidas</h2>
        ${productionItemsTable(items)}
      </section>`;
    for (const item of items) {
      body += item.item_type === "bakery"
        ? bakeryTeachingSheet(db, item, bakeryByItem[item.session_item_id] || byItem[item.session_item_id] || [], { processMode })
        : culinaryTeachingSheet(db, item, byItem[item.session_item_id] || [], { subrecipeMode, processMode });
    }
    order = classOrderRows(db, tempId);
    body += orderSection(order, true, `Pedido completo · ${title}`, { technical: true });
    openPrintWindow(docHtml(`${title} · ficha técnica completa + pedido completo`, body));
  } finally {
    db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  }
  recordPrintJob(db, { sourceType: "selection", sourceId: selectionId, profile, title: `Ficha técnica completa + pedido completo · ${title}`, totalCost: totalCost || order.reduce((a,r)=>a+Number(r.estimated_cost_total||0),0), itemCount: items.length || rows.length, items: rows.map(r => ({ itemType: r.item_type, culinaryRecipeId: r.culinary_recipe_id, bakeryRecipeId: r.bakery_recipe_id, itemName: r.item_name, productionMode: r.production_mode, quantityLabel: itemQty(r), notes: r.notes })) });
}



function recipeMediaBlock(db, recipeKind, recipeId) {
  try {
    const exists = one(db, "SELECT name FROM sqlite_schema WHERE type='table' AND name='recipe_media';");
    if (!exists || !recipeId) return "";
    const media = one(db, `
      SELECT ma.data, ma.mime_type, ma.file_name, ma.width, ma.height, ma.size_bytes,
             rm.caption, rm.alt_text, rm.role
      FROM recipe_media rm
      JOIN media_assets ma ON ma.id=rm.media_id
      WHERE rm.recipe_kind=$kind AND rm.recipe_id=$id
      ORDER BY CASE rm.role WHEN 'primary' THEN 1 ELSE 2 END, rm.sort_order
      LIMIT 1;
    `, { $kind: recipeKind, $id: recipeId });
    if (!media?.data) return "";
    const src = mediaDataUrl(media);
    if (!src) return "";
    const caption = media.caption || media.file_name || "Foto de elaboración";
    return `<div class="recipe-photo-block only-photo"><img src="${src}" alt="${esc(media.alt_text || caption)}"><div class="recipe-photo-caption">${esc(caption)}</div></div>`;
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo recuperar la foto BLOB de la ficha.", err);
    return "";
  }
}

function mediaDataUrl(row) {
  const bytes = blobBytes(row.data);
  if (!bytes?.length) return "";
  return `data:${String(row.mime_type || "image/jpeg")};base64,${bytesToBase64(bytes)}`;
}

function blobBytes(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value?.buffer instanceof ArrayBuffer) return new Uint8Array(value.buffer, value.byteOffset || 0, value.byteLength || value.buffer.byteLength);
  return null;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function culinaryTeachingSheet(db, item, lines, { subrecipeMode = "expanded", processMode = "show" } = {}) {
  const recipe = one(db, `
    SELECT cr.*, tf.name AS family, tsf.name AS subfamily, yu.symbol AS yield_unit
    FROM culinary_recipes cr
    LEFT JOIN technical_families tf ON tf.id=cr.family_id
    LEFT JOIN technical_subfamilies tsf ON tsf.id=cr.subfamily_id
    LEFT JOIN units yu ON yu.id=cr.yield_unit_id
    WHERE cr.id=$id;
  `, { $id: item.culinary_recipe_id }) || {};
  const totalCost = sumRows(lines, "estimated_cost");
  const allergens = normalizeAllergens(lines.flatMap(l => splitSemi(l.allergens))).join("; ");
  const perServing = item.servings ? totalCost / Number(item.servings || 1) : null;
  const detailRows = culinaryRecipeDetailRows(db, item, { subrecipeMode });
  return `
    <section class="sheet teaching-sheet">
      ${header("Ficha completa", item.item_name, [itemQty(item), recipe.family, recipe.subfamily].filter(Boolean).join(" · "))}
      ${recipeMediaBlock(db, "culinary", item.culinary_recipe_id)}
      <div class="grid">
        ${box("Producción", itemQty(item))}
        ${box("Coste total", fmtMoney(totalCost))}
        ${box("Coste/ración", perServing ? fmtMoney(perServing) : "—")}
        ${box("Alérgenos", allergens ? fmtNumber(splitSemi(allergens).length,0) : "Sin alérgenos declarables")}
      </div>
      <h2>Escandallo / formulación</h2>
      ${culinaryDetailTable(detailRows, { includeCost: true, includeAllergens: true })}
      ${processMode === "hide" ? "" : processBlockFromText("Proceso", recipe.process)}
      ${processMode === "hide" ? "" : processBlockFromText("Servicio / conservación", recipe.service_notes)}
      ${processMode === "hide" ? "" : processBlockFromText("APPCC / puntos críticos", recipe.appcc_notes)}
      ${recipe.notes ? `<h2>Observaciones</h2><div class="note">${esc(recipe.notes)}</div>` : ""}
    </section>`;
}

function bakeryTeachingSheet(db, item, lines, { processMode = "show" } = {}) {
  const recipe = one(db, `
    SELECT br.*, tf.name AS family, tsf.name AS subfamily
    FROM bakery_recipes br
    LEFT JOIN technical_families tf ON tf.id=br.family_id
    LEFT JOIN technical_subfamilies tsf ON tsf.id=br.subfamily_id
    WHERE br.id=$id;
  `, { $id: item.bakery_recipe_id }) || {};
  const validation = one(db, "SELECT * FROM v_bakery_formula_validation WHERE recipe_id=$id;", { $id: item.bakery_recipe_id }) || {};
  const preferment = one(db, "SELECT * FROM v_bakery_preferment_totals_v35 WHERE recipe_id=$id;", { $id: item.bakery_recipe_id }) || {};
  const process = db.query(`
    SELECT block, step_number, instruction, duration_min, temperature_c, notes
    FROM bakery_process_steps
    WHERE recipe_id=$id
    ORDER BY CASE block WHEN 'preferment' THEN 1 WHEN 'final_dough' THEN 2 WHEN 'other' THEN 3 WHEN 'baking' THEN 4 ELSE 5 END, step_number;
  `, { $id: item.bakery_recipe_id });
  const totalCost = sumRows(lines, "estimated_cost");
  const allergens = normalizeAllergens(lines.flatMap(l => splitSemi(l.allergens))).join("; ") || allergensForBakery(db, item.bakery_recipe_id);
  const effectiveFlour = lines.find(l => Number(l.effective_flour_g || 0) > 0)?.effective_flour_g || item.flour_g;
  return `
    <section class="sheet teaching-sheet">
      ${header("Formulación completa", item.item_name, [itemQty(item), recipe.family, recipe.subfamily].filter(Boolean).join(" · "))}
      ${recipeMediaBlock(db, "bakery", item.bakery_recipe_id)}
      <div class="grid">
        ${box("Producción", itemQty(item))}
        ${box("Harina base", effectiveFlour ? mass(effectiveFlour) : "—")}
        ${box("Agua en masa estimada", fmtPct(validation.real_hydration_pct))}
        ${box("Coste", fmtMoney(totalCost))}
      </div>
      ${bakeryPrefermentTeachingNote(preferment)}
      <h2>Formulación por bloques</h2>
      ${bakeryStructuredBlocks(db, item, lines, { includeCost: true, includeAllergens: true })}
      ${processMode === "hide" ? "" : (process.length ? processBlocks(process) : processBlockFromText("Proceso", recipe.notes))}
      ${allergens ? `<h2>Alérgenos</h2><div class="note">${esc(allergens)}</div>` : ""}
    </section>`;
}



function bakeryPrefermentTeachingNote(preferment = {}) {
  const type = String(preferment.preferment_type || "").trim();
  const flourPct = Number(preferment.actual_preferment_flour_pct || 0);
  const hydrationPct = Number(preferment.actual_preferment_hydration_pct || 0);
  if (!type && !flourPct) return "";
  if (flourPct <= 0.0001 || /m[eé]todo directo|levadura directa/i.test(type)) {
    return `<p class="teaching-note"><b>Método:</b> Método directo · sin prefermento.</p>`;
  }
  return `<p class="teaching-note"><b>Prefermento:</b> ${esc(type || "Prefermento")} · harina prefermentada ${esc(fmtPct(flourPct))} · hidratación ${esc(fmtPct(hydrationPct))}.</p>`;
}

function bakeryStructuredBlocks(db, item, itemLines = [], { includeCost = false, includeAllergens = false } = {}) {
  const recipe = one(db, "SELECT base_flour_g FROM bakery_recipes WHERE id=$id;", { $id: item.bakery_recipe_id }) || {};
  const effectiveFlour = Number(itemLines.find(l => Number(l.effective_flour_g || 0) > 0)?.effective_flour_g || item.flour_g || recipe.base_flour_g || 0);
  const scale = Number(recipe.base_flour_g || 0) > 0 ? effectiveFlour / Number(recipe.base_flour_g) : 1;
  const formulaRows = db.query(`
    SELECT fl.*, brl.ingredient_id, u.symbol AS unit, via.allergens, ic.cost_per_base_unit_after_waste
    FROM v_bakery_formula_lines_v35 fl
    JOIN bakery_recipe_lines brl ON brl.id=fl.line_id
    JOIN ingredients i ON i.id=brl.ingredient_id
    LEFT JOIN units u ON u.id=i.base_unit_id
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=brl.ingredient_id
    LEFT JOIN v_ingredients_cost ic ON ic.id=i.id
    WHERE fl.recipe_id=$id
    ORDER BY fl.sort_order, fl.ingredient;
  `, { $id: item.bakery_recipe_id });
  const lineKey = r => `${String(r.ingredient || "").toLocaleLowerCase("es")}||${String(r.line_group || "dough")}`;
  const sessionByKey = new Map((itemLines || []).map(r => [lineKey(r), r]));
  const prefermentRows = [];
  const finalRows = [];
  const finishingRows = [];
  for (const r of formulaRows) {
    const group = String(r.line_group || "dough");
    if (group === "dough") {
      const prefG = Number(r.preview_preferment_g || 0) * scale;
      const finalG = Number(r.preview_final_dough_g || 0) * scale;
      if (Math.abs(prefG) > 0.0001) prefermentRows.push(bakeryBlockRow(r, prefG, r.preferment_pct, includeCost, includeAllergens));
      if (Math.abs(finalG) > 0.0001) finalRows.push(bakeryBlockRow(r, finalG, r.final_dough_pct, includeCost, includeAllergens));
    } else {
      const sessionLine = sessionByKey.get(lineKey(r));
      const requiredG = Number(sessionLine?.required_g || 0);
      if (Math.abs(requiredG) > 0.0001) finishingRows.push({
        ingredient: r.ingredient,
        pctLabel: bakeryExtraPctLabel(r),
        quantity: orderQuantity(requiredG, sessionLine?.unit || r.unit || "g"),
        cost: fmtMoney(Number(sessionLine?.estimated_cost || bakeryCostFromRequired(r, requiredG))),
        allergens: normalizeAllergens(splitSemi(r.allergens)).join("; ")
      });
    }
  }
  const blocks = [
    bakeryBlockTable("Prefermento", prefermentRows, { includeCost, includeAllergens, empty: "Sin prefermento en esta formulación." }),
    bakeryBlockTable("Masa final", finalRows, { includeCost, includeAllergens, empty: "Sin ingredientes de masa final registrados." })
  ];
  // No se imprime un bloque vacío de acabados si no hay ingredientes/acabados de formulación.
  // Los pasos técnicos de terminación se muestran después desde bakery_process_steps, evitando duplicar
  // “Acabados / terminación” con un bloque vacío y otro procedimental.
  if (finishingRows.length) {
    blocks.push(bakeryBlockTable("Acabados / terminación", finishingRows, { includeCost, includeAllergens }));
  }
  return blocks.join("");
}

function bakeryBlockRow(row, requiredG, pct, includeCost, includeAllergens) {
  return {
    ingredient: row.ingredient,
    pctLabel: pct != null ? `${fmtNumber(pct,2)} %` : "—",
    quantity: orderQuantity(requiredG, row.unit || "g"),
    cost: fmtMoney(bakeryCostFromRequired(row, requiredG)),
    allergens: normalizeAllergens(splitSemi(row.allergens)).join("; ")
  };
}

function bakeryCostFromRequired(row, requiredG) {
  return (Number(requiredG || 0) / 1000.0) * Number(row.cost_per_base_unit_after_waste || 0);
}

function bakeryExtraPctLabel(row) {
  const base = String(row.calculation_base || "");
  const q = Number(row.quantity_value || 0);
  if (base === "flour_pct" || base === "baker_pct") return `${fmtNumber(q,2)} %`;
  if (base === "dough_pct") return `${fmtNumber(q,2)} % masa`;
  if (base === "per_piece") return `${fmtNumber(q,3)} / pieza`;
  if (base === "fixed") return "Fijo";
  return "—";
}

function bakeryBlockTable(title, rows, { includeCost = false, includeAllergens = false, empty = "Sin datos." } = {}) {
  const headers = ["Ingrediente", "% s.h.", "Cantidad"];
  const numeric = [1,2];
  if (includeCost) { headers.push("Coste"); numeric.push(headers.length - 1); }
  if (includeAllergens) headers.push("Alérgenos");
  const tableRows = rows.map(r => {
    const out = [r.ingredient, r.pctLabel, r.quantity];
    if (includeCost) out.push(r.cost);
    if (includeAllergens) out.push(r.allergens || "");
    return out;
  });
  return `<h3>${esc(title)}</h3>${tableRows.length ? tableHtml(headers, tableRows, numeric, "recipe-table") : `<div class="block-note">${esc(empty)}</div>`}`;
}

function culinaryRecipeDetailRows(db, item, { subrecipeMode = "expanded" } = {}) {
  const recipe = one(db, "SELECT base_servings, yield_quantity FROM culinary_recipes WHERE id=$id;", { $id: item.culinary_recipe_id }) || {};
  const multiplier = culinaryItemMultiplier(item, recipe);
  const rootRows = db.query(`
    SELECT crl.id AS line_id, crl.line_type, crl.subrecipe_id, crl.ingredient_id,
           COALESCE(i.name, sr.name, 'Línea sin nombre') AS line_name,
           crl.quantity, u.symbol AS unit, crl.sort_order,
           clc.estimated_cost, via.allergens
    FROM culinary_recipe_lines crl
    LEFT JOIN ingredients i ON i.id=crl.ingredient_id
    LEFT JOIN culinary_recipes sr ON sr.id=crl.subrecipe_id
    LEFT JOIN units u ON u.id=crl.unit_id
    LEFT JOIN v_culinary_line_costs clc ON clc.line_id=crl.id
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=crl.ingredient_id
    WHERE crl.recipe_id=$id
    ORDER BY crl.sort_order, line_name;
  `, { $id: item.culinary_recipe_id });
  const allergenByRoot = culinarySubrecipeAllergens(db, item.culinary_recipe_id);
  const childByRoot = culinaryExpandedChildren(db, item.culinary_recipe_id);
  const out = [];
  for (const r of rootRows) {
    const isSub = r.line_type === "subrecipe";
    out.push({
      kind: isSub ? "subrecipe" : "ingredient",
      depth: 0,
      ingredient: isSub && subrecipeMode === "expanded" ? `${r.line_name} · subtotal` : r.line_name,
      quantity: formatRecipeLineQuantity(Number(r.quantity || 0) * multiplier, r.unit),
      quantityValue: formatRecipeLineNumber(Number(r.quantity || 0) * multiplier),
      unit: displayUnit(r.unit),
      cost: fmtMoney(Number(r.estimated_cost || 0) * multiplier),
      allergens: isSub ? (allergenByRoot[r.line_id] || "") : normalizeAllergens(splitSemi(r.allergens)).join("; ")
    });
    if (isSub && subrecipeMode === "expanded") {
      for (const child of (childByRoot[r.line_id] || [])) {
        out.push({
          kind: "child",
          depth: Math.max(1, Number(child.depth || 1)),
          ingredient: child.ingredient,
          quantity: formatRecipeLineQuantity(Number(child.quantity || 0) * multiplier, child.unit),
          quantityValue: formatRecipeLineNumber(Number(child.quantity || 0) * multiplier),
          unit: displayUnit(child.unit),
          cost: fmtMoney(Number(child.estimated_cost || 0) * multiplier),
          allergens: normalizeAllergens(splitSemi(child.allergens)).join("; ")
        });
      }
    }
  }
  return out;
}

function culinaryItemMultiplier(item, recipe = {}) {
  if (item.production_mode === "yield" && item.main_qty != null && Number(recipe.yield_quantity || 0) > 0) return Number(item.main_qty) / Number(recipe.yield_quantity);
  if (item.servings != null && Number(recipe.base_servings || 0) > 0) return Number(item.servings) / Number(recipe.base_servings);
  if (item.main_qty != null && Number(recipe.base_servings || 0) > 0) return Number(item.main_qty) / Number(recipe.base_servings);
  return 1;
}

function culinarySubrecipeAllergens(db, recipeId) {
  const rows = db.query(`
    SELECT e.root_line_id, via.allergens
    FROM v_culinary_expanded_ingredient_lines e
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=e.ingredient_id
    WHERE e.recipe_id=$id;
  `, { $id: recipeId });
  const map = {};
  for (const r of rows) {
    map[r.root_line_id] = normalizeAllergens(splitSemi(map[r.root_line_id]).concat(splitSemi(r.allergens))).join("; ");
  }
  return map;
}

function culinaryExpandedChildren(db, recipeId) {
  const rows = db.query(`
    SELECT e.root_line_id, e.depth, e.sort_order, e.ingredient, e.quantity, e.unit, e.estimated_cost, via.allergens
    FROM v_culinary_expanded_ingredient_lines e
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=e.ingredient_id
    WHERE e.recipe_id=$id
    ORDER BY e.root_line_id, e.sort_order, e.ingredient;
  `, { $id: recipeId });
  const out = {};
  for (const r of rows) {
    if (!out[r.root_line_id]) out[r.root_line_id] = [];
    out[r.root_line_id].push(r);
  }
  return out;
}

function culinaryDetailTable(rows, { includeCost = false, includeAllergens = false } = {}) {
  if (!rows.length) return `<p class="muted">Sin datos.</p>`;
  const headers = ["Ingrediente", "Cantidad", "Unidad"];
  const numeric = [1];
  if (includeCost) { headers.push("Coste"); numeric.push(headers.length - 1); }
  if (includeAllergens) headers.push("Alérgenos");
  const head = `<thead><tr>${headers.map((h, i) => `<th class="${numeric.includes(i) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = rows.map(r => {
    const depth = Math.min(Math.max(Number(r.depth || 0), 0), 3);
    const prefix = r.kind === "child" ? `${"— ".repeat(depth || 1)}` : "";
    const firstCell = `${prefix}${r.ingredient}`;
    const cells = [
      { text: firstCell },
      { text: r.quantityValue || quantityNumberFromLabel(r.quantity) },
      { text: r.unit || quantityUnitFromLabel(r.quantity), cls: "unit-col" }
    ];
    if (includeCost) cells.push({ text: r.cost });
    if (includeAllergens) cells.push({ text: normalizeAllergens(splitSemi(r.allergens)).join("; ") });
    const cls = r.kind === "subrecipe" ? "subrecipe-row" : r.kind === "child" ? `subrecipe-child depth-${depth}` : "";
    return `<tr class="${cls}">${cells.map((cell, i) => `<td class="${[numeric.includes(i) ? "num" : "", cell.cls || ""].filter(Boolean).join(" ")}">${esc(cell.text)}</td>`).join("")}</tr>`;
  }).join("");
  const colClass = `cols-${headers.length}`;
  return `<table class="recipe-table ${colClass}"><thead>${head.replace(/^<thead>|<\/thead>$/g, "")}</thead><tbody>${body}</tbody></table>`;
}

function formatRecipeLineQuantity(quantity, unit = "g") {
  const n = Number(quantity);
  if (!Number.isFinite(n)) return "";
  const u = unit || "g";
  if ((u === "g" || u === "ml") && Math.abs(n) >= 1000) return `${fmtNumber(n / 1000, 3)} ${u === "ml" ? "l" : "kg"}`;
  return `${fmtNumber(n, 3)} ${u}`;
}

function aggregateTeachingLines(lines) {
  const map = new Map();
  for (const line of lines || []) {
    const ingredient = String(line.ingredient || "").trim() || "Ingrediente sin nombre";
    const unit = String(line.unit || "g").trim() || "g";
    const key = `${ingredient.toLocaleLowerCase("es")}||${unit.toLocaleLowerCase("es")}`;
    if (!map.has(key)) map.set(key, { ingredient, unit, required_g: 0, estimated_cost: 0, allergens: new Set() });
    const current = map.get(key);
    current.required_g += Number(line.required_g || 0);
    current.estimated_cost += Number(line.estimated_cost || 0);
    for (const allergen of splitSemi(line.allergens)) current.allergens.add(allergen);
  }
  return Array.from(map.values()).map(r => ({ ...r, allergens: Array.from(r.allergens).join("; ") }))
    .sort((a,b) => a.ingredient.localeCompare(b.ingredient, "es", { sensitivity: "base" }));
}

function groupBakeryLinesForTeaching(lines) {
  const labels = { dough: "Masa", filling: "Rellenos", topping: "Coberturas", decoration: "Acabados / terminación", other: "Otros" };
  const order = { dough: 1, filling: 2, topping: 3, decoration: 4, other: 5 };
  const map = new Map();
  for (const line of lines || []) {
    const key = String(line.line_group || "dough");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(line);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (order[a] || 99) - (order[b] || 99))
    .map(([key, rows]) => ({ title: labels[key] || sentenceCaseEs(key), rows }));
}

function processBlockFromText(title, text) {
  const source = String(text || "").trim();
  if (!source) return "";
  const candidates = source.includes("\n")
    ? source.split(/\r?\n/)
    : source.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ])/u);
  const lines = candidates
    .map(s => String(s || "").trim())
    .map(s => s.replace(/^\d+[\.)]\s*/, "").trim())
    .map(s => s.endsWith(".") ? s.slice(0, -1).trim() : s)
    .filter(s => s && !/^\d+$/.test(s));
  if (!lines.length) return "";
  return `<h2>${esc(title)}</h2><ol class="process-list">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol>`;
}

function isMigrationNoteV646(text) {
  return /migrad[oa]\s+desde|steps\s+1\.0\.4|declaraci[oó]n textual\s+1\.0\.4|curaci[oó]n\s+6\.5[23]/i.test(String(text || ""));
}

function processBlocks(rows) {
  const cleanRows = (rows || [])
    .map(p => ({ ...p, instruction: String(p.instruction || "").trim(), notes: isMigrationNoteV646(p.notes) ? "" : String(p.notes || "").trim() }))
    .filter(p => p.instruction);
  const groups = groupBy(cleanRows, r => blockName(r.block));
  return Object.entries(groups).map(([title, list]) => `
    <h2>${esc(title)}</h2>
    <ol class="process-list">
      ${list.map(p => `<li>${esc(p.instruction)}${p.duration_min ? ` <span class="compact-muted">(${esc(fmtNumber(p.duration_min,0))} min)</span>` : ""}${p.temperature_c ? `<span class="compact-muted"> · ${esc(fmtNumber(p.temperature_c,1))} °C</span>` : ""}${p.notes ? `<br><span class="compact-muted">${esc(p.notes)}</span>` : ""}</li>`).join("")}
    </ol>`).join("");
}

function sumRows(rows, key) {
  return (rows || []).reduce((acc, row) => acc + Number(row?.[key] || 0), 0);
}

function selectionRows(db, selectionId) {
  return db.query(`
    SELECT * FROM v_work_selection_items_print
    WHERE selection_id=$id
    ORDER BY sort_order, item_name;
  `, { $id: selectionId });
}

function createTempSessionFromSelection(db, tempId, rows, title, metadata = null) {
  db.exec("DELETE FROM class_sessions WHERE id=$id;", { $id: tempId });
  db.exec(`
    INSERT INTO class_sessions(id,title,practice_date,cycle_id,module_id,group_name,responsible,notes,total_students,servings_per_person,pieces_per_student,safety_margin_pct)
    VALUES($id,$title,$practice_date,$cycle_id,$module_id,$group_name,$responsible,$notes,$total_students,$servings_per_person,$pieces_per_student,$safety_margin_pct);
  `, {
    $id: tempId,
    $title: title,
    $practice_date: metadata?.practiceDate || new Date().toISOString().slice(0,10),
    $cycle_id: metadata?.cycleId || null,
    $module_id: metadata?.moduleId || null,
    $group_name: metadata?.groupName || null,
    $responsible: metadata?.responsible || null,
    $notes: metadata?.notes || '',
    $total_students: metadata?.totalStudents || null,
    $servings_per_person: metadata?.servingsPerPerson || null,
    $pieces_per_student: metadata?.piecesPerStudent || null,
    $safety_margin_pct: metadata?.safetyMarginPct || null
  });
  let order = 10;
  for (const r of rows) {
    db.exec(`
      INSERT INTO class_session_items (
        id, session_id, item_type, culinary_recipe_id, bakery_recipe_id,
        production_mode, main_qty, servings, pieces, piece_weight_g,
        flour_g, raw_dough_g, print_a4, sort_order, notes
      ) VALUES (
        $id, $session_id, $item_type, $culinary_recipe_id, $bakery_recipe_id,
        $production_mode, $main_qty, $servings, $pieces, $piece_weight_g,
        $flour_g, $raw_dough_g, 1, $sort_order, $notes
      );
    `, {
      $id: `${tempId}_${order}`,
      $session_id: tempId,
      $item_type: r.item_type,
      $culinary_recipe_id: r.culinary_recipe_id,
      $bakery_recipe_id: r.bakery_recipe_id,
      $production_mode: r.production_mode,
      $main_qty: r.main_qty,
      $servings: r.servings,
      $pieces: r.pieces,
      $piece_weight_g: r.piece_weight_g,
      $flour_g: r.flour_g,
      $raw_dough_g: r.raw_dough_g,
      $sort_order: order,
      $notes: r.notes
    });
    order += 10;
  }
}

function bakerySheetForSession(db, itemName, item) {
  return `<section class="sheet"><h1>${esc(itemName)}</h1><p class="muted">Ficha individual marcada para A4. Usa la pestaña Panadería para imprimir la ficha técnica completa de formulación.</p></section>`;
}
function culinarySheetForSession(db, itemName, item) {
  return `<section class="sheet"><h1>${esc(itemName)}</h1><p class="muted">Ficha individual marcada para A4. Usa la pestaña Cocina/Pastelería para imprimir la ficha técnica completa.</p></section>`;
}

function orderSection(order, pageBreak = false, title = "Pedido agrupado", { technical = false } = {}) {
  const total = order.reduce((acc, r) => acc + Number(r.estimated_cost_total || 0), 0);
  const groups = new Set(order.map(r => r.order_group || "Sin grupo")).size;
  const zones = new Set(order.map(r => r.storage_zone || "Sin zona")).size;
  const noSupplier = order.filter(r => !hasRealSupplier(r.supplier)).length;
  const realSupplierCount = order.filter(r => hasRealSupplier(r.supplier)).length;
  const supplierNotice = noSupplier
    ? `<div class="warn">${technical ? `Proveedor no asignado en ${fmtNumber(noSupplier,0)} línea(s). En el pedido técnico se identifica como “Sin proveedor asignado”.` : `Proveedor no asignado en ${fmtNumber(noSupplier,0)} línea(s). La columna de proveedor se mantiene oculta en el pedido limpio para mejorar la lectura.`}</div>`
    : "";
  const technicalTable = technical ? technicalOrderTable(order, true, { repeatTitle: `${technical ? "Pedido técnico" : "Pedido"} · ${fmtNumber(order.length,0)} líneas · Coste estimado ${fmtMoney(total)}` }) : "";
  const cleanBlocks = technical ? "" : cleanOrderFamilyBlocks(order);
  return `
    <section class="sheet order-sheet ${pageBreak ? "page-break" : ""}">
      ${header(technical ? "Pedido técnico" : "Pedido agrupado", title, `Coste estimado: ${fmtMoney(total)}`)}
      <div class="order-summary">
        ${box("Líneas", fmtNumber(order.length,0))}
        ${box("Familias/grupos", fmtNumber(groups,0))}
        ${box("Zonas", fmtNumber(zones,0))}
        ${box("Sin proveedor", fmtNumber(noSupplier,0))}
      </div>
      ${supplierNotice}
      ${technical ? technicalTable : cleanBlocks}
    </section>`;
}

function technicalOrderTable(order, showSupplier, { repeatTitle = "" } = {}) {
  const headers = showSupplier
    ? ["Grupo", "Ingrediente", "Cantidad", "Unidad", "Proveedor", "Zona", "Coste", "Usado en"]
    : ["Grupo", "Ingrediente", "Cantidad", "Unidad", "Zona", "Coste", "Usado en"];
  const rows = order.map(r => {
    const base = [sentenceCaseEs(r.order_group || "Sin grupo"), r.ingredient, fmtNumber(r.purchase_quantity ?? r.total_required_g,3), r.purchase_unit || r.unit || "g"];
    const tail = [r.storage_zone || "", fmtMoney(r.estimated_cost_total), formatUsedIn(r.used_in || "")];
    return showSupplier ? [...base, r.supplier || "Sin proveedor asignado", ...tail] : [...base, ...tail];
  });
  if (!repeatTitle || rows.length <= 28) {
    return tableHtml(headers, rows, showSupplier ? [2,6] : [2,5], "technical-order-table");
  }
  const chunks = [];
  let start = 0;
  chunks.push(rows.slice(start, start + 28));
  start += 28;
  while (start < rows.length) {
    chunks.push(rows.slice(start, start + 34));
    start += 34;
  }
  return chunks.map((chunk, idx) => {
    const title = idx === 0 ? repeatTitle : `${repeatTitle} · continuación de tabla`;
    const klass = idx === 0 ? "technical-order-table" : "technical-order-table continuation";
    const html = tableHtml(headers, chunk, showSupplier ? [2,6] : [2,5], klass);
    return html.replace("<thead><tr>", `<thead><tr class="order-table-title"><th colspan="${headers.length}">${esc(title)}</th></tr><tr>`);
  }).join("");
}

function cleanOrderFamilyBlocks(order) {
  if (!order.length) return `<p class="muted">Sin líneas de pedido.</p>`;
  return groupOrderRowsByFamily(order).map(group => `
    <div class="family-block">
      <div class="family-title">${esc(group.family)}</div>
      ${tableHtml(
        ["Ingrediente", "Cantidad", "Unidad", "Zona"],
        group.rows.map(r => [
          r.ingredient,
          fmtNumber(r.purchase_quantity ?? r.total_required_g,3),
          r.purchase_unit || r.unit || "g",
          r.storage_zone || ""
        ]),
        [1],
        "clean-order-table"
      )}
    </div>
  `).join("");
}

function groupOrderRowsByFamily(order) {
  const map = new Map();
  for (const r of order) {
    const family = String(r.order_group || "Sin grupo").trim() || "Sin grupo";
    if (!map.has(family)) map.set(family, []);
    map.get(family).push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => sortGroupName(a).localeCompare(sortGroupName(b), "es", { sensitivity: "base" }))
    .map(([family, rows]) => ({
      family: sentenceCaseEs(family),
      rows: rows.slice().sort((a,b) => String(a.ingredient || "").localeCompare(String(b.ingredient || ""), "es", { sensitivity: "base" }))
    }));
}

function sortGroupName(name) {
  const n = String(name || "").trim().toLowerCase();
  return n === "sin grupo" ? "zzzzzz" : n;
}

function classOrderRows(db, sessionId) {
  if (sessionId) {
    return db.query(`
      SELECT order_group, supplier, storage_zone, ingredient, unit,
             CASE WHEN unit IN ('kg','l') THEN ROUND(total_required_g/1000.0,3) ELSE ROUND(total_required_g,3) END AS purchase_quantity,
             CASE WHEN unit='kg' THEN 'kg' WHEN unit='l' THEN 'l' ELSE COALESCE(unit,'g') END AS purchase_unit,
             estimated_cost_total, used_in
      FROM v_class_order_grouped
      WHERE session_id=$id
      ORDER BY order_group, ingredient;
    `, { $id: sessionId });
  }
  return db.query("SELECT * FROM v_print_class_order ORDER BY session_title, order_group, ingredient;");
}


function recordPrintJob(db, { sourceType, sourceId = null, profile = "docente", title, totalCost = 0, itemCount = 0, items = [] } = {}) {
  try {
    const id = `PRINT_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    db.exec(`
      INSERT INTO print_jobs(id, source_type, source_id, profile, title, payload_json, total_cost, item_count)
      VALUES($id, $source_type, $source_id, $profile, $title, $payload_json, $total_cost, $item_count);
    `, {
      $id: id,
      $source_type: sourceType,
      $source_id: sourceId,
      $profile: profile,
      $title: title || "Impresión",
      $payload_json: JSON.stringify({ title, sourceType, sourceId, profile, items }),
      $total_cost: Number(totalCost || 0),
      $item_count: Number(itemCount || items.length || 0)
    });
    let sort = 10;
    for (const item of items || []) {
      db.exec(`
        INSERT INTO print_job_items(id, print_job_id, item_type, culinary_recipe_id, bakery_recipe_id, item_name, production_mode, quantity_label, notes, sort_order)
        VALUES($id, $print_job_id, $item_type, $culinary_recipe_id, $bakery_recipe_id, $item_name, $production_mode, $quantity_label, $notes, $sort_order);
      `, {
        $id: `${id}_ITEM_${sort}`,
        $print_job_id: id,
        $item_type: item.itemType || "order",
        $culinary_recipe_id: item.culinaryRecipeId || null,
        $bakery_recipe_id: item.bakeryRecipeId || null,
        $item_name: item.itemName || null,
        $production_mode: item.productionMode || null,
        $quantity_label: item.quantityLabel || null,
        $notes: item.notes || null,
        $sort_order: sort
      });
      sort += 10;
    }
    return id;
  } catch (err) {
    console.warn("No se pudo registrar la impresión.", err);
    return null;
  }
}

function meaningfulNote(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return !isAutoNote(t) && t !== "Práctica actual sin sesión formal." && t !== "Sesión creada desde la práctica actual.";
}
function isAutoNote(text) {
  const t = String(text || "").trim().toLowerCase();
  return !t || t === "añadido desde elaboraciones." || t === "añadido desde elaboraciones";
}
function productionItemsTable(items) {
  const hasNotes = items.some(i => meaningfulNote(i.notes));
  const headers = hasNotes ? ["Tipo", "Elaboración", "Modo", "Cantidad", "Notas"] : ["Tipo", "Elaboración", "Modo", "Cantidad"];
  const rows = items.map(i => {
    const base = [itemType(i.item_type), i.item_name, modeName(i.production_mode), itemQty(i)];
    return hasNotes ? [...base, meaningfulNote(i.notes) ? i.notes : ""] : base;
  });
  return tableHtml(headers, rows, [3]);
}


function culinaryProcessForItem(db, item) {
  if (!item?.culinary_recipe_id) return "";
  const recipe = one(db, "SELECT process, service_notes, appcc_notes FROM culinary_recipes WHERE id=$id;", { $id: item.culinary_recipe_id }) || {};
  return [
    processBlockFromText("Proceso", recipe.process),
    processBlockFromText("Servicio / conservación", recipe.service_notes),
    processBlockFromText("APPCC / puntos críticos", recipe.appcc_notes)
  ].filter(Boolean).join("");
}

function bakeryProcessForItem(db, item) {
  if (!item?.bakery_recipe_id) return "";
  const rows = db.query(`
    SELECT block, step_number, instruction, duration_min, temperature_c, notes
    FROM bakery_process_steps
    WHERE recipe_id=$id
    ORDER BY CASE block WHEN 'preferment' THEN 1 WHEN 'final_dough' THEN 2 WHEN 'other' THEN 3 WHEN 'baking' THEN 4 ELSE 5 END, step_number;
  `, { $id: item.bakery_recipe_id });
  if (rows.length) return processBlocks(rows);
  const recipe = one(db, "SELECT notes FROM bakery_recipes WHERE id=$id;", { $id: item.bakery_recipe_id }) || {};
  return processBlockFromText("Proceso", recipe.notes);
}

function productionDetailBlocks(db, items, byItem, bakeryByItem = {}, { subrecipeMode = "expanded", processMode = "show" } = {}) {
  if (!items.length) return `<p class="muted">Sin elaboraciones.</p>`;
  return items.map(i => {
    if (i.item_type === "bakery") {
      return `
        <div class="elaboration-block">
          <h3>${esc(i.item_name)} <span class="muted">(${esc(itemType(i.item_type))})</span></h3>
          ${bakeryStructuredBlocks(db, i, bakeryByItem[i.session_item_id] || [], { includeCost: false, includeAllergens: false })}
          ${processMode === "hide" ? "" : bakeryProcessForItem(db, i)}
        </div>
      `;
    }
    const rows = culinaryRecipeDetailRows(db, i, { subrecipeMode });
    return `
      <div class="elaboration-block">
        <h3>${esc(i.item_name)} <span class="muted">(${esc(itemType(i.item_type))})</span></h3>
        ${culinaryDetailTable(rows, { includeCost: false, includeAllergens: false })}
        ${processMode === "hide" ? "" : culinaryProcessForItem(db, i)}
      </div>
    `;
  }).join("");
}

function aggregateItemIngredientLines(lines) {
  const map = new Map();
  for (const line of lines || []) {
    const ingredient = String(line.ingredient || "").trim() || "Ingrediente sin nombre";
    const unit = String(line.unit || "g").trim() || "g";
    const key = `${ingredient.toLocaleLowerCase("es")}||${unit.toLocaleLowerCase("es")}`;
    if (!map.has(key)) {
      map.set(key, { ingredient, unit, required_g: 0, estimated_cost: 0 });
    }
    const current = map.get(key);
    current.required_g += Number(line.required_g || 0);
    current.estimated_cost += Number(line.estimated_cost || 0);
  }
  return Array.from(map.values())
    .filter(row => Math.abs(Number(row.required_g || 0)) > 0.0001)
    .sort((a,b) => a.ingredient.localeCompare(b.ingredient, "es", { sensitivity: "base" }));
}
function hasRealSupplier(value) {
  const t = String(value || "").trim().toLowerCase();
  return Boolean(t) && t !== "sin proveedor asignado" && t !== "sin proveedor" && t !== "—";
}
function formatUsedIn(value) {
  return String(value || "").split(",").map(s => s.trim()).filter(Boolean).join(", ");
}

function docHtml(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_STYLE}</style></head><body><main class="doc">${body}</main></body></html>`;
}
function header(kind, title, subtitle = "") {
  const label = String(kind || "Documento").toLocaleUpperCase("es");
  return `<div class="head"><div><div class="brand">SwiftRemo</div><h1>${esc(title)}</h1><div class="muted">${esc(subtitle || "")}</div></div><div class="right"><span class="doc-kind-pill">${esc(label)}</span><br><b>${formatPrintDate()}</b><br><span class="muted">FP Cocina, Pastelería y Panadería</span><br><span class="muted">© Remo José Pereira González · Uso docente personal</span></div></div>`;
}
function box(label, value) { return `<div class="box"><b>${esc(label)}</b><span class="value">${esc(value ?? "—")}</span></div>`; }
function tableHtml(headers, rows, numericCols = [], className = "") {
  if (!rows.length) return `<p class="muted">Sin datos.</p>`;
  const classes = String(className || "").split(/\s+/).filter(Boolean);
  if (classes.includes("recipe-table")) classes.push(`cols-${headers.length}`);
  const cls = classes.length ? ` class="${esc(classes.join(" "))}"` : "";
  return `<table${cls}><thead><tr>${headers.map((h, i) => `<th class="${numericCols.includes(i) ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td class="${numericCols.includes(i) ? "num" : ""}">${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function openPrintWindow(html) {
  // Fase 6.31: vista previa imprimible dentro de la app.
  // Evita bloqueos de ventanas emergentes en Android/Chrome y da una salida verificable.
  let overlay = document.querySelector("#swiftremoPrintPreview631");
  if (overlay) overlay.remove();
  overlay = document.createElement("div");
  overlay.id = "swiftremoPrintPreview631";
  overlay.className = "swiftremo-print-preview-631";
  overlay.innerHTML = `
    <style>
      .swiftremo-print-preview-631{position:fixed;inset:0;z-index:9999;background:#0f172a99;display:grid;grid-template-rows:auto 1fr;}
      .swiftremo-print-toolbar-631{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff;border-bottom:1px solid #d7dce2;box-shadow:0 4px 16px #0002;}
      .swiftremo-print-toolbar-631 strong{font-size:14px;color:#111827;}
      .swiftremo-print-toolbar-631 .print-hint-669{font-size:12px;color:#4b5563;margin-left:10px;}
      .swiftremo-print-toolbar-631 .actions{display:flex;gap:8px;flex-wrap:wrap;}
      .swiftremo-print-toolbar-631 button{border:1px solid #1f6feb;background:#1f6feb;color:#fff;padding:8px 12px;border-radius:10px;font-weight:700;}
      .swiftremo-print-toolbar-631 button.secondary{background:#fff;color:#1f2937;border-color:#cfd6dd;}
      .swiftremo-print-toolbar-631 button:disabled{opacity:.55;cursor:not-allowed;}
      .swiftremo-print-frame-631{width:100%;height:100%;border:0;background:#fff;}
    </style>
    <div class="swiftremo-print-toolbar-631">
      <div><strong>Vista previa imprimible</strong><span class="print-hint-669">Para PDF limpio, desactiva “Encabezados y pies” del navegador.</span></div>
      <div class="actions">
        <button type="button" data-print-now disabled>Preparando vista…</button>
        <button type="button" class="secondary" data-print-close>Volver</button>
      </div>
    </div>
    <iframe class="swiftremo-print-frame-631" title="Vista previa de impresión"></iframe>
  `;
  document.body.appendChild(overlay);
  const frame = overlay.querySelector("iframe");
  const printButton = overlay.querySelector("[data-print-now]");
  frame.addEventListener("load", () => {
    printButton.disabled = false;
    printButton.textContent = "Imprimir / guardar PDF";
  }, { once: true });
  frame.srcdoc = html;
  overlay.querySelector("[data-print-close]").addEventListener("click", () => overlay.remove());
  printButton.addEventListener("click", () => {
    if (printButton.disabled) return;
    const win = frame.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  });
}
function one(db, sql, bind = {}) { return db.query(sql, bind)[0] || null; }
function mass(value, unit = "g") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const u = unit || "g";
  if ((u === "g" || u === "ml") && Math.abs(n) >= 1000) return `${fmtNumber(n / 1000, 3)} ${u === "ml" ? "l" : "kg"}`;
  return `${fmtNumber(n, 1)} ${u}`;
}
function orderQuantity(requiredBaseValue, unit = "g") {
  const n = Number(requiredBaseValue);
  if (!Number.isFinite(n)) return "";
  const u = unit || "g";
  if (u === "kg") return `${fmtNumber(n / 1000, 3)} kg`;
  if (u === "l") return `${fmtNumber(n / 1000, 3)} l`;
  if (u === "g" || u === "ml") return mass(n, u);
  return `${fmtNumber(n, 3)} ${u}`;
}

function formatRecipeLineNumber(quantity) {
  const n = Number(quantity);
  return Number.isFinite(n) ? fmtNumber(n, 3) : "";
}
function displayUnit(unit = "g") {
  return String(unit || "g").trim() || "g";
}
function quantityNumberFromLabel(label) {
  const t = String(label || "").trim();
  const m = /^(.+?)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.%]+)$/.exec(t);
  return m ? m[1] : t;
}
function quantityUnitFromLabel(label) {
  const t = String(label || "").trim();
  const m = /^(.+?)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ.%]+)$/.exec(t);
  return m ? m[2] : "";
}
function normalizeAllergens(values) {
  const mapped = (Array.isArray(values) ? values : splitSemi(values)).map(allergenCanonicalLabel).filter(Boolean);
  const hasSpecificGluten = mapped.some(v => /^Gluten \(/i.test(v));
  const filtered = mapped.filter(v => !(hasSpecificGluten && v === "Gluten"));
  return Array.from(new Set(filtered)).sort((a,b) => allergenSortKey(a).localeCompare(allergenSortKey(b), "es"));
}
function allergenCanonicalLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const t = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
  if (t === "gluten") return "Gluten";
  if (/^gluten\s*\(\s*trigo\s*\)$/.test(t) || t === "trigo") return "Gluten (trigo)";
  if (t === "leche" || t === "lacteos" || t === "lacteos/leche") return "Leche";
  if (t === "huevo" || t === "huevos") return "Huevos";
  if (t === "sulfitos" || t === "sulfito") return "Sulfitos";
  if (t === "soia" || t === "soja") return "Soja";
  if (t === "sesamo" || t === "sesamo (posible)") return raw.toLowerCase().includes("posible") ? "Sésamo (posible)" : "Sésamo";
  if (t === "frutos de cascara" || t === "frutos secos" || t === "frutos de casca rixa") return "Frutos de cáscara";
  if (t === "amendoa" || t === "almendra") return "Frutos de cáscara (almendra)";
  if (t === "abelas" || t === "avellana") return "Frutos de cáscara (avellana)";
  return raw.charAt(0).toLocaleUpperCase("es") + raw.slice(1);
}
function allergenSortKey(value) {
  const order = { "Gluten (trigo)": "01", "Gluten": "02", "Huevos": "03", "Leche": "04", "Sulfitos": "05" };
  return `${order[value] || "99"}_${value}`;
}

function fmtPct(value) { const n = Number(value); return Number.isFinite(n) ? `${fmtNumber(n,2)} %` : "—"; }
function splitSemi(text) { return String(text || "").split(";").map(s => s.trim()).filter(Boolean); }
function uniqueText(values) { return Array.from(new Set(values.filter(Boolean))).sort((a,b) => a.localeCompare(b, "es")); }
function allergensForBakery(db, recipeId) {
  const rows = db.query(`
    SELECT via.allergens
    FROM bakery_recipe_lines brl
    LEFT JOIN v_ingredients_allergens via ON via.ingredient_id=brl.ingredient_id
    WHERE brl.recipe_id=$id;
  `, { $id: recipeId });
  return normalizeAllergens(rows.flatMap(r => splitSemi(r.allergens))).join("; ");
}
function groupBy(rows, keyFn) {
  const out = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (!out[k]) out[k] = [];
    out[k].push(r);
  }
  return out;
}
function role(v) { return ({ flour:"Harina", water:"Agua/líquido", salt:"Sal", yeast:"Levadura", fat:"Grasa", sugar:"Azúcar", other:"Otro" })[v] || v || ""; }
function groupName(v) { return ({ dough:"Masa", filling:"Relleno", topping:"Cobertura", decoration:"Decoración", other:"Otro" })[v] || v || ""; }
function baseName(v) { return ({ baker_pct:"% panadero", flour_pct:"% harina", dough_pct:"% masa", per_piece:"Por pieza", fixed:"Fijo" })[v] || v || ""; }
function blockName(v) { return ({ preferment:"Prefermento", final_dough:"Masa final", other:"Acabados / terminación", baking:"Cocción", cooling:"Enfriado / conservación" })[v] || v || ""; }
function itemType(v) { return v === "bakery" ? "Panadería" : v === "culinary" ? "Cocina/Pastelería" : v || ""; }
function modeName(v) { return ({ flour:"Harina", raw_dough:"Masa cruda", dough:"Masa cruda", pieces:"Piezas", servings:"Raciones", yield:"Rendimiento técnico" })[v] || v || ""; }
function itemQty(i) {
  if (i.production_mode === "servings") return `${fmtNumber(i.servings,0)} raciones`;
  if (i.production_mode === "yield") return `${fmtNumber(i.main_qty,3)} ${i.yield_unit || "unidad técnica"}`;
  if (i.production_mode === "pieces") return `${fmtNumber(i.pieces,0)} piezas × ${mass(i.piece_weight_g)}`;
  if (i.production_mode === "raw_dough" || i.production_mode === "dough") return mass(i.raw_dough_g);
  return mass(i.flour_g);
}

function statusLabel(value) {
  return ({ draft: "Borrador", reviewed: "Revisada", validated: "Validada", archived: "Archivada" })[value] || value || "—";
}
