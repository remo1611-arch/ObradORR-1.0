# Fase 6.71 · Shell docente limpio

Intervención parcial sobre la capa de uso. No se reescribe el motor de datos ni la base SQLite.

## Objetivo

Convertir SwiftRemo en una app de flujo docente más real: una acción principal por pantalla, botones condicionados por estado y separación clara entre práctica, pedido, salida y datos.

## Cambios aplicados

- Navegación reordenada: Inicio · Práctica · Pedido · Salida · Biblioteca · Datos · Calidad.
- Inicio simplificado como panel de continuidad, no como lista de funciones equivalentes.
- Práctica pasa a ser el centro operativo.
- Pedido y Salida quedan bloqueados si la práctica está vacía.
- Acciones de Práctica se generan dinámicamente según estado:
  - sin elaboraciones: Añadir elaboración / Biblioteca avanzada;
  - con elaboraciones: Revisar pedido / Preparar salida / Archivar como sesión / Vaciar.
- Pedido deja de mostrar botones de impresión directa; deriva a Salida.
- Salida queda como centro único de impresión documental.
- Datos concentra copia SQLite, importación, restauración y JSON técnico.
- Historial de impresión vacío se oculta para reducir ruido visual.
- Se mantiene la función `getWorkflowStateV6704()` como fuente única de estado, ampliada por `renderShellActionsV671()`.

## Sin cambios deliberados

- Sin cambios de esquema SQL.
- Sin cambios de recetas, ingredientes, formulaciones, costes ni cálculos.
- Sin cambios en el servicio de impresión, salvo reubicación de llamadas desde interfaz.
