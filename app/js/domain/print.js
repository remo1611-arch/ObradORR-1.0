export function createPrintDomain({ document: documentRef = document } = {}) {
  const ACTIONS = {
    dossier: '#workshopPrintDossier',
    sheets: '#workshopPrintSheets',
    order: '#workshopPrintOrder',
    custom: '#workshopOpenPrintCenter'
  };

  function available(workshopState) {
    return !!workshopState?.hasItems;
  }

  function getActions(workshopState) {
    const enabled = available(workshopState);
    return Object.keys(ACTIONS).map(key => ({ key, selector: ACTIONS[key], enabled }));
  }

  function setEnabled(workshopState) {
    getActions(workshopState).forEach(action => {
      const btn = documentRef.querySelector(action.selector);
      if (!btn) return;
      btn.disabled = !action.enabled;
      btn.setAttribute('aria-disabled', action.enabled ? 'false' : 'true');
      btn.classList.toggle('workflow-disabled', !action.enabled);
      if (!action.enabled) btn.title = 'Primero añade al menos una elaboración al Taller.';
      else btn.removeAttribute('title');
    });
  }

  return { available, getActions, setEnabled };
}
