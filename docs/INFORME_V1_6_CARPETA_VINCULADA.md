# SwiftRemo SQL v1.10 · Carpeta vinculada y copias automáticas

## Objetivo
Añadir una capa externa opcional de seguridad para que el trabajo no dependa solo de IndexedDB ni de descargas manuales del navegador.

## Implementación
- Nueva vinculación explícita de carpeta desde Sistema → Datos y seguridad.
- Persistencia del `FileSystemDirectoryHandle` en IndexedDB cuando el navegador lo permite.
- Comprobación de permiso de escritura antes de guardar.
- Desvinculación segura sin borrar las copias ya creadas.
- Guardado externo integrado con el autosave existente.

## Estructura creada en la carpeta vinculada
- `SwiftRemo_trabajo_actual.sqlite`: copia de trabajo siempre sobrescrita con el último estado guardado.
- `copias_trabajo/swiftremo_trabajo_YYYYMMDD_HHMMSSZ.sqlite`: copias fechadas de trabajo, limitadas por intervalo mínimo de 15 minutos salvo guardado manual.
- `copias_seguridad/swiftremo_backup_YYYYMMDD_HHMMSSZ_motivo.sqlite`: copias de seguridad fechadas en importaciones, material privado o acciones críticas.

## Compatibilidad
Funciona en navegadores compatibles con File System Access API, especialmente Chrome/Edge sobre `localhost` o HTTPS. En navegadores no compatibles, SwiftRemo mantiene el snapshot interno y las descargas manuales.

## Validación realizada
- Revisión de sintaxis con `node --check` en todos los módulos JS.
- Comprobación de rutas servidas por `python -m http.server` para HTML, JS, SQLite y WASM.
- No se elimina ni sustituye el snapshot interno del navegador.
