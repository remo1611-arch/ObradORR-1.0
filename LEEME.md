# ObradORR 3.4.1 — Corrección de arranque canónico

Versión de contenido sobre la base 3.3.0.

Incluye una base propuesta de cocina, pastelería y panadería para empezar a trabajar como catálogo documental vivo.

## Importante

Las fichas están en `propuesta_documental`. No están marcadas como validadas. Deben revisarse y probarse en obrador antes de uso evaluable o publicación como material definitivo.

## Uso prioritario

1. Buscar elaboraciones.
2. Seleccionar una o varias fichas.
3. Escalar por raciones, rendimiento o parámetros panaderos.
4. Imprimir básico/técnico/completo.
5. Corregir la ficha desde Base de datos si procede.


## Corrección 3.4.1

Se corrige la migración de arranque para garantizar una única harina base por elaboración panadera. La migración es transaccional e idempotente, y el editor desmarca la harina base anterior antes de asignar una nueva.
