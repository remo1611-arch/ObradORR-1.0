# Fase 6.72.0 · Auditoría y congelación de interfaz heredada

Objetivo: dejar de mover botones de forma incremental y fijar el mapa de sustitución de la UI.

## Mapa de equivalencias

| Interfaz heredada | Dominio nuevo | Regla |
|---|---|---|
| Práctica / Pedido / Salida | Taller | Trabajo vivo del día: seleccionar, ajustar, revisar pedido, imprimir y archivar. |
| Sesiones / clase | Histórico | Fotografías cerradas. No se editan: se clonan, imprimen o exportan. |
| Biblioteca / Elaboraciones / Ingredientes / Cocina / Panadería / Calidad | Archivo técnico | Verdad maestra y revisión técnica. Añadir al Taller no modifica la ficha maestra. |
| Datos / SQL | Sistema | Copias, importación/exportación, base inicial, recuperación y herramientas técnicas. |

## Regla de transición

El motor estable se conserva. La navegación principal deja de exponer las pestañas heredadas como áreas de primer nivel. Las secciones antiguas quedan como pantallas internas llamadas desde el shell hasta que se complete la sustitución por adaptadores.
