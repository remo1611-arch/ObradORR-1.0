# Guía Termux Android v1.15.2

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_15_1_GITHUB_READY.zip

rm -rf ~/swiftremo_v1_15_1_test
mkdir -p ~/swiftremo_v1_15_1_test

unzip -q SwiftRemo_v1_15_1_GITHUB_READY.zip -d ~/swiftremo_v1_15_1_test
cd ~/swiftremo_v1_15_1_test/swiftremo_v1_15

python -m http.server 8796 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8796/app/sqlite.html?v=1152v152"
```
