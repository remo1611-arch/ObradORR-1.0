# Guía Windows · SwiftRemo v1.10

```powershell
$zip = "$env:USERPROFILE\Downloads\SwiftRemo_v1_8_ANDROID_CARPETA_ESCRITORIO.zip"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_8"

Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

cd "$dest\swiftremo_v1_8"
python -m http.server 8768
```

Abrir:

```text
http://127.0.0.1:8768/app/sqlite.html?v=1120v112
```
