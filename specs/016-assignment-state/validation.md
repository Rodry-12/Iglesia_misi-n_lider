# Validación — 016 assignment-state

Fecha:2026-11-07. Verificada en entorno aislado; Supabase intacto, sin imágenes.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | AssignmentStateTests (4 nuevas integraciones), regresiones de asignación/aislamiento | 16 casos de integración distintos aprobados entre ejecuciones, incluida fixture |
| AC-002 | assignment-state.spec.ts unitario (14) y regresión de asignaciones/autorización | 71 unitarias focalizadas y36 E2E controlados aprobados |
| AC-003 | Fixture HTTPS/SQL aislado, escritorio y móvil; compilaciones/checks | Dos recorridos reales aprobados; builds/checks correctos |

Evidencia en backend/artifacts/assignment-state: state_net10.0_20261107170658.trx (14 correctas ydos fallos iniciales de precisión); state-final_net10.0_20261107170951.trx (5 correctas, incluido caso corregido de opciones/escritura; fallo de fixture por desbordamiento móvil); state-browser-final_net10.0_20261107171325.trx (fixture1/1 correcta,47s, con desktop/mobile). Unión por nombre:16 casos correctos distintos; los dos recorridos reales forman parte de una fixture, no son2 integraciones adicionales. No se repitieron los casos ajenos a cada corrección ni hubo omisiones en selección.

Resumen real: browser-state-result.txt. API HTTPS, cookies/CSRF, transiciones, IN_PROGRESS, cancelación terminal sin PUT, COMPLETED confirmado, fechas exactas persistidas, referencias inmutables, ausencia de reapertura, detalle/lista/recarga ylogout. Clúster detenido; cero PFX privados efímeros restantes; sin cambios de User Secrets ni Supabase.

La revisión móvil real detectó ancho intrínseco de Select con categoría larga. Se corrigió grid con minmax(0,1fr), min-width:0 y API pública fluid de PrimeNG. Se repitieron únicamente las9 unitarias de seguimiento y2 E2E de consulta/filtros con nombre largo de32 letras anchas (2/2,16.6s); son casos ya incluidos en71/36, no se suman como casos nuevos. Angular se recompiló tras el ajuste, conservando492.17kB. Sin capturas ni generación de imágenes.

Comandos desde frontend: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/assignment*.spec.ts' --include='**/core/auth/*.spec.ts'` (71/71,7 archivos); con MLP_SKIP_VISUAL_ARTIFACTS=1, `node node_modules/@playwright/test/cli.js test assignment-state.spec.ts assignment.spec.ts assignment-follow-up.spec.ts auth.spec.ts` (36/36,1.2min). No suite completa ni repetición de pruebas frontend después de corregir solo backend/fixture.

`dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore`: cero errores/advertencias. `npm run build`: correcto,492.17kB inicial bajo500kB sin elevar presupuesto. design:check/format:check correctos; spec:check al cerrar evidencia.

Integración: mismas variables loopback _tests de ../014-process-assignment/validation.md, MLP_TEST_PREPROVISIONED=1, MLP_RUN_PEOPLE_BROWSER=1 yMLP_RUN_ASSIGNMENT_STATE_BROWSER=1. Comando final focalizado: `dotnet test backend/tests/MisionLiderParis.IntegrationTests --configuration Release --no-build --no-restore --filter 'FullyQualifiedName~AssignmentState|FullyQualifiedName~AssignmentLifecycleTransfer|FullyQualifiedName~PeopleBrowserFixtureTests' --logger 'trx;LogFilePrefix=state-final' --results-directory backend/artifacts/assignment-state`. Clúster preexistente57693, arranque explícito y stop en finally; sin SQL de despliegue ni Supabase. Fixture reutilizada ejecuta solo dos recorridos de asignación/seguimiento/estado, sin historias ajenas. Cookies/CSRF/TLS/contexto firmado reales, cuentas y certificado sintéticos. No User Secrets ni imágenes.

Cobertura: VIEW no concede CHANGE; CHANGE no concede VIEW ni consulta general de catálogo, pero permite destinos/escritura en sede.401/403/404/400/409; terminales sin destinos ni reapertura. Inicio, suspensión/reanudación, completado/retirada y preservación de referencias/fechas; mismo estado no actualiza fecha_actualizacion. Inactivos bloquean transiciones abiertas pero permiten cierre según regla previa. Parámetro finishedAt arbitrario no controla la fecha. Concurrencia inicio/retirada produce resultado válido serializado. Interceptor falla después de SaveChanges al intentar commit, confirmando rollback de estado/fechas.

La prueba real detectó100ns de DateTimeOffset frente a microsegundos persistidos: PUT ahora lee su resultado dentro de la transacción antes del commit y devuelve DTO básico, sin nombres/documentos que requieran VIEW. Comparaciones de referencias/fecha_asignacion toman como base el GET persistido, sin alterar creación HU-008. Incidencias iniciales quedan separadas del resultado final.

Archivos: backend Contracts.cs, AssignmentService.cs, MinistryControllers.cs, AssignmentStateTests.cs yPeopleBrowserFixtureTests.cs; Angular core/auth/access-context.ts, admin.routes.ts, assignment.models.ts,assignment.store.ts,assignment-page.ts/html, assignment-state.spec.ts,assignment-list-page.html yassignment-list.scss (ajuste responsive); E2E assignment-state.spec.ts,assignment-follow-up.spec.ts (nombre largo) ypeople-registration-real.spec.ts; SDD016 y nota de contrato API. Sin SQL ni dependencias nuevas.

Límites: aceptación Supabase pendiente. Bloqueo/revalidación actual no equivale a versión optimista del formulario: una transición que siga siendo válida se puede aplicar. Se conserva503 para retirada sin inicio si falta integridad revisada de fechas. Sin cambio de responsable, historial, reapertura, permisos nuevos ni fallback de actor.
