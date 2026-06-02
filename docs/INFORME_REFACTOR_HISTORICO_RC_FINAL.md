# Informe de refactorización · Histórico · RC final

## Objetivo

Se refactoriza la pestaña **Histórico** para situarla al mismo nivel de claridad que Taller, Archivo técnico y Sistema.

## Problema corregido

La versión anterior mezclaba en una sola pantalla: consulta de prácticas cerradas, sesión activa, alta manual de elaboraciones, pedido e impresión. El usuario que entraba en Histórico esperando consultar prácticas archivadas encontraba primero un flujo de edición complejo.

## Cambios aplicados

- La vista principal pasa a llamarse **Prácticas guardadas**.
- La consulta de sesiones archivadas queda en primer lugar.
- Se añaden KPI de sesiones, coste estimado y selección activa.
- Se incorporan tarjetas responsive de sesiones además de tabla técnica plegada.
- La edición manual de sesión queda separada en bloques plegados.
- Pedido histórico y salida documental quedan en columna secundaria.
- “Usar como nueva” permanece deshabilitado hasta implementar clonado real.
- Se preservan IDs y handlers existentes para no alterar la lógica de datos.

## Decisiones de alcance

No se cambia SQLite, repositorios, impresión ni estructura de rutas. La refactorización es de interfaz y flujo, con mínima ampliación de renderizado en `history.js` para tarjetas y KPI.

## Validación técnica

- `node --check` correcto en los JS.
- `PRAGMA integrity_check = ok`.
- Sin fotos ni fuentes privadas en la base pública.

## Validación manual recomendada

1. Entrar en Histórico y comprobar que la primera lectura es “Prácticas guardadas”.
2. Seleccionar una sesión guardada si existe.
3. Crear nueva sesión histórica y guardarla.
4. Añadir elaboración a la sesión.
5. Revisar elaboraciones, pedido histórico e impresión.
6. Confirmar que el Taller sigue siendo el flujo principal para preparar prácticas nuevas.
