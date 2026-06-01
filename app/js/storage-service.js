const DB_NAME = "swiftremo-recovery";
const DB_VERSION = 3;
const STORE = "recovery";
const CURRENT_KEY = "current";
const BACKUP_PREFIX = "backup_";
const MAX_BACKUPS = 10;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecovery(bytes, { backup = false, reason = "auto" } = {}) {
  const db = await openDb();
  const now = new Date().toISOString();
  const currentPayload = { bytes, savedAt: now, size: bytes.byteLength, reason: "current" };
  const backupPayload = { bytes, savedAt: now, size: bytes.byteLength, reason };
  await txPut(db, CURRENT_KEY, currentPayload);
  if (backup) {
    await txPut(db, BACKUP_PREFIX + now, backupPayload);
    await pruneBackups(db);
  }
  return currentPayload;
}

export async function loadRecovery() {
  const db = await openDb();
  return txGet(db, CURRENT_KEY);
}

export async function clearRecovery() {
  const db = await openDb();
  return txClear(db);
}

async function pruneBackups(db) {
  try {
    const keys = await txKeys(db);
    const backups = keys.filter(k => String(k).startsWith(BACKUP_PREFIX)).sort().reverse();
    const remove = backups.slice(MAX_BACKUPS);
    for (const key of remove) {
      try { await txDelete(db, key); }
      catch (err) { console.warn("[SwiftRemo] No se pudo eliminar backup IndexedDB antiguo", key, err); }
    }
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo purgar backups IndexedDB antiguos", err);
  }
}

function txPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function txGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
function txKeys(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}
function txDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function txClear(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
