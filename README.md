# SwiftRemo v1.0 RC3

Aplicación docente para aula-taller de Cocina, Pastelería y Panadería: prácticas, fichas técnicas, formulación panadera, pedidos, impresión A4 y gestión local de datos SQLite.

## Estado de esta versión

**Versión pública:** `SwiftRemo v1.0 RC3 · Sistema refundido · gestión de datos clara`

Esta RC aplica una refactorización completa de la pestaña **Sistema / Datos y copias** para que el flujo sea comprensible para un usuario no técnico.

Dominios funcionales:

- **Taller:** práctica activa del día.
- **Histórico:** prácticas archivadas y documentación cerrada.
- **Archivo técnico:** verdad maestra de elaboraciones, ingredientes y formulación.
- **Sistema:** datos, copias, recuperación, paquetes privados y SQL técnico.

## Cambios principales de RC3

- Pestaña Sistema refundida como pantalla de gestión de datos por intención de usuario.
- Sustitución de tarjetas ambiguas por acordeones nativos desplegables: guardar, recuperar, reiniciar y material privado local.
- Reducción del término SQLite en la interfaz visible; se mantiene solo como nota técnica de formato.
- Separación clara entre base pública y material privado local.
- Cache busting actualizado a `v=100rc3`.

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

- La copia **SQLite descargada** es el respaldo real para conservar, trasladar o revisar trabajo.
- Importar una copia `.sqlite` o `.db` sustituye la base local activa del navegador tras confirmación.
- Reiniciar con la base pública limpia elimina la base local activa tras confirmación.
- El JSON técnico es solo diagnóstico; no sustituye la copia SQLite.

## Material privado local y fotos integradas

La RC mantiene soporte para paquetes privados SQLite y fotografías integradas como BLOB optimizado. Lo importado queda en el navegador local y en la copia privada descargada; no se incorpora a la base pública del repositorio.

Regla operativa: las copias privadas con datos de terceros o fotos BLOB no deben subirse a GitHub.

## Derechos y uso autorizado

SwiftRemo, su código, base docente, fichas, datos, estructura y documentación asociada son propiedad de **Remo José Pereira González**, salvo elementos de terceros expresamente identificados.

No se concede licencia abierta de reutilización, redistribución, publicación de versiones derivadas ni explotación comercial. Se permite el uso docente personal de la app publicada. Cualquier redistribución, adaptación pública, incorporación a otro producto, publicación de copias modificadas o uso comercial requiere autorización expresa y previa.

Consulta `NOTICE.md` y `AVISO_LEGAL.md`.
