# Guía Termux Android v1.13

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_13_SALIDA_DOCUMENTAL_CLARIFICADA.zip

rm -rf ~/swiftremo_v1_13_test
mkdir -p ~/swiftremo_v1_13_test

unzip -q SwiftRemo_v1_13_SALIDA_DOCUMENTAL_CLARIFICADA.zip -d ~/swiftremo_v1_13_test
cd ~/swiftremo_v1_13_test/swiftremo_v1_13

python -m http.server 8793 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8793/app/sqlite.html?v=1140v114"
```
