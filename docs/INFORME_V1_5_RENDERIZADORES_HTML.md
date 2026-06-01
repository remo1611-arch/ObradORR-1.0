# SwiftRemo SQL v1.5 · Renderizadores HTML pequeños

Intervención conservadora sobre v1.4.

## Objetivo

Extraer renderizadores HTML pequeños y puros desde `app.js` sin tocar datos, SQLite, persistencia ni flujos de edición.

## Cambios

- Nuevo módulo `app/js/app-renderers.js`.
- Extraídos renderizadores de KPIs, resúmenes, tarjetas de elaboraciones, tarjetas de ingredientes e indicaciones de rango.
- `app.js` conserva coordinación, estado y flujos funcionales.
- Query string actualizado a `150v15`.

## No incluido

- No se modifica `db/swiftremo.sqlite`.
- No se modifica persistencia.
- No se migra lazy DOM.
- No se cambian repositorios ni consultas SQL.
