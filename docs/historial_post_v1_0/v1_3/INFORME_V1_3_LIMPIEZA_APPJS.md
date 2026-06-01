# Informe técnico · SwiftRemo SQL v1.3

## Objetivo

Reducir deuda técnica en `app.js` después del cierre v1.0 y las mejoras de carga bajo demanda v1.1/v1.2.

## Intervención aplicada

Se extraen dos bloques relativamente autónomos y seguros:

1. Diagnóstico técnico y medición:
   - `bootMark`, `bootStart`, `bootEnd`.
   - Renderizado del panel de métricas de arranque.
   - Evaluación OPFS/Worker.

2. Módulos bajo demanda:
   - Estado de módulos.
   - Precarga por foco/puntero.
   - Carga bajo demanda de Panadería, Prefermentos, Extras, Cocina/Pastelería e Histórico.

## Archivos nuevos

- `app/js/diagnostics.js`
- `app/js/feature-modules.js`

## Resultado

`app.js` pasa de 3514 líneas en v1.2 a 3327 líneas en v1.3, sin tocar flujos de edición, persistencia ni SQLite.

## Límites

No se ha reintentado lazy DOM por plantillas. Esa intervención requiere desacoplar selectores legacy antes de volver a reducir el HTML activo.
