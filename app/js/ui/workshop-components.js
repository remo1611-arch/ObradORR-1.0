import { WORKSHOP_STEPS, canUseOrder, canUseOutput, canArchive } from './workshop-flow.js?v=6730';
function stepClass(active) {
  return active ? "workshop-step-pill active" : "workshop-step-pill";
}

export function workshopStepsHtml(workshopState) {
  const orderReady = canUseOrder(workshopState);
  const outputReady = canUseOutput(workshopState);
  const archiveReady = canArchive(workshopState);
  const active = { practice: true, order: orderReady, output: outputReady, archive: archiveReady };
  return `
    <div class="workshop-flow-steps" aria-label="Flujo del Taller">
      ${WORKSHOP_STEPS.map(step => `<button type="button" class="${stepClass(active[step.key])}" data-tab="${step.route}" ${!active[step.key] && step.key !== 'practice' ? 'disabled aria-disabled="true"' : ''}><span>${step.label}</span><small>${step.help}</small></button>`).join('')}
    </div>`;
}

export function workshopSummaryHtml(workshopState, { fmtNumber, fmtMoney } = {}) {
  const n = fmtNumber || ((value, digits = 0) => Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: digits }));
  const money = fmtMoney || ((value) => `${Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  if (!workshopState?.hasItems) {
    return `
      <div class="workshop-state-card empty">
        <div>
          <b>Práctica vacía</b>
          <span>La app mantiene bloqueados Pedido y Salida hasta que añadas una elaboración. El siguiente paso real es buscar y añadir.</span>
        </div>
        ${workshopStepsHtml(workshopState)}
        <div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button><button type="button" class="btn ghost" data-tab="archive-catalog">Abrir Archivo técnico</button></div>
      </div>`;
  }
  return `
    <div class="workshop-state-card ready">
      <div>
        <b>Práctica activa</b>
        <span>${n(workshopState.itemCount,0)} elaboración(es) · ${n(workshopState.orderLineCount,0)} línea(s) de pedido · coste estimado ${money(workshopState.orderCost || workshopState.estimatedCost || 0)}.</span>
      </div>
      ${workshopStepsHtml(workshopState)}
      <div class="actions"><button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button></div>
    </div>`;
}

export function workshopActionButtonsHtml(workshopState, area = "practice") {
  if (!workshopState?.hasItems) {
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

export function workshopOrderStateHtml(workshopState) {
  return workshopState?.hasItems
    ? `<div class="workshop-state-card ready"><b>Pedido disponible</b><span>Revisa cantidades, unidades, proveedor, zona y coste. La impresión se hace desde Salida.</span></div>`
    : `<div class="workshop-state-card empty"><b>Pedido bloqueado</b><span>El pedido se genera automáticamente cuando la práctica tiene elaboraciones.</span><div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button></div></div>`;
}

export function workshopOutputStateHtml(workshopState) {
  return workshopState?.hasItems
    ? `<div class="workshop-state-card ready"><b>Salida preparada</b><span>Centro único para generar dossier, fichas, pedido u opciones avanzadas.</span></div>`
    : `<div class="workshop-state-card empty"><b>Salida no disponible todavía</b><span>Añade al menos una elaboración para activar la impresión y la exportación documental.</span><div class="actions"><button type="button" class="btn primary" data-focus-practice-search="1">Añadir elaboración</button></div></div>`;
}
