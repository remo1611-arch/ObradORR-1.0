# Guía Windows · SwiftRemo SQL v1.3

```powershell
$zip = Get-ChildItem -Path "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
  -Filter "SwiftRemo_v1_1_MODULOS_BAJO_DEMANDA*.zip" `
  -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$dest = Join-Path $env:USERPROFILE "Desktop\SwiftRemo_v1_1_MODULOS_BAJO_DEMANDA"

if (Test-Path $dest) {
  Remove-Item $dest -Recurse -Force
}

New-Item -ItemType Directory -Path $dest | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force
Set-Location (Join-Path $dest "swiftremo_v1_2")

python -m http.server 8030
```

Abrir:

```text
http://127.0.0.1:8030/app/sqlite.html?v=130v13
```
