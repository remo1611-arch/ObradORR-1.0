# Guía Windows · SwiftRemo SQL v1.0 FINAL

```powershell
$zip = Get-ChildItem -Path "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
  -Filter "SwiftRemo_v1_0_FINAL*.zip" `
  -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$dest = Join-Path $env:USERPROFILE "Desktop\SwiftRemo_v1_0_FINAL"

if (Test-Path $dest) {
  Remove-Item $dest -Recurse -Force
}

New-Item -ItemType Directory -Path $dest | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force
Set-Location (Join-Path $dest "swiftremo_v1_0_final")

python -m http.server 8029
```

Abrir:

```text
http://127.0.0.1:8029/app/sqlite.html?v=130v13
```
