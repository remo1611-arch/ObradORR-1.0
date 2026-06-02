# Guía Termux Android v1.14

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_14_CORRECCIONES_PDF_REAL_IMPRESION.zip

rm -rf ~/swiftremo_v1_14_test
mkdir -p ~/swiftremo_v1_14_test

unzip -q SwiftRemo_v1_14_CORRECCIONES_PDF_REAL_IMPRESION.zip -d ~/swiftremo_v1_14_test
cd ~/swiftremo_v1_14_test/swiftremo_v1_14

python -m http.server 8794 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8794/app/sqlite.html?v=1140v114"
```
