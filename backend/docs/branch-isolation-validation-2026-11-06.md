# Autorización y aislamiento entre sedes — 2026-11-06

## Resultado y alcance

La autorización HTTP y el aislamiento RLS con el actor correcto pasan en dos sedes
sintéticas. No se demuestra una protección de PostgreSQL frente a un cliente que
posea la credencial SQL runtime: ese cliente puede suministrar otro `mlp.actor_id`.
Se reprodujo esta limitación en Supabase mediante READ ONLY y ROLLBACK.

No se cambiaron tablas, políticas, registros ministeriales ni User Secrets de
Supabase. No se ejecutaron migraciones, bootstrap ni 090. Login/logout reales
utilizaron los mecanismos Identity existentes; logout revoca el security stamp.

## Identidad y filtros existentes

- `src/MisionLiderParis.Api/Program.cs`: obtiene el identificador de las claims de
  la cookie validada y establece el `ActorContext` del request. No toma el actor
  de query strings ni headers. Data Protection protege la cookie.
- `src/MisionLiderParis.Application/Access/ActorContext.cs`: no admite Guid vacío
  ni sustituir un actor ya establecido por otro en el mismo scope.
- `src/MisionLiderParis.Infrastructure/Ministry/ActorConnectionInterceptor.cs`:
  ejecuta `set_config('mlp.actor_id', @actor, false)` al abrir cada conexión EF de
  ambos DbContexts. `false` significa sesión, NO transacción. Sin actor escribe
  cadena vacía. Npgsql tiene reset al devolver al pool; en la conexión remota
  inspeccionada `NoResetOnClose=false`. Esto no es una prueba exhaustiva de
  concurrencia/pooling ni una garantía para un interceptor que no se ejecute.
- `AccessService`, `AccountAccessValidator`, `MinistryDirectory` y
  `MinistryAuthorization` resuelven cuenta activa, bloqueos, concesiones vigentes,
  vinculación opcional a persona y permisos por sede desde la base.
- `PeopleService` y `AssignmentService` filtran por sedes con el permiso requerido;
  los reportes exigen permiso y sede. Una URL de sede no otorga esa autorización.
- `sql/005-runtime-role-rls.sql`: las políticas usan `has_global_access()` y
  `can_access_branch(uuid)`. RLS verifica estado/rol/sede del actor suministrado,
  pero no autentica el origen de ese UUID. Procesos/categorías/estados/roles son
  catálogos compartidos; las asignaciones/personas sí se aíslan por sede.

## Ejecución automatizada

1. Primero se ejecutó la suite existente sin `MLP_TEST_DATABASE`: 50 unitarias y
   13 integraciones HTTP correctas; 21 escenarios PostgreSQL omitidos.
2. Se reutilizó exclusivamente el clúster ya existente en loopback, puerto 57693,
   base `mlp_user_validation_tests`. Estaba detenido, se inició para verificar y
   se detuvo al terminar. La aplicación operativa siguió utilizando Supabase.
3. Se añadió `MLP_TEST_PREPROVISIONED=1` a la fixture: solo acepta loopback y
   sufijo `_tests`; comprueba seguridad runtime y metadatos/catálogo existentes,
   y retorna antes de migraciones, scripts, seeds o aprovisionamiento de roles.
   El precheck inicialmente intentó leer el historial sin GRANT; se corrigió para
   comprobar su existencia vía catálogo, sin ampliar privilegios.
4. Con el modo preaprovisionado: 52 unitarias y 35 integraciones correctas en una
   ejecución conjunta. Se excluyó `PostgresActivationTests`, porque aplica SQL y
   ejecuta bootstrap. Una integración adicional del operador pasó después:
   total 36 integraciones distintas verificadas. El caso de dos sedes ampliado
   a asignaciones/reportes/CSV se volvió a ejecutar y pasó.

Comando principal, con `MLP_TEST_DATABASE` dirigido exclusivamente al runtime del
clúster aislado y `MLP_TEST_PREPROVISIONED=1` en el entorno:

```powershell
dotnet test backend/MisionLiderParis.slnx --configuration Release --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests'
```

La base y sus roles ya estaban aprovisionados; este comando no sirve para crear
otro entorno. No apuntar nunca el entorno de pruebas a Supabase.

## Matriz con dos cuentas y datos sintéticos

Escenario simétrico A→B y B→A en `BranchIsolationTests.cs`:

| Operación | Propia | Ajena |
| --- | --- | --- |
| Sede por ID | 200 | 403 |
| Persona por ID | 200 | 404 |
| Personas por `branchId` | 200 | 403 |
| Asignación por ID | 200 | 404 |
| Asignaciones por `branchId` | 200 | 403 |
| Participantes de proceso con sede ajena | — | 403 |
| Resumen por sede | 200 | 403 |
| Exportación CSV por sede | 200 | 403 |
| SQL/EF sin filtro de aplicación | Registro propio visible | Registro ajeno ausente |

`actorId` en query y headers `X-Actor-Id`/`mlp.actor_id` no ampliaron permisos.
Cambiar `branchId` en la URL de una persona ajena tampoco la hizo visible.
Cookie inválida más actor falsificado devolvió 401.

## Supabase real

Evidencia sin secretos en `artifacts/branch-isolation/supabase-global-http.json`:
login/session/permisos 200, SUPER_ADMIN global con branchId nulo, listado 200 y
consulta individual 200 de la única sede existente; logout 204 y sesión posterior
401. No se reinició la API ni se crearon cuentas/sedes de prueba remotas.

Sonda Npgsql `backend/.local/branch-validation/result.json` (ruta relativa desde
la raíz del repositorio; ignorada por Git): solo User Secrets runtime, TLS
VerifyFull, transacción READ ONLY y ROLLBACK. Sin actor o con UUID inexistente:
RLS activo, global=false y cero personas/sedes visibles. Con UUID de administrador
vigente suministrado directamente mediante `set_config(..., true)`: global=true
y alcance global. El UUID y los registros personales no se publicaron. Después
del rollback se confirmó que el actor volvía a estar ausente.

## Límites de seguridad confirmados

1. **Suplantación del contexto por SQL runtime.** No hubo un bypass HTTP observado,
   pero una inyección SQL o exposición de la credencial runtime permitiría alterar
   el actor y saltar el aislamiento por sede. El rol no necesita BYPASSRLS para
   hacerlo: la política confía en la identidad suministrada por el backend.
2. **RLS no replica permisos granulares.** Un OPERATOR sin permisos explícitos
   recibe HTTP 403, pero puede leer dentro de su sede si accede directamente a SQL
   con ese actor. Se comprobó con datos aislados. La API aplica los códigos de
   permiso; RLS aplica principalmente el alcance por sede.

No se modificaron estas reglas: el encargo es validación, no rediseño. No afirmar
que los permisos no pueden ampliarse frente a un atacante con acceso SQL runtime.

## Pendientes concretos

- Dos sedes/cuentas controladas todavía no se probaron en Supabase real: allí
  solo se observó una sede. La matriz se verificó en PostgreSQL aislado con el
  mismo backend y SQL ya existente, sin aplicar migraciones.
- Prueba dedicada de reutilización forzada del mismo conector y concurrencia del
  contexto bajo Session pooler; las pruebas actuales sí verifican scope sin actor,
  pero no cubren exhaustivamente ese ciclo.
- Decidir explícitamente si la confianza del actor SQL y la autorización granular
  exclusivamente en API cumplen el modelo de amenaza acordado, antes de declarar
  cerrada la validación de manipulación del contexto.
- Navegador Angular no formó parte de estas pruebas de backend/PostgreSQL.

Cambios de producto: ninguno. Solo fixture de pruebas, escenarios automatizados
y esta evidencia documental.
