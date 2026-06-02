# Guía Windows · SwiftRemo SQL v1.8

## Arranque local recomendado
```powershell
cd "$env:USERPROFILE\Downloads\swiftremo_v1_6"
python -m http.server 8766
```

Abrir en el navegador:

```text
http://127.0.0.1:8766/app/sqlite.html?v=1120v112
```

## Probar carpeta vinculada
1. Entrar en Sistema → Gestionar datos.
2. Pulsar “Vincular carpeta”.
3. Elegir una carpeta local para copias de SwiftRemo.
4. Confirmar permiso de escritura.
5. Comprobar que aparecen:
   - `SwiftRemo_trabajo_actual.sqlite`
   - carpeta `copias_trabajo`
   - carpeta `copias_seguridad`

## Observación técnica
La carpeta vinculada no sustituye a IndexedDB. El snapshot interno sigue siendo la recuperación rápida; la carpeta vinculada añade salida externa verificable.
