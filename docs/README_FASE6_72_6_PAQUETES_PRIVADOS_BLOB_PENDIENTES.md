# Fase 6.72.6 · Paquetes privados BLOB con vínculos pendientes

Esta versión mantiene la base pública limpia y permite importar paquetes privados SQLite con fotos BLOB.

## Cambio funcional

La importación privada ya no bloquea la fusión cuando un paquete trae `recipe_media` para fichas que aún no están en la base local. Esos vínculos quedan pendientes y se activan automáticamente cuando se importe una base de fichas con los mismos IDs.

## Uso recomendado

1. Publicar en GitHub solo esta aplicación y `db/swiftremo.sqlite`.
2. No subir paquetes privados.
3. Importar localmente el paquete privado de fotos o fichas.
4. Exportar una copia local enriquecida si se desea conservar el estado fusionado.

## Regla

- `db/swiftremo.sqlite`: público.
- `NO_SUBIR_GITHUB_*.sqlite`: privado local.
