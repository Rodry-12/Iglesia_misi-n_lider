# Validación HU-003

Fecha: 2026-11-07. Verificada en entorno aislado; Supabase no modificado.

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| AC-001 | PeopleEditingTests.cs: cuatro escenarios HTTP/PostgreSQL de persistencia, nulos, permisos independientes, otra sede, anónimo, inválidos, campos manipulados, legado sin documento y dos escritores simultáneos con misma versión | Correcto; 58 integraciones de regresión |
| AC-002 | person-edit-page.spec.ts (7), nuevos casos MembersStore (4), alcance global sin sede; people-editing.spec.ts (4 casos por viewport) | 89 unitarias Angular y 46 E2E controlados correctos |
| AC-003 | PeopleBrowserFixtureTests.cs ejecuta people-registration-real.spec.ts sin mocks HTTP | Desktop y mobile correctos: login, registro, listado, detalle, edición, PUT200, recarga, listado filtrado, logout |

## Compilación y checks

- dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore: correcto, cero errores/advertencias.
- npm run build: correcto, 491.75 kB inicial, bajo presupuesto.
- npm test -- --watch=false: 89/89, 13 archivos.
- npm run spec:check, npm run design:check, npm run format:check, npm run deps:check y npm run skills:check: correctos.
- Desde frontend: node node_modules/@playwright/test/cli.js test people.spec.ts people-registration.spec.ts people-editing.spec.ts auth.spec.ts public-site.spec.ts: 46/46, 1.6 minutos.
- Revisión visual de frontend/artifacts/011-editing-desktop.png y 011-editing-mobile.png: dos/una columnas, etiquetas, foco y controles; screenshots sintéticos ignorados por Git. Comprobación E2E sin desbordamiento horizontal.

## .NET e integración real

Usar exclusivamente las conexiones de loopback de la fixture existente:

```powershell
$env:MLP_TEST_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_test_runtime_d09960275a58;SSL Mode=Disable'
$env:MLP_TEST_IDENTITY_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_identity_runtime;SSL Mode=Disable'
$env:MLP_TEST_OPERATOR_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=postgres;SSL Mode=Disable'
$env:MLP_TEST_PREPROVISIONED='1'
$env:MLP_RUN_PEOPLE_BROWSER='1'
& backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe start -D backend/.local/user-validation-20261106/data -o '-p 57693 -h 127.0.0.1' -l backend/.local/user-validation-20261106/editing-verified.log -w
if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL did not start' }
try {
  dotnet test backend/MisionLiderParis.slnx --configuration Release --no-build --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger 'trx;LogFilePrefix=editing-verified' --results-directory backend/artifacts/people-editing
  $taskExit=$LASTEXITCODE
} finally {
  & backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe stop -D backend/.local/user-validation-20261106/data -m fast -w
}
if ($taskExit -ne 0) { throw 'Test failure' }
```

Resultado final: 58 unitarias .NET + 58 integraciones, cero fallos/casos omitidos dentro de la selección. Excluidos PostgresActivationTests: ejecutan migraciones/bootstrap, prohibidos en esta HU. Una de las 58 integraciones lanza dos recorridos de navegador reales; no contarlos como integraciones adicionales.

TRX: backend/artifacts/people-editing/:
- editing-verified_net10.0_20261107125201.trx (58 unitarias).
- editing-verified_net10.0_20261107125301.trx (58 integraciones).
Resumen real: backend/artifacts/people-registration/browser-registration-result.txt incluye editing y ambos viewports.

## Incidencias resueltas y límites

Primera ejecución encontró un error del test: columna Identity person_id escrita como persona_id; se corrigió la consulta, sin DDL. E2E inicial usó una lectura prematura de URL y un localizador exacto sobre texto combinado, corregidos. Una regresión HU-002 coincidió con recarga en caliente durante cambios; la ejecución final estable pasa todos los casos. Estas ejecuciones fallidas no se presentan como evidencia de éxito.

Las pruebas públicas registran ECONNREFUSED en el sondeo opcional de sesión del puerto 7243, porque la API operativa no se inició. Sus verificaciones pasan; el fixture real usa puertos aleatorios y API propia aislada.

expectedUpdatedAt opcional mantiene contrato anterior: clientes que lo omitan no detectan formularios obsoletos. La UI nueva siempre envía versión persistida, verificada con microsegundos, bloqueo y condición EF. No garantiza escrituras SQL externas que no actualicen fecha_actualizacion.

No se edita documento en esta HU; duplicado documental y rollback multitabla no aplican a este PUT de una tabla. La operación documental existente queda intacta. Registros previos sin documento siguen accesibles sin inventar documentos. Supabase, sus datos, contexto firmado, scripts SQL históricos, migraciones, bootstrap y 090 intactos. Aceptación remota pendiente del despliegue coordinado de seguridad. Fixture/API/Angular temporales terminados; clúster aislado detenido y cero PFX privados de test retenidos. No se afirma ejecución en CI.

## Editor modal — 2026-11-21

El lápiz abre el editor existente dentro de Dialog después de cargar la versión actual, con MembersStore aislado. Se reutilizan validadores, payload de cinco campos personales y expectedUpdatedAt, permisos PERSON_VIEW/PERSON_UPDATE por sede y protección 409. Identificación, sede y estado permanecen de solo lectura. Cancelar y Guardar cambios quedan juntos en el footer, con submit externo vinculado por form/id, sin doble manejador. Cancelación y navegación conservan confirmación de borrador y bloqueo durante envío. Éxito real cierra modal y refresca listado manteniendo filtros; errores conservan borrador y se notifican por Toast. Cambios de sesión limpian/cierra el editor; URL directa abre el mismo modal.

Pruebas: 49 unitarias focalizadas aprobadas; regresión final de edición 8/8 en escritorio/móvil, dentro de 28 casos distintos de Personas aprobados. Comprueba pie visible/alineado, asociación del submit, un solo PUT, versión exacta, ausencia de branchId/isActive en payload, actualización del listado, validación, conflicto, descarte y 401. HTTP interceptado, sin escritura real. Build final y checks correctos; advertencia inicial previa de tamaño se conserva. Estética operativa pendiente de revisión del propietario.

2026-11-21 — Refinamiento visual compartido: ocultar País emisor del editor sin modificar issuingCountry ni payload de actualización. Identificación y contexto ministerial usan proporciones equilibradas, cabecera y estilos compartidos con consulta. Incluido en 16/16 pruebas de navegador controladas de consulta/edición aprobadas; build y checks correctos. Sin escrituras reales.

2026-11-21 — Documento integrado: tipo y número abren Información personal en el editor, como datos readonly; desaparece la tarjeta Identificación independiente. Composición compartida con consulta, dos secciones apiladas y pie fijo. Incluido en 16/16 recorridos de consulta/edición aprobados con HTTP interceptado; no cambia payload, versión de concurrencia ni validaciones.
