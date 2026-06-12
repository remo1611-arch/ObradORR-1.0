# Matriz de cobertura ObradORR 3.4.0

| Función | Estado |
|---|---:|
| Crear ingrediente | Implementado |
| Editar ingrediente | Implementado |
| Archivar/reactivar ingrediente | Implementado |
| Crear elaboración | Implementado |
| Editar elaboración | Implementado |
| Duplicar elaboración | Implementado |
| Archivar/reactivar elaboración | Implementado |
| Añadir líneas | Implementado |
| Añadir elaborados/subelaboraciones | Implementado |
| Añadir pasos de proceso | Implementado |
| Añadir APPCC | Implementado |
| Añadir fotos | Implementado |
| Selección rápida | Implementado |
| Escalado por raciones/rendimiento | Implementado |
| Escalado panadero | Implementado |
| Pedido consolidado por familias | Implementado |
| Dossier único | Implementado |
| Adaptadores cocina/panadería/subreceta | Implementado |
| Snapshots current/prev1/prev2 | Implementado |
| Regla de modificaciones serias | Implementado |
| Catálogo docente amplio | Pendiente de contenido, no de código |
| Auditoría A4 en papel | Pendiente de prueba real |


## Catálogo docente inicial 3.4.0

- Ingredientes activos: mínimo validado por `tools/validate_dev.py`.
- Elaboraciones activas: mínimo validado por `tools/validate_dev.py`.
- Panadería: fórmulas con grupos `prefermento`, `masa_final`, `acabado`, `inclusion` o `decoracion` cuando procede.
- Estado documental: propuesta_documental, pendiente de validación de obrador.
