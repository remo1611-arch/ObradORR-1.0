# SwiftRemo SQL v1.3 · módulos bajo demanda con precarga segura

## Objetivo

Reducir la sensación de espera al entrar en pantallas pesadas sin volver a cargar todos los módulos al inicio.

## Cambios

- Se mantiene la carga bajo demanda de Panadería, Prefermentos, Extras, Cocina/Pastelería e Histórico.
- Se añade precarga anticipada al pasar el puntero o enfocar accesos a rutas pesadas.
- Se añade diagnóstico visible en Sistema → Datos y seguridad.
- No se cambia SQLite, esquema de datos, persistencia ni snapshots.

## Criterio técnico

La v1.1 reducía carga inicial, pero el primer clic en una pantalla pesada podía tener una espera perceptible. La v1.3 conserva el arranque ligero y traslada parte de esa espera al gesto previo del usuario, de forma silenciosa y reversible.

## Límites

No se ha reintentado lazy DOM por templates. Esa línea queda aplazada hasta una futura limpieza real de selectores legacy.
