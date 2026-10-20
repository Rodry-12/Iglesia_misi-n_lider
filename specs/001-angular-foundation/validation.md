# Validación 001

Fecha: 2026-10-19, America/Bogota. Estado: verificada para la base de desarrollo.

## Entorno y resultados

Node.js 20.19.0, npm 10.8.2. El lockfile contiene Angular Core 21.2.25, CLI 21.2.27, Vitest 4.0.18 y jsdom 28.1.0. Las dependencias declaradas coinciden con las del lockfile.

| Criterio | Evidencia | Resultado |
|---|---|---|
| AC-001 | `npm run build`; comprobación de lockfile; conservación de páginas HTML originales | Build de producción correcto, salida `frontend/dist/iglesia-web/browser`. Bundle inicial 237,04 kB, sin contar imágenes |
| AC-002 | `npm test` | 6 pruebas Angular correctas: cuatro rutas, menú y QR/proceso manual |
| AC-003 | Build y comparación SHA-256 de recursos originales con salida | 41 archivos idénticos, incluido `qr.png`; configuración SPA apunta al build existente |
| AC-004 | Lectura de JSON/JSONC con TypeScript y comprobación de perfil, URL, webRoot y preLaunchTask | Perfil Angular en 4200, tarea de inicio coherente y perfil original en 8080 preservado |
| AC-005 | Revisión de documentación y resolución de sus enlaces locales | 10 documentos de contexto/instrucciones revisados, sin enlaces locales rotos |
| AC-006 | `npm run test:sdd`, `npm run spec:check`, `npm run skills:check` | 3 pruebas SDD correctas; estructura/trazabilidad válidas; ambas skills con metadatos y referencias válidos |

`npm run format:check` también terminó correctamente. Los tests y el build requirieron ejecución fuera del sandbox porque la creación de procesos fue bloqueada con `spawn EPERM`.

## Incidencias resueltas

- npm falló con `edgesOut` al seleccionar dependencias de pruebas. También falló usando npm 10.9.4 temporalmente. Fijar las versiones de Vitest y jsdom permitió instalar normalmente con npm 10.8.2; no se cambió npm globalmente.
- Angular rechazó entradas de assets externas al workspace. Se incorporó `prepare-assets.mjs` para preparar copias generadas dentro de `frontend/public/assets/` antes de iniciar o compilar.
- Python no está instalado, por lo que no se pudo ejecutar el validador Python de la skill del sistema. `skills:check` valida el formato simple usado por estas dos skills, nombres, descripciones, enlaces y metadatos de interfaz; no se presenta como un parser YAML general.

## Límites y comprobaciones pendientes

- No se inició el servidor local: la solicitud de ejecución fue rechazada por el usuario. No se comprobó la respuesta HTTP en 4200 ni se abrió el perfil de VS Code o un navegador.
- Las pruebas usan TestBed/RouterTestingHarness y jsdom. No constituyen revisión visual, auditoría completa de accesibilidad ni pruebas E2E con navegador.
- No se hizo despliegue, emulación Firebase, prueba de entrega real de correo ni transacción bancaria. La validación del QR fue de integridad de archivos, no de destinatario.
- La spec 002, la paridad visual completa y los incrementos del roadmap continúan pendientes.
