import { WORKSHOP_STEPS, canUseOrder, canUseOutput, canArchive } from './workshop-flow.js?v=100rcfinal';

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
      ${WORKSHOP_STEPS.map(step => {
        const isActive = active[step.key];
        const navAttr = step.action ? `data-shell-action="${step.action}" data-requires-work-items="1"` : `data-tab="${step.route}"`;
        const disabledAttr = !isActive && step.key !== 'practice' ? 'disabled aria-disabled="true"' : '';
        return `<button type="button" class="${stepClass(isActive)}" ${navAttr} ${disabledAttr}><span>${step.label}</span><small>${step.help}</small></button>`;
      }).join('')}
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
        <div class="workshop-action-status-rc2"><span>Usa el botón <b>Buscar y añadir elaboración</b> de Acción principal para abrir el buscador del Taller.</span><button type="button" class="btn ghost" data-tab="archive-catalog">Archivo técnico</button></div>
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
      return `<button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button>`;
    }
    return `<span class="workshop-action-status-rc2">Acción principal: Buscar y añadir elaboración</span><button type="button" class="btn ghost" data-tab="archive-catalog">Archivo técnico</button>`;
  }
  if (area === "order") {
    return `<button type="button" class="btn primary" data-tab="workshop-output">Imprimir / exportar</button><button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button>`;
  }
  if (area === "practice-next") {
    return `<button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button>`;
  }
  return `<button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button><button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button><button type="button" class="btn ghost" data-shell-action="archive-workshop">Archivar como sesión</button><button type="button" class="btn danger" data-shell-action="clear-workshop">Vaciar</button>`;
}

export function workshopOrderStateHtml(workshopState) {
  return workshopState?.hasItems
    ? `<div class="workshop-state-card ready"><b>Pedido disponible</b><span>Revisa cantidades, unidades, proveedor, zona y coste. La impresión se hace desde Salida.</span></div>`
    : `<div class="workshop-state-card empty"><b>Pedido bloqueado</b><span>El pedido se genera automáticamente cuando la práctica tiene elaboraciones. Vuelve a Taller y usa el único botón principal de búsqueda.</span><div class="actions"><button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button></div></div>`;
}

export function workshopOutputStateHtml(workshopState) {
  return workshopState?.hasItems
    ? `<div class="workshop-state-card ready"><b>Salida preparada</b><span>Centro único para generar fichas, pedido limpio, salidas técnicas u opciones avanzadas.</span></div>`
    : `<div class="workshop-state-card empty"><b>Salida no disponible todavía</b><span>Añade una elaboración desde la acción principal del Taller para activar impresión y exportación.</span><div class="actions"><button type="button" class="btn ghost" data-tab="workshop-practice">Volver al Taller</button></div></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection / mesa de trabajo — componentes HTML
// Estas funciones generan el HTML de la mesa de trabajo en la pestaña Taller.
// Se usan desde workshop-view.js (renderSelection) para mantener la lógica
// de presentación fuera de app.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado vacío del bloque KPI / summary (sin elaboraciones).
 */
export function workshopSelectionEmptyHtml() {
  return `
    <div class="workshop-next-card-rc1 primary">
      <span class="workshop-step-num-rc1">1</span>
      <div>
        <b>Empieza por añadir una elaboración</b>
        <small>Busca por nombre, familia o tipo. Al añadirla se pedirá la cantidad total de producción.</small>
      </div>
      <span class="workshop-next-note-rc2">Acceso único: botón “Buscar y añadir elaboración”.</span>
    </div>
    <div class="workshop-next-card-rc1">
      <span class="workshop-step-num-rc1">2</span>
      <div>
        <b>Luego revisa el pedido</b>
        <small>El pedido se activa automáticamente cuando haya elaboraciones en la práctica.</small>
      </div>
      <button type="button" class="btn ghost" data-tab="workshop-order" disabled aria-disabled="true">Pedido bloqueado</button>
    </div>`;
}

/**
 * Estado vacío del bloque de lista de ítems (sin elaboraciones).
 */
export function workshopSelectionItemsEmptyHtml() {
  return `
    <div class="empty-action-card-628 workshop-empty-panel-rc1">
      <b>No has añadido elaboraciones.</b>
      <span>Las cantidades se decidirán al añadir cada elaboración. El Catálogo permite consultar fichas maestras sin modificar la práctica.</span>
      <div class="actions">
        <button type="button" class="btn ghost" data-tab="archive-catalog">Buscar elaboraciones en el Catálogo</button>
      </div>
    </div>`;
}

/**
 * Bloque KPI + CTA cuando hay elaboraciones en la práctica.
 * @param {object} s  - resultado de repo.workSelectionSummary()
 * @param {object} helpers - { fmtNumber, fmtMoney }
 */
export function workshopSelectionKpiHtml(s, { fmtNumber, fmtMoney } = {}) {
  const n = fmtNumber || ((v, d = 0) => Number(v || 0).toLocaleString('es-ES', { maximumFractionDigits: d }));
  const money = fmtMoney || ((v) => `${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  return `
    <div class="kpi"><span>Elaboraciones</span><b>${n(s.total_items || 0, 0)}</b></div>
    <div class="kpi"><span>Panadería</span><b>${n(s.bakery_items || 0, 0)}</b></div>
    <div class="kpi"><span>Cocina/Pastelería</span><b>${n(s.culinary_items || 0, 0)}</b></div>
    <div class="kpi"><span>Coste base aprox.</span><b>${money(s.estimated_base_cost || 0)}</b></div>
    <div class="workshop-next-card-rc1 full">
      <span class="workshop-step-num-rc1">✓</span>
      <div>
        <b>Práctica lista para revisar</b>
        <small>Cambia cantidades aquí, revisa pedido y genera fichas/pedido desde Salida.</small>
      </div>
      <div class="workshop-inline-actions-rc1">
        <button type="button" class="btn primary" data-tab="workshop-order">Revisar pedido</button>
        <button type="button" class="btn ghost" data-tab="workshop-output">Imprimir / exportar</button>
      </div>
    </div>`;
}

/**
 * Tarjeta individual de elaboración para la vista móvil de la mesa de trabajo.
 * @param {object} r  - fila de repo.workSelectionItems()
 * @param {object} helpers - { fmtMoney, esc, workshopModeLabel, workshopQuantityLabel }
 */
export function workshopItemCardHtml(r, helpers = {}) {
  const { fmtMoney, esc, workshopModeLabel, workshopQuantityLabel } = helpers;
  const e = esc || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const money = fmtMoney || ((v) => `${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const modeLabel = workshopModeLabel ? workshopModeLabel(r) : (r.production_mode || '—');
  const qtyLabel = workshopQuantityLabel ? workshopQuantityLabel(r) : '—';
  return `
    <article class="workshop-item-card-rc1">
      <div class="workshop-card-main-rc1">
        <b>${e(r.item_name)}</b>
        <span>${e(r.item_type === 'bakery' ? 'Panadería' : 'Cocina/Pastelería')} · ${e(modeLabel)}</span>
      </div>
      <dl class="workshop-card-facts-rc1">
        <div><dt>Cantidad</dt><dd><span class="quantity-chip-626">${qtyLabel}</span></dd></div>
        <div><dt>Coste base</dt><dd>${money(r.estimated_cost)}</dd></div>
      </dl>
      <div class="workshop-card-actions-rc1">
        <button type="button" class="btn compact" data-workshop-edit="${e(r.selection_item_id)}">Cambiar cantidad</button>
        <button type="button" class="btn danger compact" data-workshop-delete="${e(r.selection_item_id)}">Quitar</button>
      </div>
    </article>`;
}

/**
 * Mesa de trabajo completa: tabla desktop + tarjetas móvil.
 * @param {Array}  rows    - resultado de repo.workSelectionItems()
 * @param {object} helpers - { fmtMoney, esc, table, workshopModeLabel, workshopQuantityLabel }
 */
export function workshopItemsHtml(rows, helpers = {}) {
  const { fmtMoney, esc, table: tableFn, workshopModeLabel, workshopQuantityLabel } = helpers;
  const e = esc || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const money = fmtMoney || ((v) => `${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  const modeLabel = r => workshopModeLabel ? workshopModeLabel(r) : (r.production_mode || '—');
  const qtyLabel = r => workshopQuantityLabel ? workshopQuantityLabel(r) : '—';

  let desktopTable = '';
  if (typeof tableFn === 'function') {
    desktopTable = tableFn([
      { label: 'Tipo', render: r => r.item_type === 'bakery' ? 'Panadería' : 'Cocina/Pastelería' },
      { label: 'Elaboración', key: 'item_name' },
      { label: 'Modo', render: r => modeLabel(r) },
      { label: 'Cantidad', render: r => `<span class="quantity-chip-626">${qtyLabel(r)}</span>` },
      { label: 'Coste base', render: r => money(r.estimated_cost) },
      { label: '', render: r => `<div class="quantity-inline-actions-626"><button type="button" class="btn compact" data-workshop-edit="${e(r.selection_item_id)}">Cambiar</button><button type="button" class="btn danger compact" data-workshop-delete="${e(r.selection_item_id)}">Quitar</button></div>` }
    ], rows);
  }

  const mobileCards = rows.map(r => workshopItemCardHtml(r, helpers)).join('');
  return `<div class="workshop-table-view-rc1">${desktopTable}</div><div class="workshop-card-list-rc1">${mobileCards}</div>`;
}

/**
 * Historial de impresión.
 * @param {Array}  jobs    - resultado de repo.printJobs(n)
 * @param {object} helpers - { formatDate, printSourceLabel, table }
 */
export function workshopPrintHistoryHtml(jobs, { formatDate, printSourceLabel, table: tableFn } = {}) {
  if (!jobs?.length || typeof tableFn !== 'function') return '';
  const dateF = formatDate || (d => d ? new Date(d).toLocaleDateString('es-ES') : '—');
  const srcLabel = printSourceLabel || (v => v || '—');
  return tableFn([
    { label: 'Fecha', render: r => dateF(r.created_at) },
    { label: 'Origen', render: r => srcLabel(r.source_type) },
    { label: 'Título', key: 'title' },
    { label: 'Perfil', key: 'profile' },
    { label: 'Elementos', key: 'item_count' },
    { label: 'Coste', render: r => `${Number(r.total_cost || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` }
  ], jobs);
}
