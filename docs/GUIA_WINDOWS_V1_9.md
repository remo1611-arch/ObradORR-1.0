# Guía Windows · SwiftRemo v1.10

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_9_PERSISTENCIA_PROGRESIVA_PC_MOVIL.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_9"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_9"
python -m http.server 8769
```

Abrir:

```text
http://127.0.0.1:8769/app/sqlite.html?v=1120v112
```
