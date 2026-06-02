# Guía Termux Android v1.12

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_12_SISTEMA_GUARDADO_CLARIFICADO.zip

rm -rf ~/swiftremo_v1_12_test
mkdir -p ~/swiftremo_v1_12_test

unzip -q SwiftRemo_v1_12_SISTEMA_GUARDADO_CLARIFICADO.zip -d ~/swiftremo_v1_12_test
cd ~/swiftremo_v1_12_test/swiftremo_v1_12

python -m http.server 8781 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8781/app/sqlite.html?v=1120v112"
```
