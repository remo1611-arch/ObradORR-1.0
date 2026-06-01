# Fase 6.72.2 · Adaptadores de dominio y Taller real

Esta fase convierte el shell transicional en una implementación de dominios más real:

- navegación principal limitada a Taller, Histórico, Archivo técnico y Sistema;
- router de dominio con vistas internas;
- antiguas pantallas funcionales encapsuladas dentro de su dominio, no como pestañas principales;
- adaptadores `workshop`, `technical-archive`, `history` y `system-backup`;
- estado de aplicación centralizado para el shell;
- retirada de nombres de versión antiguos de la UI nueva (`V623`, `V670`, `V672`, etc.);
- motor de Histórico renombrado y encapsulado como `history-engine.js`.

No se modifica el motor de cálculo, SQLite, impresión, fichas, ingredientes ni fórmulas.

## Estado

Implementación real de shell y adaptadores, con motor heredado encapsulado. Quedan por fases posteriores la sustitución completa del motor de Histórico y editores técnicos.
