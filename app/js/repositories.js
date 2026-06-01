export class Repository {
  constructor(swiftDb) { this.db = swiftDb; }


  unifiedElaborations({ search = "", type = "all", active = "active" } = {}) {
    const filters = [];
    const bind = {};
    if (active === "active") filters.push("active = 1");
    if (active === "inactive") filters.push("active = 0");
    if (type && type !== "all") {
      if (type === "culinary" || type === "bakery") {
        filters.push("source_type = $type");
        bind.$type = type;
      } else {
        filters.push("production_kind = $type");
        bind.$type = type;
      }
    }
    if (search.trim()) {
      bind.$q = `%${search.trim().toLowerCase()}%`;
      filters.push(`(
        lower(name) LIKE $q OR
        lower(COALESCE(family,'')) LIKE $q OR
        lower(COALESCE(subfamily,'')) LIKE $q OR
        lower(COALESCE(production_label,'')) LIKE $q OR
        lower(COALESCE(category_label,'')) LIKE $q
      )`);
    }
    const where = filters.length ? "WHERE " + filters.join(" AND ") : "";
    return this.db.query(`
      SELECT *
      FROM v_elaborations_unified
      ${where}
      ORDER BY active DESC, name;
    `, bind);
  }

  unifiedElaborationByUid(uid) {
    return this.db.query("SELECT * FROM v_elaborations_unified WHERE uid=$uid;", { $uid: uid })[0] ?? null;
  }

  unifiedElaborationLines(uid) {
    return this.db.query("SELECT * FROM v_elaboration_lines_unified WHERE uid=$uid ORDER BY sort_order, line_name;", { $uid: uid });
  }

  unifiedElaborationSteps(uid) {
    return this.db.query("SELECT * FROM v_elaboration_steps_unified WHERE uid=$uid ORDER BY step_order;", { $uid: uid });
  }

  kpis() {
    return {
      ingredients: this.db.selectValue("SELECT COUNT(*) FROM ingredients WHERE active = 1;") ?? 0,
      bakeryRecipes: this.db.selectValue("SELECT COUNT(*) FROM bakery_recipes WHERE active = 1;") ?? 0,
      culinaryRecipes: this.db.selectValue("SELECT COUNT(*) FROM culinary_recipes WHERE active = 1;") ?? 0,
      sessions: this.db.selectValue("SELECT COUNT(*) FROM class_sessions;") ?? 0,
      workItems: this.db.selectValue("SELECT COUNT(*) FROM work_selection_items WHERE selection_id='WORK_CURRENT';") ?? 0,
      workCost: this.db.selectValue("SELECT COALESCE(estimated_base_cost,0) FROM v_work_selection_summary WHERE selection_id='WORK_CURRENT';") ?? 0
    };
  }

  ingredients({ search = "", active = "active", use = "all" } = {}) {
    const filters = [];
    const bind = {};
    if (active === "active") filters.push("i.active = 1");
    if (active === "inactive") filters.push("i.active = 0");
    if (use === "bakery") filters.push("i.use_bakery = 1");
    if (use === "culinary") filters.push("i.use_culinary = 1");
    if (search.trim()) {
      bind.$q = `%${search.trim().toLowerCase()}%`;
      filters.push(`(
        lower(i.name) LIKE $q OR
        lower(COALESCE(f.name,'')) LIKE $q OR
        lower(COALESCE(og.name,'')) LIKE $q OR
        lower(COALESCE(i.bakery_role,'')) LIKE $q
      )`);
    }
    const where = filters.length ? "WHERE " + filters.join(" AND ") : "";
    return this.db.query(`
      SELECT i.id, i.name, f.name AS family, sf.name AS subfamily, u.symbol AS base_unit,
             i.purchase_price, i.purchase_net_quantity, i.waste_pct,
             ic.cost_per_base_unit_after_waste, i.use_culinary, i.use_bakery,
             i.bakery_role, i.hydration_factor, og.name AS order_group, i.active
      FROM ingredients i
      LEFT JOIN technical_families f ON f.id = i.family_id
      LEFT JOIN technical_subfamilies sf ON sf.id = i.subfamily_id
      LEFT JOIN units u ON u.id = i.base_unit_id
      LEFT JOIN order_groups og ON og.id = i.order_group_id
      LEFT JOIN v_ingredients_cost ic ON ic.id = i.id
      ${where}
      ORDER BY i.active DESC, i.name;
    `, bind);
  }

  ingredientById(id) {
    return this.db.query("SELECT * FROM ingredients WHERE id = $id;", { $id: id })[0] ?? null;
  }

  catalogs() {
    return {
      units: this.db.query("SELECT id, name, symbol FROM units ORDER BY unit_type, symbol;"),
      families: this.db.query(`
        SELECT id, name, area
        FROM technical_families f
        WHERE f.area='ingredient'
          AND EXISTS (SELECT 1 FROM ingredients i WHERE i.family_id=f.id AND i.active=1)
        ORDER BY sort_order, name;
      `),
      subfamilies: this.db.query(`
        SELECT sf.id, sf.family_id, sf.name
        FROM technical_subfamilies sf
        JOIN technical_families f ON f.id=sf.family_id
        WHERE f.area='ingredient'
          AND EXISTS (SELECT 1 FROM ingredients i WHERE i.subfamily_id=sf.id AND i.active=1)
        ORDER BY f.sort_order, sf.sort_order, sf.name;
      `),
      orderGroups: this.db.query("SELECT id, name FROM order_groups ORDER BY sort_order, name;"),
      suppliers: this.db.query("SELECT id, name FROM suppliers ORDER BY name;"),
      storageZones: this.db.query("SELECT id, name FROM storage_zones ORDER BY name;")
    };
  }

  saveIngredient(data) {
    const exists = this.ingredientById(data.$id);
    const sql = exists ? `
      UPDATE ingredients SET
        name=$name, family_id=$family_id, subfamily_id=$subfamily_id,
        order_group_id=$order_group_id, supplier_id=$supplier_id, storage_zone_id=$storage_zone_id,
        base_unit_id=$base_unit_id, purchase_unit_id=$purchase_unit_id,
        purchase_price=$purchase_price, purchase_net_quantity=$purchase_net_quantity,
        waste_pct=$waste_pct, use_culinary=$use_culinary, use_bakery=$use_bakery,
        bakery_role=$bakery_role, hydration_factor=$hydration_factor,
        edible_yield_pct=$edible_yield_pct, notes=$notes, active=$active,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$id;
    ` : `
      INSERT INTO ingredients (
        id, name, family_id, subfamily_id, order_group_id, supplier_id, storage_zone_id,
        base_unit_id, purchase_unit_id, purchase_price, purchase_net_quantity, waste_pct,
        use_culinary, use_bakery, bakery_role, hydration_factor, edible_yield_pct, notes, active
      ) VALUES (
        $id, $name, $family_id, $subfamily_id, $order_group_id, $supplier_id, $storage_zone_id,
        $base_unit_id, $purchase_unit_id, $purchase_price, $purchase_net_quantity, $waste_pct,
        $use_culinary, $use_bakery, $bakery_role, $hydration_factor, $edible_yield_pct, $notes, $active
      );
    `;
    this.db.exec(sql, data);
  }

  deactivateIngredient(id) {
    this.db.exec("UPDATE ingredients SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=$id;", { $id: id });
  }

  bakeryFormula() {
    return this.db.query(`
      SELECT recipe_name, ingredient, bakery_role, baker_pct, grams_for_base_flour, effective_water_g, estimated_cost
      FROM v_print_bakery_formula ORDER BY recipe_name, sort_order;
    `);
  }

  order() {
    return this.db.query(`
      SELECT order_group, ingredient, purchase_quantity, purchase_unit, estimated_cost_total, used_in, storage_zone
      FROM v_print_class_order ORDER BY order_group, ingredient;
    `);
  }

  margins() {
    return this.db.query(`
      SELECT session_title, ingredient_cost_total, labor_cost_total, overhead_cost_total, total_session_cost,
             ingredient_cost_pct, labor_cost_pct, overhead_cost_pct
      FROM v_class_session_margins;
    `);
  }

  sessionSummary() {
    return this.db.query(`
      SELECT session_title, total_items, bakery_items, culinary_items, estimated_order_cost
      FROM v_class_session_summary;
    `);
  }


  bakeryRecipes() {
    return this.db.query(`
      SELECT
        br.id,
        br.name,
        tf.name AS family,
        tsf.name AS subfamily,
        br.base_flour_g,
        br.preferment_type,
        br.status,
        br.active,
        COALESCE(bt.total_raw_dough_g, 0) AS total_raw_dough_g,
        COALESCE(bt.real_hydration_pct, 0) AS real_hydration_pct,
        COALESCE(bt.ingredient_cost_total, 0) AS ingredient_cost_total,
        COALESCE(bm.total_cost, 0) AS total_cost,
        COALESCE(bm.suggested_sale_price, 0) AS suggested_sale_price
      FROM bakery_recipes br
      LEFT JOIN technical_families tf ON tf.id = br.family_id
      LEFT JOIN technical_subfamilies tsf ON tsf.id = br.subfamily_id
      LEFT JOIN v_bakery_recipe_totals bt ON bt.recipe_id = br.id
      LEFT JOIN v_bakery_recipe_margins bm ON bm.recipe_id = br.id
      ORDER BY br.active DESC, br.name;
    `);
  }

  bakeryRecipeById(id) {
    return this.db.query("SELECT * FROM bakery_recipes WHERE id=$id;", { $id: id })[0] ?? null;
  }

  bakeryRecipeLines(recipeId) {
    return this.db.query(`
      SELECT
        brl.id,
        brl.recipe_id,
        brl.ingredient_id,
        i.name AS ingredient,
        brl.bakery_role,
        brl.baker_pct,
        brl.preferment_pct,
        brl.final_dough_pct,
        brl.sort_order,
        brl.technical_note,
        bfl.grams_for_base_flour,
        bfl.effective_water_g,
        bfl.estimated_cost
      FROM bakery_recipe_lines brl
      JOIN ingredients i ON i.id = brl.ingredient_id
      LEFT JOIN v_bakery_formula_lines bfl ON bfl.line_id = brl.id
      WHERE brl.recipe_id=$recipe_id
      ORDER BY brl.sort_order, i.name;
    `, { $recipe_id: recipeId });
  }

  bakeryLineById(id) {
    return this.db.query("SELECT * FROM bakery_recipe_lines WHERE id=$id;", { $id: id })[0] ?? null;
  }

  bakeryIngredients() {
    return this.db.query(`
      SELECT id, name
      FROM ingredients
      WHERE active=1 AND use_bakery=1
      ORDER BY name;
    `);
  }

  saveBakeryRecipe(data) {
    const exists = this.bakeryRecipeById(data.$id);
    const sql = exists ? `
      UPDATE bakery_recipes SET
        name=$name,
        family_id=$family_id,
        subfamily_id=$subfamily_id,
        base_flour_g=$base_flour_g,
        preferment_type=$preferment_type,
        target_dough_temp_c=$target_dough_temp_c,
        status=$status,
        labor_minutes=$labor_minutes,
        labor_cost_per_hour=$labor_cost_per_hour,
        overhead_pct=$overhead_pct,
        target_margin_pct=$target_margin_pct,
        notes=$notes,
        active=$active,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$id;
    ` : `
      INSERT INTO bakery_recipes (
        id, name, family_id, subfamily_id, base_flour_g, preferment_type,
        target_dough_temp_c, status, labor_minutes, labor_cost_per_hour,
        overhead_pct, target_margin_pct, notes, active
      ) VALUES (
        $id, $name, $family_id, $subfamily_id, $base_flour_g, $preferment_type,
        $target_dough_temp_c, $status, $labor_minutes, $labor_cost_per_hour,
        $overhead_pct, $target_margin_pct, $notes, $active
      );
    `;
    this.db.exec(sql, data);
  }

  saveBakeryLine(data) {
    const exists = this.bakeryLineById(data.$id);
    const sql = exists ? `
      UPDATE bakery_recipe_lines SET
        recipe_id=$recipe_id,
        ingredient_id=$ingredient_id,
        bakery_role=$bakery_role,
        baker_pct=$baker_pct,
        preferment_pct=$preferment_pct,
        final_dough_pct=$final_dough_pct,
        unit_id=$unit_id,
        technical_note=$technical_note,
        sort_order=$sort_order
      WHERE id=$id;
    ` : `
      INSERT INTO bakery_recipe_lines (
        id, recipe_id, ingredient_id, bakery_role, baker_pct,
        preferment_pct, final_dough_pct, unit_id, technical_note, sort_order
      ) VALUES (
        $id, $recipe_id, $ingredient_id, $bakery_role, $baker_pct,
        $preferment_pct, $final_dough_pct, $unit_id, $technical_note, $sort_order
      );
    `;
    this.db.exec(sql, data);
  }

  deleteBakeryLine(id) {
    this.db.exec("DELETE FROM bakery_recipe_lines WHERE id=$id;", { $id: id });
  }




  cycles() {
    return this.db.query("SELECT id, name FROM fp_cycles ORDER BY name;");
  }

  modules(cycleId = null) {
    if (cycleId) {
      return this.db.query("SELECT id, module_code, module_name, default_group FROM fp_modules WHERE cycle_id=$cycle_id ORDER BY course, module_code, module_name;", { $cycle_id: cycleId });
    }
    return this.db.query("SELECT id, module_code, module_name, default_group FROM fp_modules ORDER BY module_code, module_name;");
  }

  classSessions() {
    return this.db.query(`
      SELECT
        cs.id, cs.title, cs.practice_date, cs.group_name, cs.responsible, cs.team_count, cs.people_per_team, cs.total_students,
        fc.name AS cycle, fm.module_code, fm.module_name,
        COALESCE(v.total_items,0) AS total_items,
        COALESCE(v.bakery_items,0) AS bakery_items,
        COALESCE(v.culinary_items,0) AS culinary_items,
        COALESCE(v.estimated_order_cost,0) AS estimated_order_cost
      FROM class_sessions cs
      LEFT JOIN fp_cycles fc ON fc.id = cs.cycle_id
      LEFT JOIN fp_modules fm ON fm.id = cs.module_id
      LEFT JOIN v_class_session_summary v ON v.session_id = cs.id
      ORDER BY COALESCE(cs.practice_date,'') DESC, cs.created_at DESC, cs.title;
    `);
  }

  classSessionById(id) {
    return this.db.query("SELECT * FROM class_sessions WHERE id=$id;", { $id: id })[0] ?? null;
  }

  saveClassSession(data) {
    const exists = this.classSessionById(data.$id);
    const sql = exists ? `
      UPDATE class_sessions SET
        title=$title,
        practice_date=$practice_date,
        cycle_id=$cycle_id,
        module_id=$module_id,
        group_name=$group_name,
        responsible=$responsible,
        notes=$notes,
        team_count=$team_count,
        people_per_team=$people_per_team,
        total_students=$total_students,
        servings_per_person=$servings_per_person,
        pieces_per_student=$pieces_per_student,
        safety_margin_pct=$safety_margin_pct
      WHERE id=$id;
    ` : `
      INSERT INTO class_sessions (
        id, title, practice_date, cycle_id, module_id, group_name, responsible, notes,
        team_count, people_per_team, total_students, servings_per_person, pieces_per_student, safety_margin_pct
      ) VALUES (
        $id, $title, $practice_date, $cycle_id, $module_id, $group_name, $responsible, $notes,
        $team_count, $people_per_team, $total_students, $servings_per_person, $pieces_per_student, $safety_margin_pct
      );
    `;
    this.db.exec(sql, data);
  }

  classItems(sessionId) {
    return this.db.query(`
      SELECT
        csi.id, csi.session_id, csi.item_type, csi.production_mode,
        csi.flour_g, csi.raw_dough_g, csi.servings, csi.pieces, csi.piece_weight_g, csi.main_qty,
        csi.print_a4, csi.sort_order, csi.notes,
        CASE WHEN csi.item_type='bakery' THEN br.name ELSE cr.name END AS item_name
      FROM class_session_items csi
      LEFT JOIN bakery_recipes br ON br.id = csi.bakery_recipe_id
      LEFT JOIN culinary_recipes cr ON cr.id = csi.culinary_recipe_id
      WHERE csi.session_id=$session_id
      ORDER BY csi.sort_order, item_name;
    `, { $session_id: sessionId });
  }

  classItemById(id) {
    return this.db.query("SELECT * FROM class_session_items WHERE id=$id;", { $id: id })[0] ?? null;
  }

  saveClassItem(data) {
    const exists = this.classItemById(data.$id);
    const sql = exists ? `
      UPDATE class_session_items SET
        session_id=$session_id,
        item_type=$item_type,
        culinary_recipe_id=$culinary_recipe_id,
        bakery_recipe_id=$bakery_recipe_id,
        production_mode=$production_mode,
        main_qty=$main_qty,
        servings=$servings,
        pieces=$pieces,
        piece_weight_g=$piece_weight_g,
        flour_g=$flour_g,
        raw_dough_g=$raw_dough_g,
        baking_loss_pct=$baking_loss_pct,
        print_a4=$print_a4,
        sort_order=$sort_order,
        notes=$notes
      WHERE id=$id;
    ` : `
      INSERT INTO class_session_items (
        id, session_id, item_type, culinary_recipe_id, bakery_recipe_id,
        production_mode, main_qty, servings, pieces, piece_weight_g,
        flour_g, raw_dough_g, baking_loss_pct, print_a4, sort_order, notes
      ) VALUES (
        $id, $session_id, $item_type, $culinary_recipe_id, $bakery_recipe_id,
        $production_mode, $main_qty, $servings, $pieces, $piece_weight_g,
        $flour_g, $raw_dough_g, $baking_loss_pct, $print_a4, $sort_order, $notes
      );
    `;
    this.db.exec(sql, data);
  }

  deleteClassItem(id) {
    this.db.exec("DELETE FROM class_session_items WHERE id=$id;", { $id: id });
  }

  bakeryRecipeOptions() {
    return this.db.query("SELECT id, name, base_flour_g, base_pieces, base_raw_piece_weight_g FROM bakery_recipes WHERE active=1 ORDER BY name;");
  }

  culinaryRecipeOptions() {
    return this.db.query(`
      SELECT
        cr.id,
        cr.name,
        cr.base_servings,
        cr.yield_quantity,
        cr.yield_unit_id,
        u.symbol AS yield_unit,
        cr.production_kind,
        cr.default_production_mode,
        cr.production_contract_notes,
        CASE WHEN cr.production_kind = 'technical_yield' THEN 1 ELSE 0 END AS is_technical_subrecipe,
        CASE WHEN cr.production_kind = 'dual' THEN 1 ELSE 0 END AS is_dual_production
      FROM culinary_recipes cr
      LEFT JOIN units u ON u.id = cr.yield_unit_id
      WHERE cr.active=1
      ORDER BY cr.name;
    `);
  }



  culinaryRecipes() {
    return this.db.query(`
      SELECT
        cr.id,
        cr.name,
        tf.name AS family,
        tsf.name AS subfamily,
        cr.base_servings,
        cr.serving_weight_g,
        cr.status,
        cr.production_kind,
        cr.default_production_mode,
        cr.production_contract_notes,
        cr.active,
        COALESCE(ct.ingredient_cost_total, 0) AS ingredient_cost_total,
        COALESCE(ct.total_cost, 0) AS total_cost,
        COALESCE(ct.cost_per_serving, 0) AS cost_per_serving,
        COALESCE(ct.suggested_sale_price_total, 0) AS suggested_sale_price_total
      FROM culinary_recipes cr
      LEFT JOIN technical_families tf ON tf.id = cr.family_id
      LEFT JOIN technical_subfamilies tsf ON tsf.id = cr.subfamily_id
      LEFT JOIN v_culinary_recipe_totals ct ON ct.recipe_id = cr.id
      ORDER BY cr.active DESC, cr.name;
    `);
  }

  culinaryRecipeById(id) {
    return this.db.query("SELECT * FROM culinary_recipes WHERE id=$id;", { $id: id })[0] ?? null;
  }

  culinaryRecipeLines(recipeId) {
    return this.db.query(`
      SELECT
        crl.id,
        crl.recipe_id,
        crl.line_type,
        crl.ingredient_id,
        i.name AS ingredient,
        crl.quantity,
        u.symbol AS unit,
        crl.unit_id,
        crl.waste_pct,
        crl.technical_note,
        crl.sort_order,
        clc.estimated_cost
      FROM culinary_recipe_lines crl
      LEFT JOIN ingredients i ON i.id = crl.ingredient_id
      LEFT JOIN units u ON u.id = crl.unit_id
      LEFT JOIN v_culinary_line_costs clc ON clc.line_id = crl.id
      WHERE crl.recipe_id=$recipe_id
      ORDER BY crl.sort_order, i.name;
    `, { $recipe_id: recipeId });
  }

  culinaryLineById(id) {
    return this.db.query("SELECT * FROM culinary_recipe_lines WHERE id=$id;", { $id: id })[0] ?? null;
  }

  culinaryIngredients() {
    return this.db.query(`
      SELECT id, name
      FROM ingredients
      WHERE active=1 AND use_culinary=1
      ORDER BY name;
    `);
  }

  saveCulinaryRecipe(data) {
    const exists = this.culinaryRecipeById(data.$id);
    const sql = exists ? `
      UPDATE culinary_recipes SET
        name=$name,
        family_id=$family_id,
        subfamily_id=$subfamily_id,
        base_servings=$base_servings,
        serving_weight_g=$serving_weight_g,
        status=$status,
        labor_minutes=$labor_minutes,
        labor_cost_per_hour=$labor_cost_per_hour,
        overhead_pct=$overhead_pct,
        target_margin_pct=$target_margin_pct,
        process=$process,
        service_notes=$service_notes,
        appcc_notes=$appcc_notes,
        notes=$notes,
        active=$active,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$id;
    ` : `
      INSERT INTO culinary_recipes (
        id, name, family_id, subfamily_id, base_servings, serving_weight_g, status,
        labor_minutes, labor_cost_per_hour, overhead_pct, target_margin_pct,
        process, service_notes, appcc_notes, notes, active
      ) VALUES (
        $id, $name, $family_id, $subfamily_id, $base_servings, $serving_weight_g, $status,
        $labor_minutes, $labor_cost_per_hour, $overhead_pct, $target_margin_pct,
        $process, $service_notes, $appcc_notes, $notes, $active
      );
    `;
    this.db.exec(sql, data);
  }

  saveCulinaryLine(data) {
    const exists = this.culinaryLineById(data.$id);
    const sql = exists ? `
      UPDATE culinary_recipe_lines SET
        recipe_id=$recipe_id,
        line_type='ingredient',
        ingredient_id=$ingredient_id,
        subrecipe_id=NULL,
        quantity=$quantity,
        unit_id=$unit_id,
        waste_pct=$waste_pct,
        technical_note=$technical_note,
        sort_order=$sort_order
      WHERE id=$id;
    ` : `
      INSERT INTO culinary_recipe_lines (
        id, recipe_id, line_type, ingredient_id, subrecipe_id,
        quantity, unit_id, waste_pct, technical_note, sort_order
      ) VALUES (
        $id, $recipe_id, 'ingredient', $ingredient_id, NULL,
        $quantity, $unit_id, $waste_pct, $technical_note, $sort_order
      );
    `;
    this.db.exec(sql, data);
  }

  deleteCulinaryLine(id) {
    this.db.exec("DELETE FROM culinary_recipe_lines WHERE id=$id;", { $id: id });
  }

  classOrder(sessionId = null) {
    if (sessionId) {
      return this.db.query(`
        SELECT order_group, supplier, storage_zone, ingredient,
               purchase_quantity, purchase_unit, estimated_cost_total, used_in
        FROM v_print_class_order
        WHERE session_id=$session_id
        ORDER BY order_group, ingredient;
      `, { $session_id: sessionId });
    }
    return this.order();
  }

  classPrintItems(sessionId) {
    return this.db.query(`
      SELECT * FROM v_print_class_items
      WHERE session_id=$session_id AND print_a4=1
      ORDER BY sort_order, item_name;
    `, { $session_id: sessionId });
  }


  ensureWorkSelection() {
    this.db.exec(`
      INSERT OR IGNORE INTO work_selections(id, name, notes, context_json)
      VALUES('WORK_CURRENT', 'Práctica actual', 'Preparación operativa de aula: elaboraciones, cantidades, pedido e impresión.', '{}');
    `);
  }

  workSelectionContext() {
    this.ensureWorkSelection();
    const row = this.db.query("SELECT context_json FROM work_selections WHERE id='WORK_CURRENT';")[0] || {};
    try {
      return row.context_json ? JSON.parse(row.context_json) : {};
    } catch {
      return {};
    }
  }

  saveWorkSelectionContext(context = {}) {
    this.ensureWorkSelection();
    this.db.exec(`
      UPDATE work_selections
      SET context_json=$context_json, updated_at=CURRENT_TIMESTAMP
      WHERE id='WORK_CURRENT';
    `, { $context_json: JSON.stringify(context || {}) });
  }

  workSelectionSummary() {
    this.ensureWorkSelection();
    return this.db.query("SELECT * FROM v_work_selection_summary WHERE selection_id='WORK_CURRENT';")[0] ?? { selection_id: 'WORK_CURRENT', total_items: 0, bakery_items: 0, culinary_items: 0, estimated_base_cost: 0 };
  }

  workSelectionItems() {
    this.ensureWorkSelection();
    return this.db.query(`
      SELECT *
      FROM v_work_selection_items_print
      WHERE selection_id='WORK_CURRENT'
      ORDER BY sort_order, item_name;
    `);
  }

  addWorkSelectionItem(data) {
    this.ensureWorkSelection();
    this.db.exec(`
      INSERT INTO work_selection_items (
        id, selection_id, item_type, culinary_recipe_id, bakery_recipe_id,
        production_mode, main_qty, servings, pieces, piece_weight_g, flour_g,
        raw_dough_g, baking_loss_pct, print_a4, sort_order, notes
      ) VALUES (
        $id, 'WORK_CURRENT', $item_type, $culinary_recipe_id, $bakery_recipe_id,
        $production_mode, $main_qty, $servings, $pieces, $piece_weight_g, $flour_g,
        $raw_dough_g, $baking_loss_pct, $print_a4, $sort_order, $notes
      );
    `, data);
  }

  updateWorkSelectionItem(data) {
    this.ensureWorkSelection();
    this.db.exec(`
      UPDATE work_selection_items
      SET production_mode=$production_mode,
          main_qty=$main_qty,
          servings=$servings,
          pieces=$pieces,
          piece_weight_g=$piece_weight_g,
          flour_g=$flour_g,
          raw_dough_g=$raw_dough_g,
          baking_loss_pct=$baking_loss_pct,
          print_a4=$print_a4,
          sort_order=$sort_order,
          notes=$notes
      WHERE id=$id AND selection_id='WORK_CURRENT';
    `, data);
  }

  deleteWorkSelectionItem(id) {
    this.db.exec("DELETE FROM work_selection_items WHERE id=$id AND selection_id='WORK_CURRENT';", { $id: id });
  }

  clearWorkSelection() {
    this.ensureWorkSelection();
    this.db.exec("DELETE FROM work_selection_items WHERE selection_id='WORK_CURRENT';");
  }

  createSessionFromWorkSelection({ title = null, practiceDate = null, cycleId = null, moduleId = null, groupName = null, responsible = null, notes = null, totalStudents = null, servingsPerPerson = null, piecesPerStudent = null, safetyMarginPct = null } = {}) {
    this.ensureWorkSelection();
    const items = this.workSelectionItems();
    if (!items.length) throw new Error("La práctica actual está vacía.");
    const baseSessionId = slugSessionIdFromTitle(title || `Práctica actual ${new Date().toISOString().slice(0,19)}`);
    let sessionId = baseSessionId;
    let suffix = 2;
    while (this.db.query("SELECT 1 FROM class_sessions WHERE id=$id LIMIT 1;", { $id: sessionId }).length) {
      sessionId = `${baseSessionId}_${suffix++}`;
    }
    this.db.exec(`
      INSERT INTO class_sessions(id, title, practice_date, cycle_id, module_id, group_name, responsible, notes, total_students, servings_per_person, pieces_per_student, safety_margin_pct)
      VALUES($id, $title, $practice_date, $cycle_id, $module_id, $group_name, $responsible, $notes, $total_students, $servings_per_person, $pieces_per_student, $safety_margin_pct);
    `, {
      $id: sessionId,
      $title: title || `Sesión desde práctica actual · ${new Date().toLocaleString('es-ES')}`,
      $practice_date: practiceDate,
      $cycle_id: cycleId,
      $module_id: moduleId,
      $group_name: groupName,
      $responsible: responsible,
      $notes: notes || "Sesión creada desde la práctica actual.",
      $total_students: totalStudents,
      $servings_per_person: servingsPerPerson,
      $pieces_per_student: piecesPerStudent,
      $safety_margin_pct: safetyMarginPct
    });
    for (const it of items) {
      this.db.exec(`
        INSERT INTO class_session_items (
          id, session_id, item_type, culinary_recipe_id, bakery_recipe_id,
          production_mode, main_qty, servings, pieces, piece_weight_g,
          flour_g, raw_dough_g, baking_loss_pct, print_a4, sort_order, notes
        ) VALUES (
          $id, $session_id, $item_type, $culinary_recipe_id, $bakery_recipe_id,
          $production_mode, $main_qty, $servings, $pieces, $piece_weight_g,
          $flour_g, $raw_dough_g, $baking_loss_pct, $print_a4, $sort_order, $notes
        );
      `, {
        $id: slugSessionItemId(sessionId),
        $session_id: sessionId,
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
        $sort_order: it.sort_order,
        $notes: it.notes
      });
    }
    return sessionId;
  }

  printJobs(limit = 20) {
    return this.db.query(`
      SELECT * FROM v_print_jobs_recent
      ORDER BY created_at DESC
      LIMIT $limit;
    `, { $limit: limit });
  }



  appMetaMap() {
    const rows = this.db.query("SELECT key, value FROM app_meta ORDER BY key;");
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  baseStatusV663() {
    const meta = this.appMetaMap();
    const auditRows = this.technicalAudit();
    const countSeverity = sev => auditRows.filter(r => r.severity === sev).length;
    const scalar = (sql, params = {}) => Number(this.db.selectValue(sql, params) ?? 0);
    const duplicateIngredientNames = scalar(`
      SELECT COUNT(*) FROM (
        SELECT lower(TRIM(name)) AS name_key
        FROM ingredients
        WHERE active=1
        GROUP BY lower(TRIM(name))
        HAVING COUNT(*) > 1
      );
    `);
    const duplicateElaborationNames = scalar(`
      SELECT COUNT(*) FROM (
        SELECT lower(TRIM(name)) AS name_key
        FROM v_elaborations_unified
        WHERE active=1
        GROUP BY source_type, lower(TRIM(name))
        HAVING COUNT(*) > 1
      );
    `);
    const blockers = countSeverity("error");
    const warnings = countSeverity("warn");
    const infos = countSeverity("info");
    const statusLabel = blockers
      ? "Revisión obligatoria"
      : warnings
        ? "Apta con avisos"
        : "Base apta para uso docente";
    const statusClass = blockers ? "err" : warnings ? "warn" : "ok";
    return {
      schemaVersion: meta.schema_version || "desconocida",
      releaseLabel: meta.release_label || "Sin etiqueta de release",
      qualityGate: meta.quality_gate_662 || meta.quality_gate_661 || "Sin quality gate registrado",
      panelMeta: meta.base_status_panel_663 || "",
      ingredientsActive: scalar("SELECT COUNT(*) FROM ingredients WHERE active=1;"),
      ingredientsArchived: scalar("SELECT COUNT(*) FROM ingredients WHERE active=0;"),
      ingredientsTotal: scalar("SELECT COUNT(*) FROM ingredients;"),
      culinaryActive: scalar("SELECT COUNT(*) FROM culinary_recipes WHERE active=1;"),
      culinaryArchived: scalar("SELECT COUNT(*) FROM culinary_recipes WHERE active=0;"),
      culinaryTotal: scalar("SELECT COUNT(*) FROM culinary_recipes;"),
      bakeryActive: scalar("SELECT COUNT(*) FROM bakery_recipes WHERE active=1;"),
      bakeryArchived: scalar("SELECT COUNT(*) FROM bakery_recipes WHERE active=0;"),
      bakeryTotal: scalar("SELECT COUNT(*) FROM bakery_recipes;"),
      bakeryNotValidated: scalar("SELECT COUNT(*) FROM bakery_recipes WHERE active=1 AND lower(COALESCE(status,'')) <> 'validated';"),
      culinaryNotValidated: scalar("SELECT COUNT(*) FROM culinary_recipes WHERE active=1 AND lower(COALESCE(status,'')) <> 'validated';"),
      duplicateIngredientNames,
      duplicateElaborationNames,
      blockers,
      warnings,
      infos,
      checks: Number((String(meta.quality_gate_662 || '').match(/checks=(\d+)/) || [])[1] || auditRows.length || 0),
      statusLabel,
      statusClass
    };
  }

  technicalAudit() {
    return this.db.query(`
      WITH issues AS (
        SELECT 'error' AS severity, 'Panadería' AS area, br.name AS item,
               'La suma de harinas debe ser 100 % y ahora es ' || COALESCE(ROUND(bt.flour_pct_total, 3), 0) || ' %.' AS message
        FROM bakery_recipes br
        LEFT JOIN v_bakery_recipe_totals bt ON bt.recipe_id = br.id
        WHERE br.active = 1 AND ABS(COALESCE(bt.flour_pct_total, 0) - 100) > 0.001

        UNION ALL
        SELECT 'error', 'Panadería', br.name,
               'La formulación no tiene líneas de masa.'
        FROM bakery_recipes br
        WHERE br.active = 1 AND NOT EXISTS (SELECT 1 FROM bakery_recipe_lines l WHERE l.recipe_id = br.id AND COALESCE(l.include_in_dough,1)=1)

        UNION ALL
        SELECT 'warn', 'Panadería', br.name,
               'No tiene piezas base o peso crudo por pieza; la sesión por piezas requerirá introducirlos manualmente.'
        FROM bakery_recipes br
        WHERE br.active = 1 AND (br.base_pieces IS NULL OR br.base_pieces <= 0 OR br.base_raw_piece_weight_g IS NULL OR br.base_raw_piece_weight_g <= 0)

        UNION ALL
        SELECT 'warn', 'Prefermento', br.name,
               'Prefermento activo sin % de harina/prefermento definido.'
        FROM bakery_preferments bp
        JOIN bakery_recipes br ON br.id = bp.recipe_id
        WHERE br.active = 1 AND bp.calculation_mode <> 'none'
          AND COALESCE(bp.flour_prefermented_pct, bp.preferment_total_pct, 0) <= 0

        UNION ALL
        SELECT 'warn', 'Prefermento', br.name,
               'Hidratación de prefermento fuera de rango didáctico habitual: ' || ROUND(bp.hydration_pct, 2) || ' %.'
        FROM bakery_preferments bp
        JOIN bakery_recipes br ON br.id = bp.recipe_id
        WHERE br.active = 1 AND bp.calculation_mode <> 'none' AND (bp.hydration_pct <= 0 OR bp.hydration_pct > 250)

        UNION ALL
        SELECT 'warn', 'Ingredientes', i.name,
               'Ingrediente panadero sin grupo de pedido.'
        FROM ingredients i
        WHERE i.active=1 AND i.use_bakery=1 AND (i.order_group_id IS NULL OR i.order_group_id='')

        UNION ALL
        SELECT 'warn', 'Ingredientes', i.name,
               'Ingrediente activo sin precio o sin cantidad neta de compra.'
        FROM ingredients i
        WHERE i.active=1 AND i.id <> 'TEC-AGUA' AND (COALESCE(i.purchase_price,0) <= 0 OR COALESCE(i.purchase_net_quantity,0) <= 0)

        UNION ALL
        SELECT 'error', 'Cocina/Pastelería', cr.name,
               'La ficha culinaria no tiene líneas de ingredientes.'
        FROM culinary_recipes cr
        WHERE cr.active=1 AND NOT EXISTS (SELECT 1 FROM culinary_recipe_lines l WHERE l.recipe_id=cr.id)

        UNION ALL
        SELECT 'warn', 'Cocina/Pastelería', cr.name,
               'Ficha culinaria sin proceso técnico descrito.'
        FROM culinary_recipes cr
        WHERE cr.active=1 AND (cr.process IS NULL OR TRIM(cr.process)='')

        UNION ALL
        SELECT 'warn', 'Cocina/Pastelería', cr.name,
               'Ficha culinaria sin notas APPCC/puntos críticos.'
        FROM culinary_recipes cr
        WHERE cr.active=1 AND (cr.appcc_notes IS NULL OR TRIM(cr.appcc_notes)='')


        UNION ALL
        SELECT 'info', 'Panadería', br.name,
               'Hidratación real fuera del rango panadero común: ' || ROUND(bt.real_hydration_pct, 1) || ' %. Puede ser mezcla seca, sin gluten o papilla fermentada.'
        FROM bakery_recipes br
        JOIN v_bakery_recipe_totals bt ON bt.recipe_id = br.id
        WHERE br.active = 1 AND (bt.real_hydration_pct < 20 OR bt.real_hydration_pct > 180)

        UNION ALL
        SELECT 'info', 'Sesiones', cs.title,
               'Sesión sin elaboraciones asignadas.'
        FROM class_sessions cs
        WHERE NOT EXISTS (SELECT 1 FROM class_session_items csi WHERE csi.session_id=cs.id)
      )
      SELECT severity, area, item, message
      FROM issues
      ORDER BY CASE severity WHEN 'error' THEN 1 WHEN 'warn' THEN 2 ELSE 3 END, area, item;
    `);
  }

  exportJson() {
    const safeIdent = name => {
      const value = String(name || "");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        console.warn(`[SwiftRemo] Identificador SQL omitido en exportación JSON: ${value}`);
        return null;
      }
      return `"${value.replace(/"/g, '""')}"`;
    };
    const tables = this.db.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;").map(r => r.name);
    const views = this.db.query("SELECT name FROM sqlite_schema WHERE type='view' ORDER BY name;").map(r => r.name);
    const obj = { app: "SwiftRemo", version: (this.db.selectValue("SELECT value FROM app_meta WHERE key='schema_version'") || "swiftremo_sql_desconocido"), exportedAt: new Date().toISOString(), tables: {}, views: {} };
    for (const t of tables) {
      const ident = safeIdent(t);
      if (ident) obj.tables[t] = this.db.query(`SELECT * FROM ${ident};`);
    }
    for (const v of views) {
      const ident = safeIdent(v);
      if (ident) obj.views[v] = this.db.query(`SELECT * FROM ${ident};`);
    }
    return obj;
  }

  selectOnly(sql) {
    const raw = String(sql || "").trim();
    if (!raw) return [];
    const withoutComments = raw
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    const statement = withoutComments.replace(/;\s*$/, "").trim();
    if (!statement) return [];
    if (statement.includes(";")) {
      throw new Error("Solo se permite una consulta SELECT sin sentencias encadenadas.");
    }
    if (!/^(select|with)\b/i.test(statement)) {
      throw new Error("Solo se permiten consultas SELECT o WITH ... SELECT.");
    }
    if (/\b(insert|update|delete|drop|alter|create|replace|truncate|attach|detach|pragma|vacuum|reindex|analyze|begin|commit|rollback)\b/i.test(statement)) {
      throw new Error("La consulta contiene una operación no permitida en modo solo lectura.");
    }
    if (/^with\b/i.test(statement) && !/\bselect\b/i.test(statement)) {
      throw new Error("Las consultas WITH deben terminar en SELECT.");
    }
    if (/^with\s+recursive\b/i.test(statement)) {
      throw new Error("WITH RECURSIVE no está permitido en la consola técnica para evitar bloqueos del navegador.");
    }
    return this.db.query(statement);
  }
}

export function slugRecipeIdFromName(name) {
  const clean = String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 42);
  return "PAN_" + (clean || Date.now());
}

export function slugLineId(recipeId) {
  return String(recipeId || "PAN") + "_L" + Date.now();
}

export function slugIdFromName(name) {
  const clean = String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 42);
  return "ING_" + (clean || Date.now());
}


export function slugCulinaryRecipeIdFromName(name) {
  const clean = String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 42);
  return "CUL_" + (clean || Date.now());
}

export function slugCulinaryLineId(recipeId) {
  return String(recipeId || "CUL") + "_L" + Date.now();
}

export function slugSessionIdFromTitle(title) {
  const clean = String(title || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 38);
  return "SES_" + (clean || Date.now());
}

export function slugSessionItemId(sessionId) {
  return String(sessionId || "SES") + "_ITEM_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}


export function slugWorkSelectionItemId() {
  return "WORK_ITEM_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}

export function slugPrintJobId() {
  return "PRINT_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}
