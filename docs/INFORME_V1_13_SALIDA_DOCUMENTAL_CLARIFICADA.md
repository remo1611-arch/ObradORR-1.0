# SwiftRemo SQL v1.14 · Correcciones PDF real de impresión

Cache: `1140v114`

## Objetivo

Aplicar la auditoría de impresiones sobre v1.12 sin reescribir el motor de impresión: clarificar perfiles, hacer visible el pedido limpio y separar las salidas técnicas del uso diario de aula.

## Cambios aplicados

- El panel **Salida · imprimir y exportar** muestra ahora tres acciones principales:
  - **Fichas + pedido limpio**: salida diaria de aula, elaboraciones resumidas y pedido limpio por familias.
  - **Fichas docentes**: fichas completas con coste, alérgenos y proceso.
  - **Pedido limpio**: listado de compra sin proveedor, coste ni origen de uso.
- Las salidas técnicas pasan a segundo nivel:
  - **Dossier técnico**: fichas docentes completas + pedido técnico.
  - **Pedido técnico**: proveedor, zona, coste y usado en.
- El diálogo queda como **Personalizar salida**, orientado a ajustar documento, subelaboraciones y proceso, no como repetición del panel principal.
- Eliminados los botones ocultos de compatibilidad de impresión que mantenían IDs duplicados y ruido de mantenimiento.
- Reducidos los selectores de habilitación/deshabilitación a los botones reales visibles.
- Ajustes de impresión A4:
  - margen `@page` a 12 mm;
  - documento máximo 186 mm;
  - fuente de impresión base a 10 px;
  - tabla técnica con más ancho para ingrediente y menos para grupo/usado en.
- Añadida limpieza defensiva de sesiones temporales `TMP_SELECTION_%` al arranque.

## Límites no abordados

- No se ha extraído todavía `print-profiles.js` ni `print-panel.js`.
- No se ha cambiado el historial para diferenciar `preview` y `printed`.
- No se ha eliminado el chunking manual del pedido técnico.

## Validación técnica

- `node --check` correcto en todos los JS.
- Importaciones internas revisadas: 0 rutas rotas.
- Servidor local probado con respuesta `200` para `app/sqlite.html`, `app/js/app.js`, `app/js/print.js`, `app/js/swiftremo-ui.css` y `db/swiftremo.sqlite`.
