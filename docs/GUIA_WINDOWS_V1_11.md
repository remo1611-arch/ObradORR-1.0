# Guía Windows v1.12

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_12_SISTEMA_GUARDADO_CLARIFICADO.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_12"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_12"
python -m http.server 8781
```

Abrir:

```text
http://127.0.0.1:8781/app/sqlite.html?v=1120v112
```
