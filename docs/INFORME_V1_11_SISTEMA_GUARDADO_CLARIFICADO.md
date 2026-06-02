# SwiftRemo v1.12 · Sistema y guardado clarificados

## Objetivo
Aplicar los cambios de alto impacto derivados de la revisión externa: clarificar la pestaña **Sistema → Datos y seguridad**, hacer visible el estado de protección y mejorar el flujo móvil/Android sin romper la arquitectura de persistencia.

## Cambios aplicados

- Banner superior de protección en Sistema:
  - copia externa actualizada;
  - copia descargada;
  - cambios protegidos solo en navegador;
  - incidencia de guardado automático.
- Bloque **Guardar trabajo** simplificado:
  - botón principal: descargar copia de trabajo;
  - diagnóstico ligero, auditoría completa y copia completa con material local pasan a “Más opciones”.
- Bloque **Guardado automático en carpeta** reorganizado:
  - estado dinámico visible;
  - botón contextual único: activar carpeta / conceder permiso / guardar ahora;
  - detalle técnico y opciones secundarias plegadas.
- Se elimina la “Regla rápida” final por redundante.
- “Estado técnico y diagnóstico” pasa a **Diagnóstico avanzado**.
- `visibilitychange` reforzado:
  - al pasar a segundo plano intenta consolidar guardado si hay cambios pendientes;
  - al volver en móvil muestra aviso visible si hay cambios sin copia externa reciente.

## Decisión técnica
No se ha extraído todavía `folder-state.js` ni `system-panel.js`. La refactorización modular queda como fase posterior para evitar mezclar rediseño UX con traslado estructural de código.

## Caché
Versión de recursos: `1120v112`.
