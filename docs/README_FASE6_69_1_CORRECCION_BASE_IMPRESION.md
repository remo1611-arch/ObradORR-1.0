# Fase 6.69.1 · Corrección de base de impresión técnica

Corrección no superficial de la salida impresa: se ha actuado en la base de datos y en el módulo real de impresión.

## Cambios de base

- Vista `v_ingredients_allergens` reconstruida con salida canónica, distinta y ordenada.
- Eliminadas duplicidades de alérgenos cuando convivían declaraciones genéricas y específicas de gluten.
- Canonización de etiquetas heredadas: `Gluten (trigo)`, `Soja`, `Frutos de cáscara`.
- Ajuste de método directo panadero para formulaciones sin prefermento.
- Normalización visible de levadura fresca heredada.

## Cambios de impresión

- Nuevo módulo `app/js/print-service-v6-2.js` para evitar caché heredada del navegador.
- Las fichas culinarias imprimen cantidad y unidad como columnas separadas desde la línea técnica.
- Alérgenos normalizados en el render final antes de imprimir.
- Fichas panaderas de método directo muestran `Método directo · sin prefermento`.

## Alcance excluido

No se ha modificado cálculo, persistencia, pedido interno, fichas docentes ni modelo de guardado local.
