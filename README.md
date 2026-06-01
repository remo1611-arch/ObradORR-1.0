# SwiftRemo v1.0 RC1

Aplicación docente para aula-taller de Cocina, Pastelería y Panadería: prácticas, fichas técnicas, formulación panadera, pedidos, impresión A4 y gestión local de datos SQLite.

## Estado de esta versión

**Versión pública:** `SwiftRemo v1.0 RC1 · Windows · Datos y copias · Paquetes privados BLOB`

Esta RC parte de `SwiftRemo_v2_SQL_FASE6_72_13_ESTADO_FIJO_PAGINACION.zip` y mantiene la arquitectura por dominios:

- **Taller:** práctica activa del día.
- **Histórico:** prácticas archivadas y documentación cerrada.
- **Archivo técnico:** verdad maestra de elaboraciones, ingredientes y formulación.
- **Sistema:** copias SQLite, importación/exportación, base inicial, paquetes privados y SQL técnico.

## Publicación en GitHub Pages

La carpeta del ZIP puede subirse directamente al repositorio público de GitHub Pages. Se incluyen:

- `index.html` como entrada raíz.
- `.nojekyll` para evitar tratamiento Jekyll.
- `app/sqlite.html` como aplicación principal.
- `db/swiftremo.sqlite` como base pública inicial.
- `app/wasm/index.mjs` y `app/wasm/sqlite3.wasm` como motor SQLite WASM.

La base pública incluida no contiene paquetes privados ni fotografías BLOB.

## Modelo de datos y copias

La app pública carga una base inicial común. Cada usuario trabaja con su propia base local en el navegador.

- La recuperación interna del navegador ayuda ante cierres accidentales.
- La copia **SQLite descargada** es el respaldo real para conservar, trasladar o revisar trabajo.
- Importar una copia `.sqlite` o `.db` sustituye la base local activa del navegador tras confirmación.
- Reiniciar con la base pública limpia elimina la base local activa tras confirmación.

## Paquetes privados y fotos BLOB

La RC mantiene soporte para paquetes privados SQLite y fotografías integradas como BLOB optimizado. Lo importado queda en el navegador local y en la copia privada descargada; no se incorpora a la base pública del repositorio.

Regla operativa: las copias privadas con datos de terceros o fotos BLOB no deben subirse a GitHub.

## Derechos y uso autorizado

SwiftRemo, su código, base docente, fichas, datos, estructura y documentación asociada son propiedad de **Remo José Pereira González**, salvo elementos de terceros expresamente identificados.

No se concede licencia abierta de reutilización, redistribución, publicación de versiones derivadas ni explotación comercial. Se permite el uso docente personal de la app publicada. Cualquier redistribución, adaptación pública, incorporación a otro producto, publicación de copias modificadas o uso comercial requiere autorización expresa y previa.

Consulta `NOTICE.md` y `AVISO_LEGAL.md`.
