# SwiftRemo v1.10 · Sistema, carpeta vinculada y Android

## Intervención

- Se mantiene la interfaz compacta de Sistema: acciones principales visibles y diagnóstico técnico plegado.
- Se corrige el guardado manual en carpeta para solicitar permiso de escritura cuando el navegador lo requiere.
- Se evita que Android se presente como fallo funcional: la carpeta vinculada queda tratada como modo no fiable y se recomienda descarga manual + snapshot interno.
- Se desactivan acciones de carpeta cuando la plataforma no es compatible o está en modo Android limitado.

## Criterio técnico

La vinculación persistente de carpetas mediante File System Access API es una función razonable en Chrome/Edge de escritorio. En Android no se debe considerar una garantía operativa para una app docente local, por permisos, sandbox y diferencias entre navegadores.

## Resultado esperado

- Windows/Chrome o Edge: vincular carpeta, comprobar/conceder permiso y crear copias externas.
- Android: usar “Descargar copia de trabajo” y recuperación desde archivo. La pestaña Sistema no debe alarmar por ausencia de carpeta vinculada.
