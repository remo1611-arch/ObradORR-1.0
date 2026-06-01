export function createAppState(initial = {}) {
  const state = {
    activeDomain: 'workshop',
    activeRoute: 'workshop',
    workshop: { status: 'empty', items: [], order: null, printHistory: [] },
    history: { filters: {}, selectedId: null },
    technicalArchive: { section: 'elaborations', filters: {} },
    system: { storageStatus: null, lastBackupAt: null },
    ...initial
  };
  const listeners = new Set();
  function get() { return state; }
  function patch(update = {}) {
    Object.assign(state, update);
    listeners.forEach(fn => fn(state));
  }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  return { get, patch, subscribe };
}
