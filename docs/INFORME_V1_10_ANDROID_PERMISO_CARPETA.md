# SwiftRemo v1.10 · Android, carpeta vinculada y permiso recuperable

## Objetivo
Corregir el caso observado en Android con vista de escritorio: la carpeta quedaba vinculada, pero la primera escritura requería pulsar después “Comprobar / conceder permiso”.

## Cambios técnicos
- `Vincular carpeta` ahora ejecuta el flujo completo: selección de carpeta, petición de permiso, estabilización del permiso y primera escritura real.
- Añadido reintento controlado cuando Android devuelve errores transitorios de estado/permiso del handle.
- En Android, los estados `prompt` o `error` de una carpeta ya vinculada se presentan como permiso recuperable al guardar, no como fallo definitivo.
- El botón de comprobación pasa a funcionar como `Reactivar permiso`.
- Se mantienen snapshot interno, descarga manual y aviso de salida si hay cambios sin copia externa reciente.

## Límite conocido
Android puede retirar el permiso entre sesiones o tras cambios del sistema de archivos. SwiftRemo conserva la carpeta y solicita el permiso de nuevo al guardar, pero no puede impedir que el navegador revoque el permiso.
