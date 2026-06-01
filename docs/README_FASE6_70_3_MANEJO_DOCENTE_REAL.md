# Fase 6.70.3 · Manejo docente real

Intervención quirúrgica sobre el flujo de uso de SwiftRemo SQL. No modifica el modelo de datos ni la base SQLite; corrige manejo, estados vacíos y protección de acciones.

## Cambios funcionales

- Corrección del estado `practiceSearch`, que no estaba inicializado y podía romper el buscador rápido de la pestaña Práctica.
- Inicio reorganizado como flujo real de aula: Práctica → Pedido → Salida → Biblioteca avanzada → Datos.
- La Biblioteca deja de ser el primer paso obligatorio y queda como catálogo técnico avanzado.
- La pestaña Práctica muestra sugerencias activas aunque el campo de búsqueda esté vacío.
- Los estados vacíos de Práctica y Pedido dirigen al buscador de Práctica, no a Biblioteca como paso principal.
- El botón “Guardar práctica” pasa a “Archivar como sesión”, para diferenciarlo del guardado/exportación de la base.
- Los datos docentes quedan visibles en impresión por defecto, salvo que el usuario los desmarque.
- Las acciones de Pedido, Salida, impresión y archivo se desactivan cuando la práctica no contiene elaboraciones.
- Se añade protección defensiva en impresión y archivo para impedir salidas vacías.
- Se corrige el botón “Detalle” del buscador rápido para abrir Biblioteca con la elaboración seleccionada.
- Se elimina una llamada duplicada a `repo.deleteWorkSelectionItem` al quitar elaboraciones.

## Alcance no modificado

- No se cambia el esquema SQL.
- No se reescribe la arquitectura.
- No se altera la lógica de cálculo de cantidades, costes, escandallos ni pedidos.
- No se cambian datos culinarios, panaderos ni estructura SQL; solo se actualiza metadato de versión en `app_meta`.

## Validación técnica

- Comprobación sintáctica de todos los módulos JavaScript con `node --input-type=module --check`.
- Revisión textual de flujos Biblioteca-first residuales en Inicio/Práctica/Pedido.
- Actualización de cache tags a `?v=6703`.
