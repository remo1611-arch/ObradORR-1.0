# SwiftRemo SQL v1.5 · extracción limitada de utilidades puras

## Objetivo

Reducir deuda técnica de `app.js` sin cambiar comportamiento funcional, datos, persistencia ni esquema SQLite.

## Cambios aplicados

- Añadido `app/js/app-utils.js`.
- Extraídas utilidades puras de `app.js`:
  - lectura normalizada de tamaño de página;
  - cálculo de ventana de paginación;
  - HTML de paginador;
  - fecha para nombres de archivo;
  - formato de fecha visible;
  - valor seguro de input;
  - badge HTML;
  - etiqueta de rol panadero;
  - `nullIfEmpty()`;
  - conversión numérica segura.
- `app.js` pasa de 3327 líneas en v1.3 a 3290 líneas en v1.5.
- Se mantiene la carga bajo demanda de módulos pesados introducida en v1.1/v1.2.

## No se ha tocado

- `db/swiftremo.sqlite`.
- Esquema SQL.
- Repositorios.
- Persistencia.
- Importación/exportación.
- Taller, histórico, impresión ni edición de fichas.

## Criterio técnico

La extracción se limita a funciones sin estado de aplicación. No se extraen todavía flujos con dependencias fuertes de `repo`, `state`, DOM activo o persistencia.
