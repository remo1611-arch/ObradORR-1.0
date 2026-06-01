import sqlite3InitModule from "../wasm/index.mjs";

function bootStartRc7(name, detail = "") { try { window.SwiftRemoBootMetrics?.start?.(name, detail); } catch (_) {} }
function bootEndRc7(name, detail = "") { try { window.SwiftRemoBootMetrics?.end?.(name, detail); } catch (_) {} }

export class SwiftDB {
  constructor() {
    this.sqlite3 = null;
    this.db = null;
  }

  async init() {
    if (this.sqlite3) return this.sqlite3;
    bootStartRc7("sqlite:init");
    this.sqlite3 = await sqlite3InitModule({
      print: (...args) => console.log(...args),
      printErr: (...args) => console.error(...args),
      locateFile: (file) => new URL("../wasm/" + file, import.meta.url).href
    });
    bootEndRc7("sqlite:init");
    return this.sqlite3;
  }

  async loadFromUrl(url) {
    await this.init();
    bootStartRc7("sqlite:url-fetch", url);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    bootEndRc7("sqlite:url-fetch", `${buffer.byteLength} bytes`);
    return this.loadFromBytes(new Uint8Array(buffer));
  }

  async loadFromFile(file) {
    await this.init();
    bootStartRc7("sqlite:file-read", file?.name || "archivo local");
    const buffer = await file.arrayBuffer();
    bootEndRc7("sqlite:file-read", `${buffer.byteLength} bytes`);
    return this.loadFromBytes(new Uint8Array(buffer));
  }

  async loadFromBytesAsync(bytes) {
    await this.init();
    return this.loadFromBytes(bytes);
  }

  loadFromBytes(bytes) {
    bootStartRc7("sqlite:deserialize", `${bytes?.byteLength || bytes?.length || 0} bytes`);
    this.close();
    const p = this.sqlite3.wasm.allocFromTypedArray(bytes);
    this.db = new this.sqlite3.oo1.DB();
    const flags = this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
      | this.sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE;
    const rc = this.sqlite3.capi.sqlite3_deserialize(
      this.db.pointer, "main", p, bytes.byteLength, bytes.byteLength,
      flags
    );
    this.db.checkRc(rc);
    this.exec("PRAGMA foreign_keys = ON;");
    bootEndRc7("sqlite:deserialize");
    return this.db;
  }

  query(sql, bind = {}) {
    this.assertDb();
    const result = [];
    this.db.exec({ sql, bind, rowMode: "object", callback: row => result.push(row) });
    return result;
  }

  exec(sql, bind = {}) {
    this.assertDb();
    this.db.exec({ sql, bind });
  }

  selectValue(sql, bind = {}) {
    const rows = this.query(sql, bind);
    return rows.length ? Object.values(rows[0])[0] : null;
  }

  exportBytes() {
    this.assertDb();
    return new Uint8Array(this.sqlite3.capi.sqlite3_js_db_export(this.db.pointer));
  }

  isLoaded() {
    return !!this.db;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  assertDb() {
    if (!this.db) throw new Error("La base SQLite no está cargada.");
  }
}
