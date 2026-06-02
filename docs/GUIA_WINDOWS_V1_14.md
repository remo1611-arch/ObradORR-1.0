# Guía Windows v1.14

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_14_CORRECCIONES_PDF_REAL_IMPRESION.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_14"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_14"
python -m http.server 8794
```

Abrir:

```text
http://127.0.0.1:8794/app/sqlite.html?v=1140v114
```
