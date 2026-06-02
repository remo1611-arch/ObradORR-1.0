import { esc, fmtNumber, toast } from "./ui.js?v=100rcfinal";

const LOCAL_PHOTO_SOURCE = Object.freeze({
  id: "fotos_locales_privadas",
  name: "Fotos locales privadas",
  owner: "SwiftRemo local",
  visibility: "private",
  notes: "Fotos integradas desde Archivo técnico como material local privado."
});

function core() { return window.SwiftRemoCore; }
export function db() {
  const d = core()?.swiftDb;
  if (!d?.isLoaded?.()) throw new Error("La base principal de SwiftRemo no está cargada.");
  return d;
}

function slugTechnical(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "item";
}

function parseRecipeUid(uid) {
  const [kind, ...rest] = String(uid || "").split(":");
  const recipeId = rest.join(":");
  if (!recipeId || !["culinary", "bakery"].includes(kind)) return null;
  return { kind, recipeId, uid: `${kind}:${recipeId}`, entityType: kind === "bakery" ? "bakery_recipe" : "culinary_recipe" };
}

function bytesToDataUrl(bytes, mimeType = "image/webp") {
  if (!bytes) return "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return `data:${mimeType || "application/octet-stream"};base64,${btoa(binary)}`;
}

export function ensurePrivateMediaSchema(database = db()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
      permission_notes TEXT,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entity_sources (
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private','internal')),
      notes TEXT,
      PRIMARY KEY (entity_type, entity_id, source_id),
      FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      file_name TEXT,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size_bytes INTEGER,
      sha256 TEXT,
      data BLOB NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES data_sources(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS recipe_media (
      recipe_kind TEXT NOT NULL CHECK (recipe_kind IN ('culinary','bakery')),
      recipe_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','gallery','process','plating','texture','other')),
      caption TEXT,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (recipe_kind, recipe_id, media_id),
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_entity_sources_source ON entity_sources(source_id, entity_type);
    CREATE INDEX IF NOT EXISTS idx_recipe_media_recipe ON recipe_media(recipe_kind, recipe_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_media_assets_source ON media_assets(source_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_source_sha ON media_assets(source_id, sha256) WHERE sha256 IS NOT NULL AND TRIM(sha256) <> '';
  `);
}

export function ensureDataSourceRow(database, source = LOCAL_PHOTO_SOURCE) {
  const id = slugTechnical(source.id || source.name || LOCAL_PHOTO_SOURCE.id);
  const name = String(source.name || LOCAL_PHOTO_SOURCE.name).trim() || LOCAL_PHOTO_SOURCE.name;
  const visibility = ["public", "private", "internal"].includes(source.visibility) ? source.visibility : "private";
  database.exec(`
    INSERT INTO data_sources(id, name, owner, visibility, permission_notes)
    VALUES ($id, $name, $owner, $visibility, $notes)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      owner=COALESCE(excluded.owner, data_sources.owner),
      visibility=excluded.visibility,
      permission_notes=COALESCE(excluded.permission_notes, data_sources.permission_notes);
  `, { $id: id, $name: name, $owner: source.owner || null, $visibility: visibility, $notes: source.notes || null });
  return id;
}

export function recipeMediaRows(kind, recipeId, { includeData = false } = {}) {
  if (!kind || !recipeId) return [];
  ensurePrivateMediaSchema();
  return db().query(`
    SELECT rm.recipe_kind, rm.recipe_id, rm.media_id, rm.role, rm.sort_order, rm.caption, rm.alt_text,
           ma.id, ma.file_name, ma.mime_type, ma.size_bytes, ma.width, ma.height, ma.sha256, ma.created_at,
           ${includeData ? "ma.data," : ""}
           ds.id AS source_id, ds.name AS source_name, ds.visibility AS source_visibility
    FROM recipe_media rm
    JOIN media_assets ma ON ma.id=rm.media_id
    LEFT JOIN data_sources ds ON ds.id=ma.source_id
    WHERE rm.recipe_kind=$kind AND rm.recipe_id=$recipe
    ORDER BY CASE WHEN rm.role='primary' THEN 0 ELSE 1 END, rm.sort_order, ma.created_at;
  `, { $kind: kind, $recipe: recipeId });
}

export function recipeMediaSummary(kind, recipeId) {
  try {
    const rows = recipeMediaRows(kind, recipeId, { includeData: false });
    return {
      total: rows.length,
      primary: rows.find(r => r.role === "primary") || rows[0] || null,
      privateCount: rows.filter(r => r.source_visibility === "private").length,
      rows
    };
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo leer multimedia de la ficha", err);
    return { total: 0, primary: null, privateCount: 0, rows: [], error: err.message || String(err) };
  }
}

export function recipeMediaPanelHtml(uidOrTarget, { compact = false, showThumbnails = true, editable = true, title = "Fotos de la ficha" } = {}) {
  const target = typeof uidOrTarget === "string" ? parseRecipeUid(uidOrTarget) : uidOrTarget;
  if (!target?.kind || !target?.recipeId) return "";
  const uid = `${target.kind}:${target.recipeId}`;
  const summary = recipeMediaSummary(target.kind, target.recipeId);
  const rows = showThumbnails ? recipeMediaRows(target.kind, target.recipeId, { includeData: true }) : summary.rows;
  const status = summary.total
    ? `${fmtNumber(summary.total, 0)} foto${summary.total === 1 ? "" : "s"} vinculada${summary.total === 1 ? "" : "s"}`
    : "Sin foto vinculada";
  const detail = summary.primary
    ? `${summary.primary.file_name || "Foto"}${summary.primary.source_visibility === "private" ? " · local privada" : ""}`
    : "Añade una foto local desde esta ficha. La copia activa quedará marcada como privada/local.";
  const tone = summary.total ? (summary.privateCount ? "warn" : "ok") : "neutral";
  const gallery = rows.length ? `<div class="recipe-media-gallery-v161">
    ${rows.map(r => {
      const src = showThumbnails && r.data ? bytesToDataUrl(r.data, r.mime_type) : "";
      const primary = r.role === "primary";
      return `<figure class="recipe-media-thumb-v161 ${primary ? "primary" : ""}">
        ${src ? `<img src="${src}" alt="${esc(r.alt_text || r.caption || r.file_name || "Foto de la ficha")}" loading="lazy">` : `<div class="recipe-media-placeholder-v161">Foto</div>`}
        <figcaption><b>${primary ? "Principal" : "Galería"}</b><span>${esc(r.file_name || r.caption || "Foto local")}</span>${r.source_visibility === "private" ? `<em>local privada</em>` : ""}</figcaption>
        ${editable ? `<div class="recipe-media-actions-v161">
          ${primary ? "" : `<button type="button" class="btn ghost compact" data-media-primary="${esc(uid)}" data-media-id="${esc(r.media_id)}">Principal</button>`}
          <button type="button" class="btn danger compact" data-media-delete="${esc(uid)}" data-media-id="${esc(r.media_id)}">Eliminar</button>
        </div>` : ""}
      </figure>`;
    }).join("")}
  </div>` : "";
  return `<section class="archive-media-panel-v160 media-manager-panel-v161 ${esc(tone)} ${compact ? "compact" : ""}" data-media-panel="${esc(uid)}">
    <div class="media-manager-head-v161">
      <div>
        <b>${esc(title)}</b>
        <span>${esc(status)} · ${esc(detail)}</span>
        <small>${summary.total ? "Las fotos locales privadas no forman parte de la base pública de GitHub." : "La foto aparecerá como recurso de la ficha cuando la salida documental lo permita."}</small>
      </div>
      ${editable ? `<div class="actions"><button type="button" class="btn ghost" data-media-add-photo="${esc(uid)}">Añadir foto local</button></div>` : ""}
    </div>
    ${gallery}
  </section>`;
}

export function requestRecipePhotoUpload(uidOrTarget, options = {}) {
  const target = typeof uidOrTarget === "string" ? parseRecipeUid(uidOrTarget) : uidOrTarget;
  if (!target?.kind || !target?.recipeId) { toast("No se pudo identificar la ficha seleccionada.", "err"); return; }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.addEventListener("change", async ev => {
    try {
      await importPhotoFilesForRecipe(Array.from(ev.target.files || []), target, options);
    } catch (err) {
      console.error(err);
      toast(err.message || "No se pudieron integrar las fotos.", "err");
    } finally {
      input.remove();
    }
  }, { once: true });
  document.body.appendChild(input);
  input.click();
}

export async function importPhotoFilesForRecipe(files, target, { source = LOCAL_PHOTO_SOURCE, reason = "fotos locales", afterChange = true } = {}) {
  if (!files?.length) return { imported: 0 };
  if (!target?.kind || !target?.recipeId) throw new Error("No se ha indicado una ficha válida para vincular la foto.");
  const database = db();
  ensurePrivateMediaSchema(database);
  const sourceId = ensureDataSourceRow(database, source);
  let imported = 0;
  for (const file of files) {
    if (!/^image\//i.test(file.type || "")) continue;
    const media = await normalizedImageBlob(file);
    const hash = await sha256Hex(media.bytes);
    const mediaId = `${sourceId}_media_${hash.slice(0, 16)}`;
    database.exec(`
      INSERT OR IGNORE INTO media_assets(id, source_id, file_name, mime_type, width, height, size_bytes, sha256, data)
      VALUES ($id, $source, $file, $mime, $width, $height, $size, $sha, $data);
    `, { $id: mediaId, $source: sourceId, $file: media.fileName, $mime: media.mimeType, $width: media.width || null, $height: media.height || null, $size: media.bytes.byteLength, $sha: hash, $data: media.bytes });
    const storedId = database.selectValue("SELECT id FROM media_assets WHERE source_id=$source AND sha256=$sha ORDER BY created_at LIMIT 1;", { $source: sourceId, $sha: hash }) || mediaId;
    const existingPrimary = Number(database.selectValue("SELECT COUNT(*) FROM recipe_media WHERE recipe_kind=$kind AND recipe_id=$recipe AND role='primary';", { $kind: target.kind, $recipe: target.recipeId }) || 0);
    const sortOrder = Number(database.selectValue("SELECT COALESCE(MAX(sort_order),0)+1 FROM recipe_media WHERE recipe_kind=$kind AND recipe_id=$recipe;", { $kind: target.kind, $recipe: target.recipeId }) || 1);
    const role = existingPrimary ? "gallery" : "primary";
    database.exec(`
      INSERT OR REPLACE INTO recipe_media(recipe_kind, recipe_id, media_id, role, caption, alt_text, sort_order)
      VALUES ($kind, $recipe, $media, $role, $caption, $alt, $sort);
    `, { $kind: target.kind, $recipe: target.recipeId, $media: storedId, $role: role, $caption: media.caption, $alt: media.caption, $sort: sortOrder });
    database.exec(`INSERT OR IGNORE INTO entity_sources(entity_type, entity_id, source_id, visibility, notes)
                  VALUES ($type, $id, $source, 'private', 'Foto local privada vinculada desde Archivo técnico.');`,
      { $type: target.entityType || (target.kind === "bakery" ? "bakery_recipe" : "culinary_recipe"), $id: target.recipeId, $source: sourceId });
    imported += 1;
  }
  if (!imported) throw new Error("No se encontró ninguna imagen válida en la selección.");
  if (afterChange) await persistMediaChange(reason, target);
  return { imported };
}

export async function deleteRecipeMedia(uidOrTarget, mediaId) {
  const target = typeof uidOrTarget === "string" ? parseRecipeUid(uidOrTarget) : uidOrTarget;
  if (!target?.kind || !target?.recipeId || !mediaId) throw new Error("No se pudo identificar la foto a eliminar.");
  const database = db();
  ensurePrivateMediaSchema(database);
  database.exec("DELETE FROM recipe_media WHERE recipe_kind=$kind AND recipe_id=$recipe AND media_id=$media;", { $kind: target.kind, $recipe: target.recipeId, $media: mediaId });
  const stillLinked = Number(database.selectValue("SELECT COUNT(*) FROM recipe_media WHERE media_id=$media;", { $media: mediaId }) || 0);
  if (!stillLinked) database.exec("DELETE FROM media_assets WHERE id=$media;", { $media: mediaId });
  await persistMediaChange("eliminar foto local", target);
}

export async function setPrimaryRecipeMedia(uidOrTarget, mediaId) {
  const target = typeof uidOrTarget === "string" ? parseRecipeUid(uidOrTarget) : uidOrTarget;
  if (!target?.kind || !target?.recipeId || !mediaId) throw new Error("No se pudo identificar la foto principal.");
  const database = db();
  ensurePrivateMediaSchema(database);
  database.exec("UPDATE recipe_media SET role='gallery' WHERE recipe_kind=$kind AND recipe_id=$recipe AND role='primary';", { $kind: target.kind, $recipe: target.recipeId });
  database.exec("UPDATE recipe_media SET role='primary', sort_order=0 WHERE recipe_kind=$kind AND recipe_id=$recipe AND media_id=$media;", { $kind: target.kind, $recipe: target.recipeId, $media: mediaId });
  await persistMediaChange("marcar foto principal", target);
}

async function persistMediaChange(reason, target) {
  const c = core();
  await c?.autosave?.({ backup: true, reason });
  const detail = {
    kind: target.kind,
    recipeId: target.recipeId,
    uid: `${target.kind}:${target.recipeId}`,
    reason
  };
  window.dispatchEvent(new CustomEvent("swiftremo:mediaChanged", { detail }));
  c?.refreshAfterMediaChange?.(detail);
}

async function normalizedImageBlob(file) {
  const fallback = async () => ({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type || "image/jpeg", width: null, height: null, fileName: file.name || "foto", caption: file.name || "Foto" });
  if (!window.createImageBitmap || !document.createElement("canvas").toBlob) return fallback();
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) return fallback();
    const base = String(file.name || "foto").replace(/\.[^.]+$/, "");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: "image/webp", width, height, fileName: `${slugTechnical(base)}.webp`, caption: base || "Foto" };
  } catch (err) {
    console.warn("[SwiftRemo] No se pudo optimizar la imagen; se guarda original.", err);
    return fallback();
  } finally {
    try { bitmap?.close?.(); } catch {}
  }
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
