# SwiftRemo SQL v1.12 · Auditoría de estados aplicada

Fecha: 2026-06-01
Cache: 1120v112

## Alcance

Intervención sobre v1.11 centrada en los bloqueadores y mejoras de bajo riesgo detectados en la auditoría por estados de Sistema → Datos y seguridad.

## Cambios aplicados

1. Corrección del ciclo de error de autosave:
   - `hasPendingSave` se resetea a `false` en fallos de autosave.
   - `practiceContextSaveTimer` también se limpia en el `catch` del guardado diferido.
   - `beforeunload` prioriza el mensaje de error real sobre el de guardado pendiente.

2. Recuperación/reinicio más seguro:
   - Confirmación explícita antes de cargar una copia `.sqlite` que sustituye el trabajo actual.
   - Confirmación reforzada antes de reiniciar con base pública.

3. Banner de protección clarificado:
   - Estado neutro cambia a “Copia local activa”.
   - Si el navegador soporta carpeta vinculada y no hay carpeta activa, ofrece “Activar carpeta”.
   - Si hay cambios sin copia externa y no hay carpeta vinculada, ofrece descarga y activación de carpeta cuando es posible.
   - En Android con escritura confirmada reciente se usa tono correcto, no alarma permanente.

4. Indicador de guardado:
   - El guardado automático muestra “Guardado en navegador” para no confundir IndexedDB con copia externa.

5. Segundo plano:
   - En `visibilitychange: hidden`, si hay cambios sin copia externa y carpeta vinculada, intenta una escritura externa oportunista sin solicitar diálogo.
   - Si Android no puede escribir en ese momento, mantiene el aviso al volver a visible.

6. Material privado:
   - Se elimina el badge numérico que lo hacía parecer un paso obligatorio.
   - Se degrada visualmente como bloque secundario avanzado.
   - Texto aclarado: solo para material externo autorizado.

## Validación técnica

- `node --check` correcto en todos los módulos JS.
- Revisión de imports JS: 0 rutas rotas.
- Servidor local probado con HTTP 200 en:
  - `app/sqlite.html?v=1120v112`
  - `app/js/app.js?v=1120v112`
  - `app/js/storage-service.js?v=1120v112`
  - `app/js/swiftremo-ui.css?v=1120v112`
  - `db/swiftremo.sqlite`

## Pendiente no abordado en esta versión

- Refactor estructural a `folder-state.js` y `system-panel.js`.
- Modal propio para recuperación/reinicio en sustitución de `confirm()`.
- Indicador relativo tipo “última copia externa hace X minutos”.
