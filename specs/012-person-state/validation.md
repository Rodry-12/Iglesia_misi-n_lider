# Validación HU-004

Fecha: 2026-11-07. Entorno aislado, sin Supabase ni migraciones/bootstrap/090.

## Resultados

| Criterio | Pruebas y evidencia | Resultado |
| --- | --- | --- |
| AC-001 | PeopleStateTests.cs, nueve casos nuevos: integridad/estados, documento/sede de reactivación, permisos y ámbitos, cuentas/sesiones, asignaciones, concurrencia y dos tipos de rollback | 67 integraciones de regresión aprobadas |
| AC-002 | person-state-action.spec.ts (5), siete casos nuevos MembersStore; people-state.spec.ts (5 casos x 2 viewports) y regresión HU-001/002/003/auth/público | 101 unitarias Angular y 56 E2E controlados aprobados |
| AC-003 | PeopleBrowserFixtureTests ejecuta people-registration-real.spec.ts sin interceptar HTTP | Dos recorridos reales desktop/mobile: login, registro, edición, listado/ficha, baja confirmada, reactivación, consulta/listado y logout |

67 integraciones incluyen una fixture que lanza dos recorridos reales de navegador; esos recorridos no se contabilizan como integraciones adicionales. PostgresActivationTests se excluye porque ejecuta migraciones/bootstrap, prohibidos en esta HU. Cero casos omitidos o fallidos dentro de la selección final.

## Comandos y compilación

- dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore: correcto, cero errores/advertencias.
- npm run build: correcto; 491.77 kB inicial, bajo presupuesto.
- npm test -- --watch=false: 101/101, 14 archivos.
- npm run spec:check, npm run design:check, npm run format:check, npm run deps:check y npm run skills:check: correctos.
- Desde frontend: node node_modules/@playwright/test/cli.js test people-state.spec.ts people.spec.ts people-registration.spec.ts people-editing.spec.ts auth.spec.ts public-site.spec.ts: 56/56, 2.4 minutos.
- Revisión visual: frontend/artifacts/012-state-confirmation-desktop.png y 012-state-confirmation-mobile.png, datos sintéticos ignorados por Git. Se limita el ancho del diálogo y se conserva margen responsive mediante token de espaciado. Verificación específica posterior: node node_modules/@playwright/test/cli.js test people-state.spec.ts: 10/10, 53.6 segundos; no se suman como casos únicos adicionales a los 56.

## Ejecución .NET aislada

```powershell
$env:MLP_TEST_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_test_runtime_d09960275a58;SSL Mode=Disable'
$env:MLP_TEST_IDENTITY_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_identity_runtime;SSL Mode=Disable'
$env:MLP_TEST_OPERATOR_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=postgres;SSL Mode=Disable'
$env:MLP_TEST_PREPROVISIONED='1'
$env:MLP_RUN_PEOPLE_BROWSER='1'
& backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe start -D backend/.local/user-validation-20261106/data -o '-p 57693 -h 127.0.0.1' -l backend/.local/user-validation-20261106/state-verified.log -w
if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL did not start' }
try {
  dotnet test backend/MisionLiderParis.slnx --configuration Release --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger 'trx;LogFilePrefix=state-verified' --results-directory backend/artifacts/people-state
  $taskExit=$LASTEXITCODE
} finally {
  & backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe stop -D backend/.local/user-validation-20261106/data -m fast -w
}
if ($taskExit -ne 0) { throw 'Test failure' }
```

Resultado final: 58 unitarias .NET y 67 integraciones, cero errores/omitidos.
TRX bajo backend/artifacts/people-state:
- state-verified_net10.0_20261107131950.trx: 58 unitarias.
- state-verified_net10.0_20261107132100.trx: 67 integraciones.
Resumen real: backend/artifacts/people-registration/browser-registration-result.txt incluye deactivate/confirm/reactivate y desktop/mobile.

## Cobertura y observaciones

Reactivación: documento anterior no vigente, sin vinculación vigente y sede inactiva producen 409; reparar únicamente las filas sintéticas de fixture permite 204. No se regulariza información real.

Desactivación: conserva UUID/documento/sede/datos y procesos finalizados; bloquea pendientes como participante y responsable. AssignmentService rechaza asignación a inactivo, responsabilidad de inactivo y cambio hacia responsable inactivo. Competencia con nueva asignación nunca deja persona inactiva con proceso abierto. Repetición concurrente de baja es idempotente.

Sesiones: una cuenta OPERATOR vinculada pierde la sesión al desactivar, no puede iniciar sesión mientras la persona está inactiva y puede volver a autenticarse tras reactivar; conserva contraseña, cuenta y vinculación. El cambio lo ejecuta un operador con solo PERSON_DEACTIVATE, sin obtener PERSON_VIEW/USER_ADMIN.

Rollback: un interceptor exclusivamente de test falla en revocación después del UPDATE; estado/fecha se revierten y la sesión vinculada sigue válida. Además, un escenario heredado con cuenta global inactiva provoca una denegación SQL real 42501: API403 y rollback. El dato heredado se prepara mediante Identity únicamente en la fixture, porque la API prohíbe desactivar cuentas globales por su operación administrativa normal. No se cambia esa regla.

UI: la acción requiere lectura y capacidad de estado en la misma sede; cancelar no envía HTTP, envío bloquea otras mutaciones y 204 exige lectura nueva del estado/fecha. Las filas desaparecen si dejan de coincidir con filtro de estado. 401 expira y limpia; 403 conserva redirección global /sin-acceso; 404/409/fallo de red no generan éxito falso. Dos fechas de lectura no se sustituyen por reloj del navegador.

## Reproducción inicial y correcciones de pruebas

Dos casos iniciales fallaron antes del arreglo: reactivación sin documento recibía 204 y repetir baja cambiaba la fecha. Evidencia state-initial_net10.0_20261107130805.trx.

Se corrigieron supuestos de pruebas: comparar timestamps persistidos de asignaciones (precisión PostgreSQL), no repetir confirmación de correo tras rotación de sello, indicar explícitamente status200 al probar respuesta fuera del contrato (flush(null) genera204), respetar redirección403 y esperar que debounce publique búsqueda en URL antes de navegar. Se corrigió también el montaje del dato global heredado para no usar la operación API que lo prohíbe. Las ejecuciones fallidas permanecen diferenciadas de la ejecución final correcta.

## Límites y estado remoto

Sin DDL, historial, nuevas tablas, permisos, endpoints ni modificaciones al contexto firmado. Supabase permanece intacto y su aceptación requiere despliegue coordinado de seguridad.

El PUT de estado no contiene versión esperada: los cambios opuestos válidos se serializan, sin detección de intenciones antiguas. Timeouts se resuelven consultando estado, sin reintento automático. Documentos/sedes heredados inconsistentes impiden reactivación hasta regularización autorizada.

Los E2E públicos generan ECONNREFUSED en el sondeo opcional /auth/session del puerto operativo 7243, no iniciado. Sus verificaciones pasan; la fixture real usa API HTTPS propia con puertos aleatorios y PostgreSQL loopback. No se afirma aceptación remota ni ejecución en CI. Procesos temporales finalizan, clúster aislado detenido y PFX privado efímero eliminado por la fixture.

2026-11-21: la ficha de consulta pasa a modal exclusivamente de lectura. Activar/desactivar permanece en el listado y conserva permisos, confirmación, bloqueos y revocación de sesiones vinculadas. Regresiones controladas de estado incluidas en los 28 casos de Personas aprobados; ver specs/009-person-query/validation.md. Sin cambios backend ni datos reales.
