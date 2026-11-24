# Validación — 014 process-assignment

Fecha:2026-11-07. Verificada en entorno aislado; sin modificación de Supabase. Aceptación remota pendiente.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | AssignmentSelectionTests (2 nuevos escenarios amplios), regresiones de catálogo/lifecycle/concurrencia/seguridad | 58/58 unitarias .NET y74/74 integraciones aprobadas |
| AC-002 | AssignmentStore (12 casos), formulario (4), E2E controlado (4 x2 viewports) y regresión | 132/132 Angular y74/74 E2E controlados aprobados |
| AC-003 | PeopleBrowserFixtureTests, Angular → API HTTPS → PostgreSQL aislado | Seis recorridos reales correctos: asignaciones, catálogo y Personas, escritorio/móvil |

La fixture de navegador cuenta como una de las74 integraciones; sus seis recorridos Playwright no se suman como otras seis integraciones. Cero fallos/omitidos en la selección final,2min16s. Se excluye PostgresActivationTests por migraciones/bootstrap fuera de alcance.

Evidencia final en backend/artifacts/process-assignment: assignment-verified_net10.0_20261107163004.trx (58 unitarias), assignment-verified_net10.0_20261107163220.trx (74 integraciones) ybrowser-assignment-result.txt. E2E real comprueba POST201, estadoPENDING, fechas de inicio/finalización nulas, consulta GET persistida, recarga ylogout; ASSIGN/VIEW sin PERSON_VIEW/CATEGORY_VIEW. PostgreSQL de pruebas detenido al finalizar; cero PFX privados efímeros restantes. No procesos de API/navegador de pruebas pendientes.

## Compilaciones y checks

- dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore: correcto, cero errores/advertencias.
- npm run build: correcto,492.11kB inicial bajo presupuesto500kB; sin aumentar límites.
- npm test -- --watch=false:132/132,18 archivos, incluye16 nuevos casos HU-008.
- Desde frontend: node node_modules/@playwright/test/cli.js test assignment.spec.ts catalog.spec.ts people-state.spec.ts people.spec.ts people-registration.spec.ts people-editing.spec.ts auth.spec.ts public-site.spec.ts:74/74,3.1minutos.
- npm run spec:check, design:check, format:check, deps:check, skills:check: correctos.

## Entorno y comandos de integración

Solo clúster loopback existente, mlp_user_validation_tests, puerto57693, roles runtime e Identity separados. Sin instalar PostgreSQL ni ejecutar migraciones/bootstrap/scripts SQL. PostgresActivationTests se excluye porque su objeto son migraciones/bootstrap.

Variables no secretas exclusivas de prueba:

```powershell
$env:MLP_TEST_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_test_runtime_d09960275a58;SSL Mode=Disable'
$env:MLP_TEST_IDENTITY_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_identity_runtime;SSL Mode=Disable'
$env:MLP_TEST_OPERATOR_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=postgres;SSL Mode=Disable'
$env:MLP_TEST_PREPROVISIONED='1'
$env:MLP_RUN_PEOPLE_BROWSER='1'
& backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe start -D backend/.local/user-validation-20261106/data -o '-p 57693 -h 127.0.0.1' -l backend/.local/user-validation-20261106/assignment-verified.log -w
if ($LASTEXITCODE -ne 0) { throw 'Isolated database unavailable' }
try {
  dotnet test backend/MisionLiderParis.slnx --configuration Release --no-build --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger 'trx;LogFilePrefix=assignment-verified' --results-directory backend/artifacts/process-assignment
  $taskExit=$LASTEXITCODE
} finally {
  & backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe stop -D backend/.local/user-validation-20261106/data -m fast -w
}
if ($taskExit -ne 0) { throw 'Test failure' }
```

Fixture sintética: cuenta ASSIGN/VIEW sin PERSON_VIEW ni CATEGORY_VIEW, además de cuentas previas de regresión; participantes con documentos de prueba, catálogo y procesos por viewport. HTTPS real con CA/PFX efímeros, proxy verificando CA mediante NODE_EXTRA_CA_CERTS; cookies/CSRF reales. No HTTP interceptado en recorridos reales. No cuenta real ni User Secrets. Nueva API por historia/viewport conserva límites de producción sin desactivarlos. Se elimina PFX al terminar. Trace/video/screenshots deshabilitados en prueba real; hooks limpian campos de acceso y fixture sanea contextos de fallo automáticos.

## Casos comprobados

ASSIGN de dos sedes consulta solo opciones propias; sede ajena403, exclusión del participante, búsquedas nombre/apellido/documento y ausencia de concesiones de lectura adicionales. VIEW aislado no habilita opciones ASSIGN. POST sin VIEW devuelve comprobante pero GET sigue403.

Documento ausente/finalizado de participante o responsable rechaza409 y excluye de opciones. Participante/responsable inactivo o sin sede vigente rechaza409. UUID de otra sede, responsable ajeno y participante inexistente no revelan PII. Vacíos/autorresponsabilidad400, proceso inexistente404. Intentos fallidos no dejan asignaciones ni actualizan datos personales. Procesos diferentes simultáneos permitidos; duplicado409. Regresiones existentes cubren categoría/proceso inactivo, concurrencia201/409, estados y RLS.

Angular verifica cuerpo de cuatro UUID sin actor/fechas/estado;201 obligatorio, envío único, errores400/403/404/409/503 sin éxito falso ni reintento,401 cancela/borra, cambios de identidad cancelan/resuelven comandos, búsquedas obsoletas se descartan. Cambio de participante reinicia responsable; cambio de categoría reinicia proceso; formulario exige permiso en sede efectiva, valida y conserva borrador.

## Revisión visual e incidencias

Capturas con datos sintéticos: frontend/artifacts/014-assignment-form-desktop.png y014-assignment-form-mobile.png. Revisado móvil: formulario legible, controles apilados, sede/documento explícitos, sin desbordamiento horizontal. E2E valida ancho de formulario y detalle. Sin afirmar auditoría exhaustiva de accesibilidad.

Se corrigieron etiquetas ariaLabelledBy de PrimeNG Select, conservación del control durante búsquedas y esperas de navegación antes de recarga. La regresión de catálogo añade espera de URL al abrir formulario para evitar carreras de navegación. Arranque frío de API real usa espera explícita de hasta15s; producto conserva sus tiempos/límites. Se corrigió retención automática de credenciales sintéticas en contextos de error Playwright, incluso con trace deshabilitado; artefactos anteriores saneados. Ejecuciones iniciales fallidas permanecen diferenciadas de evidencia final.

## Archivos de esta HU

- Backend: Application/Ministry/Contracts.cs; Infrastructure/Ministry/AssignmentService.cs; Api/Controllers/MinistryControllers.cs; IntegrationTests/AssignmentSelectionTests.cs yPeopleBrowserFixtureTests.cs.
- Angular: training/assignment.models.ts,assignment.store.ts,assignment-page.ts/html y sus dos spec.ts; training/training-page.html; administration/admin.routes.ts; core/auth/access-context.ts ycore/navigation/admin-navigation.ts.
- E2E: assignment.spec.ts (nuevo), people-registration-real.spec.ts, catalog.spec.ts (esperas) yplaywright.people-real.config.ts.
- Documentación: docs/process-assignments.md,docs/administration.md,backend/docs/angular-api-contract.md yspecs/014-process-assignment/ (cinco archivos).

## Límites

Aceptación remota pendiente del despliegue coordinado de seguridad; no se afirma funcionamiento de HU-008 en Supabase. Documento obligatorio se valida en API bajo bloqueos, sin nuevo trigger SQL. Opciones de catálogo completas, aún sin paginación. GET existente devuelve identificadores de relaciones, presentados solo en detalle técnico; comprobante conserva nombres seleccionados. No permisos nuevos ni ampliación de VIEW al asignar. Sin historial ni cambios de estructura/datos reales. Advertencias ECONNREFUSED de suite pública corresponden a sondeo opcional de sesión en7243 sin API operativa; fixture real usa API propia en puerto aleatorio.

## Preparacion de Asignar proceso - 2026-11-22

Pantalla organizada en tres bloques numerados, paneles responsive con tokens existentes, seleccion/documento/sede visibles y Cancelar/Guardar juntos al pie. Texto de busqueda debounce2000ms, X condicional y selects showClear solo con valor; proceso dependiente de categoria y responsable dependiente de participante conservados. Paginacion compartida 10/20/50 de candidatos cuando total>10, sin botones antiguos. No se muestran cargas locales duplicadas en el nuevo formulario: se mantiene overlay global. Comprobante POST no muestra UUID y conserva acceso posterior condicionado por PROCESS_VIEW. Vista de seguimiento/cambio de estado y responsable conserva su implementacion.

Backend PeoplePageAsync normaliza nombres completos y documento vigente con translate/upper antes de paginar/contar. Sin cambios de permisos, elegibilidad o escritura: PROCESS_ASSIGN por sede, activos/documentados, responsable distinto y misma sede, categoria/proceso activos, estado PENDING, duplicado409 y revalidacion transaccional existentes.

Pruebas: 17 unitarias Angular distintas (4 formulario +13 store; store repetido tras agregar caso de tamaño de pagina), 9 unitarias .NET de asignaciones, 8 recorridos existentes y 2 nuevos de debounce/acciones (10 en total, desktop/mobile) correctos. Navegador con HTTP controlado; POST interceptados, no prueba de persistencia real. Compilaciones API/Angular correctas; Angular mantiene advertencia previa 583,76/500kB. Lectura real con servicio y contexto firmado en transaccion READ ONLY con ROLLBACK: 5 categorias/18 procesos activos, estado inicial PENDING, 3 personas elegibles; busqueda con mayusculas/sin tildes y responsables de misma sede/exclusion correctas. No se imprimieron nombres/documentos de candidatos ni secretos, no se crearon asignaciones, usuarios o correos y no se modifico Supabase. Aceptacion de escritura real pendiente de autorizacion del usuario.

## Asignacion desde Miembros en modal - 2026-11-22

FR-007: nueva accion Lucide ClipboardPlus despues de Ver/Editar en fila de Miembros, condicionada por PROCESS_ASSIGN de sede y deshabilitada para persona inactiva/sin documento vigente/sede. AssignmentPage reutilizado con input member, outputs de cierre/guardado y AssignmentStore bajo MembersPage. Persona fija desde fila (nombre/documento/sede), categorias/procesos activos y responsable consultado con sede derivada y excludePersonId. Modal espera opciones, pie fijo Cancelar/Guardar, filtro2s y limpieza condicional existentes, proteccion de borrador delegada desde guard del listado, Toast, foco restaurado y sin GET de miembros al cerrar/guardar. Store limpia pendientes al destruir modal. No hay endpoint/proveedor nuevo ni cambios de backend, permisos o SQL. POST conserva revalidacion de elegibilidad, sede y duplicados dentro de transaccion.

Formacion retira tarjeta/entrada Asignar y la accion de Seguimiento; conserva tres accesos. Ruta antigua oculta se conserva por compatibilidad, sin enlaces en producto. Miembros sigue requiriendo PERSON_VIEW, sin ampliar concesiones a usuarios ASSIGN-only. Fixture historica aislada adapta su enlace a ruta compatible y no se ejecuto.

Verificacion: 28 unitarias Angular correctas (13store/4form/11acceso). 12 recorridos controlados correctos desktop/mobile: modal con miembro fijo, POST interceptado con cuatro UUID correctos, cierre sin recargar listado, permisos, persona inactiva, conflicto409 sin perdida de borrador y confirmacion de descarte, tres entradas en Formacion. Build Angular y design:check/spec:check correctos; advertencia previa de bundle 583,76/500kB. No hubo asignaciones reales, modificaciones de Supabase, secretos ni correos; pruebas de navegador con HTTP controlado, sin capturas. Aceptacion con escritura real pendiente de autorizacion expresa.

Regresion adicional de reutilizacion: 10/10 recorridos compatibles de asignacion/consulta, permisos ASSIGN independiente, conflicto, sesion expirada y debounce en desktop/mobile correctos con HTTP controlado. Total de esta correccion: 22 recorridos distintos; no se presenta la ruta compatible como entrada visible del producto.

## Buscador de responsable integrado - 2026-11-22

Se retira nota Estado inicial/fechas del formulario sin cambiar estado PENDING ni fechas del backend. Select de responsable incorpora filtro personalizado PrimeNG con input accesible Buscar responsable y X solo con texto. El control dispara busqueda remota tras2s, sin filtrar localmente una pagina incompleta; conserva paginacion, sede derivada y excludePersonId. Se permite mantener el desplegable abierto mientras llegan resultados. PeopleOptionsAsync mantiene filtro m.Person.IsActive, sede activa, membresia y documento vigentes, permiso por sede y exclusion del participante.

6/6 recorridos de navegador correctos desktop/mobile con HTTP controlado: ausencia de nota/input externo, buscador dentro de desplegable, debounce2s, parametros de sede/exclusion, seleccion de candidata devuelta solo por busqueda remota, guardado interceptado y conservacion del borrador ante409. Cero escrituras reales. Build Angular/design:check/spec:check correctos, advertencia de bundle previa 583,76/500kB. No se modifico backend, Supabase, permisos o secretos. No se presenta el recorrido controlado como aceptacion de datos reales.
