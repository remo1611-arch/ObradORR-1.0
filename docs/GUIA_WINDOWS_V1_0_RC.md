# SwiftRemo v1.0 RC1 · Flujo de trabajo desde Windows

## 1. Preparar carpeta de trabajo

PowerShell:

```powershell
cd $env:USERPROFILE\Downloads
Expand-Archive -LiteralPath ".\SwiftRemo_v1_0_RC1_WINDOWS_DATOS_COPIAS.zip" -DestinationPath ".\SwiftRemo_v1_0_RC1" -Force
cd .\SwiftRemo_v1_0_RC1
```

CMD:

```bat
cd /d %USERPROFILE%\Downloads
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '.\SwiftRemo_v1_0_RC1_WINDOWS_DATOS_COPIAS.zip' -DestinationPath '.\SwiftRemo_v1_0_RC1' -Force"
cd /d %USERPROFILE%\Downloads\SwiftRemo_v1_0_RC1
```

## 2. Arrancar servidor local sin caché

PowerShell:

```powershell
$port = 8787
python -m http.server $port --bind 127.0.0.1
```

En otra ventana:

```powershell
Start-Process "http://127.0.0.1:8787/app/sqlite.html?v=100rc1"
```

CMD:

```bat
python -m http.server 8787 --bind 127.0.0.1
```

En otra ventana:

```bat
start http://127.0.0.1:8787/app/sqlite.html?v=100rc1
```

## 3. Validar estructura antes de publicar

PowerShell:

```powershell
Get-ChildItem -Recurse | Select-Object FullName,Length | Out-File .\validacion_estructura_windows.txt
Test-Path .\.nojekyll
Test-Path .\index.html
Test-Path .\app\sqlite.html
Test-Path .\db\swiftremo.sqlite
Test-Path .\app\wasm\sqlite3.wasm
```

CMD:

```bat
dir /s > validacion_estructura_windows.txt
if exist .nojekyll echo OK .nojekyll
if exist index.html echo OK index.html
if exist app\sqlite.html echo OK app\sqlite.html
if exist db\swiftremo.sqlite echo OK db\swiftremo.sqlite
if exist app\wasm\sqlite3.wasm echo OK sqlite3.wasm
```

## 4. Uso operativo recomendado

1. Abrir `Sistema > Datos y copias`.
2. Descargar una copia completa `.sqlite` antes de importar o reiniciar.
3. Importar copias de trabajo solo cuando se quiera sustituir la base local activa.
4. Importar paquetes privados solo desde `Paquetes privados y fotos BLOB`.
5. Descargar la copia privada local tras integrar paquetes o fotos.
6. No subir a GitHub copias privadas ni paquetes con datos de terceros.

## 5. Publicar en GitHub Pages

PowerShell desde la carpeta del repositorio:

```powershell
git status
git add .
git commit -m "SwiftRemo v1.0 RC1"
git push
```

Comprobar después:

```powershell
Start-Process "https://remo1611-arch.github.io/SwiftRemo/app/sqlite.html?v=100rc1"
```
