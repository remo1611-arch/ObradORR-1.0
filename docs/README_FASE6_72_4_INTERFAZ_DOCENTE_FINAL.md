# Fase 6.72.4 · Interfaz docente final por dominios

Versión final de la refactorización pública de interfaz docente por dominios.

## Dominios visibles

- Taller: práctica activa, pedido, salida documental y cierre.
- Histórico: prácticas cerradas o reutilizables.
- Archivo técnico: elaboraciones, ingredientes, panadería, cocina/pastelería y revisión.
- Sistema: copias SQLite, importación/exportación y recuperación.

## Criterio técnico

Se mantiene el motor estable y se encapsula tras shell, estado y adaptadores de dominio. La interfaz pública deja de organizarse por pestañas legacy y pasa a organizarse por tareas docentes.

## Límite honesto

El motor conserva funciones heredadas estabilizadas porque no conviene reescribir cálculo, contratos, recursividad, persistencia ni print-service. La refactorización cerrada afecta a la capa pública de interfaz y navegación.
