# ObradORR 1.0.0

**ObradORR** es una aplicación web offline para centralizar fichas técnicas de **cocina, pastelería y panadería** en Formación Profesional.

Permite buscar y editar elaboraciones, seleccionar una o varias fichas, escalar cantidades y generar documentación con distinto nivel de detalle: desde una ficha básica hasta un dossier con proceso, APPCC, alérgenos, costes, fotografías y subelaboraciones.

## Alcance de la versión 1.0.0

- Catálogo central de elaboraciones e ingredientes.
- Alta, edición, duplicación y archivo de fichas.
- Ingredientes y subelaboraciones enlazados.
- Escalado por raciones, rendimiento, piezas o parámetros panaderos.
- Fórmula panadera, hidratación y separación por grupos de fórmula.
- Pedido consolidado agrupado por familias de ingredientes.
- Dossier único para selecciones heterogéneas de cocina, pastelería y panadería.
- Impresión configurable de proceso, APPCC, alérgenos, costes y fotografías.
- Ciclos y módulos como contexto docente opcional.
- Persistencia local con SQLite, IndexedDB y tres snapshots rotatorios.
- Importación/restablecimiento de la base incluida en el paquete.

## Uso

La aplicación necesita un servidor HTTP local; no debe abrirse directamente mediante `file://`.

```bash
python3 -m http.server 8962 --bind 127.0.0.1
```

Después abre:

```text
http://127.0.0.1:8962/?v=obradorr_1_0_0
```

También puede publicarse en GitHub Pages desde la raíz de la rama `main`.

## Flujo principal

1. En **Sesiones**, busca y selecciona una o varias fichas.
2. Ajusta raciones, rendimiento, piezas o parámetros panaderos.
3. Revisa el pedido consolidado por familias.
4. Elige el tipo de documento y los bloques que deseas incluir.
5. Imprime sin guardar o guarda la sesión al final.
6. En **Base de datos**, crea, revisa o modifica elaboraciones e ingredientes.
7. En **Sistema**, revisa snapshots o restablece la base del paquete.

## Estado del catálogo

La versión 1.0.0 incluye un catálogo documental inicial con **99 elaboraciones activas**, **128 ingredientes activos** y **16 fichas panaderas**.

El software se publica como estable. Las fichas del catálogo se mantienen como `propuesta_documental` y con validación de obrador `pendiente`: deben revisarse y probarse antes de utilizarlas como material definitivo o evaluable.

## Privacidad y datos

- No hay telemetría ni servicios remotos.
- La aplicación trabaja en el navegador con SQLite/WASM.
- Los cambios se guardan en IndexedDB del dispositivo.
- La base pública incluida no contiene fotografías, prácticas guardadas, pedidos generados ni trabajos de impresión.
- Antes de borrar datos del navegador, conviene conservar una copia de la base.

## Estructura

```text
index.html
app.css
app.js
db/obradorr.sqlite
wasm/sql-wasm.js
wasm/sql-wasm.wasm
README.md
VERSION.txt
CHANGELOG.md
LICENSE.md
NOTICE.md
AVISO_LEGAL.md
```

## Autoría y uso

Autor: **Remo José Pereira González**.

Consulta `LICENSE.md`, `NOTICE.md` y `AVISO_LEGAL.md` antes de copiar, modificar, redistribuir o reutilizar el proyecto.
