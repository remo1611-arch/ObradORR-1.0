# Fase 6.72.12 · SQLite deserializable redimensionable

Corrección técnica crítica: la base SQLite cargada desde `db/swiftremo.sqlite` se deserializa ahora con `SQLITE_DESERIALIZE_RESIZEABLE`, además de `SQLITE_DESERIALIZE_FREEONCLOSE`.

Motivo: al cargar la base pública con `sqlite3_deserialize()` usando `szBuf == szDb` y sin bandera redimensionable, SQLite no podía ampliar el buffer en memoria. Al importar paquetes privados con muchas fichas o fotos BLOB podía aparecer `SQLITE_FULL: database or disk is full`, aunque el dispositivo tuviera espacio.

La corrección permite que la base en memoria crezca durante importaciones privadas y guardados posteriores.

La base pública sigue sin incluir datos privados ni fotos BLOB.
