# Fase 6.70.4 · Interfaz guiada por estado

Intervención centrada en manejo real de la app.

## Cambios principales

- Nueva función `getWorkflowStateV6704()` como fuente única del estado de flujo.
- Pedido y Salida quedan bloqueados cuando no hay elaboraciones en la práctica.
- Los botones finales o peligrosos se ocultan cuando no proceden: archivar sesión y vaciar práctica.
- Inicio, Práctica, Pedido y Salida muestran una tarjeta de estado con el siguiente paso.
- Las tarjetas de salida documental se desactivan visualmente si todavía no hay práctica imprimible.
- `switchTab()` protege el acceso accidental a Pedido/Salida sin elaboraciones.
- Confirmación de vaciado más explícita, indicando cuántas elaboraciones se perderán de la práctica actual.

## Límites

- No se modifica el esquema SQL.
- No se modifican recetas, ingredientes, fórmulas, costes ni lógica de cálculo.
- No se modifica el servicio de impresión, solo el acceso contextual a sus acciones.

## Cache

- Cache tag actualizado a `?v=6704`.
