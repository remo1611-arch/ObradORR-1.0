const DOMAIN_ROUTES = {
  workshop: {
    label: 'Taller',
    sectionId: 'tab-workshop',
    hostId: 'workshop-view-host',
    routes: {
      'workshop-practice': 'view-workshop-practice',
      'workshop-order': 'view-workshop-order',
      'workshop-output': 'view-workshop-output',
      'workshop-margins': 'view-workshop-margins'
    }
  },
  history: {
    label: 'Histórico',
    sectionId: 'tab-history',
    hostId: 'history-view-host',
    routes: { 'history-records': 'view-history-records' }
  },
  'technical-archive': {
    label: 'Archivo técnico',
    sectionId: 'tab-technical-archive',
    hostId: 'technical-archive-view-host',
    routes: {
      'archive-catalog': 'view-archive-catalog',
      'archive-elaborations': 'view-archive-elaborations',
      'archive-ingredients': 'view-archive-ingredients',
      'archive-bakery': 'view-archive-bakery',
      'archive-culinary': 'view-archive-culinary',
      'archive-review': 'view-archive-review'
    }
  },
  system: {
    label: 'Sistema',
    sectionId: 'tab-system',
    hostId: 'system-view-host',
    routes: {
      'system-data': 'view-system-data',
      'system-sql': 'view-system-sql',
      'system-status': 'view-archive-review'
    }
  }
};

const LEGACY_ALIASES = {
  selection: 'workshop-practice',
  order: 'workshop-order',
  print: 'workshop-output',
  margins: 'workshop-margins',
  class: 'history-records',
  library: 'archive-catalog',
  elaborations: 'archive-elaborations',
  ingredients: 'archive-ingredients',
  bakery: 'archive-bakery',
  culinary: 'archive-culinary',
  audit: 'archive-review',
  data: 'system-data',
  sql: 'system-sql'
};

function resolveRoute(route) {
  const normalized = LEGACY_ALIASES[route] || route;
  if (DOMAIN_ROUTES[normalized]) return { domain: normalized, route: normalized, viewId: null };
  for (const [domain, cfg] of Object.entries(DOMAIN_ROUTES)) {
    if (cfg.routes[normalized]) return { domain, route: normalized, viewId: cfg.routes[normalized] };
  }
  return null;
}

function ensureHost(cfg) {
  const section = document.getElementById(cfg.sectionId);
  if (!section) return null;
  let host = document.getElementById(cfg.hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = cfg.hostId;
    host.className = 'domain-view-host';
    section.append(host);
  }
  return host;
}

function sectionIdForRoute(domain, route) {
  return DOMAIN_ROUTES[domain]?.routes?.[route] || null;
}

function instantiateLazyView(sectionId) {
  let view = document.getElementById(sectionId);
  if (view) return view;
  const template = document.querySelector(`template[data-lazy-view="${sectionId}"]`);
  if (!template) return null;
  const fragment = template.content.cloneNode(true);
  view = fragment.firstElementChild;
  if (!view) return null;
  template.replaceWith(fragment);
  window.SwiftRemoBootMetrics?.mark?.('lazy-dom:view-instantiated', sectionId);
  return document.getElementById(sectionId) || view;
}

export function createDomainShell({ onBeforeNavigate, onAfterNavigate, state } = {}) {
  let active = { domain: 'workshop', route: 'workshop', viewId: null };
  const movedViews = new Map();

  function ensureRouteView(domain, route) {
    const cfg = DOMAIN_ROUTES[domain];
    const sectionId = sectionIdForRoute(domain, route);
    if (!cfg || !sectionId) return null;
    const host = ensureHost(cfg);
    if (!host) return null;

    let view = movedViews.get(route) || document.getElementById(sectionId) || instantiateLazyView(sectionId);
    if (!view) return null;

    if (!movedViews.has(route)) {
      view.classList.remove('tab-section', 'active');
      view.classList.add('domain-nested-view');
      view.dataset.domain = domain;
      view.dataset.domainRoute = route;
      view.hidden = true;
      host.append(view);
      movedViews.set(route, view);
      document.dispatchEvent(new CustomEvent('swiftremo:lazyViewReady', {
        detail: { domain, route, sectionId, view }
      }));
    }
    return view;
  }

  function init() {
    for (const cfg of Object.values(DOMAIN_ROUTES)) ensureHost(cfg);
    navigate('workshop', { scroll: false, replace: true });
  }

  function setTopDomain(domain) {
    for (const [key, cfg] of Object.entries(DOMAIN_ROUTES)) {
      const sec = document.getElementById(cfg.sectionId);
      if (sec) sec.classList.toggle('active', key === domain);
    }
    document.querySelectorAll('.nav-row button').forEach(btn => {
      const btnDomain = btn.dataset.shellArea || btn.dataset.tab;
      btn.classList.toggle('active', btnDomain === domain);
      if (btnDomain === domain) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  function setNestedView(domain, route) {
    const cfg = DOMAIN_ROUTES[domain];
    if (!cfg) return;
    const activeView = ensureRouteView(domain, route);
    const section = document.getElementById(cfg.sectionId);
    if (section) section.classList.toggle('has-domain-view', !!activeView);
    Object.entries(cfg.routes).forEach(([key]) => {
      const view = movedViews.get(key);
      if (view) view.hidden = key !== route;
    });
  }

  function navigate(route, options = {}) {
    const resolved = resolveRoute(route);
    if (!resolved) return false;
    if (onBeforeNavigate && onBeforeNavigate(resolved, active) === false) return true;
    active = resolved;
    setTopDomain(resolved.domain);
    setNestedView(resolved.domain, resolved.route);
    state?.patch?.({ activeDomain: resolved.domain, activeRoute: resolved.route });
    if (onAfterNavigate) onAfterNavigate(resolved);
    if (options.scroll !== false) {
      const section = document.getElementById(DOMAIN_ROUTES[resolved.domain].sectionId);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  }

  function getActive() { return { ...active }; }

  return { init, navigate, getActive, resolveRoute };
}

export { DOMAIN_ROUTES, LEGACY_ALIASES };
