# SwiftRemo SQL · Fase 6.72.10

Corrección puntual de arranque: `app/js/app.js` tenía una función `onAfterNavigate` generada en una sola línea con `;` dentro de la propiedad del objeto, lo que provocaba `Uncaught SyntaxError: Unexpected token ';'` en navegador.

Cambios:
- `onAfterNavigate` pasa a bloque `{ ... }` válido.
- Se mantiene el modelo de paquetes privados BLOB.
- Cache-busting actualizado a `v=6730`.
- La base pública no incluye datos privados.
