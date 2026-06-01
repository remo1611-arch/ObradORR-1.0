export const WORKSHOP_ROUTES = Object.freeze({
  practice: 'workshop-practice',
  order: 'workshop-order',
  output: 'workshop-output',
  margins: 'workshop-margins'
});

export const WORKSHOP_STEPS = Object.freeze([
  { key: 'practice', route: WORKSHOP_ROUTES.practice, label: '1 · Elaboraciones', help: 'Datos docentes, buscador y cantidades.' },
  { key: 'order', route: WORKSHOP_ROUTES.order, label: '2 · Pedido', help: 'Necesidades consolidadas.' },
  { key: 'output', route: WORKSHOP_ROUTES.output, label: '3 · Imprimir', help: 'Fichas, pedido o dossier.' },
  { key: 'archive', route: 'history-records', label: '4 · Archivar', help: 'Cerrar y conservar práctica.' }
]);

export function getWorkshopStage(state) {
  if (!state?.hasItems) return 'empty';
  if (state?.status === 'printing') return 'printing';
  if (state?.status === 'reviewingOrder' || Number(state?.orderLineCount || 0) > 0) return 'reviewingOrder';
  return 'editing';
}

export function canUseOrder(state) { return !!state?.hasItems; }
export function canUseOutput(state) { return !!state?.hasItems; }
export function canArchive(state) { return !!state?.hasItems; }
