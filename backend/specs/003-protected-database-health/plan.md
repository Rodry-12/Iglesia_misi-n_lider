# Plan — 003 protected-database-health

## Diseño

Application define IDatabaseConnectivityProbe; Infrastructure implementa NpgsqlConnectivityProbe con DatabaseOptions existente y conexión/pool sin EF. API mapea endpoint mínimo, token desde Environment y rate limit nativo. No hay cambios UI ni tokens/componentes nuevos.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

WebApplicationFactory con credencial/sonda inyectadas, sin secretos reales ni DB remota; tests de timeout por cancelación real, CORS/rate/contrato y regresiones anónimas. Sonda Npgsql probada con conexión rechazada/servidor TCP detenido; consulta real solo con MLP_TEST_DATABASE de loopback y sufijo _tests, sin DDL. Ejecutar restore/build/test y spec:check, documentar omisiones y fallos previos.

Instrucción vigente: pruebas unitarias diferidas por el usuario. No crearlas, modificarlas ni ejecutarlas hasta que se retomen explícitamente. Registrar build, checks y revisión visual por separado; no afirmar cobertura unitaria.

## Riesgos y decisiones

Registrar los riesgos reales y las decisiones que necesitan contexto adicional.
