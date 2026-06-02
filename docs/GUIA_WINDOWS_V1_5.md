# Guía Windows · SwiftRemo v1.5

```powershell
$zip = Get-ChildItem -Path "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
  -Filter "SwiftRemo_v1_5_RENDERIZADORES_HTML*.zip" `
  -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$dest = Join-Path $env:USERPROFILE "Desktop\SwiftRemo_v1_5_RENDERIZADORES_HTML"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force
Set-Location (Join-Path $dest "swiftremo_v1_5")
python -m http.server 8034
```

Abrir: `http://127.0.0.1:8034/app/sqlite.html?v=1120v112`
