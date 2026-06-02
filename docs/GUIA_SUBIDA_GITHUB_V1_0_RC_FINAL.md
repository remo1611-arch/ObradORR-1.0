# Guía de subida a GitHub · SwiftRemo SQL v1.0.0-rc.1

## Validar en PowerShell

```powershell
$zip = "$env:USERPROFILE\Desktop\SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC.zip"
$destParent = "$env:USERPROFILE\Desktop"
$dest = "$env:USERPROFILE\Desktop\SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC"

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $destParent -Force
Set-Location $dest

Get-ChildItem .\app\js -Filter *.js -Recurse | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "Error JS en $($_.FullName)" }
}

python -m http.server 8797 --bind 127.0.0.1
```

Abrir en otra ventana:

```powershell
Start-Process "http://127.0.0.1:8797/app/sqlite.html?v=100rcfinal"
```

## Validar en Termux

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC.zip
rm -rf ~/SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC
unzip -o SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC.zip -d ~/
cd ~/SwiftRemo_v1_0_0_RC_FINAL_GITHUB_PUBLIC

if command -v node >/dev/null 2>&1; then
  find app/js -name '*.js' -print0 | xargs -0 -n1 node --check
else
  echo "AVISO: node no está disponible."
fi

python -m http.server 8797 --bind 127.0.0.1
```

Abrir en otra sesión:

```bash
termux-open-url "http://127.0.0.1:8797/app/sqlite.html?v=100rcfinal"
```

## Subir a GitHub

```bash
git init
git branch -M main
git add .
git commit -m "Release SwiftRemo SQL v1.0.0-rc.1"

git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main

git tag -a v1.0.0-rc.1 -m "SwiftRemo SQL v1.0.0-rc.1"
git push origin v1.0.0-rc.1
```
