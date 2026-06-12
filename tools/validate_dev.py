#!/usr/bin/env python3
"""
Validador mínimo de ObradORR 3.4.0 Catálogo docente inicial.

Comprueba el contrato de reescritura limpia: archivos mínimos, ausencia de
imports legacy, integridad SQLite, vistas críticas para costes/pedidos/panadería
y presencia de los motores funcionales reimplantados en app.js.
"""
from __future__ import annotations

import sqlite3
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]


def exigir(ruta: str) -> Path:
    """Devuelve una ruta obligatoria o detiene la validación."""
    archivo = RAIZ / ruta
    if not archivo.exists():
        raise AssertionError(f"Falta recurso obligatorio: {ruta}")
    return archivo


def validar_archivos_minimos() -> None:
    """Verifica el contrato de archivos mínimos de la reescritura."""
    for ruta in [
        "index.html",
        "app.css",
        "app.js",
        "db/obradorr.sqlite",
        "wasm/sql-wasm.js",
        "wasm/sql-wasm.wasm",
        "VERSION.txt",
        "CONTRATO_CANONICO.md",
        "MATRIZ_COBERTURA.md",
        "REGLA_CAMBIOS_SERIOS.md",
        "CATALOGO_PROPUESTO.md",
    ]:
        exigir(ruta)
    for ruta in ["css", "js/modulos", "js/ui", "js/core", "js/servicios"]:
        if (RAIZ / ruta).exists():
            raise AssertionError(f"Ruta legacy no permitida en ObradORR 3.4.1: {ruta}")


def validar_sqlite() -> None:
    """Comprueba integridad SQLite y objetos críticos consultables."""
    con = sqlite3.connect(exigir("db/obradorr.sqlite"))
    try:
        cur = con.cursor()
        if cur.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise AssertionError("SQLite no supera integrity_check")
        errores_fk = cur.execute("PRAGMA foreign_key_check").fetchall()
        if errores_fk:
            raise AssertionError(f"foreign_key_check detecta {len(errores_fk)} errores")
        criticos = [
            "elaboraciones",
            "ingredientes",
            "elaboracion_lineas",
            "elaboracion_pasos",
            "appcc_peligros_elaboracion",
            "practicas_docentes",
            "practica_elaboraciones",
            "parametros_panaderia",
            "v_coste_elaboracion_expandido",
            "v_pedido_base_expandido",
            "v_practica_pedido_expandido_f5",
            "v_formula_panadera",
            "v_formula_panadera_resumen",
            "v_alergenos_elaboracion",
            "v_appcc_resumen_f7",
            "resultados_aprendizaje",
            "criterios_evaluacion",
            "contrato_canonico_obradorr",
        ]
        for nombre in criticos:
            cur.execute(f"SELECT * FROM {nombre} LIMIT 1").fetchall()
        columnas_lineas = {fila[1] for fila in cur.execute('PRAGMA table_info(elaboracion_lineas)').fetchall()}
        for columna in ['grupo_formula', 'factor_hidrico', 'aporta_hidratacion', 'es_harina_base']:
            if columna not in columnas_lineas:
                raise AssertionError(f'Falta columna canónica en elaboracion_lineas: {columna}')
        columnas_ingredientes = {fila[1] for fila in cur.execute('PRAGMA table_info(ingredientes)').fetchall()}
        for columna in ['aporta_hidratacion_defecto', 'factor_hidrico_defecto', 'es_harina_base_defecto']:
            if columna not in columnas_ingredientes:
                raise AssertionError(f'Falta columna canónica en ingredientes: {columna}')
        regla = cur.execute("SELECT valor FROM contrato_canonico_obradorr WHERE clave='regla_modificaciones_serias'").fetchone()
        if not regla:
            raise AssertionError('Falta la regla de modificaciones serias en contrato_canonico_obradorr')
        # Contrato de contenido mínimo del catálogo docente inicial.
        if cur.execute("SELECT count(*) FROM ingredientes WHERE activo=1").fetchone()[0] < 120:
            raise AssertionError("Catálogo insuficiente: menos de 120 ingredientes activos")
        if cur.execute("SELECT count(*) FROM elaboraciones WHERE activo=1").fetchone()[0] < 80:
            raise AssertionError("Catálogo insuficiente: menos de 80 elaboraciones activas")
        if cur.execute("SELECT count(*) FROM elaboraciones WHERE activo=1 AND tipo_obrador='panaderia'").fetchone()[0] < 10:
            raise AssertionError("Catálogo insuficiente: menos de 10 elaboraciones panaderas")
        if cur.execute("SELECT count(*) FROM elaboracion_lineas WHERE activo=1").fetchone()[0] < 300:
            raise AssertionError("Catálogo insuficiente: menos de 300 líneas activas")
        if cur.execute("SELECT count(*) FROM appcc_peligros_elaboracion").fetchone()[0] < 80:
            raise AssertionError("Catálogo insuficiente: menos de 80 registros APPCC")
        if cur.execute("SELECT count(*) FROM catalogo_docente_lotes WHERE codigo='catalogo_docente_inicial_3_4_0'").fetchone()[0] != 1:
            raise AssertionError("Falta trazabilidad del catálogo docente inicial 3.4.0")

        # Regresión crítica: una única harina base por elaboración.
        duplicadas = cur.execute("""
            SELECT elaboracion_id, COUNT(*)
            FROM elaboracion_lineas
            WHERE es_harina_base=1
            GROUP BY elaboracion_id
            HAVING COUNT(*)>1
        """).fetchall()
        if duplicadas:
            raise AssertionError(f"Hay elaboraciones con más de una harina base: {duplicadas[:5]}")

        pan_sin_base = cur.execute("""
            SELECT e.id, e.nombre
            FROM elaboraciones e
            WHERE e.activo=1
              AND (e.tipo_obrador='panaderia' OR e.modelo_calculo='porcentaje_panadero')
              AND EXISTS (
                SELECT 1 FROM elaboracion_lineas l
                WHERE l.elaboracion_id=e.id AND l.activo=1
                  AND lower(coalesce(l.rol_formula,''))='harina'
              )
              AND NOT EXISTS (
                SELECT 1 FROM elaboracion_lineas l
                WHERE l.elaboracion_id=e.id AND l.es_harina_base=1
              )
        """).fetchall()
        if pan_sin_base:
            raise AssertionError(f"Hay fichas panaderas con harina pero sin harina base: {pan_sin_base[:5]}")

    finally:
        con.close()


def validar_javascript() -> None:
    """Ejecuta node --check sobre el único JavaScript de aplicación."""
    js = exigir("app.js")
    try:
        subprocess.run(["node", "--check", str(js)], check=True, capture_output=True, text=True)
    except FileNotFoundError:
        print("AVISO: node no está instalado; se omite node --check.", file=sys.stderr)
    except subprocess.CalledProcessError as exc:
        raise AssertionError(exc.stderr or exc.stdout) from exc


def validar_sin_imports_legacy() -> None:
    """Impide que index.html cargue CSS/JS legacy o hotfixes acumulados."""
    html = exigir("index.html").read_text(encoding="utf-8")
    prohibidos = [
        "uix-consolidada",
        "flujo-canonico",
        "entidades-canonicas",
        "sesiones-canonicas",
        "hotfix",
        "base-datos-workspace",
        "js/modulos/",
        "js/ui/",
        "js/core/",
        "js/servicios/",
    ]
    encontrados = [p for p in prohibidos if p in html]
    if encontrados:
        raise AssertionError("index.html todavía referencia legacy: " + ", ".join(encontrados))


def validar_motores_obradorr30() -> None:
    """Comprueba que app.js contiene motores funcionales canónicos."""
    js = exigir("app.js").read_text(encoding="utf-8")
    obligatorios = [
        "calcularFactorEscala",
        "calcularPedidoConsolidadoSeleccion",
        "guardarFormularioLinea",
        "guardarFormularioPaso",
        "guardarFormularioAppcc",
        "validacionElaboracion",
        "documentoSeleccionCompleto",
        "renderFichaElaboracion",
        "renderFichaCocina",
        "renderFichaPanaderia",
        "renderFichaSubreceta",
        "pedidoConsolidadoSesion",
        "restaurarSnapshot",
        "CLAVES_SNAPSHOT",
        "v_formula_panadera_resumen",
        "v_pedido_base_expandido",
        "listarCiclos",
        "listarModulos",
        "fotosElaboracion",
        "fotoPrincipalElaboracion",
        "guardarFotoElaboracion",
        "marcarFotoPrincipal",
        "bloque-familia",
        "factor_hidrico",
        "es_harina_base",
        "aporta_hidratacion",
        "grupo_formula",
        "bloquesPanaderia",
        "tablaParametrosPanaderos",
        "tablaGrupoFormulaPanadera",
        "resumenSeleccionDocumento",
        "ventanaNuevaElaboracion",
        "ventanaNuevoIngrediente",
        "formularioElaboracion",
        "formularioIngrediente",
        "duplicarElaboracion",
        "INSERT INTO elaboraciones",
        "INSERT INTO ingredientes",
        "normalizarHarinaBasePanaderia",
        "SAVEPOINT migraciones_canonicas",
    ]
    faltantes = [nombre for nombre in obligatorios if nombre not in js]
    if faltantes:
        raise AssertionError("Faltan motores canónicos en app.js: " + ", ".join(faltantes))
    patron_peligroso = "SET es_harina_base=1\n    WHERE coalesce(es_harina_base,0)=0 AND lower(coalesce(rol_formula,'')='harina'"
    if patron_peligroso in js:
        raise AssertionError("Permanece la migración peligrosa que activa todas las harinas como base")


def validar_regla_cambios_serios() -> None:
    """Comprueba que la regla de cambios serios existe y cubre contrato, datos, UI, persistencia, documento y validación."""
    texto = exigir("REGLA_CAMBIOS_SERIOS.md").read_text(encoding="utf-8")
    obligatorios = ["Contrato", "Datos", "UI completa", "Persistencia real", "Documento afectado", "Validación", "Prueba de usuario"]
    faltantes = [item for item in obligatorios if item not in texto]
    if faltantes:
        raise AssertionError("REGLA_CAMBIOS_SERIOS.md incompleta: " + ", ".join(faltantes))


def main() -> int:
    """Ejecuta todas las comprobaciones y devuelve código de salida."""
    try:
        validar_archivos_minimos()
        validar_sqlite()
        validar_javascript()
        validar_sin_imports_legacy()
        validar_motores_obradorr30()
        validar_regla_cambios_serios()
    except Exception as exc:  # noqa: BLE001
        print("FALLA")
        print(exc)
        return 1
    print("PASA")
    print("ObradORR 3.4.1: arranque canónico corregido, harina base única, catálogo docente, SQLite íntegra y motor documental presentes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
