# SwiftRemo SQL · Fase 6.72.5

## Paquetes privados y fotos BLOB

Esta versión añade infraestructura para trabajar con bases privadas locales sin publicar su contenido en GitHub.

### Cambios principales

- La semilla pública `db/swiftremo.sqlite` incorpora tablas vacías para trazabilidad de fuentes privadas y medios BLOB.
- Nueva zona en **Sistema → Datos y copias → Bases y paquetes privados**.
- Importación por fusión de paquetes privados `.sqlite`, sin sustituir la base de trabajo.
- Fuente por defecto preparada: `Carlos González Sanmartín` con ID técnico `carlos_gonzalez_sanmartin`.
- Integración de fotos como BLOB optimizado en la base local.
- La primera foto vinculada a una ficha queda como principal; las siguientes como galería.
- Las fichas impresas pueden recuperar la foto BLOB principal bajo demanda.
- La exportación JSON técnica omite el campo binario `media_assets.data` para evitar volcados masivos.
- `.gitignore` protege rutas y nombres habituales de datos privados.

### Regla de seguridad

`db/swiftremo.sqlite` sigue siendo la base pública común. Las fichas y fotos privadas deben vivir solo en copias locales descargadas o paquetes `.sqlite` privados.

### Tablas nuevas

- `data_sources`
- `entity_sources`
- `media_assets`
- `recipe_media`
- `v_recipe_media_primary`

### Limitaciones conocidas

La importación privada fusiona tablas compatibles y no sobrescribe filas existentes. Si un paquete externo usa IDs o nombres que chocan con la base activa, puede omitir filas o rechazar la fusión si quedan referencias incoherentes.
