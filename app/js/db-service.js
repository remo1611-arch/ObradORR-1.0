import sqlite3InitModule from "../wasm/index.mjs";

export class SwiftDB {
  constructor() {
    this.sqlite3 = null;
    this.db = null;
  }

  async init() {
    if (this.sqlite3) return this.sqlite3;
    this.sqlite3 = await sqlite3InitModule({
      print: (...args) => console.log(...args),
      printErr: (...args) => console.error(...args),
      locateFile: (file) => new URL("../wasm/" + file, import.meta.url).href
    });
    return this.sqlite3;
  }

  async loadFromUrl(url) {
    await this.init();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url}: HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    return this.loadFromBytes(new Uint8Array(buffer));
  }

  async loadFromFile(file) {
    await this.init();
    const buffer = await file.arrayBuffer();
    return this.loadFromBytes(new Uint8Array(buffer));
  }

  async loadFromBytesAsync(bytes) {
    await this.init();
    return this.loadFromBytes(bytes);
  }

  loadFromBytes(bytes) {
    this.close();
    const p = this.sqlite3.wasm.allocFromTypedArray(bytes);
    this.db = new this.sqlite3.oo1.DB();
    const rc = this.sqlite3.capi.sqlite3_deserialize(
      this.db.pointer, "main", p, bytes.byteLength, bytes.byteLength,
      this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
    );
    this.db.checkRc(rc);
    this.exec("PRAGMA foreign_keys = ON;");
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
