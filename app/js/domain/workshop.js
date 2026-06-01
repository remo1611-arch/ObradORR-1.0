export function createWorkshopDomain({ getRepo, logger = console } = {}) {
  function items() {
    const repo = getRepo?.();
    if (!repo || typeof repo.workSelectionItems !== 'function') return [];
    try { return repo.workSelectionItems() || []; }
    catch (err) { logger.warn?.('[SwiftRemo] No se pudo leer el Taller', err); return []; }
  }

  function orderRows() {
    const repo = getRepo?.();
    if (!repo || typeof repo.workSelectionOrder !== 'function') return [];
    try { return repo.workSelectionOrder('WORK_CURRENT') || []; }
    catch (err) { logger.warn?.('[SwiftRemo] No se pudo calcular el pedido del Taller', err); return []; }
  }

  function summary() {
    const repo = getRepo?.();
    if (!repo || typeof repo.workSelectionSummary !== 'function') return {};
    try { return repo.workSelectionSummary() || {}; }
    catch (err) { logger.warn?.('[SwiftRemo] No se pudo calcular el resumen del Taller', err); return {}; }
  }

  function getState() {
    const currentItems = items();
    const currentOrder = orderRows();
    const currentSummary = summary();
    const itemCount = Number(currentSummary.total_items ?? currentItems.length ?? 0) || 0;
    const hasItems = itemCount > 0;
    const orderCost = currentOrder.reduce((acc, row) => acc + Number(row.estimated_cost_total || 0), 0);
    const status = !hasItems ? 'empty' : currentOrder.length ? 'reviewingOrder' : 'editing';
    return {
      domain: 'workshop',
      hasDb: !!getRepo?.(),
      status,
      hasItems,
      itemCount,
      bakeryItems: Number(currentSummary.bakery_items || 0) || 0,
      culinaryItems: Number(currentSummary.culinary_items || 0) || 0,
      orderLineCount: currentOrder.length,
      estimatedCost: Number(currentSummary.estimated_base_cost || 0) || 0,
      orderCost,
      items: currentItems,
      orderRows: currentOrder,
      nextAction: hasItems ? 'Revisar pedido' : 'Añadir elaboración',
      nextHelp: hasItems
        ? 'La práctica tiene elaboraciones. Revisa pedido o prepara salida documental.'
        : 'La práctica está vacía. Añade primero una elaboración desde el buscador del Taller.'
    };
  }

  function getActions(state = getState()) {
    if (!state.hasItems) {
      return {
        primary: ['addElaboration'],
        secondary: ['openTechnicalArchive'],
        danger: []
      };
    }
    return {
      primary: ['reviewOrder'],
      secondary: ['addElaboration', 'printDossier', 'archiveWorkshop'],
      danger: ['discardWorkshop']
    };
  }

  return { items, orderRows, summary, getState, getActions };
}
