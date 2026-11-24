# Validación — 017 assignment-responsible

Fecha: 2026-11-08 (America/Bogota). Verificada en entorno aislado. Supabase intacto.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001   | AssignmentResponsibleTests e integraciones de regresión | Aprobadas: permiso específico, opciones mínimas sin PERSON_VIEW/ASSIGN, 401/403/404/400/409, inactivo/sin documento/sin vinculación vigente/de otra sede, participante inválido, terminal, conservación de datos y una sola fila en listado. |
| AC-002   | Dos peticiones concurrentes y fallo después de SaveChanges antes del commit | Un 200 y un 409; precondición obsoleta rechazada; rollback conserva la asignación original. |
| AC-003   | Unidades Angular, Playwright controlado y fixture HTTPS real | 83 unidades Angular; 46 E2E distintos aprobados (44 en regresión inicial, 10 HU-011 finales con 8 repetidos y 2 nuevos403); dos recorridos reales escritorio/móvil. |

## Comandos y resultados

- `dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore`: aprobado, cero errores y advertencias.
- `dotnet test backend/tests/MisionLiderParis.UnitTests --configuration Release --no-build --logger trx --results-directory backend/artifacts/assignment-responsible`: 58 aprobadas.
- `dotnet test backend/tests/MisionLiderParis.IntegrationTests --configuration Release --no-build --filter 'FullyQualifiedName~Responsible|FullyQualifiedName~Assignment|FullyQualifiedName~AssignOnly|FullyQualifiedName~BranchIsolationTests' --logger trx --results-directory backend/artifacts/assignment-responsible`: 20 aprobadas, sin omitidas; regresión HU-008/009/010 y aislamiento RLS incluido.
- Mismo proyecto/filter `FullyQualifiedName~BrowserCreatesAndReadsPerson`, con MLP_RUN_PEOPLE_BROWSER=1, MLP_RUN_ASSIGNMENT_RESPONSIBLE_BROWSER=1 y MLP_RUN_ASSIGNMENT_STATE_BROWSER=1: fixture aprobada con dos recorridos reales completos navegador/HTTPS/API/PostgreSQL, incluidos asignación, consulta, cambio de responsable, cambio de estado y logout. Sin PERSON_VIEW ni permisos de catálogo en la cuenta de asignaciones.
- Total de integración: 21 casos distintos aprobados, incluida la fixture. Los diez aprobados del primer intento están incluidos en la regresión final; no se suman de nuevo.
- Desde frontend: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/assignment*.spec.ts' --include='**/core/auth/*.spec.ts'`: 83 aprobadas, ocho archivos; repetidas tras el ajuste final de navegación403.
- Desde frontend, MLP_SKIP_VISUAL_ARTIFACTS=1: `node node_modules/@playwright/test/cli.js test e2e/assignment.spec.ts e2e/assignment-follow-up.spec.ts e2e/assignment-state.spec.ts e2e/assignment-responsible.spec.ts e2e/auth.spec.ts`: 44 aprobadas. Después `... test e2e/assignment-responsible.spec.ts`: 10 aprobadas, incluyendo dos casos nuevos de403 con borrador pendiente.
- `npm run build`: aprobado tras el último ajuste (492.42 kB iniciales, por debajo del presupuesto500 kB). `npm run design:check`, `npm run format:check` y `npm run spec:check`: aprobados. PostgreSQL de pruebas detenido y cero PFX privados temporales restantes.

## Archivos modificados o añadidos

- Backend: src/MisionLiderParis.Application/Ministry/Contracts.cs, src/MisionLiderParis.Api/Controllers/MinistryControllers.cs y src/MisionLiderParis.Infrastructure/Ministry/AssignmentService.cs (rutas relativas a backend/).
- Angular: frontend/src/app/core/auth/access-context.ts y frontend/src/app/features/training/{assignment-page.ts,assignment-page.html,assignment.store.ts}.
- Pruebas: backend/tests/MisionLiderParis.IntegrationTests/{AssignmentResponsibleTests.cs,PeopleBrowserFixtureTests.cs}; frontend/src/app/features/training/assignment-responsible.spec.ts; frontend/e2e/{assignment-responsible.spec.ts,people-registration-real.spec.ts}.
- Trazabilidad: specs/017-assignment-responsible/{spec.md,plan.md,tasks.md,validation.md,traceability.json}.

## Evidencia y límites

TRX en backend/artifacts/assignment-responsible: 20_09_13 (20 integraciones), 20_09_18 (58 unidades), 20_07_32 (fixture real). browser-responsible-result.txt confirma ambos recorridos; los archivos homólogos de assignment-state y assignment-follow-up registran las regresiones reales.

El primer intento real falló por un selector ambiguo de Playwright (dos nodos alertdialog de PrimeNG); se corrigió por nombre accesible y se repitió satisfactoriamente. Un primer build de pruebas detectó xUnit2031, corregido usando Assert.Single con predicado. Las ejecuciones Angular/PostgreSQL necesitaron autorización fuera del sandbox por spawn EPERM/token restringido; no fueron fallos funcionales. Sin imágenes, certificados privados persistidos ni logs de credenciales.

Todos los datos de prueba son sintéticos en 127.0.0.1:57693, base mlp_user_validation_tests preaprovisionada; no se ejecutaron migraciones/bootstrap/090 ni PostgresActivationTests. Servidor de pruebas detenido tras cada ejecución.

La aceptación remota queda pendiente del despliegue coordinado de seguridad. El PUT conserva compatibilidad: clientes antiguos que omiten expectedResponsiblePersonId no detectan cambios previos a su petición; Angular siempre lo envía y las peticiones concurrentes quedan protegidas bajo bloqueo. Sin historial ni cambios de esquema.
