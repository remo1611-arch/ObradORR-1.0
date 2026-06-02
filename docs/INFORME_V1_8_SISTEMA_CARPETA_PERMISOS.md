# SwiftRemo v1.10 · Sistema compactado y permisos de carpeta

## Cambios aplicados

- Reorganizada la pestaña **Sistema → Datos y seguridad** como centro operativo:
  - Guardar trabajo.
  - Carpeta vinculada.
  - Recuperar o reiniciar.
  - Material privado local plegado.
  - Diagnóstico técnico plegado.
- Corregida la escritura manual en carpeta vinculada: las acciones de usuario solicitan permiso `readwrite` cuando el navegador devuelve estado `prompt`.
- La comprobación de permiso limpia incidencias antiguas cuando la carpeta vuelve a estar disponible.
- Se conserva el snapshot interno IndexedDB como recuperación rápida y la carpeta vinculada como capa externa.

## Lógica de copias externas

- `SwiftRemo_trabajo_actual.sqlite`: copia de trabajo sobrescrita.
- `copias_trabajo/swiftremo_trabajo_YYYYMMDD_HHMMSSZ.sqlite`: archivo histórico de trabajo.
- `copias_seguridad/swiftremo_backup_YYYYMMDD_HHMMSSZ_motivo.sqlite`: copias de seguridad en acciones críticas.

## Límite técnico

La API de carpetas depende del navegador. En Chrome/Edge puede pedir permiso de escritura tras recargar o cambiar de sesión. Las acciones manuales de v1.8 ya solicitan ese permiso; los autosaves no fuerzan diálogos para no interrumpir el trabajo.
