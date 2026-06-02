# SwiftRemo SQL v1.14 · Correcciones PDF real de impresión

Cache: `1140v114`

## Motivo

La revisión sobre un PDF real generado desde v1.13 confirmó problemas que no se podían validar solo con auditoría estática: fecha doble sin etiqueta, nota interna de perfil impresa, aviso inexistente para líneas con cantidad/coste cero y página casi vacía por chunking manual del pedido técnico.

## Cambios aplicados

- La fecha de la práctica en cabeceras de portadas aparece como `Práctica: dd/mm/aaaa`.
- La fecha derecha de cabecera aparece como `Impreso: dd/mm/aaaa`.
- Eliminada del dossier técnico la nota interna: “Dossier completo: incluye fichas técnicas...” para que no pase al PDF.
- Añadido aviso en fichas culinarias cuando se detectan líneas con cantidad 0 o un volumen significativo de costes 0,00 €.
- Eliminado el chunking manual del pedido técnico. La tabla se imprime como una sola tabla y se confía en `thead { display: table-header-group }` para repetir cabeceras al paginar.
- Se mantiene el ajuste A4 de v1.13: margen 12 mm, anchura 186 mm, fuente imprimible 10 px y tabla técnica más legible.

## No modificado

- No se normalizan en código los nombres de elaboraciones en mayúsculas. Se considera problema de datos/importación.
- No se reestructura aún `print-profiles.js` ni `print-panel.js`; queda para fase posterior.
