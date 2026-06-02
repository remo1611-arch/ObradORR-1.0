import {
  workshopSummaryHtml,
  workshopActionButtonsHtml,
  workshopOrderStateHtml,
  workshopOutputStateHtml,
  workshopSelectionEmptyHtml,
  workshopSelectionItemsEmptyHtml,
  workshopSelectionKpiHtml,
  workshopItemsHtml,
  workshopPrintHistoryHtml
} from "./workshop-components.js?v=100rcfinal";
import { applyWorkshopActionState } from "./workshop-actions.js?v=100rcfinal";

export function createWorkshopView({ document: documentRef = document, formatters = {} } = {}) {

  function renderActions(workshopState) {
    const practiceActions = documentRef.querySelector("#workshopActions");
    if (practiceActions) practiceActions.innerHTML = workshopActionButtonsHtml(workshopState, "practice");
    const practiceNext = documentRef.querySelector("#workshopNextActions");
    if (practiceNext) practiceNext.innerHTML = workshopActionButtonsHtml(workshopState, "practice-next");
    const orderActions = documentRef.querySelector("#workshopOrderActions");
    if (orderActions) orderActions.innerHTML = workshopActionButtonsHtml(workshopState, "order");
    const outputGrid = documentRef.querySelector("#workshopOutputActionsGrid");
    if (outputGrid) outputGrid.classList.toggle("shell-output-grid-disabled", !workshopState?.hasItems);
    const printHistoryCard = documentRef.querySelector("#workshopPrintHistoryCard");
    if (printHistoryCard) printHistoryCard.classList.toggle("shell-secondary-empty", printHistoryCard.classList.contains("is-empty"));
  }

  function render(workshopState) {
    // #workshopStatePanel pertenece al landing oculto; evitar render redundante.
    const practice = documentRef.querySelector("#workshopPracticeState");
    if (practice) practice.innerHTML = workshopSummaryHtml(workshopState, formatters);
    const order = documentRef.querySelector("#workshopOrderState");
    if (order) order.innerHTML = workshopOrderStateHtml(workshopState);
    const output = documentRef.querySelector("#workshopOutputState");
    if (output) output.innerHTML = workshopOutputStateHtml(workshopState);
    renderActions(workshopState);
    applyWorkshopActionState(documentRef, workshopState);
  }

  /**
   * Renderiza la mesa de trabajo: bloque KPI/summary + lista de ítems + historial.
   *
   * @param {object} data
   *   @param {object} data.s       - resultado de repo.workSelectionSummary()
   *   @param {Array}  data.rows    - resultado de repo.workSelectionItems()
   *   @param {Array}  [data.jobs]  - resultado de repo.printJobs(n), null si no aplica
   *
   * @param {object} refs
   *   @param {Element} refs.summaryEl    - #workshopSelectionSummary
   *   @param {Element} refs.itemsEl      - #workshopItemsList
   *   @param {Element} [refs.historyEl]  - #workshopPrintHistory
   *   @param {Element} [refs.historyCard] - #workshopPrintHistoryCard
   *   ... y los helpers de presentación: fmtNumber, fmtMoney, esc, table,
   *       workshopModeLabel, workshopQuantityLabel, formatDate, printSourceLabel
   */
  function renderSelection({ s, rows, jobs } = {}, refs = {}) {
    const { summaryEl, itemsEl, historyEl, historyCard, ...helpers } = refs;
    if (!summaryEl || !itemsEl) return;

    const hasRows = Array.isArray(rows) && rows.length > 0;
    const mergedHelpers = { ...formatters, ...helpers };

    if (!hasRows) {
      summaryEl.classList.add('empty-practice-summary', 'workshop-command-zone-rc1');
      summaryEl.innerHTML = workshopSelectionEmptyHtml();
      itemsEl.innerHTML = workshopSelectionItemsEmptyHtml();
    } else {
      summaryEl.classList.remove('empty-practice-summary');
      summaryEl.classList.add('workshop-command-zone-rc1');
      summaryEl.innerHTML = workshopSelectionKpiHtml(s || {}, mergedHelpers);
      itemsEl.innerHTML = workshopItemsHtml(rows, mergedHelpers);
    }

    if (historyEl) {
      const hasJobs = Array.isArray(jobs) && jobs.length > 0;
      if (historyCard) historyCard.classList.toggle('is-empty', !hasJobs);
      historyEl.innerHTML = hasJobs ? workshopPrintHistoryHtml(jobs, mergedHelpers) : '';
    }
  }

  return { render, renderActions, renderSelection };
}
