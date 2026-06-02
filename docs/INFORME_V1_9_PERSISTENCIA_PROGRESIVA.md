# SwiftRemo v1.10 · Persistencia progresiva PC/móvil

## Objetivo
Unificar la lógica de guardado para escritorio y móvil sin prometer una garantía que el navegador móvil no puede asegurar siempre.

## Cambios técnicos
- La carpeta vinculada ya no se desactiva por estar en móvil si `showDirectoryPicker` existe.
- Se clasifica el entorno en:
  - escritorio compatible;
  - móvil con compatibilidad parcial;
  - móvil sin selector de carpeta escribible;
  - navegador no compatible.
- Se humanizan errores de File System Access API para evitar mensajes crudos del navegador.
- Se añade estado de protección externa: cambios guardados solo en navegador, copia externa actualizada o descarga manual reciente.
- Se mantiene `beforeunload` condicionado para cambios pendientes de copia externa en móvil o carpeta vinculada.
- Se añade vigilancia `visibilitychange` como señal técnica complementaria, sin sustituir el snapshot interno.
- El selector masivo de material privado se carga de forma diferida solo cuando se abre el bloque correspondiente.

## Criterio de uso
- En PC con Chrome/Edge: carpeta vinculada como mecanismo recomendado para copias automáticas.
- En Android/móvil: se intenta la misma función, pero la app mantiene snapshot interno y recomienda descarga manual cuando detecta cambios no copiados fuera del navegador.

## Validación local
- `node --check` correcto en todos los módulos JS.
- Rutas principales servidas por HTTP local con respuesta 200.
