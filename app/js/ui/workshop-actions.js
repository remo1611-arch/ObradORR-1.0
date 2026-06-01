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
    "#workshopPrintSimpleSheets",
    "#workshopPrintSimpleOrder",
    "#workshopPrintSimpleDossier",
    "#workshopPrintTeachingSheets",
    "#workshopPrintTechnicalOrder",
    "#workshopPrintTeachingDossier"
  ];
  const hasItems = !!workshopState?.hasItems;
  documentRef.querySelectorAll(disabledSelectors.join(",")).forEach(btn => {
    btn.disabled = !hasItems;
    btn.setAttribute("aria-disabled", hasItems ? "false" : "true");
    btn.classList.toggle("is-disabled-by-empty-practice-6703", !hasItems);
    btn.classList.toggle("workflow-disabled-6704", !hasItems);
    if (!hasItems) btn.title = "Primero añade al menos una elaboración a la práctica.";
    else btn.removeAttribute("title");
  });
  documentRef.querySelectorAll("#workshopArchive, #workshopClear").forEach(btn => {
    btn.classList.toggle("hidden-by-workflow-6704", !hasItems);
  });
  documentRef.querySelectorAll("#workshopPrintDossier, #workshopPrintSheets, #workshopPrintOrder, #workshopOpenPrintCenter").forEach(btn => {
    const card = btn.closest(".print-profile-card-618");
    if (card) card.classList.toggle("workflow-card-disabled-6704", !hasItems);
  });
  documentRef.body.dataset.workflowState = workshopState?.stage || workshopState?.status || (hasItems ? "editing" : "empty");
}
