# SwiftRemo SQL v1.0.0-rc.1

Aplicación docente local/offline para aula-taller de Cocina, Pastelería y Panadería.

## Uso rápido

1. Descomprime el ZIP.
2. Entra en la carpeta del proyecto.
3. Arranca un servidor local:

```bash
python -m http.server 8797 --bind 127.0.0.1
```

4. Abre:

```text
http://127.0.0.1:8797/app/sqlite.html?v=100rcfinal
```

También puedes abrir `Abrir_SwiftRemo.html` como lanzador local.

## Qué incluye

- App HTML/CSS/JavaScript local.
- SQLite WASM incluido en `app/wasm/`.
- Base pública incluida en `db/swiftremo.sqlite`.
- Taller de práctica activa.
- Histórico de prácticas cerradas.
- Archivo técnico de fichas, ingredientes y fórmulas.
- Sistema de copias, recuperación, diagnóstico y publicación.
- Exportación documental de fichas y dossiers.

## Privacidad y publicación

Este paquete está preparado como candidato público. La base incluida no contiene fotos, sesiones históricas, trabajos de impresión ni fuentes privadas según la auditoría de cierre.

## Licencia y aviso

Consulta `LICENSE.md`, `NOTICE.md` y `AVISO_LEGAL.md` antes de publicar o redistribuir.


## Ajuste final de Histórico

Histórico refactorizado: consulta de prácticas guardadas como entrada principal, tarjetas responsive de sesiones, edición manual plegada y salida documental separada.
