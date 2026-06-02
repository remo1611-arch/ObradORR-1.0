# Guía Windows v1.13

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_13_SALIDA_DOCUMENTAL_CLARIFICADA.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_13"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_13"
python -m http.server 8793
```

Abrir:

```text
http://127.0.0.1:8793/app/sqlite.html?v=1140v114
```
