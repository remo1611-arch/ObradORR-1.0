# Regla de modificaciones serias — ObradORR

A partir de esta versión no se aceptan modificaciones como parches acumulativos si afectan al producto, al esquema, a la impresión o al flujo de uso.

## Regla obligatoria

Toda modificación debe cumplir estos siete puntos antes de considerarse aplicada:

1. **Contrato**: indicar qué necesidad de producto resuelve y qué queda fuera.
2. **Datos**: auditar si la SQLite lo soporta; si falta algo, crear migración no destructiva.
3. **UI completa**: si se puede editar algo, también debe poder crearse cuando proceda.
4. **Persistencia real**: todo cambio debe escribirse en SQLite y persistirse en IndexedDB con snapshots.
5. **Documento afectado**: si el cambio toca fichas, ingredientes, panadería, APPCC o sesiones, revisar su salida de impresión.
6. **Validación**: actualizar `tools/validate_dev.py` para impedir regresiones.
7. **Prueba de usuario**: definir una prueba corta que demuestre que el flujo completo funciona.

## Prohibiciones

- No añadir botones sin persistencia.
- No añadir campos en UI que no existan o no se guarden.
- No añadir tablas sin uso real en la app o en impresión.
- No declarar “completo” un flujo que solo permite editar pero no crear.
- No crear nuevas ramas para corregir síntomas si el fallo es de contrato.
- No romper la estructura mínima de archivos.

## Criterio de aceptación para ObradORR 1.0

El producto base debe permitir:

1. Crear ingredientes.
2. Crear elaboraciones.
3. Editar ingredientes y elaboraciones.
4. Añadir líneas, subelaboraciones, pasos, APPCC y fotos.
5. Seleccionar una o varias fichas.
6. Escalar por raciones, rendimiento o parámetros panaderos.
7. Generar pedido consolidado por familias.
8. Imprimir ficha básica, técnica o dossier completo.
9. Guardar sesión si interesa.
10. Restaurar snapshots.

Si una versión no cumple esto, no debe llamarse estable.
