/**
 * Aplica el estado visual de los botones del Taller según si hay elaboraciones.
 *
 * Exportada con dos nombres para compatibilidad:
 *   - applyWorkshopActionState  (nombre original, usado en workshop-view.js)
 *   - applyWorkshopButtonState  (alias, usado en app.js — permite delegación sin renombrar)
 */
export function applyWorkshopActionState(documentRef, workshopState) {
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
    "#workshopPrintTechnicalOrder",
    "#workshopPrintTeachingDossier"
  ];
  const hasItems = !!workshopState?.hasItems;
  documentRef.querySelectorAll(disabledSelectors.join(",")).forEach(btn => {
    btn.disabled = !hasItems;
    btn.setAttribute("aria-disabled", hasItems ? "false" : "true");
    btn.classList.toggle("is-disabled-by-empty-workshop", !hasItems);
    btn.classList.toggle("workflow-disabled", !hasItems);
    if (!hasItems) btn.title = "Primero añade al menos una elaboración a la práctica.";
    else btn.removeAttribute("title");
  });
  documentRef.querySelectorAll("#workshopArchive, #workshopClear").forEach(btn => {
    btn.classList.toggle("hidden-by-workflow", !hasItems);
  });
  documentRef.querySelectorAll("#workshopPrintDossier, #workshopPrintSheets, #workshopPrintOrder, #workshopPrintTeachingDossier, #workshopPrintTechnicalOrder, #workshopOpenPrintCenter").forEach(btn => {
    const card = btn.closest(".print-profile-card-618");
    if (card) card.classList.toggle("workflow-card-disabled", !hasItems);
  });
  documentRef.body.dataset.workflowState = workshopState?.stage || workshopState?.status || (hasItems ? "editing" : "empty");
}

// Alias — permite a app.js delegar sin renombrar la función existente
export const applyWorkshopButtonState = applyWorkshopActionState;
