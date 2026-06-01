# SwiftRemo v1.0 RC13 · OPFS/Worker evaluación

## Decisión

No se migra SwiftRemo SQL automáticamente a SQLite OPFS/Worker en esta fase.

La recomendación técnica para la v1.0 final es mantener el modelo actual:

- `db/swiftremo.sqlite` como base pública distribuible;
- SQLite WASM en memoria;
- snapshots IndexedDB solo cuando hay cambios reales;
- exportación `.sqlite` como copia de trabajo principal;
- auditoría completa bajo demanda.

## Justificación

1. La carga percibida en fases anteriores se corrigió principalmente reduciendo render global, paginando consultas y evitando snapshots iniciales pesados. No hay evidencia suficiente de que el cuello de botella restante exija OPFS.
2. OPFS/Worker obligaría a introducir una fachada asíncrona para operaciones que ahora son síncronas (`repo.*`, `swiftDb.query`, `swiftDb.exec`, `swiftDb.exportBytes`).
3. El uso local con `python -m http.server` no aporta por defecto cabeceras COOP/COEP. Algunas rutas de SQLite WASM/OPFS funcionan mejor o requieren aislamiento según VFS y configuración.
4. El valor principal de la app es docente, portable y fácil de probar en Windows/Termux. Una migración prematura subiría complejidad y riesgo de regresión.

## Qué se añade en RC13

- Panel de evaluación en `Sistema → Datos y seguridad`.
- Detección de capacidades del navegador:
  - OPFS (`navigator.storage.getDirectory`);
  - Worker;
  - `SharedArrayBuffer`;
  - `crossOriginIsolated`;
  - contexto seguro/local.
- Inclusión de la evaluación OPFS/Worker en el diagnóstico técnico ligero.
- No se modifica el motor de base de datos ni la persistencia.

## Criterio para una rama futura OPFS/Worker

Solo compensaría abrir una rama `RC14_OPFS_PROTOTIPO` si se cumplen estas condiciones:

- mediciones reales muestran bloqueos de UI por consultas o exportaciones, no por DOM/renderizado;
- se acepta servidor local con cabeceras específicas o empaquetado propio;
- se implementa una capa `DbClient` asíncrona para no acoplar UI a `postMessage`;
- se mantiene import/export `.sqlite` para portabilidad docente;
- se conserva fallback a WASM en memoria.

## Riesgos si se migra ahora

- Rotura de llamadas síncronas existentes.
- Mayor complejidad para Windows/Termux.
- Dificultad para depurar copias locales.
- Posibles diferencias entre navegadores.
- Riesgo de retrasar la v1.0 final sin ganancia proporcional.
