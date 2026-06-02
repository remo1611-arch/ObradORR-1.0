# Guía Termux · SwiftRemo v1.10

```bash
cd ~/storage/downloads
ls -lh SwiftRemo_v1_8_ANDROID_CARPETA_ESCRITORIO.zip

rm -rf ~/swiftremo_v1_8_test
mkdir -p ~/swiftremo_v1_8_test

unzip -q SwiftRemo_v1_8_ANDROID_CARPETA_ESCRITORIO.zip -d ~/swiftremo_v1_8_test
cd ~/swiftremo_v1_8_test/swiftremo_v1_8

python -m http.server 8768 --bind 127.0.0.1
```

Abrir:

```bash
termux-open-url "http://127.0.0.1:8768/app/sqlite.html?v=1120v112"
```

En Android la carpeta vinculada se considera modo limitado. Usa descarga manual de copia de trabajo.
