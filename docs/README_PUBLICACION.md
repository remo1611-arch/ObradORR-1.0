# SwiftRemo SQL v1.15.1 · publicación GitHub-ready

Versión revisada para publicación en GitHub Pages. Incluye las correcciones de impresión de v1.14, el catálogo FP Galicia ampliado de v1.15 y una revisión fina de metadatos/documentación para evitar enlaces de caché antiguos.

## Arranque local

```bash
python -m http.server 8795
```

Abrir:

```text
http://127.0.0.1:8795/app/sqlite.html?v=1150v115
```

## Comprobaciones realizadas para publicación

- Integridad SQLite correcta.
- `node --check` correcto en todos los módulos JS.
- Imports JS locales resueltos.
- `index.html` y `Abrir_SwiftRemo.html` apuntan a `?v=1150v115`.
- Base pública sin sesiones, impresiones, fotos BLOB ni fuentes privadas integradas.
- Archivos principales bajo límites prácticos de GitHub/GitHub Pages.

## Nota de datos

Si al abrir la app se recupera un snapshot antiguo desde IndexedDB, ir a **Sistema → Reiniciar con base pública** tras descargar una copia de trabajo si hay cambios locales.
