import { workshopSummaryHtml, workshopActionButtonsHtml, workshopOrderStateHtml, workshopOutputStateHtml } from "./workshop-components.js?v=6731";
import { applyWorkshopActionState } from "./workshop-actions.js?v=6731";

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
    const panel = documentRef.querySelector("#workshopStatePanel");
    if (panel) panel.innerHTML = workshopSummaryHtml(workshopState, formatters);
    const practice = documentRef.querySelector("#workshopPracticeState");
    if (practice) practice.innerHTML = workshopSummaryHtml(workshopState, formatters);
    const order = documentRef.querySelector("#workshopOrderState");
    if (order) order.innerHTML = workshopOrderStateHtml(workshopState);
    const output = documentRef.querySelector("#workshopOutputState");
    if (output) output.innerHTML = workshopOutputStateHtml(workshopState);
    renderActions(workshopState);
    applyWorkshopActionState(documentRef, workshopState);
  }

  return { render, renderActions };
}
