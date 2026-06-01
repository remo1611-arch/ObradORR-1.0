# Fase 6.72.10 · Corrección de sintaxis en app.js

Corrige una propiedad `onAfterNavigate` que quedó con dos instrucciones separadas por `;` fuera de bloque dentro de un literal de objeto.

Efecto del fallo previo: `Uncaught SyntaxError: Unexpected token ';'` al cargar `app/js/app.js`.

Validación realizada:
- comprobación sintáctica como módulo ES para todos los JS de `app/js`
- `PRAGMA integrity_check` de la base pública
- base pública sin datos privados ni BLOB de Carlos
