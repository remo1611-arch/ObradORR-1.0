# Fase 6.69.2 · Pulido final de impresión panadera y pedido

Corrección de cierre sobre la fase 6.69.1, centrada en salida impresa y saneamiento visible de datos maestros.

## Cambios

- Se normaliza en la base el ingrediente `Levadura fresca saccharomyces` a `Levadura fresca prensada`.
- Se activa `app/js/print-service-v6-3.js` para evitar caché heredada del módulo de impresión anterior.
- Se evita imprimir un bloque vacío de `Acabados / terminación` en formulaciones panaderas cuando no hay ingredientes de acabado.
- El pedido técnico se divide en tablas de impresión: la primera no indica continuación; las siguientes sí.
- Se mantiene la columna `Unidad` en fichas culinarias y la vista canónica de alérgenos de 6.69.1.

## Alcance

No modifica cálculo, persistencia, fichas culinarias, ingredientes salvo la normalización de nombre de levadura, ni modelo de guardado local.
