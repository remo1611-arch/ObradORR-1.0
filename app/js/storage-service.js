const DB_NAME = "swiftremo-recovery";
const DB_VERSION = 3;
const STORE = "recovery";
const CURRENT_KEY = "current";
const BACKUP_PREFIX = "backup_";
const MAX_BACKUPS = 10;

const EXTERNAL_FOLDER_HANDLE_KEY = "external_folder_handle_v16";
const EXTERNAL_FOLDER_META_KEY = "external_folder_meta_v16";
const EXTERNAL_WORK_ARCHIVE_INTERVAL_MS = 15 * 60 * 1000;

function detectProbablyMobileEnvironment() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator || {};
  const ua = String(nav.userAgent || "");
  const uaDataMobile = nav.userAgentData && typeof nav.userAgentData.mobile === "boolean" ? nav.userAgentData.mobile : false;
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const touchHeavy = Number(nav.maxTouchPoints || 0) > 1;
  const smallScreen = Math.min(Number(window.screen?.width || 9999), Number(window.screen?.height || 9999)) <= 820;
  return /Android|Mobi|iPhone|iPad|iPod/i.test(ua) || uaDataMobile || (coarsePointer && touchHeavy && smallScreen);
}

export function externalFolderPlatformInfo() {
  if (typeof window === "undefined") {
    return { supported: false, baseSupported: false, mobile: false, android: false, partial: false, mode: "none", reason: "Entorno sin ventana de navegador." };
  }
  const ua = String(window.navigator?.userAgent || "");
  const android = /Android/i.test(ua);
  const mobile = detectProbablyMobileEnvironment();
  const baseSupported = typeof window.showDirectoryPicker === "function";
  if (!baseSupported) {
    return {
      supported: false,
      baseSupported,
      mobile,
      android,
      partial: false,
      mode: mobile ? "mobile-download" : "unsupported",
      reason: mobile
        ? "Este navegador móvil no ofrece selector de carpeta escribible. Usa snapshot interno y descarga manual."
        : "El navegador no permite vincular carpetas. Usa Chrome o Edge de escritorio desde servidor local/HTTPS."
    };
  }
  if (mobile) {
    return {
      supported: true,
      baseSupported,
      mobile: true,
      android,
      partial: true,
      mode: "mobile-opportunistic",
      reason: "Compatibilidad móvil parcial: SwiftRemo intentará escribir en carpeta, pero mantén también snapshot interno y descarga manual."
    };
  }
  return { supported: true, baseSupported: true, mobile: false, android: false, partial: false, mode: "desktop", reason: "Compatible en escritorio." };
}

export function externalFolderFeatureAvailable() {
  return externalFolderPlatformInfo().supported;
}

export function externalFolderUnavailableReason() {
  return externalFolderPlatformInfo().reason;
}

export function externalFolderFriendlyError(err) {
  const name = String(err?.name || "");
  const raw = String(err?.message || err || "");
  const text = `${name} ${raw}`.toLowerCase();
  if (name === "AbortError" || /abort|cancel/i.test(raw)) return "Operación cancelada por el usuario.";
  if (/permission|denied|notallowed|security/i.test(text)) return "El navegador no concedió permiso de escritura. Vuelve a conceder permiso o descarga una copia manual.";
  if (/state cached|state had changed|read from disk|notfound|not found/i.test(text)) return "Android perdió temporalmente el permiso de la carpeta. SwiftRemo puede recuperarlo al guardar; si vas a cerrar, descarga una copia manual.";
  if (/no modification allowed|invalidmodification|readonly|read-only/i.test(text)) return "La carpeta no admite escritura en este momento. Elige otra carpeta o descarga una copia manual.";
  if (/quota|storage/i.test(text)) return "El navegador no pudo completar la escritura por límite o estado de almacenamiento. Descarga una copia manual.";
  return raw ? `No se pudo completar la operación de carpeta. Detalle técnico: ${raw}` : "No se pudo completar la operación de carpeta.";
}

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRecoverableExternalFolderError(err) {
  const name = String(err?.name || "");
  const raw = String(err?.message || err || "");
  const text = `${name} ${raw}`.toLowerCase();
  return /state cached|state had changed|read from disk|notfound|not found|permission|denied|notallowed|security/i.test(text);
}

async function stabilizeDirectoryPermission(handle, { request = false, repeat = false } = {}) {
  let status = await ensureDirectoryPermission(handle, { request });
  if (repeat) {
    await sleep(160);
    const secondStatus = await ensureDirectoryPermission(handle, { request });
    status = secondStatus || status;
  }
  return status;
}

function withPlatform(result) {
  const platform = externalFolderPlatformInfo();
  return { ...result, platformMode: platform.mode, mobile: platform.mobile, android: platform.android, partial: platform.partial };
}

export async function linkExternalFolder() {
  const platform = externalFolderPlatformInfo();
  if (!platform.supported) throw new Error(platform.reason);
  const handle = await window.showDirectoryPicker({ id: "swiftremo-copias", mode: "readwrite" });
  const permission = await stabilizeDirectoryPermission(handle, { request: true, repeat: platform.partial });
  if (permission !== "granted") throw new Error("Permiso de escritura no concedido para la carpeta seleccionada.");
  const now = new Date().toISOString();
  const meta = {
    name: handle.name || "Carpeta vinculada",
    linkedAt: now,
    lastExternalSaveAt: null,
    lastWorkCopyAt: null,
    lastWorkArchiveAt: null,
    lastBackupAt: null,
    workWrites: 0,
    backupWrites: 0,
    lastError: "",
    platformMode: platform.mode,
    mobile: platform.mobile,
    partial: platform.partial
  };
  const db = await openDb();
  await txPut(db, EXTERNAL_FOLDER_HANDLE_KEY, { handle });
  await txPut(db, EXTERNAL_FOLDER_META_KEY, meta);
  return withPlatform({ supported: true, linked: true, permission, writable: true, ...meta, reason: platform.partial ? platform.reason : "Carpeta vinculada y escribible." });
}

export async function unlinkExternalFolder() {
  const db = await openDb();
  await txDelete(db, EXTERNAL_FOLDER_HANDLE_KEY);
  await txDelete(db, EXTERNAL_FOLDER_META_KEY);
  return withPlatform({ supported: externalFolderFeatureAvailable(), linked: false, permission: "none", writable: false });
}

export async function getExternalFolderStatus({ requestPermission = false } = {}) {
  const platform = externalFolderPlatformInfo();
  if (!platform.supported) {
    return withPlatform({ supported: false, linked: false, permission: "unsupported", writable: false, reason: platform.reason });
  }
  const db = await openDb();
  const payload = await txGet(db, EXTERNAL_FOLDER_HANDLE_KEY);
  const meta = await txGet(db, EXTERNAL_FOLDER_META_KEY) || {};
  const handle = payload?.handle;
  if (!handle) {
    return withPlatform({ supported: true, linked: false, permission: "none", writable: false, reason: platform.partial ? platform.reason : "Sin carpeta vinculada." });
  }
  try {
    const permission = await stabilizeDirectoryPermission(handle, { request: requestPermission, repeat: requestPermission && platform.partial });
    const cleanMeta = {
      ...meta,
      name: meta.name || handle.name || "Carpeta vinculada",
      platformMode: platform.mode,
      mobile: platform.mobile,
      partial: platform.partial,
      lastError: permission === "granted" ? "" : (meta.lastError || "")
    };
    if (permission === "granted" && meta.lastError) await txPut(db, EXTERNAL_FOLDER_META_KEY, cleanMeta);
    return withPlatform({
      supported: true,
      linked: true,
      permission,
      writable: permission === "granted",
      ...cleanMeta,
      reason: permission === "granted"
        ? (platform.partial ? "Carpeta escribible ahora. En móvil puede requerir volver a conceder permiso." : "Carpeta disponible para escritura.")
        : "La carpeta está vinculada, pero falta permiso de escritura."
    });
  } catch (err) {
    const friendly = externalFolderFriendlyError(err);
    const cleanMeta = { ...meta, lastError: friendly, platformMode: platform.mode, mobile: platform.mobile, partial: platform.partial };
    await txPut(db, EXTERNAL_FOLDER_META_KEY, cleanMeta).catch(() => null);
    return withPlatform({
      supported: true,
      linked: true,
      permission: "error",
      writable: false,
      name: meta.name || handle.name || "Carpeta vinculada",
      ...cleanMeta,
      reason: platform.partial ? `${friendly} El trabajo sigue protegido en el navegador; descarga una copia si vas a cerrar.` : friendly
    });
  }
}

export async function saveExternalCopies(bytes, { reason = "auto", backup = false, forceWorkArchive = false, requestPermission = false, retryOnRecoverable = true } = {}) {
  const platform = externalFolderPlatformInfo();
  if (!platform.supported) return withPlatform({ supported: false, linked: false, written: false, reason: platform.reason });
  const db = await openDb();
  const payload = await txGet(db, EXTERNAL_FOLDER_HANDLE_KEY);
  const handle = payload?.handle;
  let meta = await txGet(db, EXTERNAL_FOLDER_META_KEY) || {};
  if (!handle) return withPlatform({ supported: true, linked: false, written: false, reason: platform.reason || "Sin carpeta vinculada." });

  try {
    const permission = await stabilizeDirectoryPermission(handle, { request: Boolean(requestPermission), repeat: Boolean(requestPermission) && platform.partial });
    if (permission !== "granted") {
      meta = { ...meta, lastError: "Permiso de escritura pendiente.", lastExternalSaveAt: meta.lastExternalSaveAt || null, platformMode: platform.mode, mobile: platform.mobile, partial: platform.partial };
      await txPut(db, EXTERNAL_FOLDER_META_KEY, meta);
      return withPlatform({ supported: true, linked: true, permission, writable: false, written: false, ...meta, reason: "La carpeta necesita permiso de escritura." });
    }

    const data = normalizeBytes(bytes);
    const now = new Date();
    const nowIso = now.toISOString();
    const stamp = fileDateStamp(now);
    const safeReason = safeFileSegment(reason).slice(0, 48) || "auto";
    const writtenFiles = [];

    await writeBytesToDirectory(handle, ["SwiftRemo_trabajo_actual.sqlite"], data);
    writtenFiles.push("SwiftRemo_trabajo_actual.sqlite");

    const lastWorkArchive = Date.parse(meta.lastWorkArchiveAt || "") || 0;
    const shouldArchiveWork = forceWorkArchive || !lastWorkArchive || (now.getTime() - lastWorkArchive >= EXTERNAL_WORK_ARCHIVE_INTERVAL_MS);
    if (shouldArchiveWork) {
      const file = `swiftremo_trabajo_${stamp}.sqlite`;
      await writeBytesToDirectory(handle, ["copias_trabajo", file], data);
      writtenFiles.push(`copias_trabajo/${file}`);
      meta.lastWorkArchiveAt = nowIso;
    }

    if (backup) {
      const file = `swiftremo_backup_${stamp}_${safeReason}.sqlite`;
      await writeBytesToDirectory(handle, ["copias_seguridad", file], data);
      writtenFiles.push(`copias_seguridad/${file}`);
      meta.lastBackupAt = nowIso;
      meta.backupWrites = Number(meta.backupWrites || 0) + 1;
    }

    meta = {
      ...meta,
      name: meta.name || handle.name || "Carpeta vinculada",
      lastExternalSaveAt: nowIso,
      lastWorkCopyAt: nowIso,
      workWrites: Number(meta.workWrites || 0) + 1,
      lastError: "",
      platformMode: platform.mode,
      mobile: platform.mobile,
      partial: platform.partial
    };
    await txPut(db, EXTERNAL_FOLDER_META_KEY, meta);
    return withPlatform({ supported: true, linked: true, permission, writable: true, written: true, files: writtenFiles, ...meta, reason: platform.partial ? "Copia externa creada en modo móvil parcial." : "Copia externa creada." });
  } catch (err) {
    if (retryOnRecoverable && requestPermission && isRecoverableExternalFolderError(err)) {
      try {
        await sleep(platform.partial ? 260 : 120);
        await stabilizeDirectoryPermission(handle, { request: true, repeat: platform.partial });
        return await saveExternalCopies(bytes, { reason, backup, forceWorkArchive, requestPermission: true, retryOnRecoverable: false });
      } catch (retryErr) {
        err = retryErr;
      }
    }
    const friendly = externalFolderFriendlyError(err);
    meta = { ...meta, lastError: friendly, platformMode: platform.mode, mobile: platform.mobile, partial: platform.partial };
    await txPut(db, EXTERNAL_FOLDER_META_KEY, meta).catch(() => null);
    return withPlatform({ supported: true, linked: true, permission: "error", writable: false, written: false, ...meta, reason: friendly, rawErrorName: err?.name || "" });
  }
}

async function ensureDirectoryPermission(handle, { request = false } = {}) {
  if (!handle) return "missing";
  const opts = { mode: "readwrite" };
  if (typeof handle.queryPermission !== "function") return "granted";
  let status = await handle.queryPermission(opts);
  if (status === "granted") return status;
  if (request && typeof handle.requestPermission === "function") status = await handle.requestPermission(opts);
  return status;
}

function normalizeBytes(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (ArrayBuffer.isView(bytes)) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return new Uint8Array(bytes || []);
}

async function writeBytesToDirectory(rootHandle, pathParts, bytes) {
  let dir = rootHandle;
  const cleanParts = pathParts.map(part => String(part || "").trim()).filter(Boolean);
  for (const part of cleanParts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fileName = cleanParts.at(-1);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
}

function fileDateStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
}

function safeFileSegment(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

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

export async function hasCurrentRecovery() {
  const db = await openDb();
  const keys = await txKeys(db);
  return keys.includes(CURRENT_KEY);
}

export async function getRecoveryInfo() {
  const db = await openDb();
  const current = await txGet(db, CURRENT_KEY);
  const keys = await txKeys(db);
  const backups = keys.filter(k => String(k).startsWith(BACKUP_PREFIX)).sort().reverse();
  return {
    hasCurrent: !!current,
    savedAt: current?.savedAt || null,
    size: current?.size || current?.bytes?.byteLength || current?.bytes?.length || 0,
    reason: current?.reason || '',
    backupCount: backups.length
  };
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
