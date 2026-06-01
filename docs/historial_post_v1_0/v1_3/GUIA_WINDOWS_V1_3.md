# Guía Windows · SwiftRemo SQL v1.3

```powershell
$zip = Get-ChildItem -Path "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
  -Filter "SwiftRemo_v1_3_LIMPIEZA_APPJS*.zip" `
  -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$dest = Join-Path $env:USERPROFILE "Desktop\SwiftRemo_v1_3_LIMPIEZA_APPJS"

if (Test-Path $dest) {
  Remove-Item $dest -Recurse -Force
}

New-Item -ItemType Directory -Path $dest | Out-Null
Expand-Archive -Path $zip.FullName -DestinationPath $dest -Force
Set-Location (Join-Path $dest "swiftremo_v1_3")

python -m http.server 8032
```

Abrir:

```text
http://127.0.0.1:8032/app/sqlite.html?v=130v13
```
