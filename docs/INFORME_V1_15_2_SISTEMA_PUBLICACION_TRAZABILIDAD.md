# SwiftRemo v1.15.2 · Sistema, publicación y trazabilidad clarificados

## Cambios

- Actualizado cache busting activo a `1152v152` en HTML e imports JS internos.
- Añadido semáforo de publicación en Sistema para detectar fuentes privadas, fotos BLOB, histórico, impresiones y práctica activa antes de subir a GitHub.
- Renombrado el bloque de material privado como **Material local privado y trazabilidad**.
- Degradada la carga de fotos integrada a herramienta avanzada; se documenta que la gestión ordinaria debe pasar a la ficha concreta en Archivo técnico en una iteración posterior.
- Renombrada la tabla de fuentes con terminología más clara: Fuente, ID técnico, Tipo, Elementos y Fotos.
- Añadida descarga de informe JSON de publicación desde Sistema.

## Pendiente no bloqueante

- Mover la acción normal de añadir/sustituir/eliminar fotos a la ficha concreta en Archivo técnico.
- Separar en módulos `system-panel.js`, `private-material.js`, `media-manager.js` y `source-audit.js`.
- Añadir campos `display_name`, `source_name`, `normalized_name` y `review_status` en una migración probada.

## Validación

- `node --check` correcto en todos los JS.
- Imports JS relativos: 0 rutas rotas.
- SQLite `PRAGMA integrity_check`: ok.
- Base pública sin fuentes privadas, sin fotos BLOB, sin sesiones, sin impresiones y sin práctica activa.
