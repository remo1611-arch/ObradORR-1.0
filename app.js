
const VERSION = '1.0.0';
const NOMBRE_IDB = 'obradorr_1_0_0';
const CLAVE_ACTUAL = 'current';
const CLAVES_SNAPSHOT = ['current', 'prev1', 'prev2'];

const estado = {
  vista: 'sesiones',
  baseTipo: 'elaboraciones',
  ventana: null,
  editor: null,
  seleccionRapida: new Map(),
  busquedaElaboraciones: '',
  busquedaIngredientes: '',
  datosPractica: { incluir: false, nombre: '', ciclo_id: '', modulo_id: '', modulo: '', grupo: '', fecha: '', docente: '', observaciones: '', numero_alumnos: '', obrador: '' },
  opcionesDocumento: { appcc: true, costes: true, practica: false, alergenos: true, proceso: true, pedido: true, fotos: true, tipo: 'dossier' },
  snapshots: []
};

let datos = null;

/**
 * Motor SQLite/WASM con persistencia offline robusta.
 * Mantiene tres snapshots rotatorios en IndexedDB: current, prev1 y prev2.
 * SQLite sigue siendo la fuente de verdad: la UI nunca simula cálculos canónicos.
 */
class MotorDatos {
  constructor() {
    this.SQL = null;
    this.db = null;
  }

  /** Inicia sql.js, abre snapshot local o base empaquetada y verifica integridad. */
  async iniciar() {
    if (typeof globalThis.initSqlJs !== 'function') {
      throw new Error('No se encontró sql-wasm.js. Abre ObradORR con servidor local, no con file://.');
    }
    this.SQL = await globalThis.initSqlJs({ locateFile: archivo => `wasm/${archivo}` });
    const copia = await leerBlob(CLAVE_ACTUAL);
    if (copia) {
      this.db = new this.SQL.Database(new Uint8Array(copia));
    } else {
      const respuesta = await fetch('db/obradorr.sqlite');
      if (!respuesta.ok) throw new Error(`No se pudo cargar db/obradorr.sqlite (${respuesta.status}).`);
      this.db = new this.SQL.Database(new Uint8Array(await respuesta.arrayBuffer()));
    }
    this.db.run('PRAGMA foreign_keys=ON');
    aplicarMigracionesCanonicas(this.db);
    const integridad = this.db.exec('PRAGMA integrity_check');
    if (integridad[0]?.values?.[0]?.[0] !== 'ok') throw new Error('La base SQLite no supera integrity_check.');
    await escribirBlob(CLAVE_ACTUAL, this.db.export(), copia ? 'Base local migrada y verificada' : 'Base del paquete inicializada y verificada');
    await refrescarSnapshots();
  }

  /** Ejecuta SELECT y devuelve filas como objetos. */
  consultar(sql, parametros = []) {
    const sentencia = this.db.prepare(sql);
    try {
      sentencia.bind(parametros);
      const filas = [];
      while (sentencia.step()) filas.push(sentencia.getAsObject());
      return filas;
    } finally {
      sentencia.free();
    }
  }

  /** Devuelve una fila o null. */
  uno(sql, parametros = []) {
    return this.consultar(sql, parametros)[0] || null;
  }

  /** Ejecuta una sentencia parametrizada. */
  ejecutar(sql, parametros = []) {
    const sentencia = this.db.prepare(sql);
    try {
      sentencia.run(parametros);
    } finally {
      sentencia.free();
    }
  }

  /** Ejecuta escrituras en transacción, rota snapshots y persiste. */
  async transaccion(operacion, motivo = 'Cambio en ObradORR') {
    this.db.run('BEGIN');
    try {
      const resultado = await operacion();
      this.db.run('COMMIT');
      await this.persistir(motivo);
      return resultado;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  /** Persiste la base activa con snapshots rotatorios. */
  async persistir(motivo = 'Persistencia automática') {
    const actual = await leerBlob(CLAVE_ACTUAL);
    const prev1 = await leerBlob('prev1');
    if (prev1) await escribirBlob('prev2', prev1, 'Snapshot prev2');
    if (actual) await escribirBlob('prev1', actual, 'Snapshot prev1');
    await escribirBlob(CLAVE_ACTUAL, this.db.export(), motivo);
    await refrescarSnapshots();
  }

  /** Restaura un snapshot concreto y recarga la base en memoria. */
  async restaurarSnapshot(clave) {
    const blob = await leerBlob(clave);
    if (!blob) throw new Error(`No existe snapshot ${clave}.`);
    this.db = new this.SQL.Database(new Uint8Array(blob));
    this.db.run('PRAGMA foreign_keys=ON');
    await escribirBlob(CLAVE_ACTUAL, this.db.export(), `Restaurado desde ${clave}`);
    await refrescarSnapshots();
  }

  /** Borra snapshots locales para volver a la base incluida en el ZIP. */
  async restablecerPaquete() {
    for (const clave of CLAVES_SNAPSHOT) await borrarBlob(clave);
  }

}

/**
 * Garantiza una única harina base por elaboración panadera.
 *
 * La restricción parcial idx_linea_harina_base_unica permite exactamente una línea
 * marcada como harina base por elaboración. La normalización se ejecuta en dos pasos:
 * primero desmarca todas las líneas y después selecciona una única candidata activa,
 * priorizando una harina al 100 %, el porcentaje mayor, el orden y finalmente el id.
 * De este modo la migración es idempotente y nunca intenta activar dos harinas a la vez.
 *
 * @param {object} db - Instancia sql.js Database.
 */
function normalizarHarinaBasePanaderia(db) {
  const filtroPanaderia = `elaboracion_id IN (
    SELECT id FROM elaboraciones
    WHERE tipo_obrador='panaderia' OR modelo_calculo='porcentaje_panadero'
  )`;

  db.run(`UPDATE elaboracion_lineas
    SET es_harina_base=0
    WHERE ${filtroPanaderia}`);

  db.run(`UPDATE elaboracion_lineas
    SET es_harina_base=1
    WHERE id IN (
      SELECT l.id
      FROM elaboracion_lineas l
      WHERE l.activo=1
        AND lower(coalesce(l.rol_formula,''))='harina'
        AND l.elaboracion_id IN (
          SELECT id FROM elaboraciones
          WHERE tipo_obrador='panaderia' OR modelo_calculo='porcentaje_panadero'
        )
        AND l.id = (
          SELECT l2.id
          FROM elaboracion_lineas l2
          WHERE l2.elaboracion_id=l.elaboracion_id
            AND l2.activo=1
            AND lower(coalesce(l2.rol_formula,''))='harina'
          ORDER BY
            CASE WHEN abs(coalesce(l2.porcentaje_panadero,0)-100) < 0.000001 THEN 0 ELSE 1 END,
            coalesce(l2.porcentaje_panadero,0) DESC,
            coalesce(l2.orden,0),
            l2.id
          LIMIT 1
        )
    )`);
}

/**
 * Aplica migraciones canónicas no destructivas sobre cualquier snapshot local.
 * La base incluida en el ZIP ya viene migrada, pero esta función protege a usuarios
 * que conserven una copia local antigua en IndexedDB.
 *
 * Migraciones cubiertas:
 * - grupo_formula para separar prefermento, masa final, acabados e inclusiones.
 * - coeficientes hídricos por defecto en ingredientes.
 * - RA/CA curriculares básicos para vinculación docente.
 *
 * @param {object} db - Instancia sql.js Database.
 */
function aplicarMigracionesCanonicas(db) {
  db.run('SAVEPOINT migraciones_canonicas');
  try {
  const columnas = tabla => {
    const res = db.exec(`PRAGMA table_info(${tabla})`);
    return new Set((res[0]?.values || []).map(fila => fila[1]));
  };
  const tieneTabla = nombre => {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
    try { stmt.bind([nombre]); return stmt.step(); }
    finally { stmt.free(); }
  };

  const colLineas = columnas('elaboracion_lineas');
  if (!colLineas.has('grupo_formula')) {
    db.run("ALTER TABLE elaboracion_lineas ADD COLUMN grupo_formula TEXT DEFAULT 'masa_final'");
  }
  db.run(`UPDATE elaboracion_lineas
    SET grupo_formula = CASE
      WHEN lower(coalesce(grupo_visual,'')) LIKE '%prefer%' OR lower(coalesce(rol_formula,'')) IN ('prefermento','poolish','biga','masa madre','masa_madre','levain') THEN 'prefermento'
      WHEN lower(coalesce(grupo_visual,'')) LIKE '%decor%' OR lower(coalesce(rol_formula,'')) IN ('decoracion','decoración') THEN 'decoracion'
      WHEN lower(coalesce(grupo_visual,'')) LIKE '%acab%' OR lower(coalesce(rol_formula,'')) IN ('acabado','cobertura','baño','bano','glaseado') THEN 'acabado'
      WHEN lower(coalesce(grupo_visual,'')) LIKE '%inclu%' OR lower(coalesce(grupo_visual,'')) LIKE '%rellen%' OR lower(coalesce(rol_formula,'')) IN ('inclusion','inclusión','relleno','semilla','fruta') THEN 'inclusion'
      ELSE coalesce(nullif(grupo_formula,''),'masa_final')
    END
    WHERE grupo_formula IS NULL OR grupo_formula='' OR grupo_formula='masa_final'`);
  db.run(`UPDATE elaboracion_lineas
    SET rol_formula = CASE
      WHEN lower(coalesce(rol_formula,''))<>'' THEN rol_formula
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%harina%') THEN 'harina'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%agua%' OR lower(nombre) LIKE '%leche%') THEN 'liquido'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%sal%') THEN 'sal'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%levadura%' OR lower(nombre) LIKE '%ferment%') THEN 'levadura'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%huevo%') THEN 'huevo'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%azúcar%' OR lower(nombre) LIKE '%azucar%') THEN 'azucar'
      WHEN ingrediente_id IN (SELECT id FROM ingredientes WHERE lower(nombre) LIKE '%mantequilla%' OR lower(nombre) LIKE '%aceite%' OR lower(nombre) LIKE '%grasa%') THEN 'grasa'
      ELSE rol_formula
    END
    WHERE elaboracion_id IN (SELECT id FROM elaboraciones WHERE tipo_obrador='panaderia' OR modelo_calculo='porcentaje_panadero')`);
  normalizarHarinaBasePanaderia(db);
  db.run(`UPDATE elaboracion_lineas
    SET aporta_hidratacion=1, factor_hidrico=CASE WHEN factor_hidrico IS NULL OR factor_hidrico=0 THEN 1 ELSE factor_hidrico END
    WHERE lower(coalesce(rol_formula,''))='liquido'
      AND elaboracion_id IN (SELECT id FROM elaboraciones WHERE tipo_obrador='panaderia' OR modelo_calculo='porcentaje_panadero')`);
  db.run(`UPDATE elaboracion_lineas
    SET aporta_hidratacion=1, factor_hidrico=CASE WHEN factor_hidrico IS NULL OR factor_hidrico=0 THEN 0.75 ELSE factor_hidrico END
    WHERE lower(coalesce(rol_formula,''))='huevo'
      AND elaboracion_id IN (SELECT id FROM elaboraciones WHERE tipo_obrador='panaderia' OR modelo_calculo='porcentaje_panadero')`);

  const colIng = columnas('ingredientes');
  if (!colIng.has('aporta_hidratacion_defecto')) db.run("ALTER TABLE ingredientes ADD COLUMN aporta_hidratacion_defecto INTEGER DEFAULT 0 CHECK (aporta_hidratacion_defecto IN (0,1))");
  if (!colIng.has('factor_hidrico_defecto')) db.run("ALTER TABLE ingredientes ADD COLUMN factor_hidrico_defecto REAL DEFAULT 0");
  if (!colIng.has('es_harina_base_defecto')) db.run("ALTER TABLE ingredientes ADD COLUMN es_harina_base_defecto INTEGER DEFAULT 0 CHECK (es_harina_base_defecto IN (0,1))");
  db.run("UPDATE ingredientes SET es_harina_base_defecto=1 WHERE lower(nombre) LIKE '%harina%' AND coalesce(es_harina_base_defecto,0)=0");
  db.run("UPDATE ingredientes SET aporta_hidratacion_defecto=1, factor_hidrico_defecto=1 WHERE lower(nombre) LIKE '%agua%'");
  db.run("UPDATE ingredientes SET aporta_hidratacion_defecto=1, factor_hidrico_defecto=0.87 WHERE lower(nombre) LIKE '%leche%' AND coalesce(factor_hidrico_defecto,0)=0");
  db.run("UPDATE ingredientes SET aporta_hidratacion_defecto=1, factor_hidrico_defecto=0.75 WHERE lower(nombre) LIKE '%huevo%' AND coalesce(factor_hidrico_defecto,0)=0");

  if (!tieneTabla('resultados_aprendizaje')) {
    db.run(`CREATE TABLE resultados_aprendizaje (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modulo_id INTEGER NOT NULL REFERENCES modulos_fp(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      orden INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1 CHECK (activo IN (0,1)),
      UNIQUE(modulo_id,codigo)
    )`);
  }
  if (!tieneTabla('criterios_evaluacion')) {
    db.run(`CREATE TABLE criterios_evaluacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resultado_aprendizaje_id INTEGER NOT NULL REFERENCES resultados_aprendizaje(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      minimo INTEGER DEFAULT 0 CHECK (minimo IN (0,1)),
      peso REAL,
      instrumento TEXT,
      orden INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1 CHECK (activo IN (0,1)),
      UNIQUE(resultado_aprendizaje_id,codigo)
    )`);
  }
  if (!tieneTabla('contrato_canonico_obradorr')) {
    db.run(`CREATE TABLE contrato_canonico_obradorr (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      actualizado_en TEXT DEFAULT (datetime('now'))
    )`);
  }
  db.run("INSERT OR REPLACE INTO contrato_canonico_obradorr (clave,valor,actualizado_en) VALUES ('version_contrato','1.0.0 estable: catálogo documental, motor de selección, escalado, pedido e impresión',datetime('now'))");
  db.run("INSERT OR REPLACE INTO contrato_canonico_obradorr (clave,valor,actualizado_en) VALUES ('regla_modificaciones_serias','No se aceptan cambios sin contrato, migración si procede, UI completa, persistencia real, impresión afectada revisada y validación automática actualizada.',datetime('now'))");
  db.run('RELEASE SAVEPOINT migraciones_canonicas');
  } catch (error) {
    db.run('ROLLBACK TO SAVEPOINT migraciones_canonicas');
    db.run('RELEASE SAVEPOINT migraciones_canonicas');
    throw error;
  }
}

/** Abre IndexedDB y garantiza el object store. */
function abrirAlmacen() {
  return new Promise((resolver, rechazar) => {
    const apertura = indexedDB.open(NOMBRE_IDB, 1);
    apertura.onupgradeneeded = () => {
      const db = apertura.result;
      if (!db.objectStoreNames.contains('bd')) db.createObjectStore('bd');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    apertura.onerror = () => rechazar(apertura.error);
    apertura.onsuccess = () => resolver(apertura.result);
  });
}

/** Lee un blob SQLite de IndexedDB. */
async function leerBlob(clave) {
  try {
    const db = await abrirAlmacen();
    return await new Promise(resolver => {
      const tx = db.transaction('bd', 'readonly');
      const req = tx.objectStore('bd').get(clave);
      req.onsuccess = () => resolver(req.result || null);
      req.onerror = () => resolver(null);
    });
  } catch { return null; }
}

/** Escribe un blob SQLite y metadatos de snapshot. */
async function escribirBlob(clave, bytes, motivo = '') {
  const db = await abrirAlmacen();
  await new Promise((resolver, rechazar) => {
    const tx = db.transaction(['bd', 'meta'], 'readwrite');
    tx.objectStore('bd').put(bytes, clave);
    tx.objectStore('meta').put({ clave, fecha: new Date().toISOString(), bytes: bytes.byteLength || bytes.length || 0, motivo }, clave);
    tx.oncomplete = resolver;
    tx.onerror = () => rechazar(tx.error);
  });
}

/** Borra un blob y su metadato. */
async function borrarBlob(clave) {
  try {
    const db = await abrirAlmacen();
    await new Promise(resolver => {
      const tx = db.transaction(['bd', 'meta'], 'readwrite');
      tx.objectStore('bd').delete(clave);
      tx.objectStore('meta').delete(clave);
      tx.oncomplete = resolver;
      tx.onerror = resolver;
    });
  } catch {}
}

/** Refresca metadatos de snapshots en estado. */
async function refrescarSnapshots() {
  try {
    const db = await abrirAlmacen();
    estado.snapshots = await Promise.all(CLAVES_SNAPSHOT.map(clave => new Promise(resolver => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(clave);
      req.onsuccess = () => resolver(req.result || { clave, fecha: null, bytes: 0, motivo: 'No disponible' });
      req.onerror = () => resolver({ clave, fecha: null, bytes: 0, motivo: 'No disponible' });
    })));
  } catch { estado.snapshots = []; }
}

/** Escapa texto para salida HTML segura. */
function h(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

/** Formatea números técnicos con configuración española. */
function n(valor, decimales = 2) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: decimales }).format(numero);
}

/** Devuelve fecha ISO corta. */
function hoy() { return new Date().toISOString().slice(0, 10); }

/** Muestra estado superior. */
function indicar(mensaje, tipo = '') {
  const nodo = document.getElementById('estado-aplicacion');
  nodo.textContent = mensaje;
  nodo.className = `estado ${tipo}`.trim();
}

/** Cambia vista principal. */
function navegar(vista) {
  estado.vista = vista;
  estado.ventana = null;
  estado.editor = null;
  document.querySelectorAll('[data-vista]').forEach(b => b.classList.toggle('activo', b.dataset.vista === vista));
  renderizar();
}

/** Ejecuta la renderización principal. */
function renderizar() {
  const app = document.getElementById('aplicacion');
  if (!datos) {
    app.innerHTML = '<section class="tarjeta"><h2>Cargando base de datos…</h2><p>Inicializando SQLite/WASM.</p></section>';
    return;
  }
  if (estado.vista === 'sesiones') app.innerHTML = vistaSesiones();
  if (estado.vista === 'base') app.innerHTML = vistaBaseDatos();
  if (estado.vista === 'sistema') app.innerHTML = vistaSistema();
}

/** Lista elaboraciones para catálogos. */
function listarElaboraciones(filtro = '') {
  const patron = `%${filtro.trim()}%`;
  return datos.consultar(`
    SELECT e.id,e.codigo,e.nombre,e.descripcion,e.tipo_obrador,e.tipo_elaboracion,e.modelo_calculo,
           e.estado_documental,e.estado_validacion_obrador,e.activo,e.raciones_base,e.piezas_base,
           e.cantidad_base,e.unidad_base,e.peso_racion_g,e.peso_pieza_g,e.rendimiento_teorico,e.unidad_rendimiento,
           COALESCE(fe.nombre,'') AS familia_elaboracion, COALESCE(se.nombre,'') AS subfamilia_elaboracion,
           COALESCE(ac.nombre,'') AS ambito_culinario,
           (SELECT COUNT(*) FROM elaboracion_lineas l WHERE l.elaboracion_id=e.id AND l.activo=1) AS numero_lineas,
           (SELECT COUNT(*) FROM elaboracion_pasos p WHERE p.elaboracion_id=e.id AND p.activo=1) AS numero_pasos
    FROM elaboraciones e
    LEFT JOIN familias_elaboracion fe ON fe.id=e.familia_elaboracion_id
    LEFT JOIN subfamilias_elaboracion se ON se.id=e.subfamilia_elaboracion_id
    LEFT JOIN ambitos_culinarios ac ON ac.id=e.ambito_culinario_id
    WHERE (?='%%' OR e.nombre LIKE ? OR e.codigo LIKE ? OR fe.nombre LIKE ? OR se.nombre LIKE ? OR e.tipo_obrador LIKE ?)
    ORDER BY e.activo DESC, e.nombre COLLATE NOCASE
    LIMIT 600`, [patron, patron, patron, patron, patron, patron]);
}

/** Obtiene una elaboración con coste y resumen APPCC. */
function obtenerElaboracion(id) {
  return datos.uno(`
    SELECT e.*, COALESCE(fe.nombre,'') AS familia_elaboracion, COALESCE(se.nombre,'') AS subfamilia_elaboracion,
           COALESCE(ac.nombre,'') AS ambito_culinario,
           c.coste_total,c.coste_por_racion,c.coste_por_pieza,c.coste_por_kg,c.lineas_coste_incompatible,
           a.numero_peligros,a.numero_pcc
    FROM elaboraciones e
    LEFT JOIN familias_elaboracion fe ON fe.id=e.familia_elaboracion_id
    LEFT JOIN subfamilias_elaboracion se ON se.id=e.subfamilia_elaboracion_id
    LEFT JOIN ambitos_culinarios ac ON ac.id=e.ambito_culinario_id
    LEFT JOIN v_coste_elaboracion_expandido c ON c.elaboracion_id=e.id
    LEFT JOIN v_appcc_resumen_f7 a ON a.elaboracion_id=e.id
    WHERE e.id=?`, [id]);
}

/** Devuelve líneas directas de una elaboración. */
function lineasElaboracion(id) {
  return datos.consultar(`
    SELECT l.*, COALESCE(i.nombre, ee.nombre, 'Elemento sin nombre') AS nombre_linea,
           COALESCE(i.unidad_trabajo, l.unidad) AS unidad_trabajo
    FROM elaboracion_lineas l
    LEFT JOIN ingredientes i ON i.id=l.ingrediente_id
    LEFT JOIN elaboraciones ee ON ee.id=l.elaborado_id
    WHERE l.elaboracion_id=?
    ORDER BY l.activo DESC,l.orden,l.id`, [id]);
}

/** Devuelve pasos de proceso. */
function pasosElaboracion(id) {
  return datos.consultar('SELECT * FROM elaboracion_pasos WHERE elaboracion_id=? ORDER BY activo DESC, numero_paso, id', [id]);
}

/** Devuelve peligros APPCC. */
function appccElaboracion(id) {
  return datos.consultar(`SELECT a.*, p.numero_paso, p.titulo_paso
    FROM appcc_peligros_elaboracion a LEFT JOIN elaboracion_pasos p ON p.id=a.paso_id
    WHERE a.elaboracion_id=? ORDER BY a.orden,a.id`, [id]);
}

/** Devuelve alérgenos inferidos de una elaboración. */
function alergenosElaboracion(id) {
  return datos.consultar('SELECT * FROM v_alergenos_elaboracion WHERE elaboracion_id=? ORDER BY alergeno', [id]);
}

/** Devuelve la fórmula panadera base, si existe. */
function resumenPanadero(id) {
  return datos.uno('SELECT * FROM v_formula_panadera_resumen WHERE elaboracion_id=?', [id]);
}

/** Devuelve líneas de fórmula panadera. */
function formulaPanadera(id) {
  return datos.consultar('SELECT * FROM v_formula_panadera WHERE elaboracion_id=? ORDER BY linea_id', [id]);
}

/** Devuelve líneas base expandidas para pedido consolidado. */
function pedidoBaseElaboracion(id) {
  return datos.consultar('SELECT * FROM v_pedido_base_expandido WHERE elaboracion_id=? ORDER BY orden_familia,familia,ingrediente', [id]);
}

/** Lista ingredientes. */
function listarIngredientes(filtro = '') {
  const patron = `%${filtro.trim()}%`;
  return datos.consultar(`
    SELECT i.*, COALESCE(f.nombre,'') AS familia, COALESCE(s.nombre,'') AS subfamilia, COALESCE(z.nombre,'') AS zona,
           (SELECT COUNT(*) FROM elaboracion_lineas l WHERE l.ingrediente_id=i.id AND l.activo=1) AS usos
    FROM ingredientes i
    LEFT JOIN familias_ingrediente f ON f.id=i.familia_id
    LEFT JOIN subfamilias_ingrediente s ON s.id=i.subfamilia_id
    LEFT JOIN zonas_almacenamiento z ON z.id=i.zona_almacenamiento_id
    WHERE (?='%%' OR i.nombre LIKE ? OR i.codigo LIKE ? OR f.nombre LIKE ? OR s.nombre LIKE ?)
    ORDER BY i.activo DESC,i.nombre COLLATE NOCASE
    LIMIT 700`, [patron, patron, patron, patron, patron]);
}

/** Obtiene un ingrediente. */
function obtenerIngrediente(id) {
  return datos.uno(`SELECT i.*, COALESCE(f.nombre,'') AS familia, COALESCE(s.nombre,'') AS subfamilia, COALESCE(z.nombre,'') AS zona
    FROM ingredientes i
    LEFT JOIN familias_ingrediente f ON f.id=i.familia_id
    LEFT JOIN subfamilias_ingrediente s ON s.id=i.subfamilia_id
    LEFT JOIN zonas_almacenamiento z ON z.id=i.zona_almacenamiento_id
    WHERE i.id=?`, [id]);
}

/** Devuelve usos de ingrediente. */
function usosIngrediente(id) {
  return datos.consultar(`SELECT e.id,e.nombre,e.tipo_obrador,e.modelo_calculo,l.cantidad_neta,l.unidad,l.orden
    FROM elaboracion_lineas l JOIN elaboraciones e ON e.id=l.elaboracion_id
    WHERE l.ingrediente_id=? AND l.activo=1 ORDER BY e.nombre COLLATE NOCASE`, [id]);
}


/** Lista ciclos FP activos para contextualizar prácticas y sesiones. */
function listarCiclos() {
  return datos.consultar(`SELECT id,codigo,nombre,grado,familia_profesional,normativa_referencia,orden FROM ciclos_fp WHERE activo=1 ORDER BY orden,nombre COLLATE NOCASE`);
}

/** Lista módulos FP activos, opcionalmente filtrados por ciclo. */
function listarModulos(cicloId = '') {
  if (cicloId) return datos.consultar(`SELECT id,ciclo_id,codigo,nombre,curso,horas,orden FROM modulos_fp WHERE activo=1 AND ciclo_id=? ORDER BY curso,orden,nombre COLLATE NOCASE`, [Number(cicloId)]);
  return datos.consultar(`SELECT id,ciclo_id,codigo,nombre,curso,horas,orden FROM modulos_fp WHERE activo=1 ORDER BY ciclo_id,curso,orden,nombre COLLATE NOCASE`);
}

/** Devuelve opciones HTML de ciclos. */
function opcionesCiclos(valor = '') {
  return `<option value="">Sin ciclo obligatorio</option>${listarCiclos().map(c => `<option value="${c.id}" ${String(valor)===String(c.id)?'selected':''}>${h(c.codigo)} · ${h(c.nombre)}</option>`).join('')}`;
}

/** Devuelve opciones HTML de módulos, filtrando por ciclo si procede. */
function opcionesModulos(cicloId = '', valor = '') {
  return `<option value="">Sin módulo obligatorio</option>${listarModulos(cicloId).map(m => `<option value="${m.id}" ${String(valor)===String(m.id)?'selected':''}>${h(m.codigo)} · ${h(m.nombre)}</option>`).join('')}`;
}

/** Obtiene nombre de ciclo para impresión contextual. */
function nombreCiclo(id) {
  if (!id) return '';
  const c = datos.uno('SELECT codigo,nombre FROM ciclos_fp WHERE id=?', [Number(id)]);
  return c ? `${c.codigo} · ${c.nombre}` : '';
}

/** Obtiene nombre de módulo para impresión contextual. */
function nombreModulo(id) {
  if (!id) return '';
  const m = datos.uno('SELECT codigo,nombre FROM modulos_fp WHERE id=?', [Number(id)]);
  return m ? `${m.codigo} · ${m.nombre}` : '';
}

/** Lista fotos asociadas a una elaboración. */
function fotosElaboracion(id) {
  return datos.consultar(`SELECT * FROM fotos_elaboracion WHERE elaboracion_id=? ORDER BY es_principal DESC, orden, id`, [id]);
}

/** Devuelve foto principal de una elaboración, si existe. */
function fotoPrincipalElaboracion(id) {
  return datos.uno(`SELECT * FROM fotos_elaboracion WHERE elaboracion_id=? ORDER BY es_principal DESC, orden, id LIMIT 1`, [id]);
}

/** Lista sesiones recientes. */
function listarSesiones() {
  return datos.consultar(`SELECT p.*, (SELECT COUNT(*) FROM practica_elaboraciones pe WHERE pe.practica_id=p.id) AS numero_elaboraciones
    FROM practicas_docentes p ORDER BY COALESCE(p.actualizado_en,p.creado_en,p.fecha_prevista,'') DESC,p.id DESC LIMIT 30`);
}

/** Obtiene sesión/práctica con elaboraciones. */
function obtenerSesion(id) {
  const sesion = datos.uno('SELECT * FROM practicas_docentes WHERE id=?', [id]);
  if (!sesion) return null;
  sesion.elaboraciones = datos.consultar(`SELECT pe.*, e.nombre,e.tipo_obrador,e.modelo_calculo,e.raciones_base,e.piezas_base,e.cantidad_base,e.unidad_base
    FROM practica_elaboraciones pe JOIN elaboraciones e ON e.id=pe.elaboracion_id
    WHERE pe.practica_id=? ORDER BY pe.orden,e.nombre`, [id]);
  return sesion;
}

/** Opciones para select de ingredientes. */
function opcionesIngredientes(valor = '') {
  return listarIngredientes('').map(i => `<option value="${i.id}" ${String(valor) === String(i.id) ? 'selected' : ''}>${h(i.nombre)} · ${h(i.unidad_trabajo)}</option>`).join('');
}

/** Opciones de elaborados reutilizables. */
function opcionesElaborados(valor = '', excluirId = 0) {
  return listarElaboraciones('').filter(e => e.id !== excluirId && e.es_elaborado_reutilizable !== 0).map(e => `<option value="${e.id}" ${String(valor) === String(e.id) ? 'selected' : ''}>${h(e.nombre)}</option>`).join('');
}

/** Lista unidades canónicas para evitar errores de FK por texto libre. */
function listarUnidades() {
  return datos.consultar('SELECT codigo,nombre FROM unidades ORDER BY codigo COLLATE NOCASE');
}

/** Devuelve opciones de unidades conservando un valor existente aunque no sea habitual. */
function opcionesUnidades(valor = '', defecto = 'g') {
  const actual = valor || defecto;
  const opciones = listarUnidades();
  const extra = actual && !opciones.some(u => u.codigo === actual) ? `<option value="${h(actual)}" selected>${h(actual)}</option>` : '';
  return `${extra}${opciones.map(u => `<option value="${h(u.codigo)}" ${actual === u.codigo ? 'selected' : ''}>${h(u.codigo)} · ${h(u.nombre || '')}</option>`).join('')}`;
}

/** Lista familias de ingredientes para altas y edición de catálogo. */
function listarFamiliasIngrediente() {
  return datos.consultar('SELECT id,nombre,orden FROM familias_ingrediente ORDER BY orden,nombre COLLATE NOCASE');
}

/** Opciones HTML de familias de ingrediente. */
function opcionesFamiliasIngrediente(valor = '') {
  return `<option value="">Sin familia</option>${listarFamiliasIngrediente().map(f => `<option value="${f.id}" ${String(valor) === String(f.id) ? 'selected' : ''}>${h(f.nombre)}</option>`).join('')}`;
}

/** Lista familias de elaboración para altas y edición de fichas. */
function listarFamiliasElaboracion() {
  return datos.consultar('SELECT id,nombre,orden FROM familias_elaboracion ORDER BY orden,nombre COLLATE NOCASE');
}

/** Opciones HTML de familias de elaboración. */
function opcionesFamiliasElaboracion(valor = '') {
  return `<option value="">Sin familia</option>${listarFamiliasElaboracion().map(f => `<option value="${f.id}" ${String(valor) === String(f.id) ? 'selected' : ''}>${h(f.nombre)}</option>`).join('')}`;
}

/** Normaliza un código corto único para altas creadas desde la UI. */
function codigoTemporal(prefijo, nombre) {
  const base = String(nombre || 'nuevo').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'nuevo';
  return `${prefijo}_${base}_${Date.now().toString(36)}`;
}

/** Devuelve null cuando un select opcional queda vacío. */
function idOpcional(valor) {
  const numero = Number(valor || 0);
  return numero > 0 ? numero : null;
}

/** Devuelve si una ficha debe tratarse como panadera en la selección rápida. */
function esFichaPanaderia(e) {
  return e.tipo_obrador === 'panaderia' || e.modelo_calculo === 'porcentaje_panadero';
}

/** Devuelve los modos de escalado que proceden según el tipo de ficha. */
function modosEscaladoDisponibles(e) {
  if (esFichaPanaderia(e)) {
    return [
      { valor: 'harina_total', texto: 'Harina total' },
      { valor: 'masa_total', texto: 'Masa cruda total' },
      { valor: 'piezas_peso', texto: 'Piezas × peso' },
    ];
  }
  return [
    { valor: 'raciones', texto: 'Raciones' },
    { valor: 'rendimiento', texto: 'Rendimiento' },
  ];
}

/** Devuelve modo de escalado por defecto según ficha. */
function modoEscaladoPorDefecto(e) {
  if (esFichaPanaderia(e)) return 'harina_total';
  if (e.modelo_calculo === 'rendimiento') return 'rendimiento';
  return 'raciones';
}

/** Garantiza que el modo guardado es compatible con la ficha seleccionada. */
function modoEscaladoSeguro(e, seleccion) {
  const disponibles = modosEscaladoDisponibles(e).map(m => m.valor);
  return disponibles.includes(seleccion?.modo) ? seleccion.modo : modoEscaladoPorDefecto(e);
}

/** Crea selección inicial para una elaboración. */
function seleccionInicial(e) {
  const pan = resumenPanadero(e.id);
  const modo = modoEscaladoPorDefecto(e);
  return {
    modo,
    raciones: Number(e.raciones_base || 1),
    piezas: Number(e.piezas_base || 1),
    cantidad: Number(e.cantidad_base || e.rendimiento_teorico || 1),
    unidad: e.unidad_base || e.unidad_rendimiento || 'racion',
    harina: Number(pan?.harina_total_g || pan?.harina_base_g || 1000),
    masa: Number(pan?.peso_masa_cruda_g || 1000),
    pesoPieza: Number(pan?.peso_pieza_cruda_g || e.peso_pieza_g || 250),
    orden: estado.seleccionRapida.size + 1
  };
}

/** Calcula factor de escala canónico para selección. */
function calcularFactorEscala(e, seleccion) {
  const pan = resumenPanadero(e.id);
  const modo = seleccion.modo || modoEscaladoPorDefecto(e);
  let factor = 1;
  let incidencia = '';
  if (modo === 'raciones') {
    const base = Number(e.raciones_base || 1);
    factor = Number(seleccion.raciones || base) / base;
  } else if (modo === 'rendimiento') {
    const base = Number(e.cantidad_base || e.rendimiento_teorico || 1);
    factor = Number(seleccion.cantidad || base) / base;
    if ((seleccion.unidad || e.unidad_base) !== e.unidad_base) incidencia = 'Unidad objetivo distinta de unidad base; no se aplica conversión automática.';
  } else if (modo === 'harina_total') {
    const base = Number(pan?.harina_total_g || pan?.harina_base_g || 1000);
    factor = Number(seleccion.harina || base) / base;
  } else if (modo === 'masa_total') {
    const base = Number(pan?.peso_masa_cruda_g || 1);
    factor = Number(seleccion.masa || base) / base;
  } else if (modo === 'piezas_peso') {
    const base = Number(pan?.peso_masa_cruda_g || ((e.piezas_base || 1) * (e.peso_pieza_g || seleccion.pesoPieza || 1)) || 1);
    factor = (Number(seleccion.piezas || 0) * Number(seleccion.pesoPieza || pan?.peso_pieza_cruda_g || e.peso_pieza_g || 1)) / base;
  }
  if (!Number.isFinite(factor) || factor <= 0) factor = 1;
  return { factor, modo, incidencia };
}

/** Escala una línea directa para vista de ficha. */
function escalarLineaDirecta(linea, factor) {
  return { ...linea, cantidad_escalada: Number(linea.cantidad_neta || 0) * factor };
}

/** Consolida pedido dinámico desde selección no guardada. */
function calcularPedidoConsolidadoSeleccion() {
  const acumulado = new Map();
  let costeTotal = 0;
  const fichas = [];
  for (const [id, sel] of estado.seleccionRapida.entries()) {
    const e = obtenerElaboracion(id);
    if (!e) continue;
    const escala = calcularFactorEscala(e, sel);
    fichas.push({ elaboracion: e, seleccion: sel, escala });
    costeTotal += Number(e.coste_total || 0) * escala.factor;
    for (const l of pedidoBaseElaboracion(id)) {
      const clave = `${l.ingrediente_id || l.ingrediente}-${l.unidad_base}`;
      const previo = acumulado.get(clave) || { ingrediente: l.ingrediente, familia: l.familia || 'Sin familia', ordenFamilia: Number(l.orden_familia || 9999), unidad: l.unidad_base, cantidad: 0, coste: 0, origenes: 0, origenesNombres: [] };
      previo.cantidad += Number(l.cantidad_bruta_base || 0) * escala.factor;
      previo.coste += Number(l.coste_estimado || 0) * escala.factor;
      previo.origenes += 1;
      if (!previo.origenesNombres.includes(e.nombre)) previo.origenesNombres.push(e.nombre);
      previo.origenesTexto = previo.origenesNombres.join(' · ');
      acumulado.set(clave, previo);
    }
  }
  return { fichas, lineas: [...acumulado.values()].sort((a,b)=>(a.ordenFamilia-b.ordenFamilia) || String(a.familia).localeCompare(String(b.familia),'es') || String(a.ingrediente).localeCompare(String(b.ingrediente),'es')), costeTotal };
}

/** Vista Sesiones: selección rápida y sesiones recientes. */
function vistaSesiones() {
  const sesiones = listarSesiones();
  return `<section class="portada">
    <div class="hero"><h2>Sesiones</h2><p>Selecciona fichas, escala producción, imprime sin guardar o guarda la práctica al final.</p></div>
    <section class="seleccion-rapida">
      <div class="panel">
        <div class="barra"><input class="campo-busqueda" data-control="buscar-seleccion" type="search" placeholder="Buscar fichas…" value="${h(estado.busquedaElaboraciones)}"><div class="barra__grupo"><button class="boton secundario" data-accion="seleccionar-visibles">Seleccionar visibles</button><button class="boton plano" data-accion="limpiar-seleccion">Limpiar</button></div></div>
        <div class="catalogo catalogo-seleccion">${listarElaboraciones(estado.busquedaElaboraciones).map(tarjetaSeleccion).join('')}</div>
      </div>
      <aside class="panel-lateral">
        <div class="tarjeta"><h3>Documento y práctica</h3>${panelOpcionesDocumento()}</div>
        <div class="tarjeta"><h3>Pedido consolidado dinámico</h3>${tablaPedidoConsolidado(calcularPedidoConsolidadoSeleccion().lineas, true)}</div>
        <div class="tarjeta"><h3>Vista previa</h3><div class="vista-previa">${htmlVistaPreviaSeleccion()}</div><div class="barra__grupo"><button class="boton primario" data-accion="imprimir-seleccion">Imprimir sin guardar</button><button class="boton secundario" data-accion="guardar-sesion">Guardar como sesión</button></div></div>
      </aside>
    </section>
    <section class="tarjeta"><h3>Sesiones recientes</h3>${sesiones.length ? `<div class="catalogo">${sesiones.map(tarjetaSesion).join('')}</div>` : '<p class="vacio">Aún no hay sesiones guardadas.</p>'}</section>
  </section>`;
}

/** Tarjeta seleccionable compacta con escalado contextual. */
function tarjetaSeleccion(elab) {
  const sel = estado.seleccionRapida.get(elab.id);
  const seleccion = sel || seleccionInicial(elab);
  seleccion.modo = modoEscaladoSeguro(elab, seleccion);
  const activa = Boolean(sel);
  const pan = resumenPanadero(elab.id);
  const escala = calcularFactorEscala(elab, seleccion);
  const clase = activa ? 'item seleccionable seleccionado' : 'item seleccionable';
  const tipoEtiqueta = esFichaPanaderia(elab) ? 'Panadería' : 'Cocina';
  return `<article class="${clase}" role="button" tabindex="0" data-accion="alternar-seleccion" data-id="${elab.id}" aria-pressed="${activa ? 'true' : 'false'}">
    <div class="selector-ficha" aria-hidden="true">${activa ? '✓' : '+'}</div>
    <div class="item__contenido">
      <p class="item__titulo">${h(elab.nombre)}</p>
      <div class="item__meta">${h(elab.familia_elaboracion || elab.tipo_obrador)} · ${h(tipoEtiqueta)} · ${n(elab.numero_lineas,0)} líneas · ${n(elab.numero_pasos,0)} pasos</div>
      <div class="etiquetas">
        <span class="etiqueta">${h(elab.modelo_calculo)}</span>
        <span class="etiqueta">${esFichaPanaderia(elab) ? `harina base ${n(pan?.harina_total_g || pan?.harina_base_g || 0,0)} g` : `base ${n(elab.raciones_base,0)} rac.`}</span>
        ${activa ? `<span class="etiqueta ok">${h(etiquetaEscalado(elab, seleccion, escala))}</span>` : '<span class="etiqueta">tocar para seleccionar</span>'}
      </div>
      ${activa ? camposEscaladoCompactos(elab, seleccion, pan, escala) : ''}
    </div>
    <div class="item__acciones">
      <button class="boton pequeno" data-accion="abrir-elaboracion" data-id="${elab.id}" data-modo="vista">Ver</button>
      <button class="boton pequeno secundario" data-accion="abrir-elaboracion" data-id="${elab.id}" data-modo="editar">Editar</button>
    </div>
  </article>`;
}

/** Select de modo contextual: cocina solo cocina; panadería solo panadería. */
function selectModoEscalado(elab, seleccion) {
  return `<label class="modo-escalado"><span>Modo</span><select data-control="modo-escalado" data-id="${elab.id}">${modosEscaladoDisponibles(elab).map(m => `<option value="${m.valor}" ${seleccion.modo === m.valor ? 'selected' : ''}>${h(m.texto)}</option>`).join('')}</select></label>`;
}

/** Campos visibles únicamente para el modo de escalado activo. */
function camposEscaladoCompactos(elab, seleccion, pan, escala) {
  const modo = modoEscaladoSeguro(elab, seleccion);
  const orden = `<label class="campo-mini"><span>Orden</span><input class="campo" type="number" min="1" step="1" data-control="orden" data-id="${elab.id}" value="${h(seleccion.orden)}"></label>`;
  let campos = '';
  if (modo === 'raciones') {
    campos = `<label class="campo-mini"><span>Raciones</span><input class="campo" type="number" min="0" step="1" data-control="raciones" data-id="${elab.id}" value="${h(seleccion.raciones)}"></label>`;
  } else if (modo === 'rendimiento') {
    campos = `<label class="campo-mini"><span>Cantidad</span><input class="campo" type="number" min="0" step="0.001" data-control="cantidad" data-id="${elab.id}" value="${h(seleccion.cantidad)}"></label><label class="campo-mini"><span>Unidad</span><input class="campo" data-control="unidad" data-id="${elab.id}" value="${h(seleccion.unidad)}"></label>`;
  } else if (modo === 'harina_total') {
    campos = `<label class="campo-mini"><span>Harina total g</span><input class="campo" type="number" min="0" step="1" data-control="harina" data-id="${elab.id}" value="${h(seleccion.harina)}"></label>`;
  } else if (modo === 'masa_total') {
    campos = `<label class="campo-mini"><span>Masa cruda g</span><input class="campo" type="number" min="0" step="1" data-control="masa" data-id="${elab.id}" value="${h(seleccion.masa)}"></label>`;
  } else if (modo === 'piezas_peso') {
    campos = `<label class="campo-mini"><span>Piezas</span><input class="campo" type="number" min="0" step="1" data-control="piezas" data-id="${elab.id}" value="${h(seleccion.piezas)}"></label><label class="campo-mini"><span>Peso pieza g</span><input class="campo" type="number" min="0" step="1" data-control="pesoPieza" data-id="${elab.id}" value="${h(seleccion.pesoPieza || pan?.peso_pieza_cruda_g || elab.peso_pieza_g || 0)}"></label>`;
  }
  return `<div class="cantidad cantidad-compacta">
    ${selectModoEscalado(elab, seleccion)}
    ${campos}
    ${orden}
    <p class="resumen-escala">Factor ${n(escala.factor,3)}${escala.incidencia ? ` · ${h(escala.incidencia)}` : ''}</p>
  </div>`;
}

/** Opciones de documento. */
function panelOpcionesDocumento() {
  const d = estado.datosPractica, o = estado.opcionesDocumento;
  return `<div class="opciones"><label><span>Tipo de documento</span><select data-control="tipo-documento"><option value="dossier" ${o.tipo==='dossier'?'selected':''}>Dossier completo</option><option value="pedido" ${o.tipo==='pedido'?'selected':''}>Pedido consolidado</option><option value="fichas" ${o.tipo==='fichas'?'selected':''}>Fichas técnicas</option></select></label>
    <label class="check"><input type="checkbox" data-control="opcion-appcc" ${o.appcc?'checked':''}> Incluir APPCC</label>
    <label class="check"><input type="checkbox" data-control="opcion-costes" ${o.costes?'checked':''}> Incluir costes</label>
    <label class="check"><input type="checkbox" data-control="opcion-alergenos" ${o.alergenos?'checked':''}> Incluir alérgenos</label>
    <label class="check"><input type="checkbox" data-control="opcion-fotos" ${o.fotos?'checked':''}> Incluir fotos</label>
    <label class="check"><input type="checkbox" data-control="opcion-practica" ${d.incluir?'checked':''}> Incluir datos de práctica</label>
    ${d.incluir ? `<div class="formulario"><label><span>Práctica</span><input class="campo" data-practica="nombre" value="${h(d.nombre)}"></label><label><span>Ciclo</span><select data-practica="ciclo_id">${opcionesCiclos(d.ciclo_id)}</select></label><label><span>Módulo</span><select data-practica="modulo_id">${opcionesModulos(d.ciclo_id, d.modulo_id)}</select></label><label><span>Grupo</span><input class="campo" data-practica="grupo" value="${h(d.grupo)}"></label><label><span>Fecha</span><input class="campo" type="date" data-practica="fecha" value="${h(d.fecha || hoy())}"></label><label><span>Docente</span><input class="campo" data-practica="docente" value="${h(d.docente)}"></label><label><span>Nº alumnos</span><input class="campo" type="number" data-practica="numero_alumnos" value="${h(d.numero_alumnos)}"></label><label><span>Obrador</span><input class="campo" data-practica="obrador" value="${h(d.obrador)}"></label><label style="grid-column:1/-1"><span>Observaciones</span><textarea data-practica="observaciones">${h(d.observaciones)}</textarea></label></div>` : ''}
    <p class="aviso">Seleccionadas: <strong>${estado.seleccionRapida.size}</strong>. El pedido se recalcula dinámicamente y se agrupa por familias de ingrediente.</p></div>`;
}

/** Vista previa documento de selección con escalado real. */
function htmlVistaPreviaSeleccion() {
  const pedido = calcularPedidoConsolidadoSeleccion();
  if (!pedido.fichas.length) return '<p class="vacio">Selecciona una o varias fichas.</p>';
  return `<article><h3>${estado.opcionesDocumento.tipo === 'pedido' ? 'Pedido de producción' : 'Dossier de producción'}</h3>${bloquePracticaImpresion()}<h4>Elaboraciones</h4><ol>${pedido.fichas.sort((a,b)=>(a.seleccion.orden||0)-(b.seleccion.orden||0)).map(f => `<li><strong>${h(f.elaboracion.nombre)}</strong> · ${h(etiquetaEscalado(f.elaboracion, f.seleccion, f.escala))} · factor ${n(f.escala.factor,3)}</li>`).join('')}</ol>${estado.opcionesDocumento.costes ? `<p><strong>Coste escalado estimado:</strong> ${n(pedido.costeTotal)} €</p>` : ''}${estado.opcionesDocumento.pedido ? tablaPedidoConsolidado(pedido.lineas, true) : ''}</article>`;
}

/** Etiqueta humana de escalado. */
function etiquetaEscalado(e, s, escala) {
  if (escala.modo === 'raciones') return `${n(s.raciones,0)} raciones`;
  if (escala.modo === 'rendimiento') return `${n(s.cantidad)} ${h(s.unidad || e.unidad_base)}`;
  if (escala.modo === 'harina_total') return `${n(s.harina,0)} g harina`;
  if (escala.modo === 'masa_total') return `${n(s.masa,0)} g masa cruda`;
  if (escala.modo === 'piezas_peso') return `${n(s.piezas,0)} piezas × ${n(s.pesoPieza,0)} g`;
  return 'escala base';
}

/** Bloque datos práctica para impresión. */
function bloquePracticaImpresion() {
  const d = estado.datosPractica;
  if (!d.incluir) return '';
  const ciclo = nombreCiclo(d.ciclo_id);
  const modulo = nombreModulo(d.modulo_id) || d.modulo;
  return `<section class="bloque-practica"><p><strong>${h(d.nombre || 'Práctica')}</strong><br>${ciclo ? `${h(ciclo)}<br>` : ''}${h(modulo)} · ${h(d.grupo)} · ${h(d.fecha || hoy())}<br>Docente: ${h(d.docente)} · Obrador: ${h(d.obrador)} · Alumnado: ${h(d.numero_alumnos)}</p>${d.observaciones ? `<p>${h(d.observaciones)}</p>` : ''}</section>`;
}

/** Tabla de pedido consolidado agrupado por familias técnicas de ingrediente. */
function tablaPedidoConsolidado(lineas, compacto = false) {
  if (!lineas.length) return '<p class="vacio">Sin ingredientes consolidados.</p>';
  const grupos = new Map();
  for (const l of lineas) {
    const familia = l.familia || 'Sin familia';
    if (!grupos.has(familia)) grupos.set(familia, []);
    grupos.get(familia).push(l);
  }
  return `<div class="pedido-familias ${compacto ? 'compacto' : ''}">${[...grupos.entries()].map(([familia, items]) => `<section class="bloque-familia"><h4>${h(familia)}</h4><table class="tabla ${compacto ? 'compacta' : ''}"><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Unidad</th><th>Coste</th><th>Origen</th></tr></thead><tbody>${items.map(l => `<tr><td>${h(l.ingrediente)}</td><td>${n(l.cantidad,3)}</td><td>${h(l.unidad)}</td><td>${n(l.coste)} €</td><td>${h(l.origenesTexto || l.origen || l.origenes || '')}</td></tr>`).join('')}</tbody></table></section>`).join('')}</div>`;
}

/** Tarjeta sesión reciente. */
function tarjetaSesion(s) {
  return `<article class="item" role="button" tabindex="0" data-accion="abrir-sesion" data-id="${s.id}"><div><p class="item__titulo">${h(s.nombre)}</p><div class="item__meta">${h(s.modulo)} · ${h(s.grupo)} · ${h(s.fecha_prevista)} · ${n(s.numero_elaboraciones,0)} fichas</div></div><div class="item__acciones"><button class="boton pequeno" data-accion="abrir-sesion" data-id="${s.id}">Abrir</button></div></article>`;
}

/** Vista Base de datos. */
function vistaBaseDatos() {
  const contenido = estado.baseTipo === 'ingredientes' ? vistaCatalogoIngredientes() : estado.baseTipo === 'ciclos' ? vistaCatalogoCiclos() : estado.baseTipo === 'modulos' ? vistaCatalogoModulos() : vistaCatalogoElaboraciones();
  return `<section class="portada"><div class="hero"><h2>Base de datos</h2><p>Catálogos canónicos: elaboraciones, ingredientes, ciclos y módulos profesionales.</p></div><div class="pestanas"><button data-accion="base-tipo" data-tipo="elaboraciones" class="${estado.baseTipo==='elaboraciones'?'activo':''}">Elaboraciones</button><button data-accion="base-tipo" data-tipo="ingredientes" class="${estado.baseTipo==='ingredientes'?'activo':''}">Ingredientes</button><button data-accion="base-tipo" data-tipo="ciclos" class="${estado.baseTipo==='ciclos'?'activo':''}">Ciclos</button><button data-accion="base-tipo" data-tipo="modulos" class="${estado.baseTipo==='modulos'?'activo':''}">Módulos</button></div>${contenido}</section>${estado.ventana ? renderVentana() : ''}`;
}

/** Catálogo elaboraciones. */
function vistaCatalogoElaboraciones() {
  const elementos = listarElaboraciones(estado.busquedaElaboraciones);
  return `<section class="tarjeta"><div class="barra"><input class="campo-busqueda" data-control="buscar-elaboraciones" type="search" placeholder="Buscar elaboración…" value="${h(estado.busquedaElaboraciones)}"><div class="barra__grupo"><span>${elementos.length} resultados</span><button class="boton primario" data-accion="nueva-elaboracion">Nueva elaboración</button></div></div><div class="catalogo">${elementos.map(tarjetaElaboracion).join('')}</div></section>`;
}

/** Catálogo ingredientes. */
function vistaCatalogoIngredientes() {
  const elementos = listarIngredientes(estado.busquedaIngredientes);
  return `<section class="tarjeta"><div class="barra"><input class="campo-busqueda" data-control="buscar-ingredientes" type="search" placeholder="Buscar ingrediente…" value="${h(estado.busquedaIngredientes)}"><div class="barra__grupo"><span>${elementos.length} resultados</span><button class="boton primario" data-accion="nuevo-ingrediente">Nuevo ingrediente</button></div></div><div class="catalogo">${elementos.map(tarjetaIngrediente).join('')}</div></section>`;
}

/** Catálogo de ciclos FP. */
function vistaCatalogoCiclos() {
  const ciclos = listarCiclos();
  return `<section class="tarjeta"><h3>Ciclos formativos</h3><p class="aviso">Se usan para contextualizar sesiones, prácticas e impresión. No son obligatorios en selección rápida.</p><div class="catalogo">${ciclos.map(c => `<article class="item"><div><p class="item__titulo">${h(c.codigo)} · ${h(c.nombre)}</p><div class="item__meta">${h(c.grado)} · ${h(c.familia_profesional)} · ${h(c.normativa_referencia || '')}</div></div></article>`).join('') || '<p class="vacio">Sin ciclos registrados.</p>'}</div></section>`;
}

/** Catálogo de módulos profesionales. */
function vistaCatalogoModulos() {
  const modulos = listarModulos('');
  return `<section class="tarjeta"><h3>Módulos profesionales</h3><p class="aviso">Catálogo docente para vincular sesiones y documentos de práctica.</p><div class="catalogo">${modulos.map(m => `<article class="item"><div><p class="item__titulo">${h(m.codigo)} · ${h(m.nombre)}</p><div class="item__meta">Ciclo ID ${h(m.ciclo_id)} · Curso ${h(m.curso)} · ${n(m.horas,0)} h</div></div></article>`).join('') || '<p class="vacio">Sin módulos registrados.</p>'}</div></section>`;
}

/** Tarjeta elaboración. */
function tarjetaElaboracion(e) {
  return `<article class="item" role="button" tabindex="0" data-accion="abrir-elaboracion" data-id="${e.id}" data-modo="vista"><div><p class="item__titulo">${h(e.nombre)}</p><div class="item__meta">${h(e.familia_elaboracion || e.tipo_obrador)} · ${h(e.modelo_calculo)} · ${n(e.numero_lineas,0)} líneas · ${n(e.numero_pasos,0)} pasos</div><div class="etiquetas"><span class="etiqueta">${h(e.estado_documental)}</span><span class="etiqueta ${e.activo?'ok':'aviso'}">${e.activo?'activa':'archivada'}</span></div></div><div class="item__acciones"><button class="boton pequeno" data-accion="abrir-elaboracion" data-id="${e.id}" data-modo="vista">Vista</button><button class="boton pequeno secundario" data-accion="abrir-elaboracion" data-id="${e.id}" data-modo="editar">Editar</button><button class="boton pequeno" data-accion="abrir-elaboracion" data-id="${e.id}" data-modo="imprimir">Impresión</button></div></article>`;
}

/** Tarjeta ingrediente. */
function tarjetaIngrediente(i) {
  return `<article class="item" role="button" tabindex="0" data-accion="abrir-ingrediente" data-id="${i.id}" data-modo="vista"><div><p class="item__titulo">${h(i.nombre)}</p><div class="item__meta">${h(i.familia || 'Sin familia')} · ${h(i.unidad_compra)} → ${h(i.unidad_trabajo)} · ${n(i.usos,0)} usos</div><div class="etiquetas"><span class="etiqueta">${n(i.precio_unidad_compra)} €/${h(i.unidad_compra)}</span><span class="etiqueta ${i.activo?'ok':'aviso'}">${i.activo?'activo':'archivado'}</span></div></div><div class="item__acciones"><button class="boton pequeno" data-accion="abrir-ingrediente" data-id="${i.id}" data-modo="vista">Vista</button><button class="boton pequeno secundario" data-accion="abrir-ingrediente" data-id="${i.id}" data-modo="editar">Editar</button><button class="boton pequeno" data-accion="abrir-ingrediente" data-id="${i.id}" data-modo="uso">Uso</button></div></article>`;
}

/** Renderiza ventana interna. */
function renderVentana() {
  const v = estado.ventana;
  if (v.tipo === 'elaboracion') return ventanaElaboracion(v.id, v.modo);
  if (v.tipo === 'nueva-elaboracion') return ventanaNuevaElaboracion();
  if (v.tipo === 'ingrediente') return ventanaIngrediente(v.id, v.modo);
  if (v.tipo === 'nuevo-ingrediente') return ventanaNuevoIngrediente();
  if (v.tipo === 'sesion') return ventanaSesion(v.id, v.modo);
  return '';
}

/** Estructura común de ventana. */
function ventanaBase(titulo, subtitulo, acciones, contenido) {
  return `<div class="velo" data-accion="cerrar-ventana"></div><section class="ventana" role="dialog" aria-modal="true" aria-label="${h(titulo)}"><header class="ventana__cabecera"><div class="ventana__titulo"><button class="boton pequeno plano" data-accion="cerrar-ventana">← Catálogo</button><h2>${h(titulo)}</h2><p>${h(subtitulo)}</p></div><div class="ventana__acciones">${acciones}</div></header><div class="ventana__cuerpo">${contenido}</div></section>`;
}

/** Ventana elaboración. */
function ventanaElaboracion(id, modo) {
  const e = obtenerElaboracion(id);
  if (!e) return '';
  return ventanaBase(e.nombre, `${e.familia_elaboracion || e.tipo_obrador} · ${e.modelo_calculo}`, `<button class="boton pequeno ${modo==='vista'?'primario':''}" data-accion="cambiar-modo" data-tipo="elaboracion" data-id="${id}" data-modo="vista">Vista</button><button class="boton pequeno ${modo==='editar'?'primario':''}" data-accion="cambiar-modo" data-tipo="elaboracion" data-id="${id}" data-modo="editar">Editar</button><button class="boton pequeno ${modo==='imprimir'?'primario':''}" data-accion="cambiar-modo" data-tipo="elaboracion" data-id="${id}" data-modo="imprimir">Impresión</button><button class="boton pequeno secundario" data-accion="duplicar-elaboracion" data-id="${id}">Duplicar</button>`, contenidoElaboracion(e, modo));
}

/** Contenido de elaboración. */
function contenidoElaboracion(e, modo) {
  if (modo === 'editar') return editorElaboracion(e);
  if (modo === 'imprimir') return impresionElaboracion(e);
  return vistaPreviaElaboracion(e);
}

/** Muestra la foto principal de una elaboración si existe. */
function bloqueFotoPrincipal(elaboracionId) {
  const foto = fotoPrincipalElaboracion(elaboracionId);
  if (!foto?.contenido_base64) return '';
  return `<figure class="foto-principal"><img src="${h(foto.contenido_base64)}" alt="${h(foto.titulo || 'Foto principal de elaboración')}"><figcaption>${h(foto.titulo || 'Foto principal')}</figcaption></figure>`;
}

/** Gestor compacto de fotos de elaboración. */
function gestorFotos(e) {
  const fotos = fotosElaboracion(e.id);
  return `<div class="gestor-fotos"><label><span>Añadir foto</span><input class="campo" type="file" accept="image/*" data-control="foto-elaboracion" data-id="${e.id}"></label>${fotos.length ? `<div class="galeria-fotos">${fotos.map(f => `<figure class="foto-mini ${f.es_principal ? 'principal' : ''}"><img src="${h(f.contenido_base64)}" alt="${h(f.titulo || 'Foto')}"><figcaption>${h(f.titulo || 'Foto')} ${f.es_principal ? '· principal' : ''}</figcaption><div class="barra__grupo"><button class="boton pequeno" data-accion="foto-principal" data-id="${f.id}" data-elaboracion-id="${e.id}">Principal</button><button class="boton pequeno peligro" data-accion="foto-eliminar" data-id="${f.id}" data-elaboracion-id="${e.id}">Eliminar</button></div></figure>`).join('')}</div>` : '<p class="vacio">Sin fotos registradas.</p>'}<p class="aviso">Las fotos se guardan en SQLite como base64 para mantener el ZIP autocontenido.</p></div>`;
}

/** Vista previa elaboración con costes, panadería, proceso y APPCC. */
function vistaPreviaElaboracion(e) {
  const lineas = lineasElaboracion(e.id).filter(l=>l.activo);
  const pasos = pasosElaboracion(e.id).filter(p=>p.activo);
  const alergenos = alergenosElaboracion(e.id);
  const pan = resumenPanadero(e.id);
  return `<section class="panel">${bloqueFotoPrincipal(e.id)}<div class="resumen-grid"><div class="dato"><small>Raciones base</small><strong>${n(e.raciones_base,0)}</strong></div><div class="dato"><small>Coste total</small><strong>${n(e.coste_total)} €</strong></div><div class="dato"><small>Coste/ración</small><strong>${n(e.coste_por_racion)} €</strong></div><div class="dato"><small>APPCC</small><strong>${n(e.numero_peligros||0,0)} peligros</strong></div></div><div class="tarjeta"><h3>Descripción</h3><p>${h(e.descripcion || 'Sin descripción.')}</p></div><div class="tarjeta"><h3>Ingredientes</h3>${tablaLineas(lineas)}</div>${pan ? `<div class="tarjeta"><h3>Panadería</h3>${bloquesPanaderia(e, 1)}</div>` : ''}<div class="tarjeta"><h3>Proceso</h3>${listaPasos(pasos)}</div><div class="tarjeta"><h3>APPCC</h3>${listaAppcc(appccElaboracion(e.id))}</div><div class="tarjeta"><h3>Alérgenos</h3>${alergenos.length ? `<p>${alergenos.map(a=>h(a.alergeno)).join(', ')}</p>` : '<p class="vacio">Sin alérgenos declarados por las líneas.</p>'}</div></section>`;
}

/** Ventana de alta de elaboración: crea una ficha real, no una maqueta. */
function ventanaNuevaElaboracion() {
  return ventanaBase('Nueva elaboración', 'Alta mínima para crear una ficha viva del catálogo', '', `<section class="panel"><div class="tarjeta"><h3>Datos iniciales</h3>${formularioElaboracion({}, false)}<p class="aviso">Después de crearla podrás añadir líneas, proceso, APPCC, fotos y validación.</p></div></section>`);
}

/** Formulario común de elaboración para alta y edición con valores válidos del esquema. */
function formularioElaboracion(e = {}, existe = true) {
  const tipoObrador = e.tipo_obrador || 'cocina';
  const tipoElaboracion = e.tipo_elaboracion || 'elaboracion_final';
  const modelo = e.modelo_calculo || (tipoObrador === 'panaderia' ? 'porcentaje_panadero' : 'raciones');
  const estadoDoc = e.estado_documental || 'pendiente_revision';
  const estadoObrador = e.estado_validacion_obrador || 'pendiente';
  const opcion = (valor, texto, actual) => `<option value="${valor}" ${actual === valor ? 'selected' : ''}>${texto}</option>`;
  return `<form class="formulario doble" data-formulario="elaboracion" data-id="${e.id || ''}">
    <label><span>Nombre</span><input class="campo" name="nombre" required value="${h(e.nombre || '')}" placeholder="Ej. Crema pastelera base"></label>
    <label><span>Tipo de obrador</span><select name="tipo_obrador">${['cocina','pasteleria','panaderia','mixto'].map(v => opcion(v, v, tipoObrador)).join('')}</select></label>
    <label><span>Tipo de elaboración</span><select name="tipo_elaboracion">${['elaboracion_final','subelaboracion','base_culinaria','fondo','salsa','masa','crema','relleno','guarnicion','componente'].map(v => opcion(v, v, tipoElaboracion)).join('')}</select></label>
    <label><span>Familia</span><select name="familia_elaboracion_id">${opcionesFamiliasElaboracion(e.familia_elaboracion_id || '')}</select></label>
    <label><span>Modelo cálculo</span><select name="modelo_calculo">${['raciones','rendimiento','piezas','porcentaje_panadero','mixto'].map(v => opcion(v, v, modelo)).join('')}</select></label>
    <label><span>Estado documental</span><select name="estado_documental">${[['pendiente_revision','pendiente de revisión'],['propuesta_documental','propuesta documental'],['contrastada_fuente','contrastada con fuente'],['probada_obrador','probada en obrador'],['no_apta','no apta']].map(([v,t]) => opcion(v,t,estadoDoc)).join('')}</select></label>
    <label><span>Validación obrador</span><select name="estado_validacion_obrador">${[['pendiente','pendiente'],['requiere_revision','requiere revisión'],['probada_con_ajustes','probada con ajustes'],['validada_por_docente','validada por docente'],['no_apta','no apta']].map(([v,t]) => opcion(v,t,estadoObrador)).join('')}</select></label>
    <label><span>Raciones base</span><input class="campo" type="number" name="raciones_base" min="0" step="1" value="${h(e.raciones_base ?? 1)}"></label>
    <label><span>Piezas base</span><input class="campo" type="number" name="piezas_base" min="0" step="1" value="${h(e.piezas_base ?? 1)}"></label>
    <label><span>Cantidad base</span><input class="campo" type="number" name="cantidad_base" min="0" step="0.001" value="${h(e.cantidad_base ?? 1)}"></label>
    <label><span>Unidad base</span><select name="unidad_base">${opcionesUnidades(e.unidad_base || 'racion', 'racion')}</select></label>
    <label><span>Peso ración g</span><input class="campo" type="number" min="0" step="0.1" name="peso_racion_g" value="${h(e.peso_racion_g ?? '')}"></label>
    <label><span>Peso pieza g</span><input class="campo" type="number" min="0" step="0.1" name="peso_pieza_g" value="${h(e.peso_pieza_g ?? '')}"></label>
    <label><span>Rendimiento teórico</span><input class="campo" type="number" min="0" step="0.001" name="rendimiento_teorico" value="${h(e.rendimiento_teorico ?? '')}"></label>
    <label><span>Unidad rendimiento</span><select name="unidad_rendimiento"><option value="">—</option>${opcionesUnidades(e.unidad_rendimiento || '', 'g')}</select></label>
    <label class="check"><input type="checkbox" name="es_elaborado_reutilizable" ${e.es_elaborado_reutilizable ? 'checked' : ''}> Puede usarse como subelaboración</label>
    <label style="grid-column:1/-1"><span>Descripción</span><textarea name="descripcion">${h(e.descripcion || '')}</textarea></label>
    <label style="grid-column:1/-1"><span>Notas docentes</span><textarea name="notas_docente">${h(e.notas_docente || '')}</textarea></label>
    <div class="barra__grupo"><button class="boton primario" type="submit">${existe ? 'Guardar datos' : 'Crear elaboración'}</button>${existe ? `<button class="boton ${e.activo?'peligro':'secundario'}" type="button" data-accion="alternar-activo-elaboracion" data-id="${e.id}">${e.activo?'Archivar':'Reactivar'}</button>` : ''}</div>
  </form>`;
}

/** Editor completo de elaboración: datos, líneas, pasos, APPCC y validación. */
function editorElaboracion(e) {
  return `<section class="panel"><div class="tarjeta"><h3>Datos generales y estado</h3>${formularioElaboracion(e, true)}</div><div class="tarjeta"><h3>Líneas / ingredientes / elaborados</h3>${editorLineas(e)}</div><div class="tarjeta"><h3>Proceso</h3>${editorPasos(e)}</div><div class="tarjeta"><h3>APPCC</h3>${editorAppcc(e)}</div><div class="tarjeta"><h3>Fotos</h3>${gestorFotos(e)}</div><div class="tarjeta"><h3>Validación documental</h3>${validacionElaboracion(e)}</div></section>`;
}


/** Editor de líneas con alta/edición/archivado y coeficientes panaderos/hídricos. */
function editorLineas(e) {
  const editando = estado.editor?.tipo === 'linea' ? lineasElaboracion(e.id).find(l=>l.id === estado.editor.id) : null;
  const lineas = lineasElaboracion(e.id);
  return `${tablaLineas(lineas, true)}<details open><summary>${editando ? 'Editar línea' : 'Añadir línea'}</summary><form class="formulario doble" data-formulario="linea" data-elaboracion-id="${e.id}" data-id="${editando?.id || ''}"><label><span>Tipo</span><select name="tipo_linea"><option value="ingrediente" ${editando?.tipo_linea!=='elaborado'?'selected':''}>Ingrediente</option><option value="elaborado" ${editando?.tipo_linea==='elaborado'?'selected':''}>Elaborado/subreceta</option></select></label><label><span>Ingrediente</span><select name="ingrediente_id"><option value="">—</option>${opcionesIngredientes(editando?.ingrediente_id || '')}</select></label><label><span>Elaborado</span><select name="elaborado_id"><option value="">—</option>${opcionesElaborados(editando?.elaborado_id || '', e.id)}</select></label><label><span>Cantidad neta</span><input class="campo" type="number" step="0.001" name="cantidad_neta" value="${h(editando?.cantidad_neta ?? 0)}"></label><label><span>Unidad</span><input class="campo" name="unidad" value="${h(editando?.unidad || 'g')}"></label><label><span>Merma %</span><input class="campo" type="number" step="0.01" name="merma_aplicada_pct" value="${h(editando?.merma_aplicada_pct || 0)}"></label><label><span>% panadero</span><input class="campo" type="number" step="0.001" name="porcentaje_panadero" value="${h(editando?.porcentaje_panadero ?? '')}"></label><label><span>Rol fórmula</span><input class="campo" name="rol_formula" value="${h(editando?.rol_formula || '')}" placeholder="harina, agua, sal…"></label><label><span>Grupo fórmula</span><select name="grupo_formula">${opcionesGrupoFormula(editando?.grupo_formula || inferirGrupoFormula(editando))}</select></label><label><span>Factor hídrico</span><input class="campo" type="number" min="0" step="0.001" name="factor_hidrico" value="${h(editando?.factor_hidrico ?? '')}" placeholder="agua 1, leche 0.87…"></label><label class="check"><input type="checkbox" name="es_harina_base" ${editando?.es_harina_base ? 'checked' : ''}> Harina base</label><label class="check"><input type="checkbox" name="aporta_hidratacion" ${editando?.aporta_hidratacion ? 'checked' : ''}> Aporta hidratación</label><label><span>Orden</span><input class="campo" type="number" step="1" name="orden" value="${h(editando?.orden || lineas.length + 1)}"></label><label style="grid-column:1/-1"><span>Observaciones</span><textarea name="observaciones">${h(editando?.observaciones || '')}</textarea></label><div class="barra__grupo"><button class="boton primario" type="submit">Guardar línea</button>${editando ? '<button class="boton plano" type="button" data-accion="cancelar-editor">Cancelar</button>' : ''}</div></form></details>`;
}

/** Editor de pasos. */
function editorPasos(e) {
  const editando = estado.editor?.tipo === 'paso' ? pasosElaboracion(e.id).find(p=>p.id === estado.editor.id) : null;
  const pasos = pasosElaboracion(e.id);
  return `${listaPasos(pasos, true)}<details open><summary>${editando ? 'Editar paso' : 'Añadir paso'}</summary><form class="formulario doble" data-formulario="paso" data-elaboracion-id="${e.id}" data-id="${editando?.id || ''}"><label><span>Nº paso</span><input class="campo" type="number" step="1" name="numero_paso" value="${h(editando?.numero_paso || pasos.length + 1)}"></label><label><span>Título</span><input class="campo" name="titulo_paso" required value="${h(editando?.titulo_paso || '')}"></label><label><span>Técnica</span><input class="campo" name="tecnica" value="${h(editando?.tecnica || '')}"></label><label><span>Tipo</span><input class="campo" name="tipo_paso" value="${h(editando?.tipo_paso || 'general')}"></label><label><span>Temperatura ºC</span><input class="campo" type="number" step="0.1" name="temperatura_c" value="${h(editando?.temperatura_c ?? '')}"></label><label><span>Tiempo min</span><input class="campo" type="number" step="1" name="tiempo_min" value="${h(editando?.tiempo_min ?? '')}"></label><label style="grid-column:1/-1"><span>Descripción</span><textarea name="descripcion">${h(editando?.descripcion || '')}</textarea></label><label style="grid-column:1/-1"><span>Observaciones</span><textarea name="observaciones">${h(editando?.observaciones || '')}</textarea></label><div class="barra__grupo"><button class="boton primario" type="submit">Guardar paso</button>${editando ? '<button class="boton plano" type="button" data-accion="cancelar-editor">Cancelar</button>' : ''}</div></form></details>`;
}

/** Editor APPCC. */
function editorAppcc(e) {
  const editando = estado.editor?.tipo === 'appcc' ? appccElaboracion(e.id).find(a=>a.id === estado.editor.id) : null;
  const items = appccElaboracion(e.id);
  const pasos = pasosElaboracion(e.id);
  return `${listaAppcc(items, true)}<details open><summary>${editando ? 'Editar control APPCC' : 'Añadir control APPCC'}</summary><form class="formulario doble" data-formulario="appcc" data-elaboracion-id="${e.id}" data-id="${editando?.id || ''}"><label><span>Paso asociado</span><select name="paso_id"><option value="">Sin paso concreto</option>${pasos.map(p=>`<option value="${p.id}" ${String(editando?.paso_id)===String(p.id)?'selected':''}>${n(p.numero_paso,0)} · ${h(p.titulo_paso)}</option>`).join('')}</select></label><label><span>Tipo peligro</span><select name="tipo_peligro">${['biologico','quimico','fisico','alergeno','temperatura','contaminacion_cruzada'].map(t=>`<option ${editando?.tipo_peligro===t?'selected':''}>${t}</option>`).join('')}</select></label><label><span>¿PCC?</span><select name="es_pcc"><option value="0" ${!editando?.es_pcc?'selected':''}>No</option><option value="1" ${editando?.es_pcc?'selected':''}>Sí</option></select></label><label><span>Orden</span><input class="campo" type="number" name="orden" value="${h(editando?.orden || items.length + 1)}"></label><label style="grid-column:1/-1"><span>Peligro</span><textarea name="descripcion_peligro" required>${h(editando?.descripcion_peligro || '')}</textarea></label><label style="grid-column:1/-1"><span>Medida preventiva</span><textarea name="medida_preventiva" required>${h(editando?.medida_preventiva || '')}</textarea></label><label><span>Límite crítico</span><input class="campo" name="limite_critico" value="${h(editando?.limite_critico || '')}"></label><label><span>Medida correctora</span><input class="campo" name="medida_correctora" value="${h(editando?.medida_correctora || '')}"></label><label><span>Responsable</span><input class="campo" name="responsable" value="${h(editando?.responsable || '')}"></label><label><span>Verificación</span><input class="campo" name="verificacion" value="${h(editando?.verificacion || '')}"></label><div class="barra__grupo"><button class="boton primario" type="submit">Guardar APPCC</button>${editando ? '<button class="boton plano" type="button" data-accion="cancelar-editor">Cancelar</button>' : ''}</div></form></details>`;
}


/** Etiqueta humana para grupos de fórmula panadera. */
function etiquetaGrupoFormula(grupo) {
  return ({ prefermento: 'Prefermento', masa_final: 'Masa final', acabado: 'Acabado', inclusion: 'Inclusión', decoracion: 'Decoración', otro: 'Otro' })[grupo || 'masa_final'] || 'Masa final';
}

/** Opciones cerradas para agrupar líneas panaderas en impresión profesional. */
function opcionesGrupoFormula(valor = 'masa_final') {
  const opciones = [
    ['prefermento', 'Prefermento'],
    ['masa_final', 'Masa final'],
    ['acabado', 'Acabado / baño'],
    ['inclusion', 'Inclusión / relleno'],
    ['decoracion', 'Decoración'],
    ['otro', 'Otro']
  ];
  return opciones.map(([v,t]) => `<option value="${v}" ${valor === v ? 'selected' : ''}>${t}</option>`).join('');
}

/** Deduce grupo de fórmula si la línea procede de una base antigua sin campo canónico. */
function inferirGrupoFormula(linea) {
  const texto = `${linea?.grupo_formula || ''} ${linea?.grupo_visual || ''} ${linea?.rol_formula || ''}`.toLowerCase();
  if (texto.includes('prefer') || texto.includes('poolish') || texto.includes('biga') || texto.includes('masa madre') || texto.includes('levain')) return 'prefermento';
  if (texto.includes('acab') || texto.includes('decor') || texto.includes('cobertura') || texto.includes('glase')) return 'acabado';
  if (texto.includes('inclu') || texto.includes('relleno') || texto.includes('semilla') || texto.includes('fruta')) return 'inclusion';
  return 'masa_final';
}

/** Tabla de líneas. */
function tablaLineas(lineas, conAcciones = false) {
  if (!lineas.length) return '<p class="vacio">Sin ingredientes/líneas.</p>';
  return `<table class="tabla"><thead><tr><th>Elemento</th><th>Cantidad</th><th>Unidad</th><th>% panadero</th><th>Grupo</th><th>Hidratación</th><th>Estado</th>${conAcciones?'<th>Acciones</th>':''}</tr></thead><tbody>${lineas.map(l=>`<tr><td>${h(l.nombre_linea)}</td><td>${n(l.cantidad_neta,3)}</td><td>${h(l.unidad)}</td><td>${l.porcentaje_panadero == null ? '—' : n(l.porcentaje_panadero,3)}</td><td>${h(etiquetaGrupoFormula(inferirGrupoFormula(l)))}</td><td>${l.es_harina_base ? 'harina base' : l.aporta_hidratacion ? `factor ${n(l.factor_hidrico ?? 1,3)}` : '—'}</td><td>${l.activo?'activa':'archivada'}</td>${conAcciones?`<td><button class="boton pequeno" data-accion="editar-linea" data-id="${l.id}">Editar</button><button class="boton pequeno ${l.activo?'peligro':'secundario'}" data-accion="alternar-linea" data-id="${l.id}">${l.activo?'Archivar':'Reactivar'}</button></td>`:''}</tr>`).join('')}</tbody></table>`;
}

/** Lista de pasos. */
function listaPasos(pasos, conAcciones = false) {
  if (!pasos.length) return '<p class="vacio">Sin proceso registrado.</p>';
  return `<ol class="lista">${pasos.map(p=>`<li><strong>${n(p.numero_paso,0)}. ${h(p.titulo_paso)}</strong><br>${h(p.descripcion || '')}${p.temperatura_c ? `<br>Temperatura: ${n(p.temperatura_c)} ºC` : ''}${p.tiempo_min ? ` · Tiempo: ${n(p.tiempo_min,0)} min` : ''}${conAcciones?`<div class="barra__grupo"><button class="boton pequeno" data-accion="editar-paso" data-id="${p.id}">Editar</button><button class="boton pequeno ${p.activo?'peligro':'secundario'}" data-accion="alternar-paso" data-id="${p.id}">${p.activo?'Archivar':'Reactivar'}</button></div>`:''}</li>`).join('')}</ol>`;
}

/** Lista de APPCC. */
function listaAppcc(items, conAcciones = false) {
  if (!items.length) return '<p class="vacio">Sin APPCC asociado.</p>';
  return `<ul class="lista">${items.map(a=>`<li><strong>${h(a.tipo_peligro)}${a.es_pcc?' · PCC':''}</strong>${a.numero_paso?` · paso ${n(a.numero_paso,0)}`:''}<br>${h(a.descripcion_peligro)}<br><em>${h(a.medida_preventiva)}</em>${conAcciones?`<div class="barra__grupo"><button class="boton pequeno" data-accion="editar-appcc" data-id="${a.id}">Editar</button><button class="boton pequeno peligro" data-accion="eliminar-appcc" data-id="${a.id}">Eliminar</button></div>`:''}</li>`).join('')}</ul>`;
}

/** Obtiene parámetros panaderos directos de la elaboración. */
function parametrosPanaderia(id) {
  return datos.uno('SELECT * FROM parametros_panaderia WHERE elaboracion_id=?', [id]) || {};
}

/** Devuelve líneas panaderas activas escaladas y agrupables por contrato documental. */
function lineasFormulaPanaderaEscalada(id, factor = 1) {
  return lineasElaboracion(id).filter(l => l.activo && (l.porcentaje_panadero != null || l.es_harina_base || l.rol_formula)).map(l => ({
    ...l,
    grupo_formula: inferirGrupoFormula(l),
    cantidad_escalada: Number(l.cantidad_neta || 0) * factor,
    hidratacion_efectiva_g: l.aporta_hidratacion ? Number(l.cantidad_neta || 0) * factor * Number(l.factor_hidrico || 1) : 0
  }));
}

/** Resume parámetros panaderos para imprimir o revisar. */
function resumenParametrosPanaderos(e, factor = 1) {
  const pan = resumenPanadero(e.id) || {};
  const params = parametrosPanaderia(e.id);
  const harinaBase = Number(pan.harina_total_g || pan.harina_base_g || params.harina_base_g || 0) * factor;
  const masaCruda = Number(pan.peso_masa_cruda_g || 0) * factor;
  const aguaEfectiva = Number(pan.agua_efectiva_g || 0) * factor;
  const hidratacion = harinaBase ? (aguaEfectiva / harinaBase) * 100 : Number(pan.hidratacion_total_pct || 0);
  const perdida = Number(params.perdida_coccion_pct ?? pan.perdida_coccion_pct ?? 0);
  const cocido = masaCruda ? masaCruda * (1 - perdida / 100) : Number(pan.peso_cocido_estimado_g || 0) * factor;
  const piezas = Number(pan.piezas_estimadas || e.piezas_base || 0) * (factor || 1);
  return { pan, params, harinaBase, masaCruda, aguaEfectiva, hidratacion, perdida, cocido, piezas };
}

/** Tabla estable de parámetros panaderos. */
function tablaParametrosPanaderos(e, factor = 1) {
  const r = resumenParametrosPanaderos(e, factor);
  return `<table class="tabla"><tbody>
    <tr><th>Harina total</th><td>${n(r.harinaBase,1)} g</td><th>Hidratación total</th><td>${n(r.hidratacion,2)} %</td></tr>
    <tr><th>Masa cruda estimada</th><td>${n(r.masaCruda,1)} g</td><th>Peso cocido estimado</th><td>${n(r.cocido,1)} g</td></tr>
    <tr><th>Piezas estimadas</th><td>${n(r.piezas,0)}</td><th>Peso pieza cruda</th><td>${n(r.params.peso_pieza_cruda_g || e.peso_pieza_g,1)} g</td></tr>
    <tr><th>Pérdida cocción</th><td>${n(r.perdida,2)} %</td><th>TFM objetivo</th><td>${r.params.tfm_objetivo_c == null ? '—' : `${n(r.params.tfm_objetivo_c,1)} ºC`}</td></tr>
    <tr><th>Fermentación bloque</th><td>${r.params.tiempo_bulk_min ? `${n(r.params.tiempo_bulk_min,0)} min · ${n(r.params.temperatura_bulk_c,1)} ºC` : '—'}</td><th>Apresto</th><td>${r.params.tiempo_apresto_min ? `${n(r.params.tiempo_apresto_min,0)} min · ${n(r.params.temperatura_apresto_c,1)} ºC` : '—'}</td></tr>
    <tr><th>Cocción</th><td>${r.params.tiempo_coccion_min ? `${n(r.params.tiempo_coccion_min,0)} min · ${n(r.params.temperatura_coccion_c,1)} ºC` : '—'}</td><th>Vapor inicial</th><td>${r.params.vapor_inicial ? 'sí' : 'no'}</td></tr>
  </tbody></table>`;
}

/** Tabla fórmula panadera total escalada con hidratación y grupo semántico. */
function tablaFormulaPanadera(id, factor = 1) {
  const f = lineasFormulaPanaderaEscalada(id, factor);
  if (!f.length) return '<p class="vacio">No hay fórmula panadera.</p>';
  return `<table class="tabla"><thead><tr><th>Ingrediente</th><th>Grupo</th><th>Rol</th><th>% panadero</th><th>Cantidad</th><th>Hidratación</th></tr></thead><tbody>${f.map(l=>`<tr><td>${h(l.nombre_linea)}</td><td>${h(etiquetaGrupoFormula(l.grupo_formula))}</td><td>${h(l.rol_formula || '')}</td><td>${l.porcentaje_panadero == null ? '—' : n(l.porcentaje_panadero,3)}</td><td>${n(l.cantidad_escalada,1)} ${h(l.unidad)}</td><td>${l.es_harina_base ? 'harina base' : l.aporta_hidratacion ? `factor ${n(l.factor_hidrico || 1,3)}` : '—'}</td></tr>`).join('')}</tbody></table>`;
}

/** Bloque de fórmula panadera por grupo: prefermento, masa final, acabados e inclusiones. */
function tablaGrupoFormulaPanadera(id, factor, grupo, titulo) {
  const lineas = lineasFormulaPanaderaEscalada(id, factor).filter(l => l.grupo_formula === grupo);
  if (!lineas.length) return `<section class="subbloque"><h4>${h(titulo)}</h4><p class="vacio">Sin líneas declaradas en este bloque.</p></section>`;
  return `<section class="subbloque"><h4>${h(titulo)}</h4><table class="tabla"><thead><tr><th>Ingrediente</th><th>% panadero</th><th>Cantidad</th><th>Rol</th><th>Obs.</th></tr></thead><tbody>${lineas.map(l=>`<tr><td>${h(l.nombre_linea)}</td><td>${l.porcentaje_panadero == null ? '—' : n(l.porcentaje_panadero,3)}</td><td>${n(l.cantidad_escalada,1)} ${h(l.unidad)}</td><td>${h(l.rol_formula || '')}</td><td>${h(l.observaciones || '')}</td></tr>`).join('')}</tbody></table></section>`;
}

/** Bloques panaderos profesionales dentro del mismo dossier. */
function bloquesPanaderia(e, factor = 1) {
  return `<section class="bloque-panaderia"><h3>Parámetros panaderos</h3>${tablaParametrosPanaderos(e, factor)}<h3>Fórmula panadera total</h3>${tablaFormulaPanadera(e.id, factor)}${tablaGrupoFormulaPanadera(e.id, factor, 'prefermento', 'Prefermento')}${tablaGrupoFormulaPanadera(e.id, factor, 'masa_final', 'Masa final')}${tablaGrupoFormulaPanadera(e.id, factor, 'acabado', 'Acabados / baños')}${tablaGrupoFormulaPanadera(e.id, factor, 'inclusion', 'Inclusiones / rellenos')}${tablaGrupoFormulaPanadera(e.id, factor, 'decoracion', 'Decoración')}</section>`;
}

/** Validación documental completa. */
function validacionElaboracion(e) {
  const errores = [], avisos = [];
  const lineas = lineasElaboracion(e.id).filter(l=>l.activo);
  const pasos = pasosElaboracion(e.id).filter(p=>p.activo);
  const appcc = appccElaboracion(e.id);
  const alergenos = alergenosElaboracion(e.id);
  const pan = resumenPanadero(e.id);
  if (!e.nombre) errores.push('Falta nombre.');
  if (!lineas.length) errores.push('No tiene líneas/ingredientes activos.');
  if (!pasos.length) errores.push('No tiene proceso activo.');
  if (Number(e.lineas_coste_incompatible || 0) > 0) avisos.push('Hay líneas con coste incompatible o no calculable.');
  if (!appcc.length) avisos.push('No tiene APPCC asociado.');
  if (!alergenos.length) avisos.push('No hay alérgenos inferidos/declarados.');
  if (e.tipo_obrador === 'panaderia' || e.modelo_calculo === 'porcentaje_panadero') {
    if (!pan) errores.push('La ficha panadera no tiene parámetros/fórmula panadera calculable.');
    if (pan && Number(pan.numero_harinas_base || 0) < 1) avisos.push('La fórmula panadera no marca harina base.');
  }
  const estadoTecnico = errores.length ? 'bloqueada' : 'sin errores bloqueantes';
  return `<div class="validacion ${errores.length?'error':'ok'}"><p><strong>Estado técnico:</strong> ${h(estadoTecnico)}</p>${errores.length?`<h4>Errores bloqueantes</h4><ul>${errores.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}${avisos.length?`<h4>Avisos</h4><ul>${avisos.map(x=>`<li>${h(x)}</li>`).join('')}</ul>`:''}<p class="aviso">La validación docente real debe marcarse explícitamente en los campos de estado. La app no valida automáticamente por el profesorado.</p></div>`;
}

/** Vista de impresión de elaboración. */
function impresionElaboracion(e) {
  const html = documentoElaboracion(e, { appcc: true, costes: true, alergenos: true, proceso: true }, 1);
  return `<section class="panel"><div class="barra__grupo"><button class="boton primario" data-accion="imprimir-elaboracion" data-id="${e.id}">Imprimir ficha completa</button></div><div class="vista-previa">${html}</div></section>`;
}

/** Ventana ingrediente. */
function ventanaIngrediente(id, modo) {
  const i = obtenerIngrediente(id);
  if (!i) return '';
  return ventanaBase(i.nombre, `${i.familia || 'Sin familia'} · ${i.unidad_compra} → ${i.unidad_trabajo}`, `<button class="boton pequeno ${modo==='vista'?'primario':''}" data-accion="cambiar-modo" data-tipo="ingrediente" data-id="${id}" data-modo="vista">Vista</button><button class="boton pequeno ${modo==='editar'?'primario':''}" data-accion="cambiar-modo" data-tipo="ingrediente" data-id="${id}" data-modo="editar">Editar</button><button class="boton pequeno ${modo==='uso'?'primario':''}" data-accion="cambiar-modo" data-tipo="ingrediente" data-id="${id}" data-modo="uso">Uso</button>`, contenidoIngrediente(i, modo));
}

/** Contenido ingrediente. */
function contenidoIngrediente(i, modo) {
  if (modo === 'editar') return editorIngrediente(i);
  if (modo === 'uso') return usoIngrediente(i);
  return vistaIngrediente(i);
}

/** Vista ingrediente. */
function vistaIngrediente(i) {
  return `<section class="panel"><div class="resumen-grid"><div class="dato"><small>Precio</small><strong>${n(i.precio_unidad_compra)} €/${h(i.unidad_compra)}</strong></div><div class="dato"><small>Unidad trabajo</small><strong>${h(i.unidad_trabajo)}</strong></div><div class="dato"><small>Merma</small><strong>${n(i.merma_estandar_pct)} %</strong></div><div class="dato"><small>Estado</small><strong>${i.activo?'Activo':'Archivado'}</strong></div></div><div class="tarjeta"><h3>Notas técnicas</h3><p>${h(i.notas_tecnicas || i.descripcion || 'Sin notas.')}</p></div></section>`;
}

/** Ventana de alta de ingrediente. */
function ventanaNuevoIngrediente() {
  return ventanaBase('Nuevo ingrediente', 'Alta mínima para alimentar la base documental', '', `<section class="panel"><div class="tarjeta"><h3>Datos iniciales</h3>${formularioIngrediente({}, false)}</div></section>`);
}

/** Formulario común de ingrediente para alta y edición. */
function formularioIngrediente(i = {}, existe = true) {
  return `<form class="formulario doble" data-formulario="ingrediente" data-id="${i.id || ''}">
    <label><span>Nombre</span><input class="campo" name="nombre" required value="${h(i.nombre || '')}" placeholder="Ej. Harina panadera W220"></label>
    <label><span>Nombre técnico</span><input class="campo" name="nombre_tecnico" value="${h(i.nombre_tecnico || '')}"></label>
    <label><span>Familia</span><select name="familia_id">${opcionesFamiliasIngrediente(i.familia_id || '')}</select></label>
    <label><span>Proveedor</span><input class="campo" name="proveedor_referencia" value="${h(i.proveedor_referencia || '')}"></label>
    <label><span>Unidad compra</span><select name="unidad_compra">${opcionesUnidades(i.unidad_compra || 'kg', 'kg')}</select></label>
    <label><span>Precio compra</span><input class="campo" type="number" min="0" step="0.0001" name="precio_unidad_compra" value="${h(i.precio_unidad_compra ?? 0)}"></label>
    <label><span>Unidad trabajo</span><select name="unidad_trabajo">${opcionesUnidades(i.unidad_trabajo || 'g', 'g')}</select></label>
    <label><span>Conversión compra→trabajo</span><input class="campo" type="number" min="0.000001" step="0.000001" name="factor_conversion_compra_trabajo" value="${h(i.factor_conversion_compra_trabajo ?? 1)}"></label>
    <label><span>Merma %</span><input class="campo" type="number" min="0" max="99.99" step="0.01" name="merma_estandar_pct" value="${h(i.merma_estandar_pct ?? 0)}"></label>
    <label><span>Factor hídrico por defecto</span><input class="campo" type="number" min="0" step="0.001" name="factor_hidrico_defecto" value="${h(i.factor_hidrico_defecto ?? 0)}"></label>
    <label class="check"><input type="checkbox" name="es_harina_base_defecto" ${i.es_harina_base_defecto ? 'checked' : ''}> Harina base por defecto</label>
    <label class="check"><input type="checkbox" name="aporta_hidratacion_defecto" ${i.aporta_hidratacion_defecto ? 'checked' : ''}> Aporta hidratación por defecto</label>
    <label style="grid-column:1/-1"><span>Descripción</span><textarea name="descripcion">${h(i.descripcion || '')}</textarea></label>
    <label style="grid-column:1/-1"><span>Notas técnicas</span><textarea name="notas_tecnicas">${h(i.notas_tecnicas || '')}</textarea></label>
    <div class="barra__grupo"><button class="boton primario" type="submit">${existe ? 'Guardar ingrediente' : 'Crear ingrediente'}</button>${existe ? `<button class="boton ${i.activo?'peligro':'secundario'}" type="button" data-accion="alternar-activo-ingrediente" data-id="${i.id}">${i.activo?'Archivar':'Reactivar'}</button>` : ''}</div>
  </form>`;
}

/** Editor ingrediente. */
function editorIngrediente(i) {
  return `<section class="panel"><div class="tarjeta"><h3>Editar ingrediente</h3>${formularioIngrediente(i, true)}</div></section>`;
}


/** Uso ingrediente. */
function usoIngrediente(i) {
  const usos = usosIngrediente(i.id);
  return `<section class="panel"><div class="tarjeta"><h3>Uso en elaboraciones</h3>${usos.length?`<table class="tabla"><thead><tr><th>Elaboración</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>${usos.map(u=>`<tr><td>${h(u.nombre)}</td><td>${n(u.cantidad_neta,3)}</td><td>${h(u.unidad)}</td></tr>`).join('')}</tbody></table>`:'<p class="vacio">No se usa en elaboraciones activas.</p>'}</div></section>`;
}

/** Ventana sesión con pedido y documentación. */
function ventanaSesion(id, modo='vista') {
  const s = obtenerSesion(id);
  if (!s) return '';
  return ventanaBase(s.nombre, `${s.modulo || ''} · ${s.grupo || ''} · ${s.fecha_prevista || ''}`, `<button class="boton pequeno primario">Vista general</button><button class="boton pequeno" data-accion="imprimir-sesion" data-id="${id}">Imprimir</button>`, `<section class="panel"><div class="tarjeta"><h3>Elaboraciones</h3>${s.elaboraciones.length?`<ol>${s.elaboraciones.map(e=>`<li>${h(e.nombre)} · ${h(e.modo_escalado || 'raciones')} · ${n(e.raciones_previstas,0)} rac. · ${n(e.piezas_previstas,0)} piezas</li>`).join('')}</ol>`:'<p class="vacio">Sin elaboraciones.</p>'}</div><div class="tarjeta"><h3>Pedido consolidado guardado</h3>${tablaPedidoConsolidado(pedidoConsolidadoSesion(id), false)}</div></section>`);
}

/** Calcula pedido consolidado de una sesión guardada usando vistas SQL. */
function pedidoConsolidadoSesion(id) {
  return datos.consultar(`SELECT orden_familia AS ordenFamilia,familia,ingrediente,unidad_base AS unidad,cantidad_bruta_total_base AS cantidad,coste_estimado_base AS coste,numero_elaboraciones_origen AS origenes FROM v_practica_pedido_expandido_f5 WHERE practica_id=? ORDER BY orden_familia,familia,ingrediente`, [id]);
}

/** Sistema con snapshots. */
function vistaSistema() {
  const cuentaElaboraciones = datos.uno('SELECT COUNT(*) AS n FROM elaboraciones')?.n || 0;
  const cuentaIngredientes = datos.uno('SELECT COUNT(*) AS n FROM ingredientes')?.n || 0;
  const cuentaSesiones = datos.uno('SELECT COUNT(*) AS n FROM practicas_docentes')?.n || 0;
  return `<section class="portada"><div class="hero"><h2>Sistema</h2><p>Diagnóstico, persistencia y recuperación local.</p></div><section class="tarjetas"><div class="tarjeta"><h3>Base activa</h3><p>${n(cuentaElaboraciones,0)} elaboraciones · ${n(cuentaIngredientes,0)} ingredientes · ${n(cuentaSesiones,0)} sesiones</p></div><div class="tarjeta"><h3>Versión</h3><p>${VERSION}</p></div><div class="tarjeta"><h3>Regla de cambios serios</h3><p>Activa: contrato, datos, UI completa, persistencia, impresión y validación deben modificarse juntos cuando proceda.</p></div><div class="tarjeta"><h3>Snapshots rotatorios</h3>${tablaSnapshots()}</div><div class="tarjeta"><h3>Mantenimiento</h3><p>Restablecer borra IndexedDB y carga db/obradorr.sqlite del paquete.</p><button class="boton peligro" data-accion="restablecer-base">Restablecer base del paquete</button></div></section></section>`;
}

/** Tabla snapshots. */
function tablaSnapshots() {
  return `<table class="tabla"><thead><tr><th>Clave</th><th>Fecha</th><th>Tamaño</th><th>Acción</th></tr></thead><tbody>${estado.snapshots.map(s=>`<tr><td>${h(s.clave)}</td><td>${s.fecha ? h(new Date(s.fecha).toLocaleString('es-ES')) : '—'}</td><td>${s.bytes ? n(s.bytes/1024,1)+' KB' : '—'}</td><td>${s.fecha ? `<button class="boton pequeno" data-accion="restaurar-snapshot" data-clave="${h(s.clave)}">Restaurar</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
}


/** Renderiza cabecera común de una ficha dentro del dossier único. */
function renderCabeceraFicha(e, subtitulo, factor) {
  return `<header class="doc-cabecera"><h2>${h(e.nombre)}</h2><p class="doc-subtitulo">${h(subtitulo)}</p><p>${h(e.descripcion || 'Elaboración sin descripción técnica ampliada.')}</p><table class="tabla mini"><tbody><tr><th>Modelo</th><td>${h(e.modelo_calculo || '')}</td><th>Tipo</th><td>${h(e.tipo_obrador || '')}</td></tr><tr><th>Raciones base</th><td>${n(e.raciones_base,0)}</td><th>Factor documento</th><td>${n(factor,3)}</td></tr><tr><th>Estado documental</th><td>${h(e.estado_documental || 'pendiente')}</td><th>Validación obrador</th><td>${h(e.estado_validacion_obrador || 'pendiente')}</td></tr></tbody></table></header>`;
}

/** Renderiza bloque común de proceso, APPCC, alérgenos, costes y validación. */
function renderBloquesComunesFicha(e, opciones, factor) {
  const pasos = pasosElaboracion(e.id).filter(p=>p.activo);
  return `${opciones.proceso ? `<h3>Proceso</h3>${listaPasos(pasos)}` : ''}${opciones.appcc ? `<h3>APPCC</h3>${listaAppcc(appccElaboracion(e.id))}` : ''}${opciones.alergenos ? `<h3>Alérgenos</h3><p>${alergenosElaboracion(e.id).map(a=>h(a.alergeno)).join(', ') || 'Sin alérgenos declarados/inferidos.'}</p>` : ''}${opciones.costes ? `<h3>Costes</h3><p>Coste base: ${n(e.coste_total)} € · Coste escalado: ${n(Number(e.coste_total||0)*factor)} €</p>` : ''}<h3>Validación</h3>${validacionElaboracion(e)}`;
}

/** Renderiza ficha de cocina o pastelería con plantilla propia. */
function renderFichaCocina(e, opciones, factor = 1) {
  const lineas = lineasElaboracion(e.id).filter(l=>l.activo).map(l=>escalarLineaDirecta(l, factor));
  return `<article class="doc doc-cocina">${renderCabeceraFicha(e, 'Ficha de trabajo · cocina/pastelería', factor)}${opciones.fotos ? bloqueFotoPrincipal(e.id) : ''}<h3>Ingredientes y elaborados escalados</h3>${tablaLineasEscaladas(lineas)}${renderBloquesComunesFicha(e, opciones, factor)}</article>`;
}

/** Renderiza la ficha panadera con el adaptador documental estable. */
function renderFichaPanaderia(e, opciones, factor = 1) {
  const lineas = lineasElaboracion(e.id).filter(l=>l.activo).map(l=>escalarLineaDirecta(l, factor));
  return `<article class="doc doc-panaderia">${renderCabeceraFicha(e, 'Ficha panadera · fórmula dentro del dossier único', factor)}${opciones.fotos ? bloqueFotoPrincipal(e.id) : ''}<h3>Ingredientes / líneas escaladas</h3>${tablaLineasEscaladas(lineas)}${bloquesPanaderia(e, factor)}${renderBloquesComunesFicha(e, opciones, factor)}</article>`;
}

/** Renderiza ficha de subreceta/base reutilizable dentro del mismo dossier. */
function renderFichaSubreceta(e, opciones, factor = 1) {
  const lineas = lineasElaboracion(e.id).filter(l=>l.activo).map(l=>escalarLineaDirecta(l, factor));
  return `<article class="doc doc-subreceta">${renderCabeceraFicha(e, 'Subreceta / base reutilizable', factor)}${opciones.fotos ? bloqueFotoPrincipal(e.id) : ''}<h3>Composición escalada</h3>${tablaLineasEscaladas(lineas)}${renderBloquesComunesFicha(e, opciones, factor)}</article>`;
}

/** Selecciona el adaptador documental adecuado sin romper el dossier único. */
function renderFichaElaboracion(e, opciones, factor = 1) {
  if (esFichaPanaderia(e)) return renderFichaPanaderia(e, opciones, factor);
  if (Number(e.es_elaborado_reutilizable || 0) === 1 || e.tipo_obrador === 'base') return renderFichaSubreceta(e, opciones, factor);
  return renderFichaCocina(e, opciones, factor);
}

/** Documento completo de elaboración: wrapper mantenido por compatibilidad, delega en adaptadores. */
function documentoElaboracion(e, opciones, factor = 1) {
  return renderFichaElaboracion(e, opciones, factor);
}

/** Tabla líneas escaladas. */
function tablaLineasEscaladas(lineas) {
  if (!lineas.length) return '<p class="vacio">Sin líneas.</p>';
  return `<table class="tabla"><thead><tr><th>Elemento</th><th>Cantidad escalada</th><th>Unidad</th><th>Obs.</th></tr></thead><tbody>${lineas.map(l=>`<tr><td>${h(l.nombre_linea)}</td><td>${n(l.cantidad_escalada,3)}</td><td>${h(l.unidad)}</td><td>${h(l.observaciones || '')}</td></tr>`).join('')}</tbody></table>`;
}

/** Imprime una selección, ficha o sesión. */
function imprimirHtml(titulo, html) {
  const w = window.open('', '_blank');
  if (!w) { indicar('El navegador bloqueó la ventana de impresión.', 'error'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${h(titulo)}</title><style>body{font-family:Arial,system-ui,sans-serif;margin:24px;color:#111;line-height:1.35}table{width:100%;border-collapse:collapse;margin:.6rem 0}td,th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f1f5f2}.mini th,.mini td{font-size:.9rem}h1,h2,h3,h4{break-after:avoid;color:#14352b}.doc{break-inside:auto;margin:0 0 28px;padding-bottom:18px;border-bottom:2px solid #d7ded8}.doc-cabecera{border-left:5px solid #2f6b55;padding-left:12px;margin-bottom:12px}.doc-subtitulo{font-weight:700;color:#475467}.doc-seccion{margin-bottom:20px}.bloque-panaderia{border:1px solid #cddfd6;padding:10px;background:#fbfefc}.subbloque{margin-top:10px}.validacion{border:1px solid #ccc;padding:8px}.error{border-color:#b42318}.ok{border-color:#027a48}.bloque-practica{border:1px solid #ddd;padding:10px;background:#f7f7f7}.vacio{color:#667085;font-style:italic}@media print{button{display:none}.doc{page-break-after:always}.doc:last-child{page-break-after:auto}}</style></head><body><button onclick="window.print()">Imprimir</button>${html}</body></html>`);
  w.document.close();
}

/** Resumen documental de selección sin repetir el pedido consolidado. */
function resumenSeleccionDocumento(pedido) {
  return `<section class="doc-seccion"><h2>Resumen de selección</h2>${bloquePracticaImpresion()}<ol>${pedido.fichas.sort((a,b)=>(a.seleccion.orden||0)-(b.seleccion.orden||0)).map(f => `<li><strong>${h(f.elaboracion.nombre)}</strong> · ${h(etiquetaEscalado(f.elaboracion, f.seleccion, f.escala))} · factor ${n(f.escala.factor,3)}</li>`).join('')}</ol>${estado.opcionesDocumento.costes ? `<p><strong>Coste escalado estimado:</strong> ${n(pedido.costeTotal)} €</p>` : ''}</section>`;
}

/** Genera documento completo de selección rápida. Un único dossier admite cocina, pastelería, panadería y subrecetas. */
function documentoSeleccionCompleto() {
  const pedido = calcularPedidoConsolidadoSeleccion();
  if (!pedido.fichas.length) throw new Error('No hay fichas seleccionadas.');
  const titulo = estado.opcionesDocumento.tipo === 'pedido' ? 'Pedido de producción' : 'Dossier de producción';
  const cabecera = `<h1>${titulo}</h1>${resumenSeleccionDocumento(pedido)}`;
  const pedidoHtml = estado.opcionesDocumento.pedido || estado.opcionesDocumento.tipo === 'pedido' ? `<section class="doc-seccion"><h2>Pedido consolidado por familias</h2>${tablaPedidoConsolidado(pedido.lineas, false)}</section>` : '';
  const fichasHtml = estado.opcionesDocumento.tipo !== 'pedido' ? pedido.fichas.sort((a,b)=>(a.seleccion.orden||0)-(b.seleccion.orden||0)).map(f => renderFichaElaboracion(f.elaboracion, estado.opcionesDocumento, f.escala.factor)).join('') : '';
  return `${cabecera}${pedidoHtml}${fichasHtml}`;
}

/** Guarda selección rápida como sesión con todos los modos de escalado. */
async function guardarSesionRapida() {
  if (!estado.seleccionRapida.size) throw new Error('No hay fichas seleccionadas.');
  const d = estado.datosPractica;
  const nombre = d.nombre?.trim() || `Sesión rápida ${new Date().toLocaleString('es-ES')}`;
  await datos.transaccion(async () => {
    datos.ejecutar(`INSERT INTO practicas_docentes (nombre,modulo,grupo,fecha_prevista,docente,descripcion,estado,creado_en,actualizado_en,observaciones,numero_alumnos,obrador,ciclo_id,modulo_id) VALUES (?,?,?,?,?,?,'planificada',datetime('now'),datetime('now'),?,?,?,?,?)`, [nombre,nombreModulo(d.modulo_id)||d.modulo||'',d.grupo||'',d.fecha||hoy(),d.docente||'','Sesión rápida creada desde selección de fichas.',d.observaciones||'',Number(d.numero_alumnos || 0) || null,d.obrador||'',Number(d.ciclo_id||0)||null,Number(d.modulo_id||0)||null]);
    const id = datos.uno('SELECT last_insert_rowid() AS id').id;
    for (const [elaboracionId, sel] of estado.seleccionRapida.entries()) {
      datos.ejecutar(`INSERT INTO practica_elaboraciones (practica_id,elaboracion_id,raciones_previstas,piezas_previstas,orden,modo_escalado,cantidad_objetivo,unidad_objetivo,harina_base_objetivo_g,masa_total_objetivo_g,peso_pieza_cruda_objetivo_g) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [id,elaboracionId,Number(sel.raciones||0),Number(sel.piezas||0),Number(sel.orden||0),sel.modo||'raciones',Number(sel.cantidad||0)||null,sel.unidad||null,Number(sel.harina||0)||null,Number(sel.masa||0)||null,Number(sel.pesoPieza||0)||null]);
    }
  }, 'Guardar selección rápida como sesión');
  indicar('Sesión guardada con modos de escalado.', 'ok');
  renderizar();
}

/** Guarda datos generales de elaboración: crea si no hay id, actualiza si existe. */
async function guardarFormularioElaboracion(formulario) {
  const id = Number(formulario.dataset.id || 0);
  const fd = new FormData(formulario);
  const nombre = String(fd.get('nombre') || '').trim();
  if (!nombre) throw new Error('El nombre de la elaboración es obligatorio.');
  const tipoObrador = fd.get('tipo_obrador') || 'cocina';
  const modelo = fd.get('modelo_calculo') || (tipoObrador === 'panaderia' ? 'porcentaje_panadero' : 'raciones');
  await datos.transaccion(async () => {
    if (id) {
      datos.ejecutar(`UPDATE elaboraciones SET nombre=?,descripcion=?,tipo_obrador=?,tipo_elaboracion=?,modelo_calculo=?,estado_documental=?,estado_validacion_obrador=?,familia_elaboracion_id=?,raciones_base=?,piezas_base=?,cantidad_base=?,unidad_base=?,peso_racion_g=?,peso_pieza_g=?,rendimiento_teorico=?,unidad_rendimiento=?,es_elaborado_reutilizable=?,notas_docente=?,actualizado_en=datetime('now') WHERE id=?`, [nombre,fd.get('descripcion')||'',tipoObrador,fd.get('tipo_elaboracion')||'elaboracion_final',modelo,fd.get('estado_documental')||'pendiente_revision',fd.get('estado_validacion_obrador')||'pendiente',idOpcional(fd.get('familia_elaboracion_id')),Number(fd.get('raciones_base')||0),Number(fd.get('piezas_base')||0),Number(fd.get('cantidad_base')||1),fd.get('unidad_base')||'racion',valorNullable(fd.get('peso_racion_g')),valorNullable(fd.get('peso_pieza_g')),valorNullable(fd.get('rendimiento_teorico')),fd.get('unidad_rendimiento')||null,fd.get('es_elaborado_reutilizable') ? 1 : 0,fd.get('notas_docente')||'',id]);
      if (tipoObrador === 'panaderia' || modelo === 'porcentaje_panadero') datos.ejecutar(`INSERT OR IGNORE INTO parametros_panaderia (elaboracion_id,harina_base_g) VALUES (?,1000)`, [id]);
    } else {
      const codigo = codigoTemporal('elab', nombre);
      datos.ejecutar(`INSERT INTO elaboraciones (codigo,nombre,descripcion,tipo_obrador,tipo_elaboracion,modelo_calculo,estado_documental,estado_validacion_obrador,familia_elaboracion_id,cantidad_base,unidad_base,raciones_base,piezas_base,peso_racion_g,peso_pieza_g,rendimiento_teorico,unidad_rendimiento,es_elaborado_reutilizable,notas_docente,activo,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,datetime('now'),datetime('now'))`, [codigo,nombre,fd.get('descripcion')||'',tipoObrador,fd.get('tipo_elaboracion')||'elaboracion_final',modelo,fd.get('estado_documental')||'pendiente_revision',fd.get('estado_validacion_obrador')||'pendiente',idOpcional(fd.get('familia_elaboracion_id')),Number(fd.get('cantidad_base')||1),fd.get('unidad_base')||'racion',Number(fd.get('raciones_base')||0),Number(fd.get('piezas_base')||0),valorNullable(fd.get('peso_racion_g')),valorNullable(fd.get('peso_pieza_g')),valorNullable(fd.get('rendimiento_teorico')),fd.get('unidad_rendimiento')||null,fd.get('es_elaborado_reutilizable') ? 1 : 0,fd.get('notas_docente')||'']);
      const nuevoId = datos.uno('SELECT last_insert_rowid() AS id').id;
      if (tipoObrador === 'panaderia' || modelo === 'porcentaje_panadero') datos.ejecutar(`INSERT INTO parametros_panaderia (elaboracion_id,harina_base_g) VALUES (?,1000)`, [nuevoId]);
      estado.ventana = { tipo: 'elaboracion', id: nuevoId, modo: 'editar' };
      estado.baseTipo = 'elaboraciones';
    }
  }, id ? 'Actualizar elaboración' : 'Crear elaboración');
}

/** Guarda ingrediente: crea si no hay id, actualiza si existe. */
async function guardarFormularioIngrediente(formulario) {
  const id = Number(formulario.dataset.id || 0);
  const fd = new FormData(formulario);
  const nombre = String(fd.get('nombre') || '').trim();
  if (!nombre) throw new Error('El nombre del ingrediente es obligatorio.');
  const unidadCompra = fd.get('unidad_compra') || 'kg';
  const unidadTrabajo = fd.get('unidad_trabajo') || 'g';
  await datos.transaccion(async () => {
    if (id) {
      datos.ejecutar(`UPDATE ingredientes SET nombre=?,nombre_tecnico=?,familia_id=?,proveedor_referencia=?,unidad_compra=?,precio_unidad_compra=?,unidad_trabajo=?,factor_conversion_compra_trabajo=?,merma_estandar_pct=?,descripcion=?,notas_tecnicas=?,es_harina_base_defecto=?,aporta_hidratacion_defecto=?,factor_hidrico_defecto=?,actualizado_en=datetime('now') WHERE id=?`, [nombre,fd.get('nombre_tecnico')||'',idOpcional(fd.get('familia_id')),fd.get('proveedor_referencia')||'',unidadCompra,Number(fd.get('precio_unidad_compra')||0),unidadTrabajo,Number(fd.get('factor_conversion_compra_trabajo')||1),Number(fd.get('merma_estandar_pct')||0),fd.get('descripcion')||'',fd.get('notas_tecnicas')||'',fd.get('es_harina_base_defecto') ? 1 : 0,fd.get('aporta_hidratacion_defecto') ? 1 : 0,Number(fd.get('factor_hidrico_defecto')||0),id]);
    } else {
      const codigo = codigoTemporal('ing', nombre);
      datos.ejecutar(`INSERT INTO ingredientes (codigo,nombre,nombre_tecnico,familia_id,proveedor_referencia,unidad_compra,precio_unidad_compra,unidad_trabajo,factor_conversion_compra_trabajo,merma_estandar_pct,descripcion,notas_tecnicas,es_harina_base_defecto,aporta_hidratacion_defecto,factor_hidrico_defecto,activo,es_semilla,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,datetime('now'),datetime('now'))`, [codigo,nombre,fd.get('nombre_tecnico')||'',idOpcional(fd.get('familia_id')),fd.get('proveedor_referencia')||'',unidadCompra,Number(fd.get('precio_unidad_compra')||0),unidadTrabajo,Number(fd.get('factor_conversion_compra_trabajo')||1),Number(fd.get('merma_estandar_pct')||0),fd.get('descripcion')||'',fd.get('notas_tecnicas')||'',fd.get('es_harina_base_defecto') ? 1 : 0,fd.get('aporta_hidratacion_defecto') ? 1 : 0,Number(fd.get('factor_hidrico_defecto')||0)]);
      const nuevoId = datos.uno('SELECT last_insert_rowid() AS id').id;
      estado.ventana = { tipo: 'ingrediente', id: nuevoId, modo: 'editar' };
      estado.baseTipo = 'ingredientes';
    }
  }, id ? 'Actualizar ingrediente' : 'Crear ingrediente');
}



/** Guarda línea de elaboración. */
async function guardarFormularioLinea(formulario) {
  const elaboracionId = Number(formulario.dataset.elaboracionId);
  const id = Number(formulario.dataset.id || 0);
  const fd = new FormData(formulario);
  const tipo = fd.get('tipo_linea') || 'ingrediente';
  const ingredienteId = tipo === 'ingrediente' ? Number(fd.get('ingrediente_id') || 0) || null : null;
  const elaboradoId = tipo === 'elaborado' ? Number(fd.get('elaborado_id') || 0) || null : null;
  if (!ingredienteId && !elaboradoId) throw new Error('Selecciona ingrediente o elaborado.');
  const rolFormula = fd.get('rol_formula') || null;
  const esHarinaBase = fd.get('es_harina_base') ? 1 : 0;
  if (esHarinaBase && (tipo !== 'ingrediente' || rolFormula !== 'harina')) {
    throw new Error('La harina base debe ser una línea de ingrediente con rol harina.');
  }
  await datos.transaccion(async () => {
    if (esHarinaBase) {
      datos.ejecutar('UPDATE elaboracion_lineas SET es_harina_base=0 WHERE elaboracion_id=?', [elaboracionId]);
    }
    if (id) datos.ejecutar(`UPDATE elaboracion_lineas SET tipo_linea=?,ingrediente_id=?,elaborado_id=?,cantidad_neta=?,unidad=?,merma_aplicada_pct=?,porcentaje_panadero=?,rol_formula=?,grupo_formula=?,es_harina_base=?,aporta_hidratacion=?,factor_hidrico=?,orden=?,observaciones=? WHERE id=?`, [tipo,ingredienteId,elaboradoId,Number(fd.get('cantidad_neta')||0),fd.get('unidad')||'g',Number(fd.get('merma_aplicada_pct')||0),valorNullable(fd.get('porcentaje_panadero')),rolFormula,fd.get('grupo_formula')||'masa_final',esHarinaBase,fd.get('aporta_hidratacion') ? 1 : 0,valorNullable(fd.get('factor_hidrico')),Number(fd.get('orden')||0),fd.get('observaciones')||'',id]);
    else datos.ejecutar(`INSERT INTO elaboracion_lineas (elaboracion_id,tipo_linea,ingrediente_id,elaborado_id,cantidad_neta,unidad,merma_aplicada_pct,porcentaje_panadero,rol_formula,grupo_formula,es_harina_base,aporta_hidratacion,factor_hidrico,orden,observaciones,activo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, [elaboracionId,tipo,ingredienteId,elaboradoId,Number(fd.get('cantidad_neta')||0),fd.get('unidad')||'g',Number(fd.get('merma_aplicada_pct')||0),valorNullable(fd.get('porcentaje_panadero')),rolFormula,fd.get('grupo_formula')||'masa_final',esHarinaBase,fd.get('aporta_hidratacion') ? 1 : 0,valorNullable(fd.get('factor_hidrico')),Number(fd.get('orden')||0),fd.get('observaciones')||'']);
  }, 'Guardar línea');
  estado.editor = null;
}

/** Guarda paso. */
async function guardarFormularioPaso(formulario) {
  const elaboracionId = Number(formulario.dataset.elaboracionId);
  const id = Number(formulario.dataset.id || 0);
  const fd = new FormData(formulario);
  const titulo = String(fd.get('titulo_paso') || '').trim();
  if (!titulo) throw new Error('El título del paso es obligatorio.');
  await datos.transaccion(async () => {
    if (id) datos.ejecutar(`UPDATE elaboracion_pasos SET numero_paso=?,titulo_paso=?,descripcion=?,temperatura_c=?,tiempo_min=?,tecnica=?,tipo_paso=?,observaciones=? WHERE id=?`, [Number(fd.get('numero_paso')||1),titulo,fd.get('descripcion')||'',valorNullable(fd.get('temperatura_c')),valorNullable(fd.get('tiempo_min')),fd.get('tecnica')||'',fd.get('tipo_paso')||'general',fd.get('observaciones')||'',id]);
    else datos.ejecutar(`INSERT INTO elaboracion_pasos (elaboracion_id,numero_paso,titulo_paso,descripcion,temperatura_c,tiempo_min,tecnica,tipo_paso,observaciones,activo) VALUES (?,?,?,?,?,?,?,?,?,1)`, [elaboracionId,Number(fd.get('numero_paso')||1),titulo,fd.get('descripcion')||'',valorNullable(fd.get('temperatura_c')),valorNullable(fd.get('tiempo_min')),fd.get('tecnica')||'',fd.get('tipo_paso')||'general',fd.get('observaciones')||'']);
  }, 'Guardar paso');
  estado.editor = null;
}

/** Guarda APPCC. */
async function guardarFormularioAppcc(formulario) {
  const elaboracionId = Number(formulario.dataset.elaboracionId);
  const id = Number(formulario.dataset.id || 0);
  const fd = new FormData(formulario);
  if (!String(fd.get('descripcion_peligro') || '').trim()) throw new Error('Describe el peligro APPCC.');
  if (!String(fd.get('medida_preventiva') || '').trim()) throw new Error('Indica la medida preventiva.');
  const pasoId = Number(fd.get('paso_id') || 0) || null;
  await datos.transaccion(async () => {
    if (id) datos.ejecutar(`UPDATE appcc_peligros_elaboracion SET paso_id=?,tipo_peligro=?,descripcion_peligro=?,medida_preventiva=?,es_pcc=?,limite_critico=?,medida_correctora=?,responsable=?,verificacion=?,orden=? WHERE id=?`, [pasoId,fd.get('tipo_peligro'),fd.get('descripcion_peligro'),fd.get('medida_preventiva'),Number(fd.get('es_pcc')||0),fd.get('limite_critico')||'',fd.get('medida_correctora')||'',fd.get('responsable')||'',fd.get('verificacion')||'',Number(fd.get('orden')||0),id]);
    else datos.ejecutar(`INSERT INTO appcc_peligros_elaboracion (elaboracion_id,paso_id,tipo_peligro,descripcion_peligro,medida_preventiva,es_pcc,limite_critico,medida_correctora,responsable,verificacion,orden) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [elaboracionId,pasoId,fd.get('tipo_peligro'),fd.get('descripcion_peligro'),fd.get('medida_preventiva'),Number(fd.get('es_pcc')||0),fd.get('limite_critico')||'',fd.get('medida_correctora')||'',fd.get('responsable')||'',fd.get('verificacion')||'',Number(fd.get('orden')||0)]);
  }, 'Guardar APPCC');
  estado.editor = null;
}

/** Convierte valor vacío en null numérico. */
function valorNullable(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** Alterna activo por tabla controlada. */
async function alternarActivo(tabla, id) {
  const fila = datos.uno(`SELECT activo FROM ${tabla} WHERE id=?`, [id]);
  await datos.transaccion(async () => datos.ejecutar(`UPDATE ${tabla} SET activo=? WHERE id=?`, [fila?.activo ? 0 : 1, id]), `Alternar activo en ${tabla}`);
}

/** Guarda foto de elaboración en SQLite como base64. */
async function guardarFotoElaboracion(elaboracionId, archivo) {
  if (!archivo) return;
  if (!archivo.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
  const base64 = await new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    lector.onload = () => resolver(String(lector.result));
    lector.readAsDataURL(archivo);
  });
  const hayPrincipal = fotosElaboracion(elaboracionId).some(f => Number(f.es_principal) === 1);
  await datos.transaccion(async () => datos.ejecutar(`INSERT INTO fotos_elaboracion (elaboracion_id,tipo_foto,titulo,descripcion,contenido_base64,mime_type,es_principal,orden,creado_en,actualizado_en) VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`, [elaboracionId,'elaboracion',archivo.name,'',base64,archivo.type,hayPrincipal ? 0 : 1,fotosElaboracion(elaboracionId).length + 1]), 'Guardar foto elaboración');
}

/** Marca una foto como principal. */
async function marcarFotoPrincipal(fotoId, elaboracionId) {
  await datos.transaccion(async () => {
    datos.ejecutar('UPDATE fotos_elaboracion SET es_principal=0 WHERE elaboracion_id=?', [elaboracionId]);
    datos.ejecutar('UPDATE fotos_elaboracion SET es_principal=1,actualizado_en=datetime(\'now\') WHERE id=?', [fotoId]);
  }, 'Marcar foto principal');
}

/** Elimina una foto de elaboración. */
async function eliminarFoto(fotoId) {
  await datos.transaccion(async () => datos.ejecutar('DELETE FROM fotos_elaboracion WHERE id=?', [fotoId]), 'Eliminar foto');
}

/** Duplica una elaboración completa editable: datos, líneas, pasos, APPCC y parámetros panaderos. */
async function duplicarElaboracion(id) {
  const e = obtenerElaboracion(id);
  if (!e) throw new Error('No se encontró la elaboración a duplicar.');
  await datos.transaccion(async () => {
    const nuevoNombre = `${e.nombre} · copia`;
    const codigo = codigoTemporal('elab', nuevoNombre);
    datos.ejecutar(`INSERT INTO elaboraciones (codigo,nombre,descripcion,tipo_obrador,tipo_elaboracion,modelo_calculo,estado_documental,estado_validacion_obrador,cantidad_base,unidad_base,raciones_base,piezas_base,peso_racion_g,peso_pieza_g,rendimiento_teorico,unidad_rendimiento,version,activo,notas_docente,creado_en,actualizado_en,familia_elaboracion_id,subfamilia_elaboracion_id,ambito_culinario_id,es_elaborado_reutilizable) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,datetime('now'),datetime('now'),?,?,?,?)`, [codigo,nuevoNombre,e.descripcion||'',e.tipo_obrador,e.tipo_elaboracion,e.modelo_calculo,'pendiente_revision','pendiente',Number(e.cantidad_base||1),e.unidad_base||'racion',Number(e.raciones_base||0),Number(e.piezas_base||0),e.peso_racion_g,e.peso_pieza_g,e.rendimiento_teorico,e.unidad_rendimiento,e.notas_docente||'',e.familia_elaboracion_id||null,e.subfamilia_elaboracion_id||null,e.ambito_culinario_id||null,e.es_elaborado_reutilizable ? 1 : 0]);
    const nuevoId = datos.uno('SELECT last_insert_rowid() AS id').id;
    for (const l of lineasElaboracion(id)) datos.ejecutar(`INSERT INTO elaboracion_lineas (elaboracion_id,tipo_linea,ingrediente_id,elaborado_id,cantidad_neta,unidad,merma_aplicada_pct,porcentaje_panadero,rol_formula,grupo_formula,es_harina_base,aporta_hidratacion,factor_hidrico,grupo_visual,orden,observaciones,activo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [nuevoId,l.tipo_linea,l.ingrediente_id||null,l.elaborado_id||null,Number(l.cantidad_neta||0),l.unidad||'g',Number(l.merma_aplicada_pct||0),l.porcentaje_panadero,l.rol_formula,l.grupo_formula||inferirGrupoFormula(l),l.es_harina_base?1:0,l.aporta_hidratacion?1:0,l.factor_hidrico,l.grupo_visual||'',Number(l.orden||0),l.observaciones||'',l.activo?1:0]);
    for (const p of pasosElaboracion(id)) datos.ejecutar(`INSERT INTO elaboracion_pasos (elaboracion_id,numero_paso,titulo_paso,descripcion,temperatura_c,tiempo_min,tecnica,tipo_paso,observaciones,activo) VALUES (?,?,?,?,?,?,?,?,?,?)`, [nuevoId,Number(p.numero_paso||1),p.titulo_paso||'Paso',p.descripcion||'',p.temperatura_c,p.tiempo_min,p.tecnica||'',p.tipo_paso||'general',p.observaciones||'',p.activo?1:0]);
    for (const a of appccElaboracion(id)) datos.ejecutar(`INSERT INTO appcc_peligros_elaboracion (elaboracion_id,tipo_peligro,descripcion_peligro,medida_preventiva,es_pcc,limite_critico,medida_correctora,responsable,verificacion,orden) VALUES (?,?,?,?,?,?,?,?,?,?)`, [nuevoId,a.tipo_peligro||'biologico',a.descripcion_peligro||'',a.medida_preventiva||'',a.es_pcc?1:0,a.limite_critico||'',a.medida_correctora||'',a.responsable||'',a.verificacion||'',Number(a.orden||0)]);
    const pan = parametrosPanaderia(id);
    if (pan && Object.keys(pan).length) datos.ejecutar(`INSERT OR REPLACE INTO parametros_panaderia (elaboracion_id,harina_base_g,tfm_objetivo_c,perdida_coccion_pct,peso_pieza_cruda_g,tiempo_bulk_min,temperatura_bulk_c,tiempo_apresto_min,temperatura_apresto_c,temperatura_coccion_c,tiempo_coccion_min,vapor_inicial,notas_proceso) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [nuevoId,pan.harina_base_g||1000,pan.tfm_objetivo_c,pan.perdida_coccion_pct||0,pan.peso_pieza_cruda_g,pan.tiempo_bulk_min,pan.temperatura_bulk_c,pan.tiempo_apresto_min,pan.temperatura_apresto_c,pan.temperatura_coccion_c,pan.tiempo_coccion_min,pan.vapor_inicial?1:0,pan.notas_proceso||'']);
    estado.ventana = { tipo: 'elaboracion', id: nuevoId, modo: 'editar' };
    estado.baseTipo = 'elaboraciones';
  }, 'Duplicar elaboración completa');
}

/** Elimina APPCC. */
async function eliminarAppcc(id) {
  await datos.transaccion(async () => datos.ejecutar('DELETE FROM appcc_peligros_elaboracion WHERE id=?', [id]), 'Eliminar APPCC');
}

/** Imprime sesión guardada. */
function documentoSesion(id) {
  const s = obtenerSesion(id);
  const lineas = pedidoConsolidadoSesion(id);
  return `<h1>${h(s.nombre)}</h1><p>${h(s.modulo)} · ${h(s.grupo)} · ${h(s.fecha_prevista)} · Docente: ${h(s.docente)}</p><h2>Elaboraciones</h2><ol>${s.elaboraciones.map(e=>`<li>${h(e.nombre)} · ${h(e.modo_escalado || 'raciones')} · ${n(e.raciones_previstas,0)} raciones · ${n(e.piezas_previstas,0)} piezas</li>`).join('')}</ol><h2>Pedido consolidado</h2>${tablaPedidoConsolidado(lineas,false)}`;
}

/** Delegación de clics. */
document.addEventListener('click', async (evento) => {
  if (evento.target.closest('input, select, textarea, label')) return;
  const boton = evento.target.closest('button, [role="button"]');
  if (!boton) return;
  const vista = boton.dataset.vista;
  if (vista) { navegar(vista); return; }
  const accion = boton.dataset.accion;
  if (!accion) return;
  evento.preventDefault();
  evento.stopPropagation();
  try {
    if (accion === 'base-tipo') { estado.baseTipo = boton.dataset.tipo; estado.ventana = null; estado.editor = null; renderizar(); }
    if (accion === 'nueva-elaboracion') { estado.ventana = { tipo: 'nueva-elaboracion' }; estado.editor = null; renderizar(); }
    if (accion === 'nuevo-ingrediente') { estado.ventana = { tipo: 'nuevo-ingrediente' }; estado.editor = null; renderizar(); }
    if (accion === 'cerrar-ventana') { estado.ventana = null; estado.editor = null; renderizar(); }
    if (accion === 'abrir-elaboracion') { estado.ventana = { tipo: 'elaboracion', id: Number(boton.dataset.id), modo: boton.dataset.modo || 'vista' }; estado.editor = null; renderizar(); }
    if (accion === 'abrir-ingrediente') { estado.ventana = { tipo: 'ingrediente', id: Number(boton.dataset.id), modo: boton.dataset.modo || 'vista' }; estado.editor = null; renderizar(); }
    if (accion === 'abrir-sesion') { estado.ventana = { tipo: 'sesion', id: Number(boton.dataset.id), modo: 'vista' }; renderizar(); }
    if (accion === 'cambiar-modo') { estado.ventana = { tipo: boton.dataset.tipo, id: Number(boton.dataset.id), modo: boton.dataset.modo }; estado.editor = null; renderizar(); }
    if (accion === 'alternar-seleccion') alternarSeleccion(Number(boton.dataset.id));
    if (accion === 'seleccionar-visibles') { listarElaboraciones(estado.busquedaElaboraciones).forEach(e => { if (!estado.seleccionRapida.has(e.id)) estado.seleccionRapida.set(e.id, seleccionInicial(e)); }); renderizar(); }
    if (accion === 'limpiar-seleccion') { estado.seleccionRapida.clear(); renderizar(); }
    if (accion === 'imprimir-seleccion') imprimirHtml('ObradORR · Selección', documentoSeleccionCompleto());
    if (accion === 'guardar-sesion') await guardarSesionRapida();
    if (accion === 'imprimir-elaboracion') { const e = obtenerElaboracion(Number(boton.dataset.id)); imprimirHtml(e.nombre, documentoElaboracion(e, { appcc: true, costes: true, alergenos: true, proceso: true, fotos: true }, 1)); }
    if (accion === 'imprimir-sesion') imprimirHtml('Sesión ObradORR', documentoSesion(Number(boton.dataset.id)));
    if (accion === 'duplicar-elaboracion' && confirm('¿Duplicar esta elaboración con líneas, proceso y APPCC?')) { await duplicarElaboracion(Number(boton.dataset.id)); renderizar(); }
    if (accion === 'alternar-activo-elaboracion') { await alternarActivo('elaboraciones', Number(boton.dataset.id)); renderizar(); }
    if (accion === 'alternar-activo-ingrediente') { await alternarActivo('ingredientes', Number(boton.dataset.id)); renderizar(); }
    if (accion === 'editar-linea') { estado.editor = { tipo: 'linea', id: Number(boton.dataset.id) }; renderizar(); }
    if (accion === 'editar-paso') { estado.editor = { tipo: 'paso', id: Number(boton.dataset.id) }; renderizar(); }
    if (accion === 'editar-appcc') { estado.editor = { tipo: 'appcc', id: Number(boton.dataset.id) }; renderizar(); }
    if (accion === 'cancelar-editor') { estado.editor = null; renderizar(); }
    if (accion === 'alternar-linea') { await alternarActivo('elaboracion_lineas', Number(boton.dataset.id)); renderizar(); }
    if (accion === 'alternar-paso') { await alternarActivo('elaboracion_pasos', Number(boton.dataset.id)); renderizar(); }
    if (accion === 'eliminar-appcc' && confirm('¿Eliminar este control APPCC?')) { await eliminarAppcc(Number(boton.dataset.id)); renderizar(); }
    if (accion === 'foto-principal') { await marcarFotoPrincipal(Number(boton.dataset.id), Number(boton.dataset.elaboracionId)); renderizar(); }
    if (accion === 'foto-eliminar' && confirm('¿Eliminar esta foto?')) { await eliminarFoto(Number(boton.dataset.id)); renderizar(); }
    if (accion === 'restaurar-snapshot' && confirm(`¿Restaurar snapshot ${boton.dataset.clave}?`)) { await datos.restaurarSnapshot(boton.dataset.clave); indicar('Snapshot restaurado.', 'ok'); renderizar(); }
    if (accion === 'restablecer-base' && confirm('¿Restablecer la base del paquete y borrar snapshots locales?')) { await datos.restablecerPaquete(); location.reload(); }
  } catch (error) { indicar(error.message, 'error'); }
});

/** Alterna selección rápida. */
function alternarSeleccion(id) {
  if (estado.seleccionRapida.has(id)) estado.seleccionRapida.delete(id);
  else {
    const e = obtenerElaboracion(id);
    estado.seleccionRapida.set(id, seleccionInicial(e));
  }
  renderizar();
}

let temporizadorRender = null;
/** Render retardado. */
function renderizarRetardado() {
  clearTimeout(temporizadorRender);
  temporizadorRender = setTimeout(renderizar, 160);
}

/** Captura inputs de búsqueda, práctica y escalado. */
document.addEventListener('input', (evento) => {
  const c = evento.target.dataset.control;
  if (!c && !evento.target.dataset.practica) return;
  if (c === 'buscar-elaboraciones' || c === 'buscar-seleccion') estado.busquedaElaboraciones = evento.target.value;
  if (c === 'buscar-ingredientes') estado.busquedaIngredientes = evento.target.value;
  const id = Number(evento.target.dataset.id);
  const sel = estado.seleccionRapida.get(id);
  if (sel && ['raciones','piezas','orden','cantidad','harina','masa','pesoPieza'].includes(c)) sel[c] = Number(evento.target.value || 0);
  if (sel && c === 'unidad') sel.unidad = evento.target.value;
  if (evento.target.dataset.practica) estado.datosPractica[evento.target.dataset.practica] = evento.target.value;
  renderizarRetardado();
});

/** Captura cambios en selects/checks. */
document.addEventListener('change', async (evento) => {
  const c = evento.target.dataset.control;
  if (c === 'foto-elaboracion') { try { await guardarFotoElaboracion(Number(evento.target.dataset.id), evento.target.files?.[0]); indicar('Foto guardada.', 'ok'); renderizar(); } catch (error) { indicar(error.message, 'error'); } return; }
  const id = Number(evento.target.dataset.id);
  const sel = estado.seleccionRapida.get(id);
  if (sel && c === 'modo-escalado') sel.modo = evento.target.value;
  if (c === 'tipo-documento') estado.opcionesDocumento.tipo = evento.target.value;
  if (c === 'opcion-appcc') estado.opcionesDocumento.appcc = evento.target.checked;
  if (c === 'opcion-costes') estado.opcionesDocumento.costes = evento.target.checked;
  if (c === 'opcion-alergenos') estado.opcionesDocumento.alergenos = evento.target.checked;
  if (c === 'opcion-practica') { estado.datosPractica.incluir = evento.target.checked; estado.opcionesDocumento.practica = evento.target.checked; if (!estado.datosPractica.fecha) estado.datosPractica.fecha = hoy(); }
  if (c === 'opcion-fotos') estado.opcionesDocumento.fotos = evento.target.checked;
  if (evento.target.dataset.practica) { estado.datosPractica[evento.target.dataset.practica] = evento.target.value; if (evento.target.dataset.practica === 'ciclo_id') estado.datosPractica.modulo_id = ''; }
  renderizar();
});

/** Captura formularios. */
document.addEventListener('submit', async (evento) => {
  const formulario = evento.target.closest('form[data-formulario]');
  if (!formulario) return;
  evento.preventDefault();
  try {
    if (formulario.dataset.formulario === 'elaboracion') await guardarFormularioElaboracion(formulario);
    if (formulario.dataset.formulario === 'ingrediente') await guardarFormularioIngrediente(formulario);
    if (formulario.dataset.formulario === 'linea') await guardarFormularioLinea(formulario);
    if (formulario.dataset.formulario === 'paso') await guardarFormularioPaso(formulario);
    if (formulario.dataset.formulario === 'appcc') await guardarFormularioAppcc(formulario);
    indicar('Guardado correctamente.', 'ok');
    renderizar();
  } catch (error) { indicar(error.message, 'error'); }
});

/** Soporte de teclado para tarjetas clicables. */
document.addEventListener('keydown', (evento) => {
  const tarjeta = evento.target.closest('[role="button"][data-accion]');
  if (!tarjeta) return;
  if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); tarjeta.click(); }
});

/** Inicia la aplicación. */
async function iniciar() {
  try {
    indicar('Cargando SQLite…');
    datos = new MotorDatos();
    await datos.iniciar();
    indicar('SQLite activo · persistencia con snapshots', 'ok');
    renderizar();
  } catch (error) {
    indicar('Error de arranque', 'error');
    document.getElementById('aplicacion').innerHTML = `<section class="error"><h2>No se pudo iniciar ObradORR</h2><p>${h(error.message)}</p></section>`;
  }
}

iniciar();
