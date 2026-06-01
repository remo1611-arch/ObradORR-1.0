export function createHistoryDomain({ getRepo } = {}) {
  function sessions() {
    const repo = getRepo?.();
    if (!repo || typeof repo.classSessions !== 'function') return [];
    try { return repo.classSessions() || []; }
    catch { return []; }
  }
  return { sessions };
}
