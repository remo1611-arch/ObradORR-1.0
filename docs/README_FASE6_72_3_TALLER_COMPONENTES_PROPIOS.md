# Fase 6.72.3 · Taller con componentes propios

Versión pública con Taller implementado mediante componentes propios de UI, manteniendo el motor estable.

## Componentes añadidos

- `app/js/ui/workshop-view.js`
- `app/js/ui/workshop-components.js`
- `app/js/ui/workshop-actions.js`

## Alcance

El dominio Taller renderiza estado, acciones, bloqueo de pedido/salida y mensajes de flujo desde componentes específicos, sin depender de que las antiguas pestañas sean navegación principal.

No modifica cálculo, impresión, SQLite, persistencia ni base docente.
