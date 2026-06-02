# SwiftRemo SQL v1.15.1

Aplicación docente local para cocina, pastelería y panadería con SQLite/WASM, base pública inicial, trabajo local en navegador, copias `.sqlite`, guardado en carpeta vinculada cuando el navegador lo permite, vista previa/imprimibles A4 y catálogo FP Galicia ampliado.

## Entrada recomendada

- GitHub Pages / servidor local: `app/sqlite.html?v=1150v115`
- Entrada raíz del repositorio: `index.html` redirige a la app con la misma etiqueta de caché.

## Contenido principal

- `app/`: interfaz HTML/JS/CSS.
- `app/wasm/`: motor SQLite WASM necesario para ejecutar la app.
- `db/swiftremo.sqlite`: base pública inicial.
- `docs/`: informes, guías y trazabilidad de versión.
- `assets/photos/`: carpeta preparada para fotografías públicas autorizadas.

## Uso local rápido

```bash
python -m http.server 8795
```

Abrir:

```text
http://127.0.0.1:8795/app/sqlite.html?v=1150v115
```

## Publicación y licencia

Este paquete está preparado para publicarse en GitHub Pages como herramienta docente de uso personal o de aula. La publicación del código y de la base no implica licencia abierta. Consulta `AVISO_LEGAL.md` y `NOTICE.md` antes de redistribuir, modificar, publicar versiones derivadas o integrar material externo.

© Remo José Pereira González. Uso docente personal autorizado. Sin licencia abierta de redistribución ni explotación comercial.
