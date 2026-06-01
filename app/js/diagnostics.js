export function bootMark(name, detail = "") {
  try { window.SwiftRemoBootMetrics?.mark?.(name, detail); } catch (_) {}
}

export function bootStart(name, detail = "") {
  try { window.SwiftRemoBootMetrics?.start?.(name, detail); } catch (_) {}
}

export function bootEnd(name, detail = "") {
  try { window.SwiftRemoBootMetrics?.end?.(name, detail); } catch (_) {}
}

export function opfsWorkerEvaluation() {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const win = typeof window !== "undefined" ? window : {};
  const loc = typeof location !== "undefined" ? location : { protocol: "", hostname: "" };
  const hasWorker = typeof Worker !== "undefined";
  const hasModuleWorker = hasWorker;
  const hasOpfs = !!nav.storage?.getDirectory;
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  const isolated = !!win.crossOriginIsolated;
  const localHttp = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(loc.hostname || "");
  const secureContext = !!win.isSecureContext || (loc.protocol === "http:" && localHttp);
  const currentServerLikelyPythonSimple = localHttp && !isolated;
  const decision = currentServerLikelyPythonSimple
    ? "No migrar ahora: el servidor Python simple no aporta COOP/COEP y la v1.5 mantiene persistencia ligera."
    : hasOpfs && hasWorker
      ? "Candidato a prototipo: OPFS/Worker podría evaluarse en rama separada si las mediciones reales muestran bloqueo de UI."
      : "No migrar ahora: faltan capacidades suficientes para OPFS/Worker en este entorno.";
  return {
    decision,
    recommendation: "Mantener SQLite WASM en memoria + snapshots por ahora. Preparar OPFS/Worker solo como prototipo opcional con servidor local con cabeceras si los tiempos medidos lo justifican.",
    browserCapabilities: {
      opfsGetDirectory: hasOpfs,
      worker: hasWorker,
      moduleWorker: hasModuleWorker,
      sharedArrayBuffer: hasSharedArrayBuffer,
      crossOriginIsolated: isolated,
      secureContext,
      protocol: loc.protocol || "n/d",
      hostname: loc.hostname || "n/d"
    },
    implementationRisk: {
      requiresWorkerDbFacade: true,
      requiresAsyncRepositoryFacade: true,
      affectsAllSyncDbCalls: true,
      likelyRequiresServerHeadersForBestVfs: true,
      mustKeepImportExportSqlite: true
    }
  };
}

export function renderOpfsWorkerEvaluation({ esc }) {
  const summaryEl = document.querySelector("#opfsWorkerSummaryRc13");
  const detailEl = document.querySelector("#opfsWorkerDetailsRc13");
  if (!summaryEl && !detailEl) return;
  const ev = opfsWorkerEvaluation();
  const cap = ev.browserCapabilities || {};
  const yesNo = (v) => v ? "Sí" : "No";
  if (summaryEl) {
    summaryEl.innerHTML = `
      <p><b>Decisión</b><span>${esc(ev.decision)}</span></p>
      <p><b>OPFS disponible</b><span>${yesNo(cap.opfsGetDirectory)}</span></p>
      <p><b>Worker disponible</b><span>${yesNo(cap.worker)}</span></p>
      <p><b>crossOriginIsolated</b><span>${yesNo(cap.crossOriginIsolated)}</span></p>
      <p><b>Contexto seguro/local</b><span>${yesNo(cap.secureContext)} · ${esc(cap.protocol || "")} ${esc(cap.hostname || "")}</span></p>`;
  }
  if (detailEl) detailEl.textContent = JSON.stringify(ev, null, 2);
}

export function renderBootMetricsPanel({ fmtNumber }) {
  const summaryEl = document.querySelector("#bootMetricsSummary");
  const detailEl = document.querySelector("#bootMetricsDetails");
  const metrics = window.SwiftRemoBootMetrics?.snapshot?.();
  if (!metrics || (!summaryEl && !detailEl)) return;
  const ms = (v) => Number.isFinite(v) ? `${fmtNumber(v, 1)} ms` : "n/d";
  const s = metrics.summary || {};
  if (summaryEl) {
    summaryEl.innerHTML = `
      <p><b>Arranque usable</b><span>${ms(s.bootstrap)}</span></p>
      <p><b>Módulos iniciales</b><span>${ms(s.initialModulesAll ?? s.initialModulesUntilApp)}</span></p>
      <p><b>SQLite/WASM</b><span>${ms(s.sqliteWasm)}</span></p>
      <p><b>Fetch base pública</b><span>${ms(s.publicDbFetch)}</span></p>
      <p><b>Deserialización DB</b><span>${ms(s.dbDeserialize)}</span></p>
      <p><b>IndexedDB</b><span>${ms(s.indexedDbRecovery)}</span></p>
      <p><b>Repositorio</b><span>${ms(s.repository)}</span></p>
      <p><b>Primer render activo</b><span>${ms(s.firstRender)}</span></p>`;
  }
  if (detailEl) detailEl.textContent = JSON.stringify(metrics, null, 2);
}
