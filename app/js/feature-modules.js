const DEFAULT_ROUTE_MODULES = Object.freeze({
  "archive-bakery": ["bakery", "preferments", "extras"],
  "archive-culinary": ["culinary"],
  "history": ["history"],
  "history-records": ["history"]
});

const DEFAULT_MODULE_LABELS = Object.freeze({
  bakery: "Panadería",
  preferments: "Prefermentos",
  extras: "Extras de panadería",
  culinary: "Cocina/Pastelería",
  history: "Histórico"
});

export function createFeatureModuleManager({
  version,
  toast,
  esc,
  moduleLoaded = () => {},
  mark = () => {},
  routeModules = DEFAULT_ROUTE_MODULES,
  moduleLabels = DEFAULT_MODULE_LABELS
}) {
  const loads = new Map();
  const state = new Map();
  let prefetchBound = false;

  const moduleUrl = (name) => `./${name}.js?v=${version}`;

  const snapshot = () => Object.entries(moduleLabels).map(([name, label]) => ({
    name,
    label,
    state: state.get(name)?.state || "pendiente",
    loadedAt: state.get(name)?.loadedAt || null,
    reason: state.get(name)?.reason || ""
  }));

  const renderPanel = () => {
    const el = document.querySelector("#featureModulesSummaryV12");
    const detailEl = document.querySelector("#featureModulesDetailsV12");
    const data = snapshot();
    if (el) {
      el.innerHTML = data.map(item => `<p><b>${esc(item.label)}</b><span>${esc(item.state)}${item.reason ? ` · ${esc(item.reason)}` : ""}</span></p>`).join("");
    }
    if (detailEl) detailEl.textContent = JSON.stringify({ version, modules: data }, null, 2);
  };

  const setModuleState = (name, nextState, reason = "") => {
    state.set(name, {
      state: nextState,
      reason,
      loadedAt: nextState === "cargado" ? new Date().toISOString() : (state.get(name)?.loadedAt || null)
    });
    renderPanel();
  };

  const loadModule = (name, options = {}) => {
    const reason = options.reason || "demanda";
    if (!loads.has(name)) {
      setModuleState(name, "cargando", reason);
      mark("feature-module:load-start", `${name}:${reason}`);
      loads.set(name, import(moduleUrl(name)).then(mod => {
        moduleLoaded(`lazy:${name}`);
        mark("feature-module:load-end", `${name}:${reason}`);
        setModuleState(name, "cargado", reason);
        return mod;
      }).catch(err => {
        loads.delete(name);
        setModuleState(name, "error", reason);
        console.error(`[SwiftRemo] No se pudo cargar módulo bajo demanda: ${name}`, err);
        if (!options.silent) toast(`No se pudo cargar ${moduleLabels[name] || name}.`, "err");
        throw err;
      }));
    }
    return loads.get(name);
  };

  const modulesForRoute = (route) => routeModules[route] || [];

  const preloadForRoute = async (route, reason = "precarga") => {
    const modules = modulesForRoute(route);
    if (!modules.length) return;
    await Promise.all(modules.map(name => loadModule(name, { reason, silent: true })));
  };

  const ensureForRoute = async (route) => {
    const modules = modulesForRoute(route);
    if (!modules.length) return;
    await Promise.all(modules.map(name => loadModule(name, { reason: "navegación" })));
    if (route === "archive-bakery") {
      window.dispatchEvent(new CustomEvent("swiftremo:bakeryReady"));
      return;
    }
    if (route === "archive-culinary") {
      window.dispatchEvent(new CustomEvent("swiftremo:culinaryReady"));
      return;
    }
    if (route === "history" || route === "history-records") {
      window.dispatchEvent(new CustomEvent("swiftremo:historyReady"));
    }
  };

  const routeFromTarget = (target) => {
    const btn = target?.closest?.("[data-tab],[data-system-route]");
    if (!btn) return "";
    return btn.dataset.systemRoute || btn.dataset.tab || "";
  };

  const installPrefetch = () => {
    if (prefetchBound) return;
    prefetchBound = true;
    const handler = ev => {
      const route = routeFromTarget(ev.target);
      if (!modulesForRoute(route).length) return;
      preloadForRoute(route, ev.type === "focusin" ? "foco" : "anticipación").catch(err => console.debug("[SwiftRemo] Precarga opcional omitida", err));
    };
    document.addEventListener("pointerenter", handler, true);
    document.addEventListener("focusin", handler, true);
  };

  return {
    installPrefetch,
    ensureForRoute,
    preloadForRoute,
    renderPanel,
    snapshot,
    publicApi: { version, snapshot, preload: preloadForRoute }
  };
}
