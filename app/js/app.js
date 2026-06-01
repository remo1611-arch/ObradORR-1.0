import { SwiftDB } from "./db-service.js?v=6729";
import { Repository, slugIdFromName, slugWorkSelectionItemId } from "./repositories.js?v=6729";
import { printWorkSelection, printWorkSelectionOrder, printWorkSelectionTeachingSheets, printWorkSelectionTechnicalOrder, printWorkSelectionTeachingSheetsWithOrder } from "./print-service-v6-3.js?v=6729";
import { loadRecovery, saveRecovery, clearRecovery } from "./storage-service.js?v=6729";
import { $, $$, esc, fmtMoney, fmtNumber, table, fillSelect, toast, setState, setStatus, setSaveIndicator, downloadBytes, downloadJson } from "./ui.js?v=6729";
import { createAppState } from "./ui/state.js?v=6729";
import { createDomainShell } from "./ui/app-shell.js?v=6729";
import { createWorkshopDomain } from "./domain/workshop.js?v=6729";
import { createTechnicalArchiveDomain } from "./domain/technical-archive.js?v=6729";
import { createHistoryDomain } from "./domain/history.js?v=6729";
import { createSystemBackupService } from "./domain/system-backup.js?v=6729";
import { createPrintDomain } from "./domain/print.js?v=6729";
import { createWorkshopView } from "./ui/workshop-view.js?v=6729";

const swiftDb = new SwiftDB();
let repo = null;
let catalogs = null;
let appState = null;
let domainShell = null;
let workshopDomain = null;
let technicalArchiveDomain = null;
let historyDomain = null;
let systemBackupService = null;
let printDomain = null;
let workshopView = null;
let selectedIngredientId = null;
let hasSaveError = false;
let hasPendingSave = false;
let practiceContextSaveTimer = null;

const state = {
  filters: { search: "", active: "active", use: "all", view: "work" },
  elaborations: { search: "", type: "all", active: "active" },
  library: { kind: "elaborations", search: "", active: "active", quality: "all", page: 1, pageSize: 50, selectedKey: "" },
  workshopSearch: { search: "", type: "all", limit: 12 },
  quantityDialog: { mode: "add", elaboration: null, workshopItem: null }
};

window.SwiftRemoCore = {
  swiftDb,
  get repo() { return repo; },
  autosave,
  renderAll,
  get appState() { return appState?.get?.(); },
  get domainShell() { return domainShell; },
  get workshopDomain() { return workshopDomain; },
  toast,
  fmtMoney,
  fmtNumber,
  esc,
  addWorkSelectionItem,
  renderAll
};

window.addEventListener("DOMContentLoaded", init);

function cancelPendingPracticeContextSave(reason = "") {
  if (practiceContextSaveTimer) {
    clearTimeout(practiceContextSaveTimer);
    practiceContextSaveTimer = null;
  }
  hasPendingSave = false;
  if (reason) console.info(`[SwiftRemo] Guardado diferido de práctica cancelado: ${reason}`);
}

function readLocalJsonRawV651(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function migrateLegacyPracticeContextToSqliteV651() {
  if (!repo?.saveWorkSelectionContext) return;
  const previous = currentWorkContextV633();
  if (previous?.meta || previous?.plan || previous?.legacyMigratedV651) return;
  const legacyMeta = readLocalJsonRawV651(WORKSHOP_META_KEY);
  const legacyPlan = readLocalJsonRawV651(WORKSHOP_PLAN_KEY);
  const scopedMeta = readLocalJsonRawV651(scopedPracticeStorageKeyV645(WORKSHOP_META_KEY));
  const scopedPlan = readLocalJsonRawV651(scopedPracticeStorageKeyV645(WORKSHOP_PLAN_KEY));
  const meta = scopedMeta || legacyMeta;
  const plan = scopedPlan || legacyPlan;
  if (!meta && !plan) return;
  try {
    repo.saveWorkSelectionContext({
      ...previous,
      ...(meta ? { meta } : {}),
      ...(plan ? { plan } : {}),
      legacyMigratedV651: true,
      updatedAt: new Date().toISOString()
    });
    console.info("[SwiftRemo] Contexto de práctica legacy migrado a SQLite.");
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo migrar contexto legacy a SQLite", err);
  }
}

async function init() {
  try {
    bindEvents();
    initDomainLayer();
    await loadBestAvailableDb();
  } catch (err) {
    console.error(err);
    setState("Error JS", "error");
    setStatus(err.message, "err");
    setSaveIndicator("No se pudo iniciar", "err", "Descarga o importa una copia si tienes cambios.");
  }
}


function bindIfExists(selector, eventName, handler) {
  const el = document.querySelector(selector);
  if (el) el.addEventListener(eventName, handler);
}

function bindEvents() {
  $$(`[data-tab]`).forEach(btn => {
    if (btn.dataset.tabBound === "1") return;
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    btn.dataset.tabBound = "1";
  });
  $("#loadInitialDb").addEventListener("click", loadInitialDbWithConfirm);
  $("#sqliteFile").addEventListener("change", loadSqliteFile);
  $("#exportSqlite").addEventListener("click", exportSqlite);
  $("#exportJson").addEventListener("click", exportJson);
  bindIfExists("#privateSqliteFile", "change", importPrivateSqlitePackage);
  bindIfExists("#exportPrivateSqlite", "click", exportPrivateSqlite);
  bindIfExists("#privatePhotoFiles", "change", importPrivatePhotoFiles);
  bindIfExists("#privateSourceName", "input", syncPrivateSourceSlug);
  bindIfExists("#privateSourceSlug", "input", ev => { ev.target.dataset.autofilled = "0"; renderPrivateDataManager(); });
  bindIfExists("#privatePhotoKind", "change", renderPrivateDataManager);

  $("#ingredientSearch").addEventListener("input", ev => { state.filters.search = ev.target.value; renderIngredients(); });
  $("#ingredientActiveFilter").addEventListener("change", ev => { state.filters.active = ev.target.value; renderIngredients(); });
  $("#ingredientUseFilter").addEventListener("change", ev => { state.filters.use = ev.target.value; renderIngredients(); });
  bindIfExists("#ingredientViewMode", "change", ev => { state.filters.view = ev.target.value; renderIngredients(); });
  bindIfExists("#elaborationSearchV625", "input", ev => { state.elaborations.search = ev.target.value; renderElaborations(); });
  bindIfExists("#elaborationTypeFilterV625", "change", ev => { state.elaborations.type = ev.target.value; renderElaborations(); });
  bindIfExists("#elaborationStatusFilterV625", "change", ev => { state.elaborations.active = ev.target.value; renderElaborations(); });
  bindIfExists("#archiveKind", "change", ev => { state.library.kind = ev.target.value; state.library.page = 1; state.library.selectedKey = ""; renderArchiveCatalog(); });
  bindIfExists("#archiveSearch", "input", ev => { state.library.search = ev.target.value; state.library.page = 1; renderArchiveCatalog(); });
  bindIfExists("#archiveStatus", "change", ev => { state.library.active = ev.target.value; state.library.page = 1; state.library.selectedKey = ""; renderArchiveCatalog(); });
  bindIfExists("#archiveQuality", "change", ev => { state.library.quality = ev.target.value; state.library.page = 1; state.library.selectedKey = ""; renderArchiveCatalog(); });
  bindIfExists("#archivePageSize", "change", ev => { state.library.pageSize = Number(ev.target.value) || 50; state.library.page = 1; renderArchiveCatalog(); });
  bindIfExists("#workshopSearchInput", "input", ev => { ensureWorkshopSearchState().search = ev.target.value || ""; renderWorkshopSearch(); });
  bindIfExists("#workshopSearchType", "change", ev => { ensureWorkshopSearchState().type = ev.target.value || "all"; renderWorkshopSearch(); });
  bindIfExists("#workshopSearchLimit", "change", ev => { ensureWorkshopSearchState().limit = Number(ev.target.value) || 12; renderWorkshopSearch(); });
  bindIfExists("#workshopSearchClear", "click", () => { state.workshopSearch = { search: "", type: "all", limit: 12 }; const q = document.querySelector("#workshopSearchInput"); if (q) q.value = ""; const t = document.querySelector("#workshopSearchType"); if (t) t.value = "all"; const l = document.querySelector("#workshopSearchLimit"); if (l) l.value = "12"; renderWorkshopSearch(); });
  bindIfExists("#archiveClearFilters", "click", clearArchiveFilters);
  bindIfExists("#archiveCopyReview", "click", copyArchiveReviewReport);
  $("#newIngredient").addEventListener("click", newIngredientForm);
  $("#clearIngredientForm").addEventListener("click", clearIngredientForm);
  $("#deactivateIngredient").addEventListener("click", deactivateSelectedIngredient);
  $("#ingredientForm").addEventListener("submit", saveIngredientFromForm);
  $("#runSql").addEventListener("click", runSql);
  bindIfExists("#refreshAudit", "click", () => { renderBaseStatusV663(); renderAudit(); });
  bindIfExists("#copyBaseDiagnosisV663", "click", copyBaseDiagnosisV663);
  bindIfExists("#printQuickSession", "click", () => document.querySelector("#classPrintSessionV41")?.click());
  bindIfExists("#printQuickOrder", "click", () => document.querySelector("#globalPrintOrderV61")?.click());
  bindIfExists("#printQuickWorkshop", "click", () => printWorkshopSimpleDossier());
  bindIfExists("#workshopOrderPrintTechnical", "click", () => printWorkshopTechnicalOrder());
  bindIfExists("#workshopOrderPrintSimple", "click", () => printWorkshopDirect({ includeElaborations: false, includeOrder: true, reason: "historial impresión pedido simple desde pestaña pedido" }));
  bindIfExists("#workshopPrintDossier", "click", () => printWorkshopTeachingDossier());
  bindIfExists("#workshopPrintSheets", "click", () => printWorkshopTeachingSheets());
  bindIfExists("#workshopPrintOrder", "click", () => printWorkshopTechnicalOrder());
  bindIfExists("#workshopExportSqlite", "click", () => exportSqlite());
  bindIfExists("#workshopPrintSimpleSheets", "click", () => printWorkshopDirect({ includeElaborations: true, includeOrder: false, reason: "historial impresión elaboraciones práctica" }));
  bindIfExists("#workshopPrintSimpleOrder", "click", () => printWorkshopDirect({ includeElaborations: false, includeOrder: true, reason: "historial impresión pedido práctica" }));
  bindIfExists("#workshopPrintSimpleDossier", "click", () => printWorkshopSimpleDossier());
  bindIfExists("#workshopPrintTeachingSheets", "click", () => printWorkshopTeachingSheets());
  bindIfExists("#workshopPrintTechnicalOrder", "click", () => printWorkshopTechnicalOrder());
  bindIfExists("#workshopPrintTeachingDossier", "click", () => printWorkshopTeachingDossier());
  bindIfExists("#workshopOpenPrintCenter", "click", () => openWorkshopPrintDialog());
  bindIfExists("#workshopPrintDialogCancel", "click", () => closeWorkshopPrintDialog());
  bindIfExists("#workshopPrintDialogClose", "click", () => closeWorkshopPrintDialog());
  bindIfExists("#workshopPrintDialogConfirm", "click", () => executeWorkshopPrintDialog());
  bindIfExists("#workshopPrintDialog", "click", ev => { if (ev.target?.id === "workshopPrintDialog") closeWorkshopPrintDialog(); });
  bindIfExists("#workshopClear", "click", clearWorkshop);
  bindIfExists("#workshopArchive", "click", archiveWorkshopAsHistory);
  bindIfExists("#qtyModeV626", "change", handleQuantityModeChange);
  ["qtyScopeV6272", "qtyTeamCountV6272", "qtyPeoplePerTeamV6272", "qtyMainQtyV626", "qtyFlourGV626", "qtyRawDoughGV626", "qtyPiecesV626", "qtyPieceWeightGV626", "qtyBakingLossV626"].forEach(id => {
    bindIfExists("#" + id, "input", updateQuantityComputedV6272);
    bindIfExists("#" + id, "change", updateQuantityComputedV6272);
  });
  bindIfExists("#qtyConfirmV626", "click", saveQuantityDialog);
  bindIfExists("#qtyCancelV626", "click", closeQuantityDialog);
  bindIfExists("#qtyCloseV626", "click", closeQuantityDialog);
  ["practiceTeamCountV627", "practicePeoplePerTeamV627", "practiceStudentCountV627", "practiceServingsPerPersonV627", "practicePiecesPerPersonV627", "practiceSafetyMarginV627"].forEach(id => {
    bindIfExists("#" + id, "input", () => { savePracticePlanV627(); renderPracticePlanV627(); });
    bindIfExists("#" + id, "change", () => { savePracticePlanV627(); renderPracticePlanV627(); });
  });
  ["workshopTitle", "workshopDate", "workshopCycle", "workshopModule", "workshopGroup", "workshopResponsible", "workshopNotes", "printIncludeWorkshopData"].forEach(id => {
    bindIfExists("#" + id, "input", () => { saveWorkshopMeta(); });
    bindIfExists("#" + id, "change", () => { if (id === "workshopCycle") refreshWorkshopModules(true); if (id === "workshopModule") applyWorkshopModuleDefaultGroup(); saveWorkshopMeta(); });
  });
  document.addEventListener("click", ev => {
    const libDetailPre = ev.target.closest?.("[data-library-detail]");
    if (libDetailPre) {
      ev.preventDefault();
      state.library.kind = "elaborations";
      state.library.selectedKey = libDetailPre.dataset.libraryDetail || "";
      switchTab("archive-catalog");
      renderArchiveCatalog();
      return;
    }
    const focusPracticeSearch = ev.target.closest?.("[data-focus-practice-search]");
    if (focusPracticeSearch) {
      ev.preventDefault();
      focusWorkshopSearch();
      return;
    }
    const shellAction = ev.target.closest?.("[data-shell-action]");
    if (shellAction) {
      ev.preventDefault();
      const action = shellAction.dataset.shellAction || "";
      if (action === "archive-workshop") { archiveWorkshopAsHistory(); return; }
      if (action === "clear-workshop") { clearWorkshop(); return; }
    }
    const tabButton = ev.target.closest?.("[data-tab]");
    if (tabButton && !tabButton.dataset.tabBound) {
      ev.preventDefault();
      switchTab(tabButton.dataset.tab);
      return;
    }
    const del = ev.target.closest?.("[data-workshop-delete]");
    if (del) { ev.preventDefault(); deleteWorkshopItem(del.dataset.workshopDelete); return; }
    const editSel = ev.target.closest?.("[data-workshop-edit]");
    if (editSel) { ev.preventDefault(); editWorkshopItem(editSel.dataset.workshopEdit); return; }
    const openElab = ev.target.closest?.("[data-open-elaboration]");
    if (openElab) { ev.preventDefault(); openUnifiedElaboration(openElab.dataset.openElaboration); return; }
    const addElab = ev.target.closest?.("[data-add-elaboration-work]");
    if (addElab) { ev.preventDefault(); addUnifiedElaborationToWork(addElab.dataset.addElaborationWork); return; }
    const libPage = ev.target.closest?.("[data-library-page]");
    if (libPage) { ev.preventDefault(); state.library.page = Number(libPage.dataset.libraryPage) || 1; renderArchiveCatalog(); return; }
    const libDetail = ev.target.closest?.("[data-library-detail]");
    if (libDetail) { ev.preventDefault(); state.library.selectedKey = libDetail.dataset.libraryDetail || ""; renderArchiveCatalog(); return; }
    const libOpen = ev.target.closest?.("[data-library-open]");
    if (libOpen) { ev.preventDefault(); openUnifiedElaboration(libOpen.dataset.libraryOpen); return; }
    const libEditIng = ev.target.closest?.("[data-library-edit-ingredient]");
    if (libEditIng) { ev.preventDefault(); loadIngredientForm(libEditIng.dataset.libraryEditIngredient); switchTab("archive-ingredients"); return; }
  });
  bindScrollTargets();
  bindClassWorkflowAccordion();
  window.addEventListener("swiftremo:databaseChanged", async ev => {
    try {
      await loadBestAvailableDb();
      if (ev?.detail?.message) toast(ev.detail.message);
    } catch (err) {
      console.error(err);
      toast("No se pudo actualizar el panel tras cambios externos.", "err");
    }
  });

  window.addEventListener("beforeunload", ev => {
    if (hasSaveError || hasPendingSave) {
      ev.preventDefault();
      ev.returnValue = hasPendingSave
        ? "Hay cambios de práctica pendientes de guardado automático. Espera unos segundos o guarda antes de cerrar."
        : "Hay cambios que no se han podido guardar automáticamente. Descarga una copia antes de cerrar.";
    }
  });
}

function bindScrollTargets() {
  document.querySelectorAll("[data-scroll-target]").forEach(btn => {
    if (btn.dataset.scrollBound === "1") return;
    btn.addEventListener("click", () => {
      const selector = btn.dataset.scrollTarget;
      const target = selector ? document.querySelector(selector) : null;
      if (!target) return;
      const tab = target.closest(".tab-section")?.id?.replace("tab-", "");
      if (tab) switchTab(tab);
      const details = target.closest("details");
      if (details) details.open = true;
      setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    });
    btn.dataset.scrollBound = "1";
  });
}

function bindClassWorkflowAccordion() {
  const buttons = Array.from(document.querySelectorAll("[data-class-step-target]"));
  const panels = Array.from(document.querySelectorAll(".class-workflow-step"));
  if (!panels.length) return;

  const hint = document.querySelector("#classWorkflowHint");

  const labelFor = panel => {
    const summary = panel.querySelector("summary");
    return summary?.innerText?.replace(/\s+/g, " ")?.trim() || "paso seleccionado";
  };

  const setActive = panel => {
    panels.forEach(item => {
      const isActive = item === panel;
      item.classList.toggle("active", isActive);
      if (item.tagName === "DETAILS" && !isActive) item.open = false;
    });

    if (panel?.tagName === "DETAILS") panel.open = true;

    buttons.forEach(btn => {
      const target = btn.dataset.classStepTarget ? document.querySelector(btn.dataset.classStepTarget) : null;
      const isActive = target === panel;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (hint && panel) hint.textContent = `Bloque abierto: ${labelFor(panel)}.`;
  };

  panels.forEach(panel => {
    if (panel.dataset.accordionBound === "1") return;
    const summary = panel.querySelector("summary");
    if (summary) {
      summary.addEventListener("click", ev => {
        if (panel.open) {
          ev.preventDefault();
          setActive(panel);
        }
      });
    }
    panel.addEventListener("toggle", () => {
      if (panel.open) setActive(panel);
    });
    panel.dataset.accordionBound = "1";
  });

  buttons.forEach(btn => {
    if (btn.dataset.classStepBound === "1") return;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      const panel = btn.dataset.classStepTarget ? document.querySelector(btn.dataset.classStepTarget) : null;
      if (panel) setActive(panel);
    });
    btn.dataset.classStepBound = "1";
  });

  const initial = panels.find(panel => panel.hasAttribute("open"))
    || document.querySelector("#classAddDetails")
    || panels[0];
  setActive(initial);
}

async function loadBestAvailableDb() {
  cancelPendingPracticeContextSave("carga de base");
  setState("Cargando…", "loading");
  setSaveIndicator("Cargando…", "saving", "Buscando base de trabajo.");
  const recovery = await loadRecovery();
  if (recovery?.bytes) {
    try {
      await swiftDb.loadFromBytesAsync(new Uint8Array(recovery.bytes));
      ensurePrivateMediaSchema();
      afterDbLoaded("Base de trabajo restaurada.", "Guardado", recovery.savedAt);
      return;
    } catch (err) {
      console.error("[SwiftRemo] Recuperación no válida. Recovery corrupta. Se limpia y se carga base inicial.", err);
      try { await clearRecovery(); } catch (clearErr) { console.warn("[SwiftRemo] No se pudo limpiar la recuperación corrupta", clearErr); }
      setStatus("Recuperación no válida. La recuperación interna no se pudo abrir. Se ha limpiado y se carga la base inicial; importa una copia .sqlite si necesitas recuperar cambios.", "warn");
      setSaveIndicator("Recuperación limpiada", "err", "Se cargará una base inicial limpia.");
      await loadInitialDb(true);
      return;
    }
  }
  await loadInitialDb(false);
}

async function loadInitialDbWithConfirm() {
  if (!confirm("¿Usar la base inicial? Si no has descargado una copia, podrías perder los cambios actuales.")) return;
  await clearRecovery();
  await loadInitialDb(true);
}

async function loadInitialDb(saveAsCurrent = true) {
  cancelPendingPracticeContextSave("base inicial");
  setState("Cargando base…", "loading");
  setStatus("Cargando base inicial…", "warn");
  await swiftDb.loadFromUrl("../db/swiftremo.sqlite");
  ensurePrivateMediaSchema();
  if (saveAsCurrent) await autosave({ backup: true, reason: "base inicial" });
  afterDbLoaded("Base inicial cargada.", "Guardado", new Date().toISOString());
}

async function loadSqliteFile(ev) {
  cancelPendingPracticeContextSave("importación SQLite");
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    await swiftDb.loadFromFile(file);
    ensurePrivateMediaSchema();
    await autosave({ backup: true, reason: "importación" });
    afterDbLoaded(`Copia importada: ${file.name}`, "Guardado", new Date().toISOString());
  } catch (err) {
    console.error(err); toast(err.message, "err");
    setSaveIndicator("Error al importar", "err", err.message);
  }
}

function afterDbLoaded(message, saveLabel = "Guardado", savedAt = null) {
  ensurePrivateMediaSchema();
  syncPrivateSourceSlug();
  repo = new Repository(swiftDb);
  catalogs = repo.catalogs();
  selectedIngredientId = null;
  hasSaveError = false;
  populateCatalogs();
  clearIngredientForm(false);
  migrateLegacyPracticeContextToSqliteV651();
  renderAll();
  setState("Listo", "clean");
  setStatus(message, "ok");
  setSaveIndicator(saveLabel, "ok", savedAt ? `Última actualización: ${formatDate(savedAt)}` : "Listo.");
  window.dispatchEvent(new CustomEvent("swiftremo:coreReady", { detail: { message } }));
}

function initDomainLayer() {
  if (domainShell) return;
  appState = createAppState();
  workshopDomain = createWorkshopDomain({ getRepo: () => repo });
  workshopView = createWorkshopView({ document, formatters: { fmtNumber, fmtMoney } });
  technicalArchiveDomain = createTechnicalArchiveDomain({ getRepo: () => repo });
  historyDomain = createHistoryDomain({ getRepo: () => repo });
  systemBackupService = createSystemBackupService({ getDb: () => swiftDb });
  printDomain = createPrintDomain({ document });
  domainShell = createDomainShell({
    state: appState,
    onBeforeNavigate: (route) => {
      if ((route.route === "workshop-order" || route.route === "workshop-output") && repo && !getWorkshopState().hasItems) {
        toast("Primero añade al menos una elaboración al Taller.", "warn");
        focusWorkshopSearch();
        return false;
      }
      return true;
    },
    onAfterNavigate: () => renderDomainActions(getWorkshopState()); printDomain?.setEnabled?.(getWorkshopState())
  });
  domainShell.init();
}

function switchTab(tab) {
  if (!tab) return;
  if (domainShell?.navigate(tab)) return;
  console.warn(`[SwiftRemo] Ruta no encontrada: ${tab}`);
}

async function autosave({ backup = false, reason = "auto" } = {}) {
  try {
    setState("Guardando…", "saving");
    setSaveIndicator("Guardando…", "saving", "Actualizando base de trabajo.");
    const bytes = swiftDb.exportBytes();
    const saved = await saveRecovery(bytes, { backup, reason });
    hasSaveError = false;
    setState("Guardado", "clean");
    setSaveIndicator("Guardado", "ok", `Última actualización: ${formatDate(saved.savedAt)}`);
    setStatus("Cambios guardados.", "ok");
    return saved;
  } catch (err) {
    console.error(err);
    hasSaveError = true;
    setState("Error de guardado", "error");
    setSaveIndicator("No se pudo guardar", "err", "Descarga una copia .sqlite para no perder cambios.");
    setStatus("No se pudo guardar automáticamente. Descarga una copia .sqlite.", "err");
    toast("No se pudo guardar. Descarga una copia .sqlite.", "err");
    throw err;
  }
}

function renderAll() {
  [
    renderKpis,
    renderBaseStatusV663,
    renderPanelQualitySummary,
    renderSessionSummary,
    renderWorkshopMeta,
    renderPracticePlanV627,
    renderWorkshopSearch,
    renderArchiveCatalog,
    renderElaborations,
    renderIngredients,
    renderSelection,
    renderOrder,
    renderMargins,
    renderAudit,
    renderPrivateDataManager,
    renderWorkshopState
  ].forEach(fn => {
    try { fn(); }
    catch (err) {
      console.error(`[SwiftRemo] Error renderizando ${fn.name}`, err);
      const quality = document.querySelector("#panelQualitySummary");
      if (quality && fn.name === "renderPanelQualitySummary") {
        quality.className = "quality-strip warn";
        quality.innerHTML = "<b>Calidad no disponible en este momento.</b><span>Abre Revisar calidad o recarga la app.</span>";
      }
    }
  });
}

function renderKpis() {
  const k = repo.kpis();
  $("#kpis").innerHTML = `
    <div class="kpi"><span>Ingredientes activos</span><b>${k.ingredients}</b></div>
    <div class="kpi"><span>Elaboraciones</span><b>${Number(k.bakeryRecipes || 0) + Number(k.culinaryRecipes || 0)}</b></div>
    <div class="kpi"><span>Práctica actual</span><b>${k.workItems || 0}</b></div>
    <div class="kpi"><span>Coste práctica</span><b>${fmtMoney(k.workCost || 0)}</b></div>`;
}




function statusBadgeV663(label, tone = "off") {
  return `<span class="badge ${esc(tone)}">${esc(label)}</span>`;
}

function baseStatusDiagnosisTextV663(st) {
  if (!st) return "SwiftRemo · diagnóstico no disponible";
  return [
    "SwiftRemo · Estado de la base",
    `Release: ${st.releaseLabel}`,
    `Schema: ${st.schemaVersion}`,
    `Estado: ${st.statusLabel}`,
    `Quality gate: ${st.qualityGate}`,
    `Ingredientes: ${st.ingredientsActive} activos · ${st.ingredientsArchived} archivados · ${st.ingredientsTotal} totales`,
    `Fichas cocina/pastelería: ${st.culinaryActive} activas · ${st.culinaryArchived} archivadas · ${st.culinaryTotal} totales`,
    `Fórmulas panaderas: ${st.bakeryActive} activas · ${st.bakeryArchived} archivadas · ${st.bakeryTotal} totales`,
    `No validadas: ${st.culinaryNotValidated + st.bakeryNotValidated}`,
    `Duplicados activos: ingredientes ${st.duplicateIngredientNames} · elaboraciones ${st.duplicateElaborationNames}`,
    `Auditoría visible: ${st.blockers} bloqueadores · ${st.warnings} avisos · ${st.infos} informativos`,
    `Controles: ${st.checks || "n/d"}`
  ].join("\n");
}

function baseStatusHtmlV663(st, compact = false) {
  if (!st) {
    return `<div class="base-status-title-v663">Estado no disponible</div><div class="small">La base todavía no está cargada.</div>`;
  }
  const notValidated = Number(st.culinaryNotValidated || 0) + Number(st.bakeryNotValidated || 0);
  const duplicateTotal = Number(st.duplicateIngredientNames || 0) + Number(st.duplicateElaborationNames || 0);
  const diagnostic = st.blockers
    ? "Hay errores bloqueantes. Revisa la pestaña Calidad antes de imprimir o escandallar."
    : st.warnings
      ? "La base es operativa, pero hay avisos técnicos documentados."
      : "La base no presenta errores ni avisos bloqueantes en la auditoría visible.";
  const details = compact ? "" : `
    <div class="base-status-metadata-v663">
      <div><b>Versión</b><span>${esc(st.releaseLabel)}</span></div>
      <div><b>Schema</b><span>${esc(st.schemaVersion)}</span></div>
      <div><b>Quality gate</b><span>${esc(st.qualityGate)}</span></div>
    </div>`;
  return `
    <div class="base-status-head-v663">
      <div>
        <div class="base-status-title-v663">${esc(st.statusLabel)}</div>
        <div class="small">${esc(diagnostic)}</div>
      </div>
      ${statusBadgeV663(st.blockers ? "Bloqueada" : st.warnings ? "Con avisos" : "Apta", st.statusClass)}
    </div>
    <div class="base-status-grid-v663">
      <div><span>Ingredientes activos</span><b>${fmtNumber(st.ingredientsActive,0)}</b><small>${fmtNumber(st.ingredientsArchived,0)} archivados</small></div>
      <div><span>Fichas activas</span><b>${fmtNumber(st.culinaryActive,0)}</b><small>Cocina/Pastelería</small></div>
      <div><span>Fórmulas activas</span><b>${fmtNumber(st.bakeryActive,0)}</b><small>Panadería</small></div>
      <div><span>Bloqueadores</span><b>${fmtNumber(st.blockers,0)}</b><small>${fmtNumber(st.warnings,0)} avisos · ${fmtNumber(st.infos,0)} info</small></div>
      <div><span>No validadas</span><b>${fmtNumber(notValidated,0)}</b><small>Activas pendientes</small></div>
      <div><span>Duplicados activos</span><b>${fmtNumber(duplicateTotal,0)}</b><small>${fmtNumber(st.duplicateIngredientNames,0)} ingredientes · ${fmtNumber(st.duplicateElaborationNames,0)} elaboraciones</small></div>
    </div>
    ${details}`;
}

function renderBaseStatusV663() {
  const targets = [document.querySelector("#baseStatusPanelV663"), document.querySelector("#baseStatusAuditV663")].filter(Boolean);
  if (!targets.length) return;
  if (!repo) {
    targets.forEach(el => {
      el.className = "base-status-card-v663 muted";
      el.innerHTML = `<div class="base-status-title-v663">Estado pendiente de cargar</div><div class="small">SQLite todavía se está preparando.</div>`;
    });
    return;
  }
  try {
    const st = repo.baseStatusV663();
    targets.forEach(el => {
      const compact = el.id === "baseStatusPanelV663";
      el.className = `base-status-card-v663 ${st.statusClass || "muted"}`;
      el.innerHTML = baseStatusHtmlV663(st, compact);
    });
  } catch (err) {
    console.error("[SwiftRemo] No se pudo renderizar el estado de la base", err);
    targets.forEach(el => {
      el.className = "base-status-card-v663 warn";
      el.innerHTML = `<div class="base-status-title-v663">Estado no disponible</div><div class="small">Abre Calidad o recarga la app.</div>`;
    });
  }
}

async function copyBaseDiagnosisV663() {
  if (!repo) return toast("La base todavía no está cargada.", "warn");
  const text = baseStatusDiagnosisTextV663(repo.baseStatusV663());
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Diagnóstico copiado.");
  } catch (err) {
    console.error(err);
    toast("No se pudo copiar el diagnóstico.", "err");
  }
}

function renderPanelQualitySummary() {
  const el = document.querySelector("#panelQualitySummary");
  if (!el) return;
  if (!repo) {
    el.className = "quality-strip muted";
    el.innerHTML = "<b>Calidad pendiente de cargar.</b><span>La base todavía se está preparando.</span>";
    return;
  }
  try {
    const rows = repo.technicalAudit();
    const errors = rows.filter(r => r.severity === "error").length;
    const warns = rows.filter(r => r.severity === "warn").length;
    const infos = rows.filter(r => r.severity === "info").length;
    const cls = errors ? "quality-strip err" : warns ? "quality-strip warn" : "quality-strip ok";
    const label = errors ? "Revisión obligatoria antes de imprimir" : warns ? "Operativa con avisos técnicos" : "Sin errores críticos";
    el.className = cls;
    el.innerHTML = `<b>${esc(label)}</b><span>${errors} errores · ${warns} avisos · ${infos} notas</span>`;
  } catch (err) {
    console.error("[SwiftRemo] No se pudo cargar la calidad", err);
    el.className = "quality-strip warn";
    el.innerHTML = `<b>Calidad no disponible.</b><span>Entra en Revisar calidad o recarga la app.</span>`;
  }
}

function renderSessionSummary() {
  const box = document.querySelector("#workshopSummaryPanel");
  if (!box || !repo) return;
  const wf = getWorkshopState();
  if (!wf.hasItems) {
    box.innerHTML = `
      <div class="empty-state empty-state-6271 workflow-empty-panel-6704">
        <b>No hay práctica activa.</b>
        <span>El siguiente paso real es abrir Práctica, buscar una elaboración y definir la cantidad de producción.</span>
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Crear práctica</button><button type="button" class="btn ghost" data-tab="archive-catalog">Consultar Archivo técnico</button></div>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><span>Elaboraciones</span><b>${fmtNumber(wf.itemCount || 0,0)}</b></div>
      <div class="kpi"><span>Panadería</span><b>${fmtNumber(wf.bakeryItems || 0,0)}</b></div>
      <div class="kpi"><span>Cocina/Pastelería</span><b>${fmtNumber(wf.culinaryItems || 0,0)}</b></div>
      <div class="kpi"><span>Coste base aprox.</span><b>${fmtMoney(wf.estimatedCost || 0)}</b></div>
    </div>
    <div class="actions"><button type="button" class="btn primary" data-tab="workshop-practice">Continuar práctica</button><button type="button" class="btn ghost" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button></div>`;
}



const WORKSHOP_PLAN_KEY = "swiftremo_practice_plan_v627";
const WORKSHOP_META_KEY = "swiftremo_practice_meta_v632";

function scopedPracticeStorageKeyV645(baseKey) {
  try {
    const version = swiftDb?.isLoaded?.() ? swiftDb.selectValue("SELECT value FROM app_meta WHERE key='schema_version'") : "sin_db";
    return `${baseKey}_${String(version || "sin_version").replace(/[^a-z0-9_\-\.]+/gi, "_")}`;
  } catch {
    return baseKey;
  }
}

function readLocalJsonV645(baseKey, fallbackLegacy = false) {
  try {
    // Fase 6.51: cuando SQLite ya está cargada, el contexto de práctica vive en work_selections.context_json.
    // Evita arrastrar metadatos antiguos de localStorage al importar o cambiar de base.
    if (swiftDb?.isLoaded?.()) return null;
    const scoped = localStorage.getItem(scopedPracticeStorageKeyV645(baseKey));
    if (scoped) return JSON.parse(scoped);
    if (fallbackLegacy) {
      const legacy = localStorage.getItem(baseKey);
      return legacy ? JSON.parse(legacy) : null;
    }
    return null;
  } catch { return null; }
}

function writeLocalJsonV645(baseKey, data) {
  try {
    // Fase 6.51: localStorage solo es prearranque/compatibilidad. Con SQLite cargada, no se duplica contexto.
    if (swiftDb?.isLoaded?.()) return;
    localStorage.setItem(scopedPracticeStorageKeyV645(baseKey), JSON.stringify(data));
  } catch {}
}

function localPracticePlanV627() {
  return readLocalJsonV645(WORKSHOP_PLAN_KEY, true);
}

function currentWorkContextV633() {
  try { return repo?.workSelectionContext?.() || {}; }
  catch { return {}; }
}

function loadPracticePlanV627() {
  const contextPlan = currentWorkContextV633().plan;
  return contextPlan || localPracticePlanV627();
}

function practicePlanV627() {
  // Fase 6.34: se elimina la escala por alumnado de la UX estable.
  // Se conservan claves antiguas solo por compatibilidad con sesiones/exportaciones previas.
  return {
    teamCount: 1,
    peoplePerTeam: 1,
    totalStudents: 0,
    servingsPerPerson: 0,
    piecesPerPerson: 0,
    safetyMarginPct: 0
  };
}

function savePracticePlanV627() {
  const data = { productionScaleDisabledV634: true };
  writeLocalJsonV645(WORKSHOP_PLAN_KEY, data);
  savePracticeContextToSqliteV633({ plan: data });
}

function savePracticeContextToSqliteV633(partial = {}) {
  if (!repo?.saveWorkSelectionContext) return;
  const previous = currentWorkContextV633();
  const next = { ...previous, ...partial, updatedAt: new Date().toISOString() };
  try { repo.saveWorkSelectionContext(next); }
  catch (err) { console.error("[SwiftRemo] No se pudo guardar contexto de práctica", err); return; }
  if (practiceContextSaveTimer) clearTimeout(practiceContextSaveTimer);
  hasPendingSave = true;
  practiceContextSaveTimer = setTimeout(() => {
    autosave({ backup: false, reason: "contexto práctica" })
      .then(() => { hasPendingSave = false; practiceContextSaveTimer = null; })
      .catch(err => { hasSaveError = true; console.error(err); });
  }, 650);
}


function todayIso() { return new Date().toISOString().slice(0, 10); }

function localWorkshopMeta() {
  return readLocalJsonV645(WORKSHOP_META_KEY, true) || {};
}

function loadWorkshopMeta() {
  const contextMeta = currentWorkContextV633().meta;
  return contextMeta || localWorkshopMeta();
}

function workshopMeta() {
  const stored = loadWorkshopMeta() || {};
  const get = (id, fallback = "") => {
    const el = document.querySelector("#" + id);
    return el ? el.value : (stored[id] ?? fallback);
  };
  return {
    title: String(get("workshopTitle", stored.workshopTitle || "")).trim(),
    practiceDate: get("workshopDate", stored.workshopDate || todayIso()),
    cycleId: get("workshopCycle", stored.workshopCycle || ""),
    moduleId: get("workshopModule", stored.workshopModule || ""),
    groupName: String(get("workshopGroup", stored.workshopGroup || "")).trim(),
    responsible: String(get("workshopResponsible", stored.workshopResponsible || "Remo J. Pereira González")).trim(),
    notes: String(get("workshopNotes", stored.workshopNotes || "")).trim(),
    includePracticeData: document.querySelector("#printIncludeWorkshopData")
      ? document.querySelector("#printIncludeWorkshopData").checked
      : Boolean(stored.printIncludeWorkshopData)
  };
}

function saveWorkshopMeta() {
  const ids = ["workshopTitle", "workshopDate", "workshopCycle", "workshopModule", "workshopGroup", "workshopResponsible", "workshopNotes", "printIncludeWorkshopData"];
  const data = {};
  ids.forEach(id => { const el = document.querySelector("#" + id); if (el) data[id] = el.type === "checkbox" ? el.checked : el.value; });
  writeLocalJsonV645(WORKSHOP_META_KEY, data);
  savePracticeContextToSqliteV633({ meta: data });
}

function renderWorkshopMeta() {
  const titleEl = document.querySelector("#workshopTitle");
  if (!titleEl) return;
  const meta = workshopMeta();
  if (!titleEl.value && meta.title) titleEl.value = meta.title;
  const dateEl = document.querySelector("#workshopDate");
  if (dateEl && !dateEl.value) dateEl.value = meta.practiceDate || todayIso();
  const groupEl = document.querySelector("#workshopGroup");
  if (groupEl && !groupEl.value && meta.groupName) groupEl.value = meta.groupName;
  const respEl = document.querySelector("#workshopResponsible");
  if (respEl && !respEl.value) respEl.value = meta.responsible || "Remo J. Pereira González";
  const notesEl = document.querySelector("#workshopNotes");
  if (notesEl && !notesEl.value && meta.notes) notesEl.value = meta.notes;
  const includeDataEl = document.querySelector("#printIncludeWorkshopData");
  const stored = loadWorkshopMeta() || {};
  if (includeDataEl && typeof stored.printIncludeWorkshopData === "boolean") includeDataEl.checked = stored.printIncludeWorkshopData;
  else if (includeDataEl) includeDataEl.checked = true;
}

function populateWorkshopMetaSelectors() {
  if (!repo) return;
  const cycleEl = document.querySelector("#workshopCycle");
  const moduleEl = document.querySelector("#workshopModule");
  if (!cycleEl || !moduleEl) return;
  const meta = loadWorkshopMeta() || {};
  fillSelect(cycleEl, repo.cycles(), { value: "id", label: "name", blank: "Sin ciclo / seleccionar" });
  if (meta.workshopCycle) cycleEl.value = meta.workshopCycle;
  refreshWorkshopModules(false);
  if (meta.workshopModule) moduleEl.value = meta.workshopModule;
  renderWorkshopMeta();
}

function refreshWorkshopModules(resetModule = false) {
  if (!repo) return;
  const cycleId = document.querySelector("#workshopCycle")?.value || "";
  const moduleEl = document.querySelector("#workshopModule");
  if (!moduleEl) return;
  const old = moduleEl.value;
  const rows = repo.modules(cycleId || null);
  fillSelect(moduleEl, rows, { value: "id", label: r => `${r.module_code || ""} · ${r.module_name}`, blank: "Sin módulo / seleccionar" });
  if (!resetModule && old && rows.some(r => r.id === old)) moduleEl.value = old;
  if (resetModule) moduleEl.value = "";
}

function applyWorkshopModuleDefaultGroup() {
  if (!repo) return;
  const cycleId = document.querySelector("#workshopCycle")?.value || "";
  const moduleId = document.querySelector("#workshopModule")?.value || "";
  const groupEl = document.querySelector("#workshopGroup");
  if (!moduleId || !groupEl || groupEl.value.trim()) return;
  const m = repo.modules(cycleId || null).find(x => x.id === moduleId);
  if (m?.default_group) groupEl.value = m.default_group;
}

function renderPracticePlanV627() {
  const box = document.querySelector("#practicePlanHintV627");
  if (box) box.textContent = "";
}

function suggestedPracticeQuantityV627(mode, elab, item = null) {
  return null;
}


function foldText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function archiveSearchMatch(row, q) {
  if (!q) return true;
  const haystack = foldText([
    row.name, row.typeLabel, row.family, row.subfamily, row.statusLabel,
    row.baseLabel, row.orderGroup, row.unit, row.roleLabel, row.productionLabel,
    row.qualityLabel, ...(row.qualityIssues || [])
  ].join(" "));
  return haystack.includes(q);
}


function textLength(value) {
  return String(value || "").trim().length;
}

function hasWord(text, words) {
  const folded = foldText(text || "");
  return words.some(w => folded.includes(w));
}

function qualityType(result) {
  if (!result || result.key === "ingredient") return "ingredient";
  if (result.key === "archived") return "archived";
  if (result.criticals?.length) return "poor";
  if ((result.warnings?.length || 0) >= 3) return "review";
  return "complete";
}

function qualityLabel(type) {
  return ({
    complete: "Completa",
    review: "Revisable",
    poor: "Pobre",
    archived: "Archivada",
    ingredient: "Ingrediente"
  })[type] || "Sin clasificar";
}

function qualityBadgeType(type) {
  return ({ complete: "ok", review: "warn", poor: "err", archived: "off", ingredient: "off" })[type] || "off";
}

function qualityReview(row) {
  if (!row || row.sourceKind === "ingredient") {
    return { key: "ingredient", type: "ingredient", label: "Ingrediente", positives: ["Registro de ingrediente"], warnings: [], criticals: [], info: [] };
  }
  const positives = [];
  const warnings = [];
  const criticals = [];
  const info = [];
  if (!row.active) {
    return { key: "archived", type: "archived", label: "Archivada", positives: [], warnings: ["No visible por defecto"], criticals: [], info: ["Ficha conservada para trazabilidad"] };
  }
  const lines = repo.unifiedElaborationLines(row.uid || row.key) || [];
  const steps = repo.unifiedElaborationSteps(row.uid || row.key) || [];
  const lineCount = lines.length;
  const stepCount = steps.length;
  const stepText = steps.map(st => `${st.phase || ""} ${st.instruction || ""} ${st.notes || ""}`).join("\n");
  if (row.family) positives.push("Familia asignada"); else warnings.push("Sin familia técnica");
  if (row.subfamily) positives.push("Subfamilia asignada"); else warnings.push("Sin subfamilia técnica");
  if (lineCount > 0) positives.push(`${lineCount} línea${lineCount === 1 ? "" : "s"} técnica${lineCount === 1 ? "" : "s"}`); else criticals.push("Sin ingredientes/líneas técnicas");
  if (stepCount > 0) positives.push(`${stepCount} bloque${stepCount === 1 ? "" : "s"} de proceso/APPCC`); else criticals.push("Sin proceso estructurado");
  if (Number(row.cost || 0) > 0) positives.push("Coste calculable"); else warnings.push("Coste no calculable o cero");
  if (row.sourceKind === "culinary") {
    const raw = repo.culinaryRecipeById(row.id) || {};
    const processLen = textLength(raw.process);
    const appccLen = textLength(raw.appcc_notes);
    if (processLen >= 80 || stepCount >= 3) positives.push("Proceso suficientemente documentado"); else warnings.push("Proceso breve: conviene revisar técnica y secuencia");
    if (appccLen >= 25 || hasWord(stepText, ["appcc", "pcc", "temperatura", "frio", "caliente", "abat", "conserv", "alerg"])) positives.push("APPCC/puntos críticos presentes"); else warnings.push("APPCC poco visible");
    if (raw.production_kind === "technical_yield") {
      if (Number(raw.yield_quantity || 0) > 0 || String(row.baseLabel || "").toLowerCase().includes("rendimiento")) positives.push("Rendimiento técnico definido"); else warnings.push("Subelaboración sin rendimiento claro");
    } else {
      if (Number(raw.base_servings || 0) > 0) positives.push("Raciones base definidas"); else warnings.push("Sin raciones base");
      if (Number(raw.serving_weight_g || 0) > 0 || raw.production_kind === "dual") positives.push("Gramaje/rendimiento por servicio definido"); else warnings.push("Sin gramaje/ración orientativo");
    }
    if (raw.status === "validated") positives.push("Estado validado"); else warnings.push(`Estado ${statusLabel(raw.status)}`);
  }
  if (row.sourceKind === "bakery") {
    const raw = repo.bakeryRecipeById(row.id) || {};
    const flourLines = lines.filter(x => String(x.baker_role || "").toLowerCase() === "flour");
    const flourPct = flourLines.reduce((acc, x) => acc + Number(x.baker_pct || 0), 0);
    const hydration = Number(row.hydration || raw.real_hydration_pct || 0);
    if (Number(raw.base_flour_g || 0) > 0) positives.push("Harina base definida"); else criticals.push("Sin harina base");
    if (Math.abs(flourPct - 100) < 0.01) positives.push("Harina al 100 % panadero"); else warnings.push(`Porcentaje de harina no estándar: ${fmtNumber(flourPct, 2)} %`);
    if (hydration > 0) positives.push(`Hidratación calculada: ${fmtNumber(hydration, 1)} %`); else warnings.push("Hidratación no calculable");
    if (hydration > 120) info.push("Hidratación especial: revisar si es papilla, dosa, injera o sin gluten");
    if (hasWord(stepText, ["enfri", "conserv", "abat", "temperatura", "reposo", "ferment", "horne"])) positives.push("Proceso panadero con control técnico"); else warnings.push("Proceso panadero mejorable");
    if (raw.status === "validated") positives.push("Estado validado"); else warnings.push(`Estado ${statusLabel(raw.status)}`);
  }
  const type = qualityType({ warnings, criticals });
  return { key: type, type, label: qualityLabel(type), positives, warnings, criticals, info };
}

function enrichArchiveQuality(rows) {
  return rows.map(row => {
    const quality = qualityReview(row);
    return {
      ...row,
      quality,
      qualityType: quality.type,
      qualityLabel: quality.label,
      qualityIssues: [...(quality.criticals || []), ...(quality.warnings || []), ...(quality.info || [])]
    };
  });
}

function qualityMatchesFilter(row) {
  const filter = state.library.quality || "all";
  if (filter === "all") return true;
  if (filter === "actionable") return ["poor", "review"].includes(row.qualityType);
  return row.qualityType === filter;
}

function archiveRows() {
  if (!repo) return [];
  const kind = state.library.kind || "elaborations";
  const active = state.library.active || "active";
  const q = foldText(state.library.search || "").trim();
  let rows = [];

  if (kind === "ingredients") {
    rows = repo.ingredients({ search: "", active, use: "all" }).map(r => ({
      key: `ingredient:${r.id}`,
      sourceKind: "ingredient",
      id: r.id,
      name: r.name,
      typeLabel: "Ingrediente",
      family: r.family || "",
      subfamily: r.subfamily || "",
      unit: r.base_unit || "",
      orderGroup: r.order_group || "",
      roleLabel: r.bakery_role ? roleLabel(r.bakery_role) : "",
      statusLabel: r.active ? "Activo" : "Inactivo",
      active: Number(r.active) === 1,
      baseLabel: [r.base_unit || "", r.order_group || ""].filter(Boolean).join(" · "),
      cost: Number(r.cost_per_base_unit_after_waste || 0),
      raw: r
    }));
  } else if (kind === "culinary") {
    rows = repo.culinaryRecipes().map(r => ({
      key: `culinary:${r.id}`,
      uid: `culinary:${r.id}`,
      sourceKind: "culinary",
      id: r.id,
      name: r.name,
      typeLabel: "Cocina/Pastelería",
      family: r.family || "",
      subfamily: r.subfamily || "",
      productionLabel: productionKindLabel(r.production_kind),
      statusLabel: statusLabel(r.status),
      active: Number(r.active) === 1,
      baseLabel: culinaryBaseLabel(r),
      cost: Number(r.total_cost || 0),
      raw: r
    }));
  } else if (kind === "bakery") {
    rows = repo.bakeryRecipes().map(r => ({
      key: `bakery:${r.id}`,
      uid: `bakery:${r.id}`,
      sourceKind: "bakery",
      id: r.id,
      name: r.name,
      typeLabel: "Panadería",
      family: r.family || "",
      subfamily: r.subfamily || "",
      productionLabel: "Porcentaje panadero",
      statusLabel: statusLabel(r.status),
      active: Number(r.active) === 1,
      baseLabel: bakeryBaseLabel(r),
      cost: Number(r.total_cost || r.ingredient_cost_total || 0),
      hydration: Number(r.real_hydration_pct || 0),
      raw: r
    }));
  } else {
    rows = repo.unifiedElaborations({ search: "", type: "all", active }).map(r => ({
      key: r.uid,
      uid: r.uid,
      sourceKind: r.source_type,
      id: r.source_id,
      name: r.name,
      typeLabel: r.source_type === "bakery" ? "Panadería" : "Cocina/Pastelería",
      family: r.family || "",
      subfamily: r.subfamily || "",
      productionLabel: r.production_label || r.production_model || "",
      statusLabel: statusLabel(r.status),
      active: Number(r.active) === 1,
      baseLabel: r.base_label || "",
      cost: Number(r.total_cost || 0),
      raw: r
    }));
  }

  if (kind !== "ingredients" && kind !== "elaborations") {
    if (active === "active") rows = rows.filter(r => r.active);
    if (active === "inactive") rows = rows.filter(r => !r.active);
  }
  rows = enrichArchiveQuality(rows);
  if (q) rows = rows.filter(r => archiveSearchMatch(r, q));
  rows = rows.filter(qualityMatchesFilter);
  return rows.sort((a, b) => Number(b.active) - Number(a.active) || String(a.name).localeCompare(String(b.name), "es"));
}

function productionKindLabel(kind) {
  return ({ final_servings: "Raciones", technical_yield: "Rendimiento técnico", dual: "Dual" })[kind] || kind || "Ficha";
}

function culinaryBaseLabel(r) {
  if (r.production_kind === "technical_yield") return "Rendimiento técnico";
  const servings = Number(r.base_servings || 0) > 0 ? `${fmtNumber(r.base_servings, 0)} raciones` : "Sin raciones base";
  const weight = Number(r.serving_weight_g || 0) > 0 ? `${fmtNumber(r.serving_weight_g, 0)} g/ración` : "sin gramaje";
  return `${servings} · ${weight}`;
}

function bakeryBaseLabel(r) {
  const flour = Number(r.base_flour_g || 0) > 0 ? `${fmtNumber(r.base_flour_g, 0)} g harina` : "sin harina base";
  const dough = Number(r.total_raw_dough_g || 0) > 0 ? `${fmtNumber(r.total_raw_dough_g, 0)} g masa` : "";
  const hydration = Number(r.real_hydration_pct || 0) > 0 ? `${fmtNumber(r.real_hydration_pct, 1)} % hidratación` : "";
  return [flour, dough, hydration].filter(Boolean).join(" · ");
}

function clearArchiveFilters() {
  state.library.kind = "elaborations";
  state.library.search = "";
  state.library.active = "active";
  state.library.quality = "all";
  state.library.page = 1;
  state.library.pageSize = 50;
  state.library.selectedKey = "";
  renderArchiveCatalog();
  toast("Filtros de biblioteca limpiados.", "ok");
}

function ensureWorkshopSearchState() {
  if (!state.workshopSearch) state.workshopSearch = { search: "", type: "all", limit: 12 };
  state.workshopSearch.search = String(state.workshopSearch.search || "");
  state.workshopSearch.type = state.workshopSearch.type || "all";
  state.workshopSearch.limit = Number(state.workshopSearch.limit || 12) || 12;
  return state.workshopSearch;
}

function focusWorkshopSearch() {
  switchTab("workshop-practice");
  window.setTimeout(() => {
    const q = document.querySelector("#workshopSearchInput");
    if (!q) return;
    q.focus();
    q.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 80);
}

function hasWorkshopItems() {
  try { return !!repo && typeof repo.workSelectionItems === "function" && repo.workSelectionItems().length > 0; }
  catch { return false; }
}

function ensureWorkshopNotEmpty(message = "Primero añade al menos una elaboración a la práctica.") {
  if (hasWorkshopItems()) return true;
  toast(message, "warn");
  focusWorkshopSearch();
  return false;
}

function getWorkshopState() {
  if (workshopDomain) {
    try { return workshopDomain.getState(); } catch (err) { console.warn("[SwiftRemo] Adaptador de Taller no disponible", err); }
  }
  const empty = {
    hasDb: !!repo,
    hasItems: false,
    itemCount: 0,
    bakeryItems: 0,
    culinaryItems: 0,
    orderLineCount: 0,
    estimatedCost: 0,
    orderCost: 0,
    stage: "empty",
    nextAction: "Añadir elaboración",
    nextHelp: "Busca una elaboración y define la cantidad de producción."
  };
  if (!repo) return empty;
  try {
    const summary = typeof repo.workSelectionSummary === "function" ? repo.workSelectionSummary() : {};
    const items = typeof repo.workSelectionItems === "function" ? repo.workSelectionItems() : [];
    const orderRows = typeof repo.workSelectionOrder === "function" ? repo.workSelectionOrder("WORK_CURRENT") : [];
    const itemCount = Number(summary.total_items ?? items.length ?? 0) || 0;
    const orderCost = orderRows.reduce((acc, r) => acc + Number(r.estimated_cost_total || 0), 0);
    const hasItems = itemCount > 0;
    return {
      hasDb: true,
      hasItems,
      itemCount,
      bakeryItems: Number(summary.bakery_items || 0) || 0,
      culinaryItems: Number(summary.culinary_items || 0) || 0,
      orderLineCount: orderRows.length,
      estimatedCost: Number(summary.estimated_base_cost || 0) || 0,
      orderCost,
      stage: hasItems ? (orderRows.length ? "ready" : "selection") : "empty",
      nextAction: hasItems ? "Revisar pedido" : "Añadir elaboración",
      nextHelp: hasItems
        ? "La práctica ya tiene elaboraciones. El siguiente paso es revisar pedido o preparar salida documental."
        : "La práctica está vacía. Añade primero una elaboración desde el buscador."
    };
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo calcular el estado de flujo", err);
    return empty;
  }
}

function workshopStepClass(active) {
  return active ? "workshop-step-pill active" : "workshop-step-pill";
}

function workshopStepsHtml(wf) {
  const has = wf.hasItems;
  return `
    <div class="workshop-flow-steps" aria-label="Estado del flujo de práctica">
      <span class="${workshopStepClass(true)}">1 · Práctica</span>
      <span class="${workshopStepClass(has)}">2 · Pedido</span>
      <span class="${workshopStepClass(has)}">3 · Salida</span>
      <span class="${workshopStepClass(has)}">4 · Archivo</span>
    </div>`;
}

function workshopSummaryHtml(wf, context = "panel") {
  if (!wf.hasItems) {
    return `
      <div class="workshop-state-card empty">
        <div>
          <b>Práctica vacía</b>
          <span>La app mantiene bloqueados Pedido y Salida hasta que añadas una elaboración. El siguiente paso real es buscar y añadir.</span>
        </div>
        ${workshopStepsHtml(wf)}
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button><button type="button" class="btn ghost" data-tab="archive-catalog">Abrir Archivo técnico</button></div>
      </div>`;
  }
  return `
    <div class="workshop-state-card ready">
      <div>
        <b>Práctica activa</b>
        <span>${fmtNumber(wf.itemCount,0)} elaboración(es) · ${fmtNumber(wf.orderLineCount,0)} línea(s) de pedido · coste estimado ${fmtMoney(wf.orderCost || wf.estimatedCost || 0)}.</span>
      </div>
      ${workshopStepsHtml(wf)}
      <div class="actions"><button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button></div>
    </div>`;
}


function domainActionButtonHtml(wf, area = "practice") {
  if (!wf?.hasItems) {
    if (area === "order") {
      return `<button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button><button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button>`;
    }
    return `<button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button><button type="button" class="btn ghost" data-tab="archive-catalog">Archivo técnico</button>`;
  }
  if (area === "order") {
    return `<button type="button" class="btn primary" data-tab="workshop-output">Imprimir / exportar</button><button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button>`;
  }
  if (area === "practice-next") {
    return `<button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button><button type="button" class="btn ghost" data-tab="archive-review">Revisar calidad</button>`;
  }
  return `<button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button><button type="button" class="btn ghost" data-shell-action="archive-workshop">Archivar como sesión</button><button type="button" class="btn danger" data-shell-action="clear-workshop">Vaciar</button>`;
}

function renderDomainActions(wf) {
  if (workshopView?.renderActions) { workshopView.renderActions(wf); return; }
  const practiceActions = document.querySelector("#workshopActions");
  if (practiceActions) practiceActions.innerHTML = domainActionButtonHtml(wf, "practice");
  const practiceNext = document.querySelector("#workshopNextActions");
  if (practiceNext) practiceNext.innerHTML = domainActionButtonHtml(wf, "practice-next");
  const orderActions = document.querySelector("#workshopOrderActions");
  if (orderActions) orderActions.innerHTML = domainActionButtonHtml(wf, "order");
  const outputGrid = document.querySelector("#workshopOutputActionsGrid");
  if (outputGrid) outputGrid.classList.toggle("shell-output-grid-disabled", !wf.hasItems);
  const printHistoryCard = document.querySelector("#workshopPrintHistoryCard");
  if (printHistoryCard) printHistoryCard.classList.toggle("shell-secondary-empty", printHistoryCard.classList.contains("is-empty"));
}

function applyWorkshopButtonState(wf) {
  const disabledSelectors = [
    "button[data-tab='workshop-order']",
    "button[data-tab='workshop-output']",
    "button[data-requires-work-items='1']",
    "#workshopOrderPrintTechnical",
    "#workshopOrderPrintSimple",
    "#workshopPrintDossier",
    "#workshopPrintSheets",
    "#workshopPrintOrder",
    "#workshopOpenPrintCenter",
    "#workshopPrintSimpleSheets",
    "#workshopPrintSimpleOrder",
    "#workshopPrintSimpleDossier",
    "#workshopPrintTeachingSheets",
    "#workshopPrintTechnicalOrder",
    "#workshopPrintTeachingDossier"
  ];
  document.querySelectorAll(disabledSelectors.join(",")).forEach(btn => {
    btn.disabled = !wf.hasItems;
    btn.setAttribute("aria-disabled", wf.hasItems ? "false" : "true");
    btn.classList.toggle("is-disabled-by-empty-workshop", !wf.hasItems);
    btn.classList.toggle("workflow-disabled", !wf.hasItems);
    if (!wf.hasItems) btn.title = "Primero añade al menos una elaboración a la práctica.";
    else btn.removeAttribute("title");
  });

  const hideWhenEmpty = [
    "#workshopArchive",
    "#workshopClear"
  ];
  document.querySelectorAll(hideWhenEmpty.join(",")).forEach(btn => {
    btn.classList.toggle("hidden-by-workflow", !wf.hasItems);
  });

  document.querySelectorAll("#workshopPrintDossier, #workshopPrintSheets, #workshopPrintOrder, #workshopOpenPrintCenter").forEach(btn => {
    const card = btn.closest(".print-profile-card-618");
    if (card) card.classList.toggle("workflow-card-disabled", !wf.hasItems);
  });
  document.body.dataset.workflowState = wf.stage;
}

function renderWorkshopState() {
  if (!repo) return;
  const wf = getWorkshopState();
  if (workshopView?.render) { workshopView.render(wf); return; }
  const panel = document.querySelector("#workshopStatePanel");
  if (panel) panel.innerHTML = workshopSummaryHtml(wf, "panel");
  const practice = document.querySelector("#workshopPracticeState");
  if (practice) practice.innerHTML = workshopSummaryHtml(wf, "practice");
  const order = document.querySelector("#workshopOrderState");
  if (order) {
    order.innerHTML = wf.hasItems
      ? `<div class="workshop-state-card ready"><b>Pedido disponible</b><span>Revisa cantidades, unidades, proveedor, zona y coste. La impresión se hace desde Salida.</span></div>`
      : `<div class="workshop-state-card empty"><b>Pedido bloqueado</b><span>El pedido se genera automáticamente cuando la práctica tiene elaboraciones.</span><div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button></div></div>`;
  }
  const output = document.querySelector("#workshopOutputState");
  if (output) {
    output.innerHTML = wf.hasItems
      ? `<div class="workshop-state-card ready"><b>Salida preparada</b><span>Centro único para generar dossier, fichas, pedido u opciones avanzadas.</span></div>`
      : `<div class="workshop-state-card empty"><b>Salida no disponible todavía</b><span>Añade al menos una elaboración para activar la impresión y la exportación documental.</span><div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button></div></div>`;
  }
  renderDomainActions(wf);
  applyWorkshopButtonState(wf);
}

function updateWorkshopActionState() {
  renderWorkshopState();
}

function renderWorkshopSearch() {
  const box = document.querySelector("#workshopSearchResults");
  if (!box || !repo) return;
  const ps = ensureWorkshopSearchState();
  const q = String(ps.search || "").trim();
  const type = ps.type || "all";
  const limit = Math.max(4, Math.min(30, Number(ps.limit || 12)));
  const rows = repo.unifiedElaborations({ search: q, type, active: "active" }).slice(0, limit);
  const totalLabel = !q ? `Sugerencias activas · ${fmtNumber(rows.length, 0)}` : rows.length ? `${fmtNumber(rows.length, 0)} resultado${rows.length === 1 ? "" : "s"}` : "Sin resultados";
  if (!rows.length && !q) {
    box.innerHTML = `
      <div class="practice-search-empty-6702">
        <b>Busca una elaboración para añadirla a la práctica.</b>
        <span>Ejemplos útiles: croquetas, caldo, bica, pan, torta, salsa.</span>
      </div>`;
    return;
  }
  if (!rows.length) {
    box.innerHTML = `
      <div class="practice-search-empty-6702 warn">
        <b>No se encontraron elaboraciones activas.</b>
        <span>Prueba con otro término o abre Biblioteca completa para revisar archivadas y filtros avanzados.</span>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="practice-search-count-6702">${esc(totalLabel)} · añadir desde aquí no modifica la ficha maestra.</div>
    <div class="practice-search-list-6702">
      ${rows.map(r => `
        <article class="practice-search-card-6702">
          <div>
            <b>${esc(r.name)}</b>
            <span>${esc(r.source_type === "bakery" ? "Panadería" : "Cocina/Pastelería")} · ${esc(r.family || "Sin familia")} · ${esc(r.base_label || "Sin base definida")}</span>
          </div>
          <div class="practice-search-card-actions-6702">
            <button type="button" class="btn ghost compact" data-library-detail="${esc(r.uid)}" data-tab="archive-catalog">Detalle</button>
            <button type="button" class="btn primary compact" data-add-elaboration-work="${esc(r.uid)}">Añadir</button>
          </div>
        </article>`).join("")}
    </div>`;
}

function renderArchiveCatalog() {
  const tableEl = document.querySelector("#archiveTable");
  if (!tableEl || !repo) return;
  const controls = {
    kind: document.querySelector("#archiveKind"),
    search: document.querySelector("#archiveSearch"),
    status: document.querySelector("#archiveStatus"),
    quality: document.querySelector("#archiveQuality"),
    pageSize: document.querySelector("#archivePageSize")
  };
  if (controls.kind && controls.kind.value !== state.library.kind) controls.kind.value = state.library.kind;
  if (controls.search && controls.search.value !== state.library.search) controls.search.value = state.library.search;
  if (controls.status && controls.status.value !== state.library.active) controls.status.value = state.library.active;
  if (controls.quality && controls.quality.value !== state.library.quality) controls.quality.value = state.library.quality || "all";
  if (controls.pageSize && Number(controls.pageSize.value) !== Number(state.library.pageSize)) controls.pageSize.value = String(state.library.pageSize || 50);

  const rows = archiveRows();
  const size = Math.max(1, Number(state.library.pageSize || 50));
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  state.library.page = Math.min(Math.max(1, Number(state.library.page || 1)), totalPages);
  const start = (state.library.page - 1) * size;
  const pageRows = rows.slice(start, start + size);

  renderArchiveSummary(rows);
  const pager = archivePagerHtml(rows.length, start, pageRows.length, totalPages);
  const top = document.querySelector("#archivePagerTop");
  const bottom = document.querySelector("#archivePagerBottom");
  if (top) top.innerHTML = pager;
  if (bottom) bottom.innerHTML = pager;

  tableEl.innerHTML = table(archiveHeaders(), pageRows, {
    rowAttrs: r => r.key === state.library.selectedKey ? "class='selected-row'" : ""
  });

  const stillVisible = rows.some(r => r.key === state.library.selectedKey);
  if (!stillVisible) state.library.selectedKey = "";
  renderArchiveDetail(state.library.selectedKey);
}

function renderArchiveSummary(rows) {
  const el = document.querySelector("#archiveSummary");
  if (!el) return;
  const all = rows.length;
  const complete = rows.filter(r => r.qualityType === "complete").length;
  const review = rows.filter(r => r.qualityType === "review").length;
  const poor = rows.filter(r => r.qualityType === "poor").length;
  const archived = rows.filter(r => r.qualityType === "archived").length;
  const ingredients = rows.filter(r => r.sourceKind === "ingredient").length;
  el.innerHTML = `
    <div class="kpi"><span>Resultados</span><b>${fmtNumber(all, 0)}</b></div>
    <div class="kpi"><span>Completas</span><b>${fmtNumber(complete, 0)}</b></div>
    <div class="kpi"><span>Revisables</span><b>${fmtNumber(review, 0)}</b></div>
    <div class="kpi"><span>Pobres</span><b>${fmtNumber(poor, 0)}</b></div>
    <div class="kpi"><span>Archivadas</span><b>${fmtNumber(archived, 0)}</b></div>
    <div class="kpi"><span>Ingredientes</span><b>${fmtNumber(ingredients, 0)}</b></div>`;
}

function archivePagerHtml(total, start, count, totalPages) {
  const page = Number(state.library.page || 1);
  const from = total ? start + 1 : 0;
  const to = start + count;
  const disabledPrev = page <= 1 ? "disabled" : "";
  const disabledNext = page >= totalPages ? "disabled" : "";
  return `
    <span class="library-range-666b">Mostrando <b>${fmtNumber(from,0)}–${fmtNumber(to,0)}</b> de <b>${fmtNumber(total,0)}</b> · página ${fmtNumber(page,0)}/${fmtNumber(totalPages,0)}</span>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledPrev} data-library-page="1">Inicio</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledPrev} data-library-page="${page - 1}">Anterior</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledNext} data-library-page="${page + 1}">Siguiente</button>
    <button type="button" class="btn ghost mini-btn-666b" ${disabledNext} data-library-page="${totalPages}">Final</button>`;
}

function archiveHeaders() {
  return [
    { label: "Nombre", render: r => `<button type="button" class="link-btn" data-library-detail="${esc(r.key)}">${esc(r.name)}</button>` },
    { label: "Tipo", render: r => esc(r.typeLabel) },
    { label: "Familia", render: r => esc([r.family, r.subfamily].filter(Boolean).join(" · ")) },
    { label: "Base técnica", render: r => esc(r.baseLabel || "—") },
    { label: "Calidad", render: r => badge(r.qualityLabel || "—", qualityBadgeType(r.qualityType)) },
    { label: "Estado", render: r => badge(r.statusLabel || (r.active ? "Activo" : "Inactivo"), r.active ? "ok" : "off") },
    { label: "Coste", render: r => Number.isFinite(r.cost) && r.cost > 0 ? fmtMoney(r.cost) : "—" },
    { label: "Acciones", render: r => archiveActionsHtml(r) }
  ];
}

function archiveActionsHtml(r) {
  const detail = `<button type="button" class="btn ghost mini-btn-666b" data-library-detail="${esc(r.key)}">Detalle</button>`;
  if (r.sourceKind === "ingredient") return detail;
  return `${detail} <button type="button" class="btn ghost mini-btn-666b" data-library-open="${esc(r.uid)}">Editar</button> <button type="button" class="btn primary mini-btn-666b" data-add-elaboration-work="${esc(r.uid)}">Añadir</button>`;
}

function renderArchiveDetail(key) {
  const el = document.querySelector("#archiveDetail");
  if (!el) return;
  if (!key) {
    el.className = "library-detail-666b muted";
    el.innerHTML = "Selecciona un registro para ver su detalle.";
    return;
  }
  if (key.startsWith("ingredient:")) {
    renderArchiveIngredientDetail(el, key.slice("ingredient:".length));
  } else {
    renderArchiveElaborationDetail(el, key);
  }
}

function renderArchiveIngredientDetail(el, id) {
  const row = repo.ingredients({ search: "", active: "all", use: "all" }).find(r => r.id === id);
  const raw = repo.ingredientById(id);
  if (!row || !raw) {
    el.className = "library-detail-666b err";
    el.innerHTML = "No se encontró el ingrediente.";
    return;
  }
  el.className = "library-detail-666b";
  el.innerHTML = `
    <div class="library-detail-head-666b">
      <div>
        <h3>${esc(row.name)}</h3>
        <div class="library-detail-badges-666b">
          ${badge(row.active ? "Activo" : "Inactivo", row.active ? "ok" : "off")}
          ${row.use_culinary ? badge("Cocina/Pastelería", "ok") : ""}
          ${row.use_bakery ? badge("Panadería", "warn") : ""}
          ${row.bakery_role ? badge(roleLabel(row.bakery_role), "warn") : ""}
        </div>
      </div>
      <button type="button" class="btn ghost" data-library-edit-ingredient="${esc(id)}">Editar en ingredientes</button>
    </div>
    <div class="library-detail-grid-666b">
      <div><span>Familia</span><b>${esc(row.family || "—")}</b></div>
      <div><span>Subfamilia</span><b>${esc(row.subfamily || "—")}</b></div>
      <div><span>Unidad base</span><b>${esc(row.base_unit || "—")}</b></div>
      <div><span>Grupo pedido</span><b>${esc(row.order_group || "—")}</b></div>
      <div><span>Coste neto</span><b>${fmtMoney(row.cost_per_base_unit_after_waste || 0)}</b></div>
      <div><span>Coef. hídrico</span><b>${fmtNumber(row.hydration_factor, 2) || "—"}</b></div>
    </div>
    <div class="library-text-block-666b"><b>Notas</b><p>${esc(raw.notes || "Sin notas.")}</p></div>`;
}


function qualityListHtml(title, items, cls = "") {
  if (!items || !items.length) return "";
  return `<div class="quality-box-667 ${esc(cls)}"><b>${esc(title)}</b><ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
}

function qualityDetailHtml(q) {
  if (!q || q.type === "ingredient") return "";
  return `<section class="quality-review-667">
    <div class="quality-title-667">${badge(q.label, qualityBadgeType(q.type))}<span>Auditoría orientativa de ficha</span></div>
    <div class="quality-grid-667">
      ${qualityListHtml("Fortalezas", q.positives, "ok")}
      ${qualityListHtml("A revisar", q.warnings, "warn")}
      ${qualityListHtml("Crítico", q.criticals, "err")}
      ${qualityListHtml("Información", q.info, "info")}
    </div>
  </section>`;
}

function copyArchiveReviewReport() {
  if (!repo) return;
  const rows = archiveRows();
  const counts = rows.reduce((acc, r) => { acc[r.qualityType || "other"] = (acc[r.qualityType || "other"] || 0) + 1; return acc; }, {});
  const actionable = rows.filter(r => ["poor", "review"].includes(r.qualityType)).slice(0, 80);
  const lines = [
    "SwiftRemo · Informe de revisión de biblioteca",
    `Filtro catálogo: ${state.library.kind || "elaborations"}`,
    `Filtro estado: ${state.library.active || "active"}`,
    `Filtro calidad: ${state.library.quality || "all"}`,
    `Resultados: ${rows.length}`,
    `Completas: ${counts.complete || 0}`,
    `Revisables: ${counts.review || 0}`,
    `Pobres: ${counts.poor || 0}`,
    `Archivadas: ${counts.archived || 0}`,
    "",
    "Primeras fichas accionables:",
    ...actionable.map(r => `- [${r.qualityLabel}] ${r.name}: ${(r.qualityIssues || []).slice(0, 4).join("; ")}`)
  ];
  navigator.clipboard?.writeText(lines.join("\n")).then(
    () => toast("Informe de revisión copiado.", "ok"),
    () => toast("No se pudo copiar el informe.", "err")
  );
}

function renderArchiveElaborationDetail(el, uid) {
  const r = repo.unifiedElaborationByUid(uid);
  if (!r) {
    el.className = "library-detail-666b err";
    el.innerHTML = "No se encontró la elaboración.";
    return;
  }
  const lines = repo.unifiedElaborationLines(uid);
  const steps = repo.unifiedElaborationSteps(uid);
  el.className = "library-detail-666b";
  el.innerHTML = `
    <div class="library-detail-head-666b">
      <div>
        <h3>${esc(r.name)}</h3>
        <div class="library-detail-badges-666b">
          ${badge(r.source_type === "bakery" ? "Panadería" : "Cocina/Pastelería", r.source_type === "bakery" ? "warn" : "ok")}
          ${badge(r.production_label || r.production_model || "Modelo", r.source_type === "bakery" ? "warn" : "off")}
          ${badge(statusLabel(r.status), r.status === "validated" ? "ok" : r.status === "archived" ? "off" : "warn")}
          ${badge(qualityReview({ ...r, uid, key: uid, sourceKind: r.source_type, source_type: r.source_type, id: r.source_id, active: Number(r.active) === 1, cost: Number(r.total_cost || 0), hydration: Number(r.real_hydration_pct || 0) }).label, qualityBadgeType(qualityReview({ ...r, uid, key: uid, sourceKind: r.source_type, source_type: r.source_type, id: r.source_id, active: Number(r.active) === 1, cost: Number(r.total_cost || 0), hydration: Number(r.real_hydration_pct || 0) }).type))}
        </div>
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" data-library-open="${esc(uid)}">Abrir / editar</button>
        <button type="button" class="btn primary" data-add-elaboration-work="${esc(uid)}">Añadir a práctica</button>
      </div>
    </div>
    <div class="library-detail-grid-666b">
      <div><span>Familia</span><b>${esc(r.family || "—")}</b></div>
      <div><span>Subfamilia</span><b>${esc(r.subfamily || "—")}</b></div>
      <div><span>Base</span><b>${esc(r.base_label || "—")}</b></div>
      <div><span>Coste base</span><b>${fmtMoney(r.total_cost || 0)}</b></div>
      <div><span>Ingredientes</span><b>${fmtNumber(lines.length, 0)}</b></div>
      <div><span>Proceso</span><b>${fmtNumber(steps.length, 0)} bloque${steps.length === 1 ? "" : "s"}</b></div>
    </div>
    ${qualityDetailHtml(qualityReview({ ...r, uid, key: uid, sourceKind: r.source_type, source_type: r.source_type, id: r.source_id, active: Number(r.active) === 1, cost: Number(r.total_cost || 0), hydration: Number(r.real_hydration_pct || 0) }))}
    <h4>Ingredientes / líneas técnicas</h4>
    <div class="wide">${table([
      { label: "Línea", render: x => esc(x.line_name || "—") },
      { label: "Cantidad", render: x => x.baker_pct !== null && x.baker_pct !== undefined ? `${fmtNumber(x.baker_pct, 3)} %` : [fmtNumber(x.quantity, 3), x.unit].filter(Boolean).join(" ") || "—" },
      { label: "Rol/fase", render: x => esc([x.baker_role ? roleLabel(x.baker_role) : "", x.phase || ""].filter(Boolean).join(" · ")) },
      { label: "Coste", render: x => fmtMoney(x.estimated_cost || 0) },
      { label: "Nota", render: x => esc(x.technical_note || "") }
    ], lines)}</div>
    <h4>Proceso / APPCC</h4>
    <div class="library-steps-666b">${steps.length ? steps.map(st => `<article><b>${esc(st.phase || "Paso")} ${fmtNumber(st.step_order,0)}</b><p>${esc(st.instruction || "")}</p>${st.notes ? `<small>${esc(st.notes)}</small>` : ""}</article>`).join("") : "<p class='small'>Sin proceso estructurado disponible.</p>"}</div>`;
}

function renderElaborations() {
  const listEl = document.querySelector("#elaborationsListV625");
  const summaryEl = document.querySelector("#elaborationsSummaryV625");
  if (!listEl || !summaryEl || !repo) return;
  const rows = repo.unifiedElaborations(state.elaborations);
  const total = rows.length;
  const bakery = rows.filter(r => r.source_type === "bakery").length;
  const culinary = rows.filter(r => r.source_type === "culinary").length;
  const technical = rows.filter(r => r.production_kind === "technical_yield").length;
  summaryEl.innerHTML = `
    <div class="kpi"><span>Resultados</span><b>${fmtNumber(total,0)}</b></div>
    <div class="kpi"><span>Cocina/Pastelería</span><b>${fmtNumber(culinary,0)}</b></div>
    <div class="kpi"><span>Panadería</span><b>${fmtNumber(bakery,0)}</b></div>
    <div class="kpi"><span>Subelaboraciones</span><b>${fmtNumber(technical,0)}</b></div>`;
  if (!rows.length) {
    listEl.innerHTML = "<p class='small'>Sin elaboraciones con estos filtros.</p>";
    return;
  }
  const visible = rows.slice(0, 120);
  const note = rows.length > visible.length
    ? `<div class="view-hint-618 strong">Mostrando ${visible.length} de ${rows.length}. Usa el buscador para acotar.</div>`
    : `<div class="view-hint-618 strong">Mostrando ${rows.length} elaboración${rows.length === 1 ? "" : "es"}.</div>`;
  listEl.innerHTML = note + visible.map(renderElaborationCard).join("");
}

function renderElaborationCard(r) {
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

function statusLabel(v) {
  return ({ draft: "Borrador", reviewed: "Revisada", validated: "Validada", archived: "Archivada" })[v] || v || "—";
}

async function addUnifiedElaborationToWork(uid) {
  try {
    if (!repo) throw new Error("La base todavía no está preparada.");
    const r = repo.unifiedElaborationByUid(uid);
    if (!r) throw new Error("No se encontró la elaboración seleccionada.");
    openQuantityDialogForElaboration(r);
  } catch (err) { console.error(err); toast(err.message || "No se pudo preparar la cantidad.", "err"); }
}

function allowedQuantityModesFor(elab) {
  if (!elab) return [];
  if (elab.source_type === "bakery") {
    return [
      { value: "flour", label: "Harina total" },
      { value: "raw_dough", label: "Masa total" },
      { value: "pieces", label: "Nº piezas" }
    ];
  }
  if (elab.production_kind === "technical_yield") return [{ value: "yield", label: "Rendimiento técnico" }];
  if (elab.production_kind === "dual") return [
    { value: "servings", label: "Raciones" },
    { value: "yield", label: "Rendimiento técnico" }
  ];
  return [{ value: "servings", label: "Raciones" }];
}

function defaultQuantityModeFor(elab, item = null) {
  if (item?.production_mode) return item.production_mode;
  if (elab?.source_type === "bakery") return "flour";
  if (elab?.production_kind === "technical_yield") return "yield";
  if (elab?.production_kind === "dual") return elab.default_production_mode === "yield" ? "yield" : "servings";
  return "servings";
}

function quantityContractLabel(elab) {
  if (!elab) return "Selecciona un modo válido.";
  if (elab.source_type === "bakery") return "Panadería/Bollería: produce por harina, masa o piezas. No se usan raciones.";
  if (elab.production_kind === "technical_yield") return "Subelaboración técnica: produce por rendimiento en su unidad base.";
  if (elab.production_kind === "dual") return "Elaboración dual: puede producirse por raciones o por rendimiento técnico.";
  return "Ficha final de cocina/pastelería: produce por raciones.";
}

function openQuantityDialogForElaboration(elab, item = null) {
  const dialog = document.querySelector("#quantityDialogV626");
  if (!dialog) return fallbackPromptQuantity(elab, item);
  state.quantityDialog = { mode: item ? "edit" : "add", elaboration: elab, workshopItem: item || null };
  const modes = allowedQuantityModesFor(elab);
  const selectedMode = defaultQuantityModeFor(elab, item);
  document.querySelector("#qtyUidV626").value = elab.uid || `${elab.source_type}:${elab.source_id}`;
  document.querySelector("#qtySelectionItemIdV626").value = item?.selection_item_id || "";
  document.querySelector("#qtyItemTypeV626").value = elab.source_type;
  document.querySelector("#qtyCulinaryRecipeIdV626").value = elab.source_type === "culinary" ? elab.source_id : "";
  document.querySelector("#qtyBakeryRecipeIdV626").value = elab.source_type === "bakery" ? elab.source_id : "";
  document.querySelector("#qtyTitleV626").textContent = item ? "Cambiar cantidad" : "Añadir a la práctica";
  document.querySelector("#qtySubtitleV626").textContent = `${elab.name} · ${elab.production_label || elab.category_label || "Elaboración"}`;
  document.querySelector("#qtyContractV626").textContent = quantityContractLabel(elab);
  const modeSel = document.querySelector("#qtyModeV626");
  modeSel.innerHTML = modes.map(m => `<option value="${esc(m.value)}">${esc(m.label)}</option>`).join("");
  modeSel.value = modes.some(m => m.value === selectedMode) ? selectedMode : modes[0]?.value || "servings";
  document.querySelector("#qtyMainQtyV626").value = quantityValueForMode(modeSel.value, elab, item);
  document.querySelector("#qtyFlourGV626").value = quantityValueForMode("flour", elab, item);
  document.querySelector("#qtyRawDoughGV626").value = quantityValueForMode("raw_dough", elab, item);
  document.querySelector("#qtyPiecesV626").value = quantityValueForMode("pieces", elab, item, "pieces");
  document.querySelector("#qtyPieceWeightGV626").value = item?.piece_weight_g || elab.base_raw_piece_weight_g || 250;
  document.querySelector("#qtyBakingLossV626").value = item?.baking_loss_pct ?? elab.baking_loss_pct ?? 0;
  document.querySelector("#qtyNotesV626").value = item?.notes || "";
  prepareQuantityScopeV6272(item);
  syncQuantityDialogFields();
  updateQuantityComputedV6272();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "open");
}

function quantityValueForMode(mode, elab, item, subfield = null) {
  const clean = v => (v === null || v === undefined || v === "") ? "" : String(v).replace(".", ",");
  const suggested = suggestedPracticeQuantityV627(mode, elab, item);
  if (mode === "servings") return clean(item?.servings ?? suggested ?? elab.base_servings ?? 1);
  if (mode === "yield") return clean(item?.main_qty ?? elab.yield_quantity ?? 1);
  if (mode === "flour") return clean(item?.flour_g ?? elab.base_flour_g ?? 1000);
  if (mode === "raw_dough") return clean(item?.raw_dough_g ?? 1000);
  if (mode === "pieces") return clean(subfield === "pieces" ? (item?.pieces ?? suggested ?? elab.base_pieces ?? 1) : (item?.pieces ?? suggested ?? elab.base_pieces ?? 1));
  return "";
}


function prepareQuantityScopeV6272(item = null) {
  const plan = practicePlanV627();
  const teamEl = document.querySelector("#qtyTeamCountV6272");
  const peopleEl = document.querySelector("#qtyPeoplePerTeamV6272");
  const scopeEl = document.querySelector("#qtyScopeV6272");
  if (teamEl) teamEl.value = 1;
  if (peopleEl) peopleEl.value = plan.totalStudents || 1;
  if (scopeEl) scopeEl.value = item ? "total" : "total";
}

function quantityScopeDataV6272() {
  return { scope: "total", teamCount: 1, peoplePerTeam: 1, multiplier: 1 };
}

function quantityScopeLabelV6272(scope) {
  return "total de la práctica";
}

function currentQuantityRawValueV6272(mode) {
  if (mode === "servings" || mode === "yield") return parseDecimalInput(document.querySelector("#qtyMainQtyV626")?.value) || 0;
  if (mode === "flour") return parseDecimalInput(document.querySelector("#qtyFlourGV626")?.value) || 0;
  if (mode === "raw_dough") return parseDecimalInput(document.querySelector("#qtyRawDoughGV626")?.value) || 0;
  if (mode === "pieces") return parseDecimalInput(document.querySelector("#qtyPiecesV626")?.value) || 0;
  return 0;
}

function currentQuantityUnitV6272(mode) {
  const elab = state.quantityDialog.elaboration;
  if (mode === "servings") return "raciones";
  if (mode === "yield") return elab?.yield_unit || "unidad(es) de rendimiento";
  if (mode === "flour") return "g de harina";
  if (mode === "raw_dough") return "g de masa";
  if (mode === "pieces") return "piezas";
  return "unidades";
}

function updateQuantityComputedV6272() {
  const box = document.querySelector("#qtyComputedV6272");
  if (!box) return;
  const mode = document.querySelector("#qtyModeV626")?.value || "servings";
  const raw = currentQuantityRawValueV6272(mode);
  const { scope, teamCount, peoplePerTeam, multiplier } = quantityScopeDataV6272();
  const unit = currentQuantityUnitV6272(mode);
  const total = raw * multiplier;
  box.innerHTML = `<b>Cantidad total:</b> ${fmtNumber(total, mode === "pieces" || mode === "servings" ? 0 : 3)} ${esc(unit)} <span class="muted">para esta práctica.</span>`;
}

function scopedPositiveValueV6272(selector, label) {
  const value = positiveOrError(document.querySelector(selector)?.value, label);
  const { multiplier } = quantityScopeDataV6272();
  return value * multiplier;
}

function updatePracticePlanFromQuantityScopeV6272() {
  // Fase 6.34: sin escala por alumnado.
}

function scopedNotesSuffixV6272(mode) {
  return "";
}

function handleQuantityModeChange(ev) {
  const mode = ev?.target?.value || document.querySelector("#qtyModeV626")?.value || "servings";
  const elab = state.quantityDialog.elaboration;
  const item = state.quantityDialog.workshopItem;
  if (mode === "servings" || mode === "yield") {
    const main = document.querySelector("#qtyMainQtyV626");
    if (main) main.value = quantityValueForMode(mode, elab, item);
  }
  if (mode === "flour") {
    const input = document.querySelector("#qtyFlourGV626");
    if (input) input.value = quantityValueForMode("flour", elab, item);
  }
  if (mode === "raw_dough") {
    const input = document.querySelector("#qtyRawDoughGV626");
    if (input) input.value = quantityValueForMode("raw_dough", elab, item);
  }
  if (mode === "pieces") {
    const pieces = document.querySelector("#qtyPiecesV626");
    if (pieces) pieces.value = quantityValueForMode("pieces", elab, item, "pieces");
  }
  syncQuantityDialogFields();
  updateQuantityComputedV6272();
}

function syncQuantityDialogFields() {
  const mode = document.querySelector("#qtyModeV626")?.value || "servings";
  const elab = state.quantityDialog.elaboration;
  const show = (id, visible) => { const node = document.querySelector(id); if (node) node.classList.toggle("hidden", !visible); };
  show("#qtyMainWrapV626", mode === "servings" || mode === "yield");
  show("#qtyFlourWrapV626", mode === "flour");
  show("#qtyRawDoughWrapV626", mode === "raw_dough");
  show("#qtyPiecesWrapV626", mode === "pieces");
  show("#qtyPieceWeightWrapV626", mode === "pieces");
  show("#qtyLossWrapV626", elab?.source_type === "bakery" && (mode === "pieces" || mode === "raw_dough"));
  const mainWrap = document.querySelector("#qtyMainWrapV626");
  const unit = document.querySelector("#qtyMainUnitV626");
  if (mainWrap && unit) {
    if (mode === "servings") unit.textContent = "raciones";
    else if (mode === "yield") unit.textContent = elab?.yield_unit || "unidad de rendimiento";
    else unit.textContent = "";
  }
  const confirm = document.querySelector("#qtyConfirmV626");
  if (confirm) confirm.textContent = state.quantityDialog.mode === "edit" ? "Guardar cantidad" : "Añadir a la práctica";
  updateQuantityComputedV6272();
}

function closeQuantityDialog() {
  const dialog = document.querySelector("#quantityDialogV626");
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function parseDecimalInput(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function positiveOrError(value, label) {
  const n = parseDecimalInput(value);
  if (!(n > 0)) throw new Error(`${label} debe ser mayor que 0.`);
  return n;
}

async function saveQuantityDialog() {
  try {
    const elab = state.quantityDialog.elaboration;
    if (!elab) throw new Error("No hay elaboración seleccionada.");
    const mode = document.querySelector("#qtyModeV626")?.value || defaultQuantityModeFor(elab);
    const itemId = document.querySelector("#qtySelectionItemIdV626")?.value || "";
    const data = {
      $id: itemId || slugWorkSelectionItemId(),
      $item_type: elab.source_type,
      $culinary_recipe_id: elab.source_type === "culinary" ? elab.source_id : null,
      $bakery_recipe_id: elab.source_type === "bakery" ? elab.source_id : null,
      $production_mode: mode,
      $main_qty: null,
      $servings: null,
      $pieces: null,
      $piece_weight_g: null,
      $flour_g: null,
      $raw_dough_g: null,
      $baking_loss_pct: parseDecimalInput(document.querySelector("#qtyBakingLossV626")?.value) ?? 0,
      $print_a4: state.quantityDialog.workshopItem?.print_a4 ?? 1,
      $sort_order: state.quantityDialog.workshopItem?.sort_order ?? 100,
      $notes: ((document.querySelector("#qtyNotesV626")?.value || "") + scopedNotesSuffixV6272(mode)).trim() || null
    };
    updatePracticePlanFromQuantityScopeV6272();
    if (mode === "servings") data.$servings = scopedPositiveValueV6272("#qtyMainQtyV626", "Las raciones");
    if (mode === "yield") data.$main_qty = scopedPositiveValueV6272("#qtyMainQtyV626", "El rendimiento");
    if (mode === "flour") data.$flour_g = scopedPositiveValueV6272("#qtyFlourGV626", "La harina total");
    if (mode === "raw_dough") data.$raw_dough_g = scopedPositiveValueV6272("#qtyRawDoughGV626", "La masa total");
    if (mode === "pieces") {
      data.$pieces = scopedPositiveValueV6272("#qtyPiecesV626", "El número de piezas");
      data.$piece_weight_g = positiveOrError(document.querySelector("#qtyPieceWeightGV626")?.value, "El peso por pieza");
    }
    if (state.quantityDialog.mode === "edit" && itemId) {
      repo.updateWorkSelectionItem(data);
      toast("Cantidad actualizada.");
    } else {
      repo.addWorkSelectionItem(data);
      toast("Añadido a la práctica con cantidad definida.");
    }
    closeQuantityDialog();
    renderSelection();
    await autosave({ backup: false, reason: state.quantityDialog.mode === "edit" ? "editar cantidad práctica actual" : "añadir con cantidad práctica actual" });
    switchTab("workshop-practice");
  } catch (err) { console.error(err); toast(err.message || "No se pudo guardar la cantidad.", "err"); }
}

function editWorkshopItem(id) {
  const item = repo?.workSelectionItems().find(r => r.selection_item_id === id);
  if (!item) return toast("No se encontró la línea de la práctica actual.", "err");
  const uid = item.item_type === "bakery" ? `bakery:${item.bakery_recipe_id}` : `culinary:${item.culinary_recipe_id}`;
  const elab = repo.unifiedElaborationByUid(uid);
  if (!elab) return toast("No se encontró la elaboración asociada.", "err");
  openQuantityDialogForElaboration(elab, item);
}

function fallbackPromptQuantity(elab, item = null) {
  const mode = defaultQuantityModeFor(elab, item);
  const label = mode === "servings" ? "raciones" : mode === "yield" ? (elab.yield_unit || "rendimiento") : mode === "flour" ? "g de harina" : "cantidad";
  const value = prompt(`Cantidad para ${elab.name} (${label})`, quantityValueForMode(mode, elab, item));
  if (value === null) return;
  const fake = { production_mode: mode, notes: item?.notes || "" };
  if (mode === "servings") fake.servings = positiveOrError(value, "Las raciones");
  else if (mode === "yield") fake.main_qty = positiveOrError(value, "El rendimiento");
  else if (mode === "flour") fake.flour_g = positiveOrError(value, "La harina total");
  addWorkSelectionItem({ item_type: elab.source_type, culinary_recipe_id: elab.source_type === "culinary" ? elab.source_id : null, bakery_recipe_id: elab.source_type === "bakery" ? elab.source_id : null, ...fake });
}


function openUnifiedElaboration(uid) {
  const r = repo?.unifiedElaborationByUid(uid);
  if (!r) return toast("No se encontró la elaboración.", "err");
  if (r.source_type === "bakery") {
    switchTab("archive-bakery");
    setTimeout(() => {
      const sel = document.querySelector("#bakeryRecipeSelectV37");
      if (sel) { sel.value = r.source_id; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }, 80);
  } else {
    switchTab("archive-culinary");
    setTimeout(() => {
      const sel = document.querySelector("#culinaryRecipeSelectV51");
      if (sel) { sel.value = r.source_id; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    }, 80);
  }
}

function renderIngredients() {
  const rows = repo.ingredients(state.filters);
  const viewMode = state.filters.view || "work";
  const output = $("#ingredientsTable");
  const modeSelect = document.querySelector("#ingredientViewMode");
  if (modeSelect && modeSelect.value !== viewMode) modeSelect.value = viewMode;

  if (viewMode === "work") {
    output.classList.remove("wide");
    output.innerHTML = renderIngredientCards(rows);
  } else {
    output.classList.add("wide");
    output.innerHTML = table([
      { label: "Nombre", render: r => `<button type="button" class="link-btn" data-edit-ing="${esc(r.id)}">${esc(r.name)}</button>` },
      { label: "Familia", key: "family" },
      { label: "Unidad", key: "base_unit" },
      { label: "Coste neto", render: r => fmtMoney(r.cost_per_base_unit_after_waste) },
      { label: "Cocina", render: r => badge(r.use_culinary ? "Sí" : "No", r.use_culinary ? "ok" : "off") },
      { label: "Panadería", render: r => badge(r.use_bakery ? "Sí" : "No", r.use_bakery ? "ok" : "off") },
      { label: "Rol", render: r => r.bakery_role ? roleLabel(r.bakery_role) : "" },
      { label: "Coef.", render: r => fmtNumber(r.hydration_factor, 2) },
      { label: "Estado", render: r => badge(r.active ? "Activo" : "Inactivo", r.active ? "ok" : "off") }
    ], rows, { rowAttrs: r => r.id === selectedIngredientId ? "class='selected-row'" : "" });
  }
  document.querySelectorAll("[data-edit-ing]").forEach(btn => btn.addEventListener("click", () => loadIngredientForm(btn.dataset.editIng)));
}

function renderIngredientCards(rows) {
  if (!rows?.length) return "<p class='small'>Sin ingredientes con estos filtros.</p>";
  const limit = 80;
  const visible = rows.slice(0, limit);
  const note = rows.length > limit
    ? `<div class="view-hint-618 strong">Mostrando ${limit} de ${rows.length}. Usa el buscador o cambia a vista auditoría para ver todo.</div>`
    : `<div class="view-hint-618 strong">Mostrando ${rows.length} ingrediente${rows.length === 1 ? "" : "s"}.</div>`;
  return `${note}<div class="ingredient-card-grid-618">${
    visible.map(r => `
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




function renderAudit() {
  const tableEl = document.querySelector("#auditTable");
  const kpisEl = document.querySelector("#auditKpis");
  if (!tableEl || !kpisEl || !repo) return;
  const rows = repo.technicalAudit();
  const errors = rows.filter(r => r.severity === "error").length;
  const warns = rows.filter(r => r.severity === "warn").length;
  const infos = rows.filter(r => r.severity === "info").length;
  kpisEl.innerHTML = `
    <div class="kpi"><span>Errores bloqueantes</span><b>${errors}</b></div>
    <div class="kpi"><span>Avisos técnicos</span><b>${warns}</b></div>
    <div class="kpi"><span>Notas informativas</span><b>${infos}</b></div>
    <div class="kpi"><span>Estado</span><b>${errors ? "Revisar" : "Operativo"}</b></div>`;
  tableEl.innerHTML = table([
    { label: "Nivel", render: r => badge(r.severity === "error" ? "Error" : r.severity === "warn" ? "Aviso" : "Info", r.severity === "error" ? "err" : r.severity === "warn" ? "warn" : "off") },
    { label: "Área", key: "area" },
    { label: "Elemento", key: "item" },
    { label: "Mensaje", key: "message" }
  ], rows);
}


function renderSelection() {
  if (!repo) return;
  const summaryEl = document.querySelector("#workshopSelectionSummary");
  const itemsEl = document.querySelector("#workshopItemsList");
  const historyEl = document.querySelector("#workshopPrintHistory");
  const historyCard = document.querySelector("#workshopPrintHistoryCard");
  if (!summaryEl || !itemsEl) return;
  const s = repo.workSelectionSummary();
  const rows = repo.workSelectionItems();
  if (!rows.length) {
    summaryEl.classList.add("empty-practice-summary");
    summaryEl.innerHTML = `
      <div class="empty-action-card-628">
        <b>Práctica sin elaboraciones.</b>
        <span>Usa el buscador de esta misma pantalla para añadir la primera elaboración y definir su producción.</span>
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Buscar elaboración</button></div>
      </div>`;
    itemsEl.innerHTML = `
      <div class="empty-action-card-628">
        <b>No has añadido elaboraciones.</b>
        <span>Las cantidades se decidirán al añadir cada elaboración: cantidad total de esta práctica.</span>
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir desde el buscador</button><button type="button" class="btn ghost" data-tab="archive-catalog">Abrir Biblioteca completa</button></div>
      </div>`;
  } else {
    summaryEl.classList.remove("empty-practice-summary");
    summaryEl.innerHTML = `
      <div class="kpi"><span>Elaboraciones</span><b>${fmtNumber(s.total_items || 0,0)}</b></div>
      <div class="kpi"><span>Panadería</span><b>${fmtNumber(s.bakery_items || 0,0)}</b></div>
      <div class="kpi"><span>Cocina/Pastelería</span><b>${fmtNumber(s.culinary_items || 0,0)}</b></div>
      <div class="kpi"><span>Coste base aprox.</span><b>${fmtMoney(s.estimated_base_cost || 0)}</b></div>`;
    itemsEl.innerHTML = table([
      { label: "Tipo", render: r => r.item_type === "bakery" ? "Panadería" : "Cocina/Pastelería" },
      { label: "Elaboración", key: "item_name" },
      { label: "Modo", render: r => workshopModeLabel(r) },
      { label: "Cantidad", render: r => `<span class="quantity-chip-626">${workshopQuantityLabel(r)}</span>` },
      { label: "Coste base", render: r => fmtMoney(r.estimated_cost) },
      { label: "", render: r => `<div class="quantity-inline-actions-626"><button type="button" class="btn compact" data-workshop-edit="${esc(r.selection_item_id)}">Cambiar</button><button type="button" class="btn danger compact" data-workshop-delete="${esc(r.selection_item_id)}">Quitar</button></div>` }
    ], rows);
  }
  if (historyEl) {
    const jobs = repo.printJobs(20);
    if (historyCard) historyCard.classList.toggle("is-empty", !jobs.length);
    historyEl.innerHTML = jobs.length ? table([
      { label: "Fecha", render: r => formatDate(r.created_at) },
      { label: "Origen", render: r => printSourceLabel(r.source_type) },
      { label: "Título", key: "title" },
      { label: "Perfil", key: "profile" },
      { label: "Elementos", key: "item_count" },
      { label: "Coste", render: r => fmtMoney(r.total_cost) }
    ], jobs) : "";
  }
  updateWorkshopActionState();
}

async function addWorkSelectionItem(item) {
  try {
    if (!repo) throw new Error("La base todavía no está preparada.");
    const data = {
      $id: slugWorkSelectionItemId(),
      $item_type: item.item_type,
      $culinary_recipe_id: item.culinary_recipe_id || null,
      $bakery_recipe_id: item.bakery_recipe_id || null,
      $production_mode: item.production_mode,
      $main_qty: item.main_qty ?? null,
      $servings: item.servings ?? null,
      $pieces: item.pieces ?? null,
      $piece_weight_g: item.piece_weight_g ?? null,
      $flour_g: item.flour_g ?? null,
      $raw_dough_g: item.raw_dough_g ?? null,
      $baking_loss_pct: item.baking_loss_pct ?? null,
      $print_a4: item.print_a4 ?? 1,
      $sort_order: item.sort_order ?? 100,
      $notes: item.notes || null
    };
    repo.addWorkSelectionItem(data);
    renderSelection();
    renderOrder();
    await autosave({ backup: false, reason: "práctica actual" });
    toast("Añadido a la práctica.");
  } catch (err) { console.error(err); toast(err.message || "No se pudo añadir a la práctica actual.", "err"); }
}

async function deleteWorkshopItem(id) {
  try {
    repo.deleteWorkSelectionItem(id);
    renderSelection();
    renderOrder();
    await autosave({ backup: false, reason: "quitar de práctica actual" });
    toast("Elaboración quitada de la práctica.", "warn");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function clearWorkshop() {
  try {
    const wf = getWorkshopState();
    if (!wf.hasItems) {
      toast("No hay elaboraciones que vaciar.", "warn");
      focusWorkshopSearch();
      return;
    }
    if (!confirm(`Vas a vaciar una práctica con ${fmtNumber(wf.itemCount,0)} elaboración(es). No se borran fichas, fórmulas, biblioteca ni sesiones archivadas.`)) return;
    repo.clearWorkSelection();
    renderSelection();
    renderOrder();
    renderWorkshopState();
    const activeRoute = domainShell?.getActive?.()?.route || "";
    if (activeRoute === "workshop-order" || activeRoute === "workshop-output") switchTab("workshop-practice");
    await autosave({ backup: false, reason: "vaciar práctica actual" });
    toast("Práctica actual vaciada.", "warn");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function archiveWorkshopAsHistory() {
  try {
    if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de archivar la sesión.")) return;
    const meta = workshopMeta();
    const plan = practicePlanV627();
    const title = meta.title || `Práctica ${meta.practiceDate || todayIso()}`;
    const id = repo.createSessionFromWorkSelection({
      title,
      practiceDate: meta.practiceDate || todayIso(),
      cycleId: meta.cycleId || null,
      moduleId: meta.moduleId || null,
      groupName: meta.groupName || null,
      responsible: meta.responsible || null,
      notes: meta.notes || "Sesión creada desde la práctica actual.",
      totalStudents: plan.totalStudents || null,
      servingsPerPerson: plan.servingsPerPerson || null,
      piecesPerStudent: plan.piecesPerPerson || null,
      safetyMarginPct: plan.safetyMarginPct || null
    });
    await autosave({ backup: false, reason: "crear sesión desde práctica actual" });
    renderAll();
    toast("Sesión guardada con los datos de práctica.");
    switchTab("history-records");
    window.dispatchEvent(new CustomEvent("swiftremo:databaseChanged", { detail: { message: "Sesión guardada con datos de práctica." } }));
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

function workshopPrintMetadata() {
  const meta = workshopMeta();
  const plan = practicePlanV627();
  return {
    title: meta.title || `Práctica ${meta.practiceDate || todayIso()}`,
    practiceDate: meta.practiceDate || todayIso(),
    cycleId: meta.cycleId || null,
    moduleId: meta.moduleId || null,
    groupName: meta.groupName || null,
    responsible: meta.responsible || null,
    notes: meta.notes || "",
    includePracticeData: Boolean(meta.includePracticeData),
    totalStudents: null,
    servingsPerPerson: null,
    piecesPerStudent: null,
    safetyMarginPct: null
  };
}

function printOptionsV637(overrides = {}) {
  return {
    includeElaborations: overrides.includeElaborations !== undefined ? Boolean(overrides.includeElaborations) : true,
    includeOrder: overrides.includeOrder !== undefined ? Boolean(overrides.includeOrder) : true,
    includePracticeData: document.querySelector("#printIncludeWorkshopData")?.checked === true,
    subrecipeMode: overrides.subrecipeMode || document.querySelector('input[name="printSubrecipeModeV646"]:checked')?.value || "expanded",
    processMode: overrides.processMode || document.querySelector('input[name="printProcessModeV649"]:checked')?.value || "show"
  };
}

async function printWorkshopDirect({ includeElaborations = true, includeOrder = true, reason = "historial impresión práctica actual" } = {}) {
  try {
    if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de imprimir.")) return;
    const opts = printOptionsV637({ includeElaborations, includeOrder });
    if (!opts.includeElaborations && !opts.includeOrder) { toast("Selecciona elaboraciones, pedido o ambos para imprimir.", "warn"); return; }
    printWorkSelection(swiftDb, "WORK_CURRENT", { ...opts, profile: "docente", metadata: workshopPrintMetadata(), subrecipeMode: opts.subrecipeMode, processMode: opts.processMode });
    await autosave({ backup: false, reason });
    renderSelection();
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo imprimir la práctica actual.", "err");
  }
}

async function printWorkshopSimpleDossier() {
  return printWorkshopDirect({ includeElaborations: true, includeOrder: true, reason: "historial impresión elaboraciones y pedido práctica" });
}

async function printSelection() {
  return printWorkshopSimpleDossier();
}

async function printSelectionOrder() {
  return printWorkshopDirect({ includeElaborations: false, includeOrder: true, reason: "historial impresión pedido práctica" });
}

async function printWorkshopTeachingSheets() {
  try {
    if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de imprimir fichas.")) return;
    const opts = printOptionsV637({ includeElaborations: true, includeOrder: false });
    printWorkSelectionTeachingSheets(swiftDb, "WORK_CURRENT", { profile: "ficha_docente_completa", metadata: workshopPrintMetadata(), includePracticeData: opts.includePracticeData, subrecipeMode: opts.subrecipeMode, processMode: opts.processMode });
    await autosave({ backup: false, reason: "historial impresión ficha docente completa práctica" });
    renderSelection();
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo imprimir la ficha docente completa.", "err");
  }
}

async function printWorkshopTechnicalOrder() {
  try {
    if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de imprimir el pedido.")) return;
    const opts = printOptionsV637({ includeElaborations: false, includeOrder: true });
    printWorkSelectionTechnicalOrder(swiftDb, "WORK_CURRENT", { profile: "pedido_tecnico", metadata: workshopPrintMetadata(), includePracticeData: opts.includePracticeData });
    await autosave({ backup: false, reason: "historial impresión pedido técnico práctica" });
    renderSelection();
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo imprimir el pedido técnico.", "err");
  }
}


function openWorkshopPrintDialog() {
  if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de abrir la salida.")) return;
  const dialog = document.querySelector("#workshopPrintDialog");
  if (!dialog) return printWorkshopSimpleDossier();
  const selected = dialog.querySelector('input[name="workshopPrintProfile"]:checked');
  if (!selected) {
    const fallback = dialog.querySelector('input[name="workshopPrintProfile"][value="both"]');
    if (fallback) fallback.checked = true;
  }
  const count = repo?.workSelectionItems ? repo.workSelectionItems("WORK_CURRENT").length : 0;
  const summary = dialog.querySelector("#workshopPrintDialogSummary");
  if (summary) summary.textContent = count ? `${fmtNumber(count,0)} elaboración(es) en la práctica actual.` : "La práctica actual está vacía.";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "open");
}

function closeWorkshopPrintDialog() {
  const dialog = document.querySelector("#workshopPrintDialog");
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function selectedWorkshopPrintProfile() {
  return document.querySelector('input[name="workshopPrintProfile"]:checked')?.value || "both";
}

async function executeWorkshopPrintDialog() {
  const profile = selectedWorkshopPrintProfile();
  closeWorkshopPrintDialog();
  if (profile === "elaborations") return printWorkshopDirect({ includeElaborations: true, includeOrder: false, reason: "historial impresión ficha técnica práctica" });
  if (profile === "order") return printWorkshopDirect({ includeElaborations: false, includeOrder: true, reason: "historial impresión pedido simple práctica" });
  if (profile === "both") return printWorkshopSimpleDossier();
  if (profile === "teaching") return printWorkshopTeachingSheets();
  if (profile === "technical_order") return printWorkshopTechnicalOrder();
  if (profile === "teaching_order") return printWorkshopTeachingDossier();
  return printWorkshopSimpleDossier();
}

async function printWorkshopTeachingDossier() {
  try {
    if (!ensureWorkshopNotEmpty("Primero añade al menos una elaboración antes de imprimir el dossier.")) return;
    const opts = printOptionsV637({ includeElaborations: true, includeOrder: true });
    printWorkSelectionTeachingSheetsWithOrder(swiftDb, "WORK_CURRENT", { profile: "ficha_docente_mas_pedido", metadata: workshopPrintMetadata(), includePracticeData: opts.includePracticeData, subrecipeMode: opts.subrecipeMode, processMode: opts.processMode });
    await autosave({ backup: false, reason: "historial impresión ficha docente más pedido práctica" });
    renderSelection();
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo imprimir la ficha docente con pedido.", "err");
  }
}

function workshopModeLabel(r) { return ({ flour:"Harina", raw_dough:"Masa cruda", pieces:"Piezas", servings:"Raciones", yield:"Rendimiento" })[r.production_mode] || r.production_mode || "—"; }
function workshopQuantityLabel(r) {
  if (r.production_mode === "servings") return `${fmtNumber(r.servings,0)} raciones`;
  if (r.production_mode === "yield") return `${fmtNumber(r.main_qty,3)} ${r.yield_unit || "unidad"}`;
  if (r.production_mode === "flour") return `${fmtNumber(r.flour_g,0)} g harina`;
  if (r.production_mode === "raw_dough") return `${fmtNumber(r.raw_dough_g,0)} g masa`;
  if (r.production_mode === "pieces") return `${fmtNumber(r.pieces,0)} piezas × ${fmtNumber(r.piece_weight_g,0)} g`;
  return "—";
}
function printSourceLabel(v) { return ({ recipe:"Ficha", selection:"Práctica actual", session:"Histórico", order:"Pedido" })[v] || v || "—"; }

function renderOrder() {
  const tableEl = document.querySelector("#orderTable");
  const summaryEl = document.querySelector("#workshopOrderSummary");
  if (!tableEl || !repo) return;
  const rows = typeof repo.workSelectionOrder === "function" ? repo.workSelectionOrder("WORK_CURRENT") : repo.order();
  const summary = repo.workSelectionSummary ? repo.workSelectionSummary() : { total_items: 0, estimated_base_cost: 0 };
  const totalCost = rows.reduce((acc, r) => acc + Number(r.estimated_cost_total || 0), 0);
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="kpi"><span>Elaboraciones</span><b>${fmtNumber(summary.total_items || 0,0)}</b></div>
      <div class="kpi"><span>Líneas pedido</span><b>${fmtNumber(rows.length,0)}</b></div>
      <div class="kpi"><span>Coste pedido</span><b>${fmtMoney(totalCost)}</b></div>
      <div class="kpi"><span>Origen</span><b>Práctica actual</b></div>`;
  }
  if (!rows.length) {
    tableEl.innerHTML = `
      <div class="empty-action-card-628">
        <b>Pedido vacío.</b>
        <span>Añade elaboraciones desde Práctica y define cantidades para calcular el pedido.</span>
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button><button type="button" class="btn ghost" data-tab="workshop-practice">Ir al Taller</button></div>
      </div>`;
    updateWorkshopActionState();
    return;
  }
  updateWorkshopActionState();
  tableEl.innerHTML = table([
    { label: "Grupo", key: "order_group" },
    { label: "Ingrediente", key: "ingredient" },
    { label: "Cantidad", render: r => fmtNumber(r.purchase_quantity, 3) },
    { label: "Unidad", key: "purchase_unit" },
    { label: "Coste", render: r => fmtMoney(r.estimated_cost_total) },
    { label: "Proveedor", render: r => r.supplier || "—" },
    { label: "Almacén", render: r => r.storage_zone || "—" },
    { label: "Usado en", key: "used_in" }
  ], rows);
}

function renderMargins() {
  $("#marginsTable").innerHTML = table([
    { label: "Sesión", key: "session_title" },
    { label: "Ingredientes", render: r => fmtMoney(r.ingredient_cost_total) },
    { label: "Mano de obra", render: r => fmtMoney(r.labor_cost_total) },
    { label: "Indirectos", render: r => fmtMoney(r.overhead_cost_total) },
    { label: "Total", render: r => `<b>${fmtMoney(r.total_session_cost)}</b>` },
    { label: "% ingredientes", render: r => `${fmtNumber(r.ingredient_cost_pct, 2)} %` },
    { label: "% mano obra", render: r => `${fmtNumber(r.labor_cost_pct, 2)} %` }
  ], repo.margins());
}



function populateCatalogs() {
  fillSelect($("#ing_family_id"), catalogs.families, { empty: "Selecciona familia" });
  fillSelect($("#ing_subfamily_id"), catalogs.subfamilies, { empty: "Sin subfamilia" });
  fillSelect($("#ing_base_unit_id"), catalogs.units, { empty: "Selecciona unidad" });
  fillSelect($("#ing_purchase_unit_id"), catalogs.units, { empty: "Igual que unidad base" });
  fillSelect($("#ing_order_group_id"), catalogs.orderGroups, { empty: "Sin grupo" });
  fillSelect($("#ing_supplier_id"), catalogs.suppliers, { empty: "Sin proveedor" });
  fillSelect($("#ing_storage_zone_id"), catalogs.storageZones, { empty: "Sin zona" });
  $("#ing_family_id").addEventListener("change", filterSubfamilies);
  filterSubfamilies();
  populateWorkshopMetaSelectors();
}

function filterSubfamilies() {
  const familyId = $("#ing_family_id").value;
  fillSelect($("#ing_subfamily_id"), catalogs.subfamilies.filter(s => !familyId || s.family_id === familyId), { empty: "Sin subfamilia" });
}

function newIngredientForm() { clearIngredientForm(); switchTab("archive-ingredients"); $("#ing_name").focus(); }

function clearIngredientForm(shouldRender = true) {
  selectedIngredientId = null;
  $("#ingredientForm").reset();
  $("#ing_id").value = "";
  $("#ing_purchase_net_quantity").value = "1";
  $("#ing_waste_pct").value = "0";
  $("#ing_hydration_factor").value = "0";
  $("#ing_edible_yield_pct").value = "100";
  $("#ing_active").checked = true;
  $("#ing_use_culinary").checked = true;
  $("#ingredientFormTitle").textContent = "Nuevo ingrediente";
  if (shouldRender && repo) renderIngredients();
}

function loadIngredientForm(id) {
  const ing = repo.ingredientById(id);
  if (!ing) return toast("No se encontró el ingrediente.", "err");
  selectedIngredientId = id;
  $("#ingredientFormTitle").textContent = `Editar ingrediente · ${ing.name}`;
  setValue("ing_id", ing.id); setValue("ing_name", ing.name);
  setValue("ing_family_id", ing.family_id); filterSubfamilies();
  setValue("ing_subfamily_id", ing.subfamily_id); setValue("ing_base_unit_id", ing.base_unit_id);
  setValue("ing_purchase_unit_id", ing.purchase_unit_id); setValue("ing_purchase_price", ing.purchase_price);
  setValue("ing_purchase_net_quantity", ing.purchase_net_quantity); setValue("ing_waste_pct", ing.waste_pct);
  setValue("ing_order_group_id", ing.order_group_id); setValue("ing_supplier_id", ing.supplier_id);
  setValue("ing_storage_zone_id", ing.storage_zone_id); setValue("ing_bakery_role", ing.bakery_role);
  setValue("ing_hydration_factor", ing.hydration_factor); setValue("ing_edible_yield_pct", ing.edible_yield_pct);
  setValue("ing_notes", ing.notes);
  $("#ing_use_culinary").checked = !!ing.use_culinary;
  $("#ing_use_bakery").checked = !!ing.use_bakery;
  $("#ing_active").checked = !!ing.active;
  renderIngredients();
}

async function saveIngredientFromForm(ev) {
  ev.preventDefault();
  try {
    const name = $("#ing_name").value.trim();
    if (!name) throw new Error("El nombre es obligatorio.");
    const id = $("#ing_id").value || slugIdFromName(name);
    const data = {
      $id: id, $name: name,
      $family_id: nullIfEmpty($("#ing_family_id").value),
      $subfamily_id: nullIfEmpty($("#ing_subfamily_id").value),
      $order_group_id: nullIfEmpty($("#ing_order_group_id").value),
      $supplier_id: nullIfEmpty($("#ing_supplier_id").value),
      $storage_zone_id: nullIfEmpty($("#ing_storage_zone_id").value),
      $base_unit_id: $("#ing_base_unit_id").value,
      $purchase_unit_id: nullIfEmpty($("#ing_purchase_unit_id").value) || $("#ing_base_unit_id").value,
      $purchase_price: num($("#ing_purchase_price").value, 0),
      $purchase_net_quantity: num($("#ing_purchase_net_quantity").value, 1),
      $waste_pct: num($("#ing_waste_pct").value, 0),
      $use_culinary: $("#ing_use_culinary").checked ? 1 : 0,
      $use_bakery: $("#ing_use_bakery").checked ? 1 : 0,
      $bakery_role: nullIfEmpty($("#ing_bakery_role").value),
      $hydration_factor: num($("#ing_hydration_factor").value, 0),
      $edible_yield_pct: num($("#ing_edible_yield_pct").value, 100),
      $notes: nullIfEmpty($("#ing_notes").value),
      $active: $("#ing_active").checked ? 1 : 0
    };
    if (!data.$base_unit_id) throw new Error("La unidad base es obligatoria.");
    if (data.$purchase_net_quantity <= 0) throw new Error("La cantidad neta de compra debe ser mayor que 0.");
    if (data.$waste_pct < 0 || data.$waste_pct >= 100) throw new Error("La merma debe estar entre 0 y 99,99 %.");
    repo.saveIngredient(data);
    selectedIngredientId = id;
    renderAll();
    loadIngredientForm(id);
    await autosave({ backup: false, reason: "ingrediente" });
    window.dispatchEvent(new CustomEvent("swiftremo:bakeryChanged", { detail: { source: "app", message: "Ingrediente actualizado." } }));
    toast("Ingrediente guardado.");
  } catch (err) { console.error(err); toast(err.message, "err"); }
}

async function deactivateSelectedIngredient() {
  if (!selectedIngredientId) return toast("Selecciona un ingrediente primero.", "warn");
  const ing = repo.ingredientById(selectedIngredientId);
  if (!ing) return;
  if (!confirm(`Desactivar "${ing.name}"?
No se borra: solo active = 0.`)) return;
  await autosave({ backup: true, reason: "antes de desactivar" });
  repo.deactivateIngredient(selectedIngredientId);
  clearIngredientForm();
  renderAll();
  await autosave({ backup: false, reason: "desactivar" });
  toast("Ingrediente desactivado.", "warn");
}


const PRIVATE_DEFAULT_SOURCE_NAME = "Carlos González Sanmartín";
const PRIVATE_DEFAULT_SOURCE_ID = "carlos_gonzalez_sanmartin";
const PRIVATE_MERGE_TABLES = Object.freeze([
  "data_sources", "units", "technical_families", "technical_subfamilies", "order_groups", "suppliers", "storage_zones", "allergens",
  "ingredients", "ingredient_allergens", "ingredient_price_history",
  "culinary_recipes", "culinary_recipe_lines",
  "bakery_recipes", "bakery_recipe_lines", "bakery_preferments", "bakery_process_steps",
  "media_assets", "recipe_media", "entity_sources"
]);
const PRIVATE_ENTITY_TABLES = Object.freeze({
  ingredients: "ingredient",
  culinary_recipes: "culinary_recipe",
  bakery_recipes: "bakery_recipe",
  media_assets: "media_asset"
});

function ensurePrivateMediaSchema(db = swiftDb) {
  if (!db?.isLoaded?.()) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
      permission_notes TEXT,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entity_sources (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
      notes TEXT,
      PRIMARY KEY (entity_type, entity_id, source_id),
      FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      file_name TEXT,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size_bytes INTEGER,
      sha256 TEXT,
      data BLOB NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS recipe_media (
      recipe_kind TEXT NOT NULL CHECK (recipe_kind IN ('culinary','bakery')),
      recipe_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','gallery','process','plating','texture','other')),
      caption TEXT,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (recipe_kind, recipe_id, media_id),
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_entity_sources_source ON entity_sources(source_id, entity_type);
    CREATE INDEX IF NOT EXISTS idx_recipe_media_recipe ON recipe_media(recipe_kind, recipe_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_media_assets_source ON media_assets(source_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_source_sha ON media_assets(source_id, sha256) WHERE sha256 IS NOT NULL AND TRIM(sha256) <> '';
    CREATE VIEW IF NOT EXISTS v_recipe_media_primary AS
    SELECT rm.recipe_kind, rm.recipe_id, rm.media_id, rm.role, rm.caption, rm.alt_text, rm.sort_order,
           ma.source_id, ma.file_name, ma.mime_type, ma.width, ma.height, ma.size_bytes, ma.sha256
    FROM recipe_media rm
    JOIN media_assets ma ON ma.id = rm.media_id
    WHERE rm.role='primary'
      AND rm.sort_order = (
        SELECT MIN(rm2.sort_order) FROM recipe_media rm2
        WHERE rm2.recipe_kind=rm.recipe_kind AND rm2.recipe_id=rm.recipe_id AND rm2.role='primary'
      );
    INSERT OR REPLACE INTO app_meta(key,value,updated_at) VALUES ('schema_private_media','6.72.6',CURRENT_TIMESTAMP);
  `);
}

function privateSourceName() {
  return (document.querySelector("#privateSourceName")?.value || PRIVATE_DEFAULT_SOURCE_NAME).trim() || PRIVATE_DEFAULT_SOURCE_NAME;
}
function privateSourceId() {
  const raw = document.querySelector("#privateSourceSlug")?.value || slugTechnical(privateSourceName()) || PRIVATE_DEFAULT_SOURCE_ID;
  return slugTechnical(raw) || PRIVATE_DEFAULT_SOURCE_ID;
}
function syncPrivateSourceSlug() {
  const nameEl = document.querySelector("#privateSourceName");
  const slugEl = document.querySelector("#privateSourceSlug");
  if (nameEl && !nameEl.value) nameEl.value = PRIVATE_DEFAULT_SOURCE_NAME;
  if (slugEl && (!slugEl.value || slugEl.dataset.autofilled === "1")) {
    slugEl.value = slugTechnical(privateSourceName()) || PRIVATE_DEFAULT_SOURCE_ID;
    slugEl.dataset.autofilled = "1";
  }
}
function slugTechnical(value) {
  const normalized = String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "privado";
}
function safeSqlIdent(name) {
  const value = String(name || "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Identificador SQL no seguro: ${value}`);
  return `"${value.replace(/"/g, '""')}"`;
}
function tableExistsIn(db, name) {
  return Number(db.selectValue("SELECT COUNT(*) FROM sqlite_schema WHERE type='table' AND name=$name;", { $name: name }) || 0) > 0;
}
function tableColumnsIn(db, name) {
  return db.query(`PRAGMA table_info(${safeSqlIdent(name)});`).map(r => r.name);
}
function selectTableRows(db, name, columns) {
  return db.query(`SELECT ${columns.map(safeSqlIdent).join(", ")} FROM ${safeSqlIdent(name)};`);
}
function ensureDataSourceRow(db, { id, name, owner = "", visibility = "private", notes = "" } = {}) {
  const sourceId = slugTechnical(id || name || PRIVATE_DEFAULT_SOURCE_ID);
  db.exec(`
    INSERT INTO data_sources(id, name, owner, visibility, permission_notes, imported_at)
    VALUES ($id, $name, $owner, $visibility, $notes, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      owner=COALESCE(NULLIF(excluded.owner,''), data_sources.owner),
      visibility=excluded.visibility,
      permission_notes=COALESCE(NULLIF(excluded.permission_notes,''), data_sources.permission_notes);
  `, { $id: sourceId, $name: name || sourceId, $owner: owner || "", $visibility: visibility || "private", $notes: notes || "" });
  return sourceId;
}
function insertEntitySource(db, tableName, row, sourceId) {
  const entityType = PRIVATE_ENTITY_TABLES[tableName];
  if (!entityType || !row?.id) return;
  db.exec(`INSERT OR IGNORE INTO entity_sources(entity_type, entity_id, source_id, visibility, notes)
           VALUES ($type, $id, $source, 'private', 'Importado como paquete privado.');`,
    { $type: entityType, $id: String(row.id), $source: sourceId });
}
function insertGenericRow(db, tableName, columns, row) {
  const bind = {};
  const placeholders = columns.map((_, i) => `$v${i}`);
  columns.forEach((c, i) => { bind[`$v${i}`] = row[c] ?? null; });
  const sql = `INSERT OR IGNORE INTO ${safeSqlIdent(tableName)} (${columns.map(safeSqlIdent).join(", ")}) VALUES (${placeholders.join(", ")});`;
  db.exec(sql, bind);
  return Number(db.selectValue("SELECT changes();") || 0);
}
async function importPrivateSqlitePackage(ev) {
  const input = ev.target;
  const file = input.files?.[0];
  if (!file) return;
  if (!swiftDb.isLoaded()) { toast("La base principal todavía no está cargada.", "warn"); input.value = ""; return; }
  const sourceId = privateSourceId();
  const sourceName = privateSourceName();
  const sourceDb = new SwiftDB();
  try {
    setState("Importando paquete…", "saving");
    setStatus("Fusionando paquete privado SQLite…", "warn");
    const bytes = new Uint8Array(await file.arrayBuffer());
    await sourceDb.loadFromBytesAsync(bytes);
    ensurePrivateMediaSchema(swiftDb);
    try { ensurePrivateMediaSchema(sourceDb); } catch (err) { console.warn("[SwiftRemo] El paquete privado no permite crear esquema auxiliar; se intentará importar tablas existentes.", err); }
    const report = mergePrivateDatabase(sourceDb, { sourceId, sourceName, fileName: file.name });
    await autosave({ backup: true, reason: `paquete privado ${sourceName}` });
    renderAll();
    const insertedTotal = report.reduce((a, r) => a + Number(r.inserted || 0), 0);
    const skippedTotal = report.reduce((a, r) => a + Number(r.skipped || 0), 0);
    const pendingTotal = report.reduce((a, r) => a + Number(r.pending || 0), 0);
    toast(`Paquete privado fusionado: ${insertedTotal} registros nuevos${pendingTotal ? `; ${pendingTotal} vínculo(s) de foto pendiente(s)` : ""}.`, pendingTotal ? "warn" : "ok");
    setStatus(`Paquete privado fusionado: ${file.name}. ${insertedTotal} registros nuevos; ${skippedTotal} omitidos por existir${pendingTotal ? `; ${pendingTotal} vínculo(s) de foto pendiente(s) hasta importar sus fichas.` : ""}.`, pendingTotal ? "warn" : "ok");
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudo importar el paquete privado.", "err");
    setStatus(`No se pudo importar el paquete privado: ${err.message}`, "err");
    setState("Error de importación", "error");
  } finally {
    sourceDb.close();
    input.value = "";
  }
}
function mergePrivateDatabase(sourceDb, { sourceId, sourceName, fileName } = {}) {
  const report = [];
  swiftDb.exec("BEGIN IMMEDIATE;");
  try {
    const normalizedSourceId = ensureDataSourceRow(swiftDb, {
      id: sourceId,
      name: sourceName || sourceId,
      owner: sourceName || "",
      visibility: "private",
      notes: `Paquete privado importado desde ${fileName || "archivo SQLite"}.`
    });
    for (const tableName of PRIVATE_MERGE_TABLES) {
      if (!tableExistsIn(sourceDb, tableName) || !tableExistsIn(swiftDb, tableName)) continue;
      const targetCols = tableColumnsIn(swiftDb, tableName);
      const sourceCols = tableColumnsIn(sourceDb, tableName);
      const common = sourceCols.filter(c => targetCols.includes(c));
      if (!common.length) continue;
      const rows = selectTableRows(sourceDb, tableName, common);
      let inserted = 0;
      let skipped = 0;
      for (const originalRow of rows) {
        const row = { ...originalRow };
        if (tableName === "media_assets" && !String(row.source_id || "").trim()) row.source_id = normalizedSourceId;
        if (tableName === "entity_sources" && !String(row.source_id || "").trim()) row.source_id = normalizedSourceId;
        const changed = insertGenericRow(swiftDb, tableName, common, row);
        if (changed) {
          inserted += changed;
          insertEntitySource(swiftDb, tableName, row, normalizedSourceId);
        } else {
          skipped += 1;
        }
      }
      report.push({ table: tableName, rows: rows.length, inserted, skipped });
    }
    const fk = swiftDb.query("PRAGMA foreign_key_check;");
    if (fk.length) {
      throw new Error(`La fusión generó ${fk.length} referencia(s) rota(s). No se ha guardado ningún cambio del paquete.`);
    }
    const pendingMedia = swiftDb.query(`
      SELECT rm.recipe_kind, rm.recipe_id, rm.media_id
      FROM recipe_media rm
      WHERE (rm.recipe_kind='culinary' AND NOT EXISTS (SELECT 1 FROM culinary_recipes cr WHERE cr.id=rm.recipe_id))
         OR (rm.recipe_kind='bakery' AND NOT EXISTS (SELECT 1 FROM bakery_recipes br WHERE br.id=rm.recipe_id));
    `);
    if (pendingMedia.length) {
      report.push({ table: "recipe_media_pending", rows: pendingMedia.length, inserted: 0, skipped: pendingMedia.length, pending: pendingMedia.length });
      console.warn("[SwiftRemo] Fotos privadas pendientes de ficha. Se conservarán y se activarán cuando exista una ficha con el mismo ID.", pendingMedia.slice(0, 25));
    }
    swiftDb.exec("COMMIT;");
    console.info("[SwiftRemo] Informe de importación privada", report);
    return report;
  } catch (err) {
    try { swiftDb.exec("ROLLBACK;"); } catch {}
    throw err;
  }
}

function renderPrivateDataManager() {
  const box = document.querySelector("#privateDataStatus");
  const recipeSelect = document.querySelector("#privatePhotoRecipe");
  if (!box && !recipeSelect) return;
  if (!swiftDb.isLoaded()) {
    if (box) box.innerHTML = `<p class="small">Base no cargada.</p>`;
    return;
  }
  ensurePrivateMediaSchema();
  syncPrivateSourceSlug();
  if (recipeSelect) {
    const current = recipeSelect.value;
    const kind = document.querySelector("#privatePhotoKind")?.value || "all";
    const rows = swiftDb.query(`
      SELECT uid, source_type, source_id, name
      FROM v_elaborations_unified
      WHERE active=1 AND ($kind='all' OR source_type=$kind)
      ORDER BY name;
    `, { $kind: kind });
    recipeSelect.innerHTML = `<option value="">Selecciona ficha/formulación…</option>` + rows.map(r => `<option value="${esc(r.uid)}">${esc(r.name)} · ${esc(r.source_type === "bakery" ? "Panadería" : "Cocina/Pastelería")}</option>`).join("");
    if (rows.some(r => r.uid === current)) recipeSelect.value = current;
  }
  if (!box) return;
  const stats = {
    sources: Number(swiftDb.selectValue("SELECT COUNT(*) FROM data_sources WHERE visibility='private';") || 0),
    media: Number(swiftDb.selectValue("SELECT COUNT(*) FROM media_assets;") || 0),
    linked: Number(swiftDb.selectValue("SELECT COUNT(*) FROM recipe_media;") || 0),
    pending: Number(swiftDb.selectValue(`SELECT COUNT(*) FROM recipe_media rm
      WHERE (rm.recipe_kind='culinary' AND NOT EXISTS (SELECT 1 FROM culinary_recipes cr WHERE cr.id=rm.recipe_id))
         OR (rm.recipe_kind='bakery' AND NOT EXISTS (SELECT 1 FROM bakery_recipes br WHERE br.id=rm.recipe_id));`) || 0),
    recipes: Number(swiftDb.selectValue("SELECT COUNT(DISTINCT entity_id) FROM entity_sources WHERE visibility='private' AND entity_type IN ('culinary_recipe','bakery_recipe');") || 0)
  };
  const sources = swiftDb.query(`
    SELECT ds.id, ds.name, ds.visibility, ds.imported_at,
           (SELECT COUNT(*) FROM entity_sources es WHERE es.source_id=ds.id) AS entities,
           (SELECT COUNT(*) FROM media_assets ma WHERE ma.source_id=ds.id) AS media_count
    FROM data_sources ds
    ORDER BY ds.visibility DESC, ds.name;
  `);
  box.innerHTML = `
    <div class="private-kpi-grid">
      <div class="kpi"><span>Fuentes privadas</span><b>${fmtNumber(stats.sources,0)}</b></div>
      <div class="kpi"><span>Fichas trazadas</span><b>${fmtNumber(stats.recipes,0)}</b></div>
      <div class="kpi"><span>Fotos BLOB</span><b>${fmtNumber(stats.media,0)}</b></div>
      <div class="kpi"><span>Fotos vinculadas</span><b>${fmtNumber(stats.linked,0)}</b></div>
      <div class="kpi"><span>Vínculos pendientes</span><b>${fmtNumber(stats.pending,0)}</b></div>
    </div>
    ${stats.pending ? `<div class="notice warn"><b>Fotos privadas pendientes</b><p>Hay ${fmtNumber(stats.pending,0)} vínculo(s) de foto cuyo ID de ficha todavía no existe en la base actual. No es un error si has importado primero las fotos de Carlos: se activarán cuando se importe una base de fichas con esos mismos IDs.</p></div>` : ""}
    ${sources.length ? table([
      { label: "Origen", key: "name" },
      { label: "ID", key: "id" },
      { label: "Visibilidad", key: "visibility" },
      { label: "Entidades", key: "entities", render: r => fmtNumber(r.entities,0) },
      { label: "Fotos", key: "media_count", render: r => fmtNumber(r.media_count,0) }
    ], sources) : `<p class="small">Aún no hay fuentes privadas registradas.</p>`}
  `;
}
async function importPrivatePhotoFiles(ev) {
  const input = ev.target;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  if (!swiftDb.isLoaded()) { toast("La base principal todavía no está cargada.", "warn"); input.value = ""; return; }
  const selection = document.querySelector("#privatePhotoRecipe")?.value || "";
  const [kind, recipeId] = selection.split(":");
  if (!kind || !recipeId || !["culinary","bakery"].includes(kind)) {
    toast("Selecciona primero una ficha o formulación para vincular las fotos.", "warn");
    input.value = "";
    return;
  }
  try {
    ensurePrivateMediaSchema();
    const sourceId = ensureDataSourceRow(swiftDb, { id: privateSourceId(), name: privateSourceName(), owner: privateSourceName(), visibility: "private", notes: "Fotos privadas integradas como BLOB optimizado." });
    setState("Integrando fotos…", "saving");
    setStatus("Optimizando e integrando fotos privadas como BLOB…", "warn");
    let imported = 0;
    for (const file of files) {
      if (!/^image\//i.test(file.type || "")) continue;
      const media = await normalizedImageBlob(file);
      const hash = await sha256Hex(media.bytes);
      const mediaId = `${sourceId}_media_${hash.slice(0, 16)}`;
      swiftDb.exec(`
        INSERT OR IGNORE INTO media_assets(id, source_id, file_name, mime_type, width, height, size_bytes, sha256, data)
        VALUES ($id, $source, $file, $mime, $width, $height, $size, $sha, $data);
      `, { $id: mediaId, $source: sourceId, $file: media.fileName, $mime: media.mimeType, $width: media.width || null, $height: media.height || null, $size: media.bytes.byteLength, $sha: hash, $data: media.bytes });
      const storedId = swiftDb.selectValue("SELECT id FROM media_assets WHERE source_id=$source AND sha256=$sha ORDER BY created_at LIMIT 1;", { $source: sourceId, $sha: hash }) || mediaId;
      const existingPrimary = Number(swiftDb.selectValue("SELECT COUNT(*) FROM recipe_media WHERE recipe_kind=$kind AND recipe_id=$recipe AND role='primary';", { $kind: kind, $recipe: recipeId }) || 0);
      const sortOrder = Number(swiftDb.selectValue("SELECT COALESCE(MAX(sort_order),0)+1 FROM recipe_media WHERE recipe_kind=$kind AND recipe_id=$recipe;", { $kind: kind, $recipe: recipeId }) || 1);
      const role = existingPrimary ? "gallery" : "primary";
      swiftDb.exec(`
        INSERT OR REPLACE INTO recipe_media(recipe_kind, recipe_id, media_id, role, caption, alt_text, sort_order)
        VALUES ($kind, $recipe, $media, $role, $caption, $alt, $sort);
      `, { $kind: kind, $recipe: recipeId, $media: storedId, $role: role, $caption: media.caption, $alt: media.caption, $sort: sortOrder });
      swiftDb.exec(`INSERT OR IGNORE INTO entity_sources(entity_type, entity_id, source_id, visibility, notes)
                    VALUES ($type, $id, $source, 'private', 'Foto privada vinculada como BLOB.');`,
        { $type: kind === "bakery" ? "bakery_recipe" : "culinary_recipe", $id: recipeId, $source: sourceId });
      imported += 1;
    }
    if (!imported) throw new Error("No se encontró ninguna imagen válida en la selección.");
    await autosave({ backup: true, reason: `fotos privadas ${privateSourceName()}` });
    renderAll();
    toast(`${imported} foto(s) integrada(s) como BLOB.`);
    setStatus(`${imported} foto(s) privada(s) integrada(s) como BLOB y vinculada(s) a la ficha.`, "ok");
  } catch (err) {
    console.error(err);
    toast(err.message || "No se pudieron integrar las fotos.", "err");
    setStatus(`No se pudieron integrar las fotos: ${err.message}`, "err");
  } finally {
    input.value = "";
  }
}
async function normalizedImageBlob(file) {
  const fallback = async () => ({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type || "image/jpeg", width: null, height: null, fileName: file.name || "foto", caption: file.name || "Foto" });
  if (!window.createImageBitmap || !document.createElement("canvas").toBlob) return fallback();
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) return fallback();
    const base = String(file.name || "foto").replace(/\.[^.]+$/, "");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: "image/webp", width, height, fileName: `${slugTechnical(base)}.webp`, caption: base || "Foto" };
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo optimizar la imagen; se guarda original.", err);
    return fallback();
  } finally {
    try { bitmap?.close?.(); } catch {}
  }
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function exportPrivateSqlite() {
  const base = slugTechnical(privateSourceName()) || PRIVATE_DEFAULT_SOURCE_ID;
  downloadBytes(`SwiftRemo_${base}_${dateSlug()}.sqlite`, swiftDb.exportBytes());
  toast("Copia SQLite privada descargada.");
  setStatus("Copia local privada descargada. No la subas al repositorio público.", "ok");
}

function exportSqlite() {
  downloadBytes(`swiftremo_${dateSlug()}.sqlite`, swiftDb.exportBytes());
  setState("Guardado", "clean");
  setStatus("Copia .sqlite descargada.", "ok");
  toast("Copia SQLite descargada.");
}

function exportJson() { downloadJson(`swiftremo_export_${dateSlug()}.json`, repo.exportJson()); toast("JSON técnico exportado."); }

function runSql() {
  try { $("#sqlOutput").textContent = JSON.stringify(repo.selectOnly($("#sqlInput").value), null, 2); }
  catch (err) { $("#sqlOutput").textContent = err.stack || err.message; toast(err.message, "err"); }
}

function setValue(id, value) { $("#" + id).value = value ?? ""; }
function badge(text, type = "ok") { return `<span class="badge ${type}">${esc(text)}</span>`; }
function roleLabel(role) {
  const labels = { flour: "Harina", liquid: "Líquido", yeast: "Levadura", salt: "Sal", fat: "Grasa", sugar: "Azúcar", egg: "Huevo", dairy: "Lácteo", aroma: "Aroma", seed: "Semilla", inclusion: "Inclusión", other: "Otro" };
  return labels[role] || role || "";
}
function nullIfEmpty(value) { const v = String(value ?? "").trim(); return v ? v : null; }
function num(value, fallback = 0) { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : fallback; }
function dateSlug() { const d = new Date(); const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; }
function formatDate(value) { try { return new Date(value).toLocaleString("es-ES"); } catch { return ""; } }
