# Activación del backend — revisión y evidencia

Fecha: 2026-10-24, America/Bogota. El backend está **activado y verificado en PostgreSQL local de pruebas**, conservando los módulos existentes. No se ha conectado ni aplicado SQL a Supabase en esta fase.

## Entorno comprobado

- SDK .NET 10.0.402, ASP.NET Core/EF Core 10.0.13; Npgsql/EF PostgreSQL 10.
- PostgreSQL local 17.11, loopback 127.0.0.1:55432; baseline real de las once tablas de Supabase 17.6, obtenido anteriormente en READ ONLY y fijado por hash.
- La captura de solo metadatos de Supabase `artifacts/step18-live-security-metadata.json` se generó el 2026-10-24 a las 20:00:14 UTC: `iglesia` contiene once tablas con RLS activo, sin `FORCE ROW LEVEL SECURITY` ni políticas; `auth_app` no existía; `auth` pertenece a `supabase_admin`; el operador observado (`postgres`) no es superusuario, pero tiene `BYPASSRLS`, `CREATEROLE` y `REPLICATION`. Es evidencia de esa captura, no una afirmación de estado remoto actual.
- Base activada: `mlp_activation_5385eb02fc5a_tests`.
- Restauración anterior al cambio: `mlp_recovery_5385eb02fc5a_tests`.
- Restauración posterior al bootstrap: `mlp_restored_active_5385eb02fc5a_tests`.
- API iniciada para revisión en `https://localhost:53077`, con usuario runtime propio NOBYPASSRLS. Es una instancia local, no un despliegue.
- Administrador exclusivamente de pruebas: `activation-admin@example.invalid`. Contraseña aleatoria y conexión cifradas con DPAPI Windows en `backend/.local/activation.credential`, ignorado en Git; no se imprimen en consola.
- Certificado HTTPS de pruebas de corta duración, validado por su certificado exacto en el comprobador local. Regenerar ejecutando de nuevo la activación antes de su caducidad; no sirve para producción.

La fuente de verdad local es `backend/artifacts/activation/mlp_activation_5385eb02fc5a_tests/result.json`, junto con los TRX y respaldos privados de esa carpeta. No hay datos personales procedentes de Supabase: las filas son ficticias.

En esta revisión se volvió a ejecutar restore, build y la suite completa usando un PostgreSQL efímero de loopback, restaurando solamente el dump estructural de referencia en una base nueva `_tests`: 41 unitarias y 27 integración, 68 correctas, ninguna fallida ni omitida. El clúster temporal y sus archivos se eliminaron al terminar.

## Hallazgos y correcciones

| Hallazgo | Corrección / resultado |
| --- | --- |
| El modelo seguía declarando el CHECK anterior aunque el script 003 lo sustituye. | MinistryDbContext describe ahora CHECK v2 e índice único parcial del esquema activado. Las once tablas siguen excluidas de migraciones. |
| NOBYPASSRLS por sí solo no impide omitir RLS si el usuario es propietario o puede asumir un rol propietario; una cuenta fuera de `mlp_runtime` tampoco recibiría las políticas asignadas al grupo. | Validación de runtime exige membresía `mlp_runtime` y comprueba atributos, membresías `pg_*`, propiedad de relaciones/funciones/esquemas/base y CREATE sobre esquemas. Las membresías propietaria y `pg_read_all_data`, además de una conexión sin el grupo, se rechazan en integración. |
| Bootstrap podía usar la conexión de ejecución y sus errores no estaban sanitizados. | Requiere Database:MigrationConnectionString separada; solo el comando explícito la selecciona. Valida límites de seguridad aunque no arranque el host. Error controlado con salida 2 sin credenciales/correo; repetición y configuración débil rechazadas. |
| Login podía distinguir credenciales válidas con persona inactiva o acceso inválido mediante 403/404. | Devuelve el mismo 401 genérico, sin cookie. Errores de dependencia conservan su tratamiento. |
| Resolver concesiones de una cuenta multi-sede fuera del ámbito devolvía 403 antes de ocultar el recurso. | Gestión de usuarios normaliza ese caso a 404. Se verificó denegación de lectura y desactivación desde una sede incompleta. |
| Bloqueo estaba fijado en código y readiness no verificaba FK/políticas. | MaxFailedAccessAttempts/LockoutMinutes configurables con límites; readiness requiere cuatro FK validadas, RLS/políticas en once tablas y helper de sede. |
| El script 001 creaba `auth_app` y su historial fuera de la transacción de la migración. | La transacción ahora cubre desde la creación del esquema e historial; cualquier fallo deja intacto el estado previo. |
| La comprobación runtime no cubría membresías `pg_*`, propiedad de funciones/vistas ni el propietario de la base de datos; el SQL 005 tampoco prevalidaba un grupo existente. | Se amplió el chequeo de arranque/readiness y el preflight de 005; el ensayo comprueba que una membresía `pg_read_all_data` se rechaza antes de conceder permisos. |
| La guía citaba helpers PowerShell inexistentes y usaba `Development` para el bootstrap contra producción. | Se retiraron los comandos no disponibles y el bootstrap ahora exige `Production`, TLS verificado y configuración de key ring/certificado. |
| No había ejecución real de bootstrap CLI ni recuperación de un respaldo. | Escenario con procesos reales psql, pg_dump, pg_restore, dotnet CLI y Kestrel HTTPS; restauración antes y después del bootstrap. |

No se identificaron incompatibilidades nuevas de columnas, tipos UUID o relaciones frente al baseline real previamente inspeccionado. Esta revisión no constituye una nueva inspección del estado actual de producción.

## Modelo y autorización

Identity usa exclusivamente auth_app, sin roles Identity duplicados. Usuarios y referencias son UUID PostgreSQL/Guid .NET. users.person_id es opcional, FK a iglesia.persona y único cuando está informado; permite el administrador inicial sin persona vinculada. Una misma persona no puede ligarse a dos cuentas.

user_access_grants vincula usuario/rol/sede: SUPER_ADMIN exige sede nula; BRANCH_ADMIN/OPERATOR exigen sede activa y rol no global. Se admiten concesiones de varias sedes para una cuenta. La administración de sede no gestiona una cuenta que tenga accesos fuera de su ámbito.

Los permisos OPERATOR son UUID explícitos del catálogo existente, sin permisos implícitos. BRANCH_ADMIN solo delega subconjuntos de sus permisos y no obtiene USER_ASSIGN_ROLE por tener USER_CREATE. API verifica capacidad y sede; RLS proporciona una segunda barrera de sede. La credencial PostgreSQL runtime es privada del servidor y no debe entregarse a Angular. `mlp.actor_id` es un GUC fijado por la API y cualquier sesión SQL con esa credencial puede cambiarlo; por tanto RLS defiende contra omisiones accidentales de filtros de sede, pero no es una frontera contra SQL arbitrario ejecutado con la credencial runtime. La conexión debe permanecer privada y la API debe evitar SQL injection.

Cuatro FK entre esquemas en script 004, todas RESTRICT y validadas: users→persona, grants→rol/sede, grant_permissions→permiso. Las FK externas son SQL revisado, no se importan entidades ministeriales al contexto/migraciones de Identity.

## Resultados ejecutados

- `dotnet restore MisionLiderParis.slnx --locked-mode`: correcto.
- `dotnet build MisionLiderParis.slnx --no-restore -c Release`: correcto, **0 advertencias y 0 errores**.
- `dotnet test MisionLiderParis.slnx --no-build --no-restore -c Release ...`: **41 unitarias + 27 integración = 68 correctas, 0 fallidas, 0 omitidas**.
- Reejecución de esta revisión después de los cambios locales: `dotnet restore MisionLiderParis.slnx --locked-mode`, `dotnet build MisionLiderParis.slnx --no-restore -c Release` y `dotnet test MisionLiderParis.slnx -c Release --no-restore`: restore/build correctos, build con 0 advertencias/errores, 41 unitarias y 27 integración correctas en clúster PostgreSQL efímero local.
- Unitarias: políticas, ciclo de asignaciones, comparador y límites de ambos modelos. La prueba de metadatos pendiente de la etapa anterior pasó.
- Integración: Identity, CSRF/CORS/cookies, sesión, lockout real tras cinco fallos, vínculo cuenta/persona, unicidad, revocación por baja, aislamiento multi-sede, delegación, concurrencia y reportes.
- Activación: aplicación de scripts SQL 001–005 reales con filas existentes; contenido y OID de las once tablas idénticos tras cada script; dos triggers no afectados conservados; FK validadas; scripts Identity ejecutados dos veces sin duplicación.
- Respaldo previo restaurado en base nueva con contenido igual. Datos inválidos de PENDING provocan aborto del 003 sin reparación ni pérdida.
- Respaldo posterior restaurado en otra base nueva conservando cuenta, hash Identity, concesión, tablas ministeriales y ACL runtime. El usuario runtime accedió correctamente.
- Bootstrap por proceso dotnet real: primera creación correcta, segundo intento rechazado. Primer login Kestrel HTTPS con certificado validado, SUPER_ADMIN global, lectura de sedes, logout y 401 posterior.
- La evidencia de activación registra readiness 200, login 200, sesión SUPER_ADMIN global, logout 204 y sesión revocada 401 mediante Kestrel HTTPS. Los scripts `Start-LocalBackend.ps1` y `Test-FirstLogin.ps1` citados anteriormente no existen en este checkout; se corrigió la guía para no depender de ellos.

TRX finales: `artifacts/activation-test-results/rodrigo.jimenez_PMVM1018_2026-10-24_14_45_08_net10.0.trx` (unitarias) y `...14_45_09_net10.0.trx` (integración). La instancia retenida procede del ensayo de las 14:36; se reinició con la compilación final y pasó de nuevo el comprobador de login. Hubo un fallo inicial del nuevo escenario multi-sede que reveló la inconsistencia 403/404; se corrigió antes de esta ejecución final.

Checks adicionales: modelo AuthDbContext sin cambios pendientes de migración; npm run spec:check, deps:check, skills:check, format:check y build correctos. El build Angular verificó 31 referencias de recursos. No se ejecutaron unitarias frontend ni revisión visual, pues no hubo cambios de UI. La primera serialización de trazabilidad produjo una lista anidada inválida; se aplanó y spec:check pasó después.

## Inventario pendiente en Supabase

La comparación estructural y la inspección de seguridad READ ONLY actuales se completaron el 2026-10-24 con `mlp_inspector` y TLS VerifyFull. Esta evidencia actualiza la captura histórica anterior; no equivale a aplicar ni aprobar cambios productivos. No se ejecutaron los scripts 001–005, no se aplicó DDL y no se modificaron tablas ni roles de Supabase.

## Cierre de bloqueantes del Paso 19

- **AC-016 — APROBADO CON CONDICIONES:** además del comparador estructural (37 findings review, cero blocking; SHA-256 `1C5FBA619ED7ADAD251E89F8AAF0DBD7806D6E2099CB4547DECE54D245010A02`), se ejecutó 018 mediante Npgsql usando User Secrets y VerifyFull. El comando verificó que el archivo contiene transacción `REPEATABLE READ READ ONLY` con `ROLLBACK`, ejecutó la consulta y guardó la salida local; código 0, sin DDL. Informe: `src/MisionLiderParis.Api/schema-security-metadata.json`, SHA-256 `3FA07647A2850D6649FE7F33954795C1D2832D9830DD0353C548E021B6E413B0`.
  - `mlp_runtime` y `mlp_api_runtime` no existen todavía; es estado esperado antes de desplegar, no un rol existente con atributos inseguros. El diseño revisado exige preaprovisionar `mlp_runtime` y `mlp_security_definer` con la autoridad de roles antes de 005; el LOGIN `mlp_api_runtime` se aprovisiona por separado después. No se pudieron verificar sus atributos/membresías futuros.
  - `iglesia` y sus 11 tablas y tres funciones pertenecen a `postgres`; `auth_app` no existe aún. No hay políticas en iglesia/auth_app; las once tablas ministeriales tienen RLS habilitado y FORCE RLS desactivado. Estado previo a 005, no apto para activar runtime.
  - `postgres` no es SUPERUSER, pero tiene BYPASSRLS, CREATEROLE, CREATEDB y REPLICATION y es propietario de los objetos ministeriales. Puede crear roles, pero usarlo como operador DDL contradice el perfil mínimo documentado. `supabase_admin` es SUPERUSER/BYPASSRLS; `service_role` es BYPASSRLS. Ninguno debe ser el LOGIN runtime.
  - `mlp_inspector` es LOGIN/NOINHERIT sin atributos privilegiados ni membresías, y carece de privilegios efectivos sobre tablas y secuencias. La ACL de `iglesia` sí le concede USAGE, más de lo solicitado originalmente; debe revocarse en una operación posterior autorizada. Tiene EXECUTE efectivo por PUBLIC en tres funciones `RETURNS trigger`, SECURITY INVOKER con `search_path=""`; no da privilegio de lectura/escritura de tablas.
  - La consulta de roles, membresías, propietarios, ACL efectivos, funciones y políticas se completó sin error. Las membresías de plataforma observadas son `authenticator` → `anon`, `authenticated` y `service_role` con INHERIT falso. `postgres` no es SUPERUSER, pero tiene BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION y posee los objetos ministeriales; `supabase_admin` es SUPERUSER y posee funciones de event trigger de la plataforma. `service_role` también tiene BYPASSRLS y `dashboard_user` tiene CREATEROLE/CREATEDB/REPLICATION. Estos son roles de plataforma, no runtime; las ACL efectivas no les dan acceso al esquema ministerial a `anon`/`authenticated`/`service_role`.
  - La ausencia de `auth_app` y roles runtime se observó explícitamente; no se infirieron sus permisos futuros. No hubo errores de visibilidad en los catálogos consultados. `apiSchemaSettings` no contiene `pgrst.db_schemas` a nivel de base/rol; esto no sustituye revisar la configuración PostgREST del panel Supabase. Las condiciones de despliegue y evidencias completas están en `specs/001-ministry-backend/validation.md`.
- **AC-017 — APROBADO en ensayo local restringido:** se restauró el baseline real de solo estructura en una base local nueva, se cargaron filas ficticias para dos sedes y se creó un respaldo custom que se verificó y restauró en bases aisladas. El LOGIN de despliegue no fue SUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB ni REPLICATION; asumió un owner DDL NOLOGIN y con atributos equivalentes. Un administrador separado preaprovisionó `mlp_runtime` y `mlp_security_definer`; 005 ahora exige esas precondiciones y no intenta crear roles. Los scripts 001–005 pasaron secuencialmente. Se revocó CREATE de base al owner después de 001 y los pasos posteriores pasaron sin ese privilegio. Los fingerprints de filas y OID de las once tablas ministeriales permanecieron iguales; cuatro FK quedaron validadas, las once tablas conservaron RLS y recibieron políticas runtime, el aislamiento por sede pasó y un cambio de estado inválido fue rechazado sin persistirse. La restauración posterior se verificó. Esta simulación no demuestra privilegios ni datos actuales de Supabase.
- **AC-019 — APROBADO para el estado Git inspeccionado:** Git 2.53.0 está disponible. `git status --short --untracked-files=all` mostró 122 rutas: 13 modificaciones/eliminaciones y 109 sin seguimiento; no había rutas staged. Los cambios ajenos a esta actualización se conservaron. En 337 archivos rastreados/sin seguimiento y 87 commits no se detectaron claves privadas, URI PostgreSQL con credenciales, claves cloud conocidas ni archivos sensibles rastreados por nombre. Las coincidencias amplias de asignación de credenciales restantes aparecen en pruebas y documentación/comandos, no en configuraciones con credenciales reales. `.env*`, `backend/.local/` y `appsettings.Local.json` están ignorados. La auditoría detectó que faltaban exclusiones para certificados/llaves privados; `.gitignore` ahora ignora `*.pfx`, `*.p12`, `*.pem` y `*.key`, confirmado con `git check-ignore`. No hay archivos de esos tipos rastreados. `.env.example` contiene variables secretas vacías. DPAPI solo se usa para el handoff local de Windows; la guía productiva requiere secretos del hosting y key ring persistente cifrado con certificado.

| Orden | Artefacto | Tipo / propósito |
| --- | --- | --- |
| 1 | sql/001-auth-app.sql | EF 20261024015144_InitialApplicationIdentity: cinco tablas Identity/cuentas/concesiones y su historial en auth_app. |
| 2 | sql/002-explicit-operator-permissions.sql | EF 20261024044431_ExplicitOperatorPermissions: permisos explícitos por concesión. |
| 3 | sql/proposals/003-assignment-integrity.sql | SQL manual: CHECK v2, retiro sin inicio, validación/transiciones del trigger de fechas e índice único de abiertos. |
| 4 | sql/004-auth-ministry-references.sql | SQL manual: cuatro FK entre esquemas, índices y dos validadores de concesiones. |
| 5 | sql/005-runtime-role-rls.sql | SQL manual: exige mlp_runtime/mlp_security_definer preaprovisionados; helpers SECURITY DEFINER dedicados y políticas RLS/grants limitados. |

Pendientes según la última inspección productiva; no se comprobó drift remoto en esta fase. 001/002 son idempotentes y registran historial EF; 003/004/005 son de aplicación única revisada y no aparecen en dicho historial. La API no aplica ninguno al iniciar.

El 003 sustituye deliberadamente solo el CHECK de fechas y un trigger existente; conserva los otros dos triggers y la función original para revisión. No elimina ni reconstruye tablas, ni borra/repara filas. Los pasos 004/005 no crean catálogos ministeriales ni abren acceso a anon/authenticated/PUBLIC.

## Paso 21 — endurecimiento de roles y ensayo restringido

- 005 exige `mlp_runtime` y `mlp_security_definer` preaprovisionados. `has_global_access()` y `can_access_branch(uuid)` son los únicos helpers `SECURITY DEFINER`; pertenecen a `mlp_security_definer`, usan `search_path=''`, no ejecutan SQL dinámico y solo `mlp_runtime` tiene EXECUTE. El owner helper recibe SELECT explícito y políticas propias en `iglesia.rol`/`iglesia.sede`, sin `BYPASSRLS`; se retiró `has_any_branch_access`, que no tenía consumidores.
- El LOGIN de despliegue no tiene SUPERUSER, BYPASSRLS, CREATEROLE ni CREATEDB; asume temporalmente un owner DDL NOLOGIN. Un administrador separado preaprovisiona roles y transfiere ownership. CREATE de base se revoca tras 001; CREATE de `iglesia` y la membresía temporal del helper se revocan tras 005. La credencial runtime no recibe roles propietarios.
- El ensayo actualizado con PostgreSQL aislado aplicó 001–005 secuencialmente, preservó filas/OID de las once tablas ministeriales y comprobó FK, RLS por sede, ownership/ACL de helpers y revocación de CREATE en base tras 001. El caso de activación restringida pasó. No se conectó a Supabase ni se cambió producción.
- **AC-016 sigue APROBADO CON CONDICIONES**: no se verificó en un proyecto Supabase no productivo que la identidad administrativa pueda preaprovisionar las membresías y transferir los once objetos/funciones bajo las restricciones del proveedor. No se debe afirmar que ese preflight remoto pasó.
- **AC-017 APROBADO en PostgreSQL local restringido**, no como prueba de compatibilidad del proveedor. Runtime conserva DML de Identity necesario y `mlp.actor_id` es un GUC modificable por quien tenga la credencial; RLS no sustituye prevención de SQL injection ni protege de SQL arbitrario ejecutado con esa credencial.

## Archivos modificados

- API: Program.cs, AuthController.cs, RuntimeDatabaseValidator.cs y ReadinessCheck.cs.
- Inspección READ ONLY de seguridad Supabase: Program.cs incorpora `--inspect-live-security`, que exige TLS VerifyFull y ejecuta 018 mediante Npgsql; el informe local sensible `schema-security-metadata.json` está ignorado por Git. SQL 018 ahora devuelve atributos/membresías transitivas, propietarios y privilegios efectivos para los roles relevantes.
- Infrastructure: RuntimeDatabaseSafety.cs, BackendOptions.cs, DependencyInjection.cs, AdministratorBootstrap.cs, AuthDbContext.cs, MinistryDbContext.cs y UserAdministration.cs.
- Comparador de esquema: SchemaInspector.cs ahora consulta metadatos de `pg_catalog` sin requerir lectura de filas ministeriales; la compilación y las 41 pruebas unitarias pasaron. El ensayo con rol CONNECT-only fue local y no sustituye la comparación remota.
- Configuración: .gitignore, appsettings.json, .env.example y workflow backend.yml.
- SQL: comentarios de 003 y preflight de privilegios del grupo runtime en 005.
- Integración: PostgresActivationTests.cs, TestDatabaseSetup.cs, PostgresIdentityTests.cs, PostgresMinistryTests.cs y csproj de integración.
- Operación/documentación: README, database-rollout.md, esta revisión, instrucciones/ADR/contexto y specs/001-ministry-backend. Los dos helpers PowerShell citados en documentos históricos no están disponibles en este checkout.

No se reescribieron módulos ministeriales ni UI Angular. La auditoría previa usó Git; en la sesión Paso 21 `git.exe` no estuvo disponible en PATH, por lo que no se creó commit ni push y se dejó pendiente revalidar el índice actual.

## Riesgos y límites pendientes

- El preflight debe ejecutarse con datos y esquema actuales de producción en una ventana revisada: una base local no demuestra que todos sus datos sean compatibles ni estima duración de bloqueos/índice.
- No se ha probado DDL con las restricciones particulares del rol de operador del Supabase actual; comprobar propietario, permisos y drift antes de la aplicación.
- No SMTP externo, integración de Angular, navegador real, proxy de despliegue, certificado público ni configuración de claves productivas verificados. CORS local espera https://localhost:4200; Angular no se integró.
- MFA no implementado. Rate limit es por IP/instancia; requiere configuración de proxy/perímetro para despliegue.
- Las pruebas cubren escenarios concretos, no acreditan ausencia absoluta de vulnerabilidades ni todas las carreras externas a la API. Quien accede directamente al SQL puede eludir reglas que solo aplica el servicio.
- El respaldo local verificado cubre iglesia/auth_app y roles ya presentes en el mismo clúster. Una recuperación Supabase completa también requiere roles/grants, secretos, claves persistentes y servicios administrados; no restaurar indiscriminadamente roles internos.
- El clúster PostgreSQL temporal de la simulación AC-017 se detuvo y sus archivos temporales se eliminaron. Los procesos y credenciales de prueba anteriores no son infraestructura productiva.

Comandos exactos, respaldo/recuperación y bootstrap con credenciales propias: [database-rollout.md](database-rollout.md).
