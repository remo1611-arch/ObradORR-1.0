# Guía Termux Android · SwiftRemo v1.10

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_9_PERSISTENCIA_PROGRESIVA_PC_MOVIL.zip

rm -rf ~/swiftremo_v1_9_test
mkdir -p ~/swiftremo_v1_9_test

unzip -q SwiftRemo_v1_9_PERSISTENCIA_PROGRESIVA_PC_MOVIL.zip -d ~/swiftremo_v1_9_test
cd ~/swiftremo_v1_9_test/swiftremo_v1_9

python -m http.server 8769 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8769/app/sqlite.html?v=1120v112"
```
