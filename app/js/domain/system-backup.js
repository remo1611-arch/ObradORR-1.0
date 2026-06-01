export function createSystemBackupService({ getDb } = {}) {
  function hasDatabase() { return !!getDb?.(); }
  function exportBytes() {
    const db = getDb?.();
    if (!db || typeof db.exportBytes !== 'function') throw new Error('Base SQLite no disponible.');
    return db.exportBytes();
  }
  return { hasDatabase, exportBytes };
}
