# SwiftRemo SQL v1.3 · módulos bajo demanda

## Objetivo

Reducir trabajo inicial y evitar que Panadería, Prefermentos, Extras, Cocina/Pastelería e Histórico se inicialicen durante el arranque cuando el usuario no ha abierto esas rutas.

## Cambios

- Se retiran de `sqlite.html` las cargas iniciales de `bakery.js`, `preferments.js`, `extras.js`, `culinary.js` e `history.js`.
- `app.js` incorpora un cargador bajo demanda por ruta.
- Al entrar en `archive-bakery` se cargan Panadería, Prefermentos y Extras.
- Al entrar en `archive-culinary` se carga Cocina/Pastelería.
- Al entrar en Histórico se carga `history.js`.
- `combobox.js` se mantiene en carga inicial porque mejora el buscador y es ligero.
- No se modifica SQLite, esquema, persistencia ni datos.

## Límite

Esta versión no reintenta el lazy DOM por plantillas. La reducción se centra en módulos JS e inicialización diferida, que es menos arriesgada que retirar nodos HTML activos.
