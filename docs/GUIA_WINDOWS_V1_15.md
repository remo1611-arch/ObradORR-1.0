# Guía Windows v1.15.2

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_15_1_GITHUB_READY.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_15_1"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_15"
python -m http.server 8796
```

Abrir:

```text
http://127.0.0.1:8796/app/sqlite.html?v=1152v152
```
