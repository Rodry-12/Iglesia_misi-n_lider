# Validación — 001 Backend ministerial

## Continuación de rendimiento — 2026-11-10 (AC-029)

- BranchService.AdministratorsAsync agrupa existencia de sede y roles en una sola
  transacción READ ONLY firmada. Autorización global previa intacta. Conteo/página
  de Identity conservan conexión separada y finalizan después del scope ministerial.
- BranchAdministratorsShareSignedReadScopeAndPreserveCallerTransaction verifica
 2 transacciones ministeriales (permisos+lecturas) frente a3 del código anterior,
  respuesta/conteo,404,limpieza y conservación de la transacción del llamador.
- 16/16 integraciones aprobadas en loopback:57693/mlp_user_validation_tests con
  MLP_TEST_PREPROVISIONED=1 y roles separados. Incluyen CRUD de sedes, prohibición
  no global, Identity/login/logout/revocación y contexto firmado/solo lectura.
  Evidencia: backend/artifacts/performance-20261110/*.trx.
- Primer intento con helper histórico falló antes de ejecutar escenarios por falta
  de modo preaprovisionado. No hubo migraciones. Se corrigió solo el entorno de tests
  y se ejecutó proyecto IntegrationTests directamente en Debug; no se cambió fixture.
- Clúster aislado detenido al terminar. Ningún cambio de datos o configuración en
  Supabase, ni scripts remotos. No se midió HTTP autenticado real: menos transacciones
  no equivale a un número de segundos demostrado.

## Rendimiento — 2026-11-09 (AC-029)

Solicitud vigente: revisar y corregir latencia, documentando cómo arrancan ambos
proyectos. No se ejecutaron escrituras ni SQL de aprovisionamiento en Supabase.

- Reproducción: `AuthorizationPerformanceTests.GlobalGrantResolutionUsesOneReadOnlyTransactionAndTwoQueries`
  falló inicialmente con expected=1/actual=4 transacciones. El segundo caso de limpieza
  aprobó antes de la corrección. Evidencia: `backend/artifacts/performance/before.trx`.
- Tras corregir, `after.trx`: **20/20 integraciones**. Tres casos nuevos cuentan una
  transacción/dos comandos EF para concesión global, dos transacciones para cada uno
  de cinco listados (incluidos filtros de asignación), conservación de transacción
  del llamador, limpieza y rechazo tras desactivar cuenta. Incluye regresiones Identity,
  firma, prueba adulterada, aislamiento, rollback, cancelación y reutilización de pool.
- `regressions.trx`: **17/17 integraciones** adicionales. Incluye cuarto caso nuevo
  READ ONLY que rechaza UPDATE con SQLSTATE25006 y recupera contexto tras rollback,
  además de concesiones, invitaciones simuladas y concurrencia de baja de sedes.
  Son **37 casos distintos aprobados**, sin pruebas de navegador ni envíos externos.
- `unit.trx`: **36/36 unitarias** de BranchAuthorizationTests, AccessScopeTests,
  UserAdministrationPolicyTests y AccountAccessValidator. Los tests pasaron en Debug.
- Comandos: `dotnet test backend/tests/MisionLiderParis.IntegrationTests --configuration Debug --no-restore --filter <casos anteriores> --logger trx --results-directory backend/artifacts/performance -m:1 -nodeReuse:false`;
  unitarias con el mismo patrón sobre `backend/tests/MisionLiderParis.UnitTests`.
  Se usó exclusivamente loopback127.0.0.1:57693/base mlp_user_validation_tests,
  preaprovisionada, sin migraciones. La fixture registra una clave efímera solo en
  esa base aislada; no se usan credenciales reales ni se modifica Supabase.
- `dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore -m:1 -nodeReuse:false`:
  aprobado, cero advertencias/errores. El primer intento Release encontró DLL bloqueado
  por la API en uso; los tests se hicieron en Debug sin interrumpirla, y después se
  detuvo exclusivamente su PID verificado para compilar/reiniciar Release.
- Reinicio mediante `.local/supabase-key-review/Start-VerifiedApi.ps1 -LocalInvitations`:
  API activa en7243; verificador existente devuelve runtime/Identity seguros,
  Identity consultable, firma aceptada, once tablas con RLS, ninguna persona sin actor,
  contexto limpio tras rollback, TLS validado, readiness200 y Gmail anónimo401.
  Cero escrituras remotas y cero correos; no se inició OAuth.
- GET HTTPS con CA validada: readiness200 en1.310674s y Angular /gestion/sedes200
  en0.053619s. Son dos mediciones puntuales; la segunda sirve la SPA, no acredita
  sesión ni listado autenticado. No se presentan como benchmark de endpoints ministeriales.
- No se modificó Angular, secretos, permisos, HMAC/RLS SQL ni esquema. Se conserva
  validación por operación y no se añade caché entre peticiones. Las lecturas agrupadas
  conservan READ COMMITTED, sin prometer un snapshot único entre conteo y página.
- Falta comparación p50/p95 de endpoints HTTP autenticados contra Supabase real.
  La mejora acreditada es menor número de transacciones/consultas redundantes.

Archivos: Infrastructure/Access/MinistryDirectory.cs;
Infrastructure/Ministry/{ActorTransactionContext,BranchService,PeopleService,ProcessCatalogService,AssignmentService}.cs;
tests/IntegrationTests/AuthorizationPerformanceTests.cs (proyecto MisionLiderParis.IntegrationTests);
BranchAuthorizationTests.cs, documentación de rendimiento y docs/development.md raíz.

Los apartados siguientes son históricos; sus pendientes de activación no describen
el estado operativo actual confirmado por el verificador anterior.

## Aprovisionamiento HMAC y arranque real — 2026-11-09

Ejecución remota expresamente autorizada contra Supabase sneceodpvscrvjrlqwgw: respaldo y recuperación cifrada revalidados; almacén vacío y estructura exacta comprobados; registro de una clave de 32 bytes mediante la sobrecarga pgcrypto de ActorKeyProvisioner. USAGE de extensions concedido temporalmente a mlp_ddl_owner, retirado antes del commit junto a la membresía del operador. ACL completa del esquema comparada antes/después y única clave activa verificada tras commit. Recuperación cifrada comprobada antes del commit y material coincidente al guardar los dos User Secrets; configuración Identity conservada. Evidencia operativa: `.local/supabase-key-review/hmac-status.json`.

API Release compilada sin errores/advertencias y ejecutándose en Production, HTTPS localhost:7243, conexiones runtime ministerial/Identity separadas y VerifyFull, Data Protection persistente protegido por certificado. Verificación real exclusivamente de lectura: safety de ambos roles, consulta Identity, RLS activo en once tablas, personas invisibles sin actor, ActorTransactionContext existente aceptado por PostgreSQL con alcance global y consulta de personas bajo RLS, contexto eliminado tras rollback. HTTPS con certificado validado: ready 200, sesión anónima 401, Gmail anónimo 401. Configuración Gmail validada; no se probó login HTTP nuevo, no se autorizó Google ni se enviaron correos. Evidencia: `.local/supabase-key-review/runtime-verification.json` y `api-status.json`. Sin scripts 100/101, migraciones, bootstrap ni cambios ministeriales. Los apartados previos conservan evidencia histórica y sus bloqueos anteriores.

## Aprovisionamiento sin parámetros secretos — 2026-11-09

Overload de `ActorKeyProvisioner.InsertAsync` con generación pgcrypto VOLATILE dentro de PostgreSQL, retorno TLS y rechazo previo de deriva del almacén. Ejecutor temporal adaptado sin SET de logging, con recuperación cifrada antes del commit y comparación del material en memoria. Ensayo exclusivamente en `127.0.0.1:58273/key_confidentiality_tests`, clúster desechable sin datos reales y detenido al finalizar: diez comprobaciones correctas, incluida ausencia de material en logs con log_statement=all, duración=0, parámetros completos y auto_explain=0/verbose. Cubiertos commit/coincidencia, rollback, duplicados, rechazo de triggers/restricciones imprevistas, recuperación cifrada y adulteración. Resultado: `.local/key-confidentiality-tests/result.json`; código/runner en esa carpeta. API y ejecutor compilan Release sin advertencias/errores; cinco regresiones ActorProofTests aprobadas. No hubo conexión ni cambios en Supabase, ni cambios de User Secrets. Registro remoto y arranque siguen pendientes de autorización de la alternativa.

## Preparación local del registro HMAC — 2026-11-09

Ejecutor temporal `.local/supabase-key-review/KeyOperator.csproj` compilado Release, cero errores y advertencias. Dos procesos independientes comprobaron generación de 32 bytes, protección con el certificado persistente, recuperación y rechazo de ciphertext adulterado. Sin conexión a Supabase, sin registro de clave y sin cambios de User Secrets. El ejecutor comprueba la conservación de los secretos ajenos a cada actualización. El helper existente `scripts/Set-SupabaseLoginPassword.ps1` admite ahora el rol Identity. Registro HMAC y asignación de contraseña remotos pendientes de autorización expresa; API no iniciada en esta preparación.

## Despliegue SQL real autorizado — 2026-11-08 (Colombia)

Supabase `sneceodpvscrvjrlqwgw`, base postgres, Session pooler y TLS VerifyFull. Respaldo cifrado de ambos esquemas y metadatos de roles, restauración aislada con propietarios/ACL originales y 102 coincidente, revalidados antes de desplegar. Estado remoto y datos coincidieron con la restauración. Ejecutados solamente GRANT USAGE de extensions al definer, 100 íntegro una vez con commit y 102. Resultado: dos roles Identity seguros, siete funciones seguras, 27 políticas, RLS en once tablas, runtime sin acceso directo a Identity/clave, cero membresías temporales, cero claves y datos de las 18 tablas originales sin cambios. Evidencia operativa local: `.local/supabase-backup-review/deployment-status.json`; hash y plan del siguiente paso en `docs/signed-actor-rollout.md`.

No se ejecutaron 001–090, 101, migraciones ni bootstrap. No se asignaron passwords ni se actualizaron User Secrets. API, conexión Identity efectiva y contexto autenticado real pendientes de registrar HMAC y completar configuración con aprobación adicional. Los apartados siguientes conservan evidencia histórica; sus declaraciones de no despliegue corresponden a esas fechas anteriores.

## Remediación RLS firmada — cierre 2026-11-07

AC-025/026/027/028. Antes del cambio se ejecutaron dos regresiones contra el esquema previo: ambas fallaron porque aceptaban UUID global y conservaban contexto tras rollback (`artifacts/signed-actor/before-remediation.trx`). Después: **58 unitarias + 45 integraciones = 103 correctas**, cero fallidas/omitidas dentro de la selección ejecutada. Evidencia final: `artifacts/signed-actor/signed-verified_net10.0_20261107111249.trx` y `signed-verified_net10.0_20261107111309.trx`. Restore locked y compilación Release durante test correctos. Se excluyó expresamente PostgresActivationTests porque ejecuta migraciones/bootstrap históricos, prohibidos en esta solicitud; no se acredita la suite histórica completa ni el workflow CI remoto.

Las pruebas usan exclusivamente `mlp_user_validation_tests` de loopback, preaprovisionada, con identidades ministerial/Identity/operador separadas. No utilizan User Secrets. Cubren firma válida, UUID sin firma, MAC adulterado, vencimiento, PID distinto, replay tras commit, rollback, ausencia de actor, hints de persona sin firma, revocación de stamp, permisos SQL 42501, errores/cancelación, reutilización comprobada del mismo PID y solicitudes concurrentes repetidas A/B. Incluyen prohibición de revocar cuentas globales vinculadas desde una sede. La suite HTTP existente conserva login/logout, sesiones, administración/delegación, personas con documento obligatorio, cambios de sede/desactivación, documentos, procesos/asignaciones/reportes y rechazo de escalada.

SQL 100–102 parseado con libpg-query PostgreSQL 17. El incremento 100 se ensayó exclusivamente en bases aisladas existentes. El procedimiento 101 se ejecutó localmente reemplazando su COMMIT final por ROLLBACK: deshabilitó nueve claves dentro de la transacción y revirtió, sin bloquear los siguientes tests. 102 confirmó cuatro comprobaciones ACL falsas, siete funciones con search_path vacío/EXECUTE público revocado y 27 políticas. No se cambian los scripts históricos 010–080. Procedimiento y límites: `docs/signed-actor-rollout.md`.

Sin conexiones ni cambios a Supabase en esta implementación, sin migraciones EF, bootstrap ni 090. No se ha hecho aceptación remota ni prueba nueva de navegador Angular. El nuevo backend requiere desplegar SQL, credencial Identity y clave HMAC conjuntamente; no iniciar contra Supabase hasta aprobación y configuración. El rollback posterior al commit contiene el acceso, no restaura la vulnerabilidad.

Cierre adicional: `dotnet build -c Release --no-restore` correcto, cero advertencias/errores; `npm run spec:check` y comprobación del generador SQL Editor correctos. Build Angular correcto al repetir fuera de la restricción de procesos del sandbox (el primer intento falló por spawn EPERM); frontend sin cambios de código. El clúster PostgreSQL de pruebas quedó detenido; API no reiniciada.

## Autorización por sede — 2026-11-06

Evidencia detallada: `docs/branch-isolation-validation-2026-11-06.md`. Primero:
50 unitarias + 13 HTTP correctas, 21 PostgreSQL omitidas. Después, base loopback
ya preaprovisionada, sin migraciones/DDL/bootstrap: 52 unitarias + 35 integraciones
correctas, más una integración posterior del límite de permisos OPERATOR (36
integraciones distintas). Caso simétrico de dos sedes ampliado a personas,
asignaciones, reportes y CSV: correcto. Test de activación excluido expresamente.
Clúster de prueba detenido al terminar. Supabase: SuperAdmin HTTP 200 en listado y
detalle de su única sede; logout 204 y sesión 401. Sonda SQL READ ONLY con rollback:
sin actor/actor inexistente cero registros; runtime puede suministrar UUID global
y obtener acceso. RLS confía en el backend y no replica permisos granulares; no
acreditar resistencia frente a SQL runtime malicioso. Sin cambios ministeriales
remotos, migraciones, bootstrap, 090 ni cambios de código de producto.

## Corrección de ejecución 040 — 2026-11-06

El operador reportó 42601 con texto terminado dentro de `validar_estado_fechas_v2`, después de THEN y antes del cierre de función. Se describe truncación del SQL recibido, sin atribuir un origen no demostrado (selección, copia o interfaz). El archivo previo completo es válido para el parser. Solo el 040 derivado cambia sus delimitadores a literales PostgreSQL E de una línea, preservando texto decodificado, transacción y once statements del origen. No se modifica `sql/proposals/003-assignment-integrity.sql`, lógica de dominio ni RLS. Se añade 041 de metadatos y guía de ejecución completa con FIN 040. No se repiten 010–030 ni se abre base remota/local.

Correctos: `node --check` del generador/verificador, generación y `--check`, `verify-integrity-040.mjs` (parser PostgreSQL 17, 170004: once statements/cuerpos idénticos, BEGIN/COMMIT y siete archivos 040/041/050–090 con sintaxis válida), regresión `verify-identity-020.mjs` y `npm run spec:check`. Cotejo contra paquete anterior: 010/020/021/030 y 050–090 sin cambios. Evidencia `artifacts/integrity-040/verification.json`; parser no ejecuta semántica PL/pgSQL ni acredita SQL Editor remoto. Cero conexiones de base/SQL ejecutado. Archivo completo de 040: 60 líneas, sin dollar quotes y con marcador FIN 040.

## Corrección de ejecución 020 — 2026-11-06

El operador informó 010 checkpoint OK, fallo 42601 de 020 tras transformación del Editor y auth_app ausente (cero tablas), once tablas iglesia, cuatro roles técnicos y cero políticas. Se toma ese estado como evidencia comunicada, sin reinspección ni cambios remotos. No repetir 010. Se identificaron en el código público de Supabase las rutas Run without RLS/original y Run and enable RLS/transformación; no se afirma haber reproducido su versión desplegada ni el SQL alterado exacto del incidente.

020 ahora deriva las sentencias originales de CREATE SCHEMA, seis CREATE TABLE, siete índices e INSERT de historial al nivel superior, manteniendo guard de esquema ausente, contexto owner, checkpoints y permisos. No cambia el modelo ni la migración fuente; no agrega ENABLE/DISABLE RLS. Su checkpoint aborta ante RLS inesperado dentro de la transacción. Se añade 021 READ ONLY y guía `docs/identity-020-sql-editor-fix.md`.

Verificación offline: `libpg-query@17.6.0` (parser PostgreSQL 17, versión AST 170004) instalado solo en `.local/sql-parser-020`, sin servidor ni dependencias de aplicación modificadas. Comparación AST de tablas/columnas/constraints/identity/PK/FK, índices y predicados, e INSERT de historial: iguales al origen. 020 sin DO EF ni CREATE TABLE dentro de DO; transacción única. Parser comprueba sintaxis SQL sin resolver objetos/roles ni ejecutar semántica PL/pgSQL. Se cotejaron 010 y 030–090 contra el ZIP anterior: textos idénticos. `scripts/verify-identity-020.mjs` registra evidencia privada en `artifacts/identity-020/verification.json`: nueve archivos (020/021 y 030–090) con sintaxis válida, seis tablas y siete índices explícitos preservados, sin cambio RLS. `node --check` de generador/verificador, generación, `--check`, verificador AST y `npm run spec:check` correctos. No se ejecutó SQL, conexiones de base, bootstrap ni tests remotos; no se inició PostgreSQL local.

## SQL Editor — preparación 2026-11-06

AC-020: paquete `sql/supabase-editor/` con diez bloques, README y manifest. Cinco cuerpos derivados de 001–005 sin cambios; añadidos de contexto transaccional/guards/checkpoints y retirada de membresías temporales. La consulta final reutiliza RuntimeDatabaseSafety con rol explícito. PostgreSQL 17 y guía oficial Supabase verificadas para ownership, SET ROLE y grantor de membresías; no se presupone que postgres pueda revocar concesiones de supabase_admin. Los checkpoints de filas Identity corren como owner antes de liberar el contexto; 080 lee solo catálogos porque BYPASSRLS no otorga USAGE/SELECT. Passwords separados en `scripts/Set-SupabaseLoginPassword.ps1`, sin secretos ni metacomandos en `.sql`. Ninguna conexión remota, DDL, backup, creación de rol, bootstrap o test de integración ejecutado durante esta adaptación. No se inició PostgreSQL local ni se creó proyecto. El respaldo y restauración reales siguen pendientes, y preparar archivos no autoriza ejecutarlos.

Comprobaciones offline correctas: `node --check backend/scripts/prepare-supabase-sql-editor.mjs`, generación y `--check` (cinco cuerpos intactos, manifest coherente, sin metacomandos/contraseñas literales), Parser.ParseFile del helper PowerShell sin errores y `npm run spec:check`. Revisados los límites independientes de transacción de los diez SQL. No se presenta esta revisión estática como prueba funcional de SQL contra Supabase.

## Preparación de activación Supabase — 2026-11-06

AC-015/020: se prepararon `docs/supabase-activation-2026-11-06.md`, `scripts/Backup-Supabase.ps1` y SQL de activación 010/011/020/030. Se reutiliza inspección remota 009.1, sin repetir consultas. Clientes existentes pg_dump/pg_restore 17.11 disponibles; no se instaló ni inició servidor. Sintaxis PowerShell comprobada por Parser.ParseFile, sin ejecutar el script. Frontend, servicios y SQL 001–005 intactos. No se ejecutaron backup, preflight de datos, aprovisionamiento, bootstrap ni pruebas contra Supabase durante esta preparación. Solo hay credencial inspectora; la contraseña administrativa se solicitará interactivamente al operador. Respaldo real y restauración aún no acreditados; no hay autorización DDL. El destino operativo futuro es el proyecto Supabase existente, no PostgreSQL local.

Verificación de preparación: `npm run spec:check` correcto; Parser.ParseFile de `Backup-Supabase.ps1` sin errores; manifiesto `docs/supabase-activation-manifest.json` con SHA-256 de diez archivos. Ayuda local de psql 17.11 consultada sin conexión. No se ejecutaron build/suite de integración: ningún servicio de aplicación cambió y esos comandos no acreditarían activación remota. SQL nuevo revisado estáticamente, sin afirmar validación funcional ni compatibilidad DDL del proveedor.

## Corrección de coherencia de cuentas — 2026-11-06

Alcance FR-019/020/021 y AC-021/022/023/024. No se conectó a Supabase; no se modificaron SQL, esquema, contratos HTTP ni UI. Las cifras de 2026-10-24 que siguen son evidencia histórica, no el resultado de esta corrección.

### Reproducción previa y corrección

Antes de modificar los servicios se añadió `SuperAdministratorCannotCreateBranchBAccountLinkedToBranchAPerson`. Ejecutada contra el backend original con PostgreSQL local real y RLS runtime, falló: se esperaba 404 y la API devolvió 201 Created para una cuenta OPERATOR de B vinculada a una persona de A. TRX local ignorado: `artifacts/user-validation/red/red.trx` (una integración fallida, cero omitidas). No se utilizó esa cuenta ficticia fuera del clúster dedicado.

`AccountAccessValidator` centraliza el vínculo opcional sobre concesiones destinatarias ya resueltas; AccessService y UserAdministration lo reutilizan. MinistryDirectory conserva la consulta de persona activa y membresía vigente en sede activa; SUPER_ADMIN global no exige sede, pero sí persona activa cuando está vinculada. La autorización/delegación del actor se mantiene antes de validar/persistir el destinatario. Cambiar personId revoca security stamp. Las pruebas de sustitución válida revelaron otro fallo: Identity trataba los nuevos grants con UUID preasignado como filas existentes. Se registran explícitamente como Added dentro de la transacción antes de actualizar el security stamp; ahora se persisten también sus permisos explícitos.

### Comprobaciones ejecutadas

- `dotnet restore backend/MisionLiderParis.slnx --locked-mode`: correcto.
- `dotnet build backend/MisionLiderParis.slnx --no-restore -c Release`: correcto, cero advertencias y cero errores.
- Pruebas afectadas después del fix inicial: nueve unitarias y siete integraciones correctas. Se ampliaron después las aserciones de membresía ausente, permiso explícito, revocación explícita y vínculo global inactivo.
- `dotnet test backend/MisionLiderParis.slnx --no-restore -c Release --logger trx --results-directory backend/artifacts/user-validation/final`, con `MLP_TEST_DATABASE` local y `MLP_POSTGRES_BIN` del PostgreSQL local: **50 unitarias + 34 integraciones = 84 correctas, cero fallidas y cero omitidas**. Las dos suites compilaron en Release. TRX finales: `artifacts/user-validation/final/rodrigo.jimenez_PMVM1018_2026-11-06_16_50_31_net10.0.trx` y `...16_50_43_net10.0.trx`.
- Los siete escenarios nuevos incluyen creación incoherente sin persistencia; OPERATOR/BRANCH_ADMIN y múltiples sedes válidas; persona sin cuenta; cuentas sin persona; SUPER_ADMIN vinculado sin membresía; edición/retiro/reasignación de personId; rechazo sin modificar perfil o sesión; sustitución válida/inválida de concesiones y permisos; promoción global autorizada; traslado con rechazo de login hasta corregir concesiones; baja de persona; revocación explícita y rechazo de escalada por administrador de sede.
- El ensayo completo también ejecutó las pruebas previas de bootstrap CLI, Kestrel HTTPS, copia de cookies, integridad, RLS y respaldo/restauración local.
- `npm run build`: correcto, 463,34 kB iniciales y 31 referencias de recursos verificadas. No se ejecutaron unitarias Angular.
- `npm run spec:check`: estructura y trazabilidad correctas.

Entorno: clúster nuevo PostgreSQL 17.11 en 127.0.0.1 y puerto efímero; base `mlp_user_validation_tests`, baseline exclusivamente estructural, catálogos/filas ficticios y usuario runtime NOBYPASSRLS. El runner local ignorado `.local/user-validation-runner.ps1` configura la conexión exclusivamente para cada proceso de prueba; nunca lee secretos de producción. La autenticación trust del clúster efímero se limita a loopback y no es configuración productiva.

Limpieza: `pg_ctl -D backend/.local/user-validation-20261106/data -m fast -w stop` terminó correctamente; el clúster temporal quedó detenido. Los TRX y archivos de ensayo permanecen únicamente en rutas locales ignoradas.

Límites: no se verificaron datos actuales de Supabase ni SMTP externo. Se conserva la revalidación de acceso en cada resolución y la revocación de traslados/bajas; estos escenarios no acreditan todas las carreras con escrituras SQL externas concurrentes. La prueba global de baja mantiene la protección existente que impide desactivar una persona vinculada a una cuenta global activa.

Fecha: 2026-10-24, America/Bogota. **Estado vigente: activación local verificada; paquete incremental no aplicado en Supabase.**

## Cierre de activación autorizado posteriormente

La nueva solicitud retoma expresamente las unitarias del backend. Restore locked y build Release de la solución correctos, cero advertencias/errores. Ejecución final: **41 unitarias + 27 integración, 68 correctas, cero fallidas/omitidas**. TRX finales en artifacts/activation-test-results: 2026-10-24_14_45_08 (unitarias) y 14_45_09 (integración). El modelo AuthDbContext no tiene cambios pendientes según dotnet ef migrations has-pending-model-changes.

Después de los ajustes de seguridad de Paso 21, `dotnet test MisionLiderParis.slnx --no-restore -c Release` se ejecutó contra un clúster PostgreSQL 17.11 aislado en loopback con baseline solo estructural en una base `_tests`: **41 unitarias + 27 integración, 68 correctas, cero fallidas/omitidas**. La prueba de activación verificó que el owner DDL perdiera CREATE de base tras 001 y que 002–005 siguieran pasando. `dotnet build MisionLiderParis.slnx --no-restore -c Release`: correcto, 0 advertencias/errores. El clúster temporal se detuvo y su directorio se eliminó.

Se ejecutaron SQL 001–005 reales en clones locales nuevos con filas ficticias existentes; se conservaron contenido y OID de once tablas tras cada script. pg_dump/pg_restore restauraron respaldos previos y posteriores al bootstrap, incluyendo hash/concesión/ACL. Preflight inválido abortó sin alterar filas. Bootstrap CLI creó SUPER_ADMIN global, rechazó repetición y política de contraseña insegura antes de insertar cuentas. El usuario runtime separado pasó validación; membresía propietaria fue rechazada.

Kestrel HTTPS real, dentro de `PostgresActivationTests`, verificó primer login, cookie/CSRF, sesión global y logout. La evidencia anterior también menciona `Start-LocalBackend.ps1` y `Test-FirstLogin.ps1`, pero esos archivos no existen en este checkout y no se consideran pasos reproducibles. El clúster PostgreSQL efímero utilizado en esta revisión se detuvo y eliminó. No hubo cambios de producción, correos reales, integración Angular ni despliegue.

El hallazgo 403/404 en usuarios multi-sede se corrigió y verificó; login con persona inactiva conserva 401 genérico y sin cookie. Bloqueo real tras cinco errores, vínculo/uniquidad persona-cuenta y revocación por baja pasaron. AC-011–015 se acreditan en [activation-review.md](../../docs/activation-review.md); procedimiento exacto en [database-rollout.md](../../docs/database-rollout.md).

Checks de cierre anteriores: npm run spec:check, deps:check, skills:check, format:check y build correctos, con 31 referencias de recursos Angular verificadas. En Paso 21 se volvió a ejecutar `npm run spec:check` y pasó. Se corrigió una lista anidada en la serialización inicial de traceability.json antes del spec:check final. Sin unitarias Angular, revisión visual ni despliegue.

## Paso 19 — AC-016, AC-017 y AC-019

- **AC-016 — APROBADO CON CONDICIONES:** el comparador estructural reportó 37 revisiones sin bloqueantes (SHA-256 del reporte `1C5FBA619ED7ADAD251E89F8AAF0DBD7806D6E2099CB4547DECE54D245010A02`). Después se ejecutó `sql/review/018-live-security-metadata.sql` mediante Npgsql/User Secrets sobre TLS VerifyFull; transacción `REPEATABLE READ READ ONLY`, salida y rollback correctos, código 0, sin DDL. SHA-256 del informe local `schema-security-metadata.json`: `3FA07647A2850D6649FE7F33954795C1D2832D9830DD0353C548E021B6E413B0`.
  - Catálogos de roles y membresías consultados con éxito. `mlp_inspector` es LOGIN, NOINHERIT, sin SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION, no miembro de otros roles. Las únicas membresías relevantes observadas son las de plataforma: `authenticator` puede hacer `SET ROLE` a `anon`, `authenticated` y `service_role`, con INHERIT falso. `mlp_runtime` y `mlp_api_runtime` no existen: se interpretan como roles aún no aprovisionados, no como roles existentes mal configurados. No hay membresía de runtime que evaluar hasta crearlos.
  - `iglesia` pertenece a `postgres`; las 11 tablas y tres funciones ministeriales pertenecen a `postgres`. `auth_app` todavía no existe, por lo que sus propietarios y ACL futuros no se pueden verificar antes de 001. Ninguna de las 11 tablas tiene ACL explícita; `mlp_inspector` tiene USAGE de esquema pero cero privilegios efectivos sobre tablas/secuencias. También tiene EXECUTE efectivo por el ACL predeterminado de PUBLIC sobre las tres funciones `RETURNS trigger` (SECURITY INVOKER, `search_path=""`); no equivale a permiso de lectura/escritura de tablas. Los ocho event triggers visibles pertenecen a `supabase_admin` y sus funciones viven en `graphql`/`extensions`. La concesión de USAGE es más amplia que CONNECT-only solicitado y debe retirarse en una ventana autorizada; no se revocó durante esta inspección.
  - `anon`, `authenticated`, `authenticator` y `service_role` no tienen USAGE ni privilegios de tablas en `iglesia`. `service_role` tiene BYPASSRLS, igual que los roles administrativos Supabase `postgres` y `supabase_admin` (este último SUPERUSER); `dashboard_user` tiene CREATEROLE/CREATEDB/REPLICATION. Estos roles de plataforma no son miembros de `mlp_runtime` ni tienen privilegios efectivos sobre las tablas ministeriales por la ACL observada; no usarlos como runtime.
  - RLS está habilitado en las 11 tablas, FORCE RLS está desactivado y no hay políticas en `iglesia` ni `auth_app`. Esperado antes de 005, pero el runtime no puede activarse así. `auth_app`, sus funciones/tablas/secuencias y sus privilegios efectivos están ausentes, no ocultos por un error de permisos. Los ocho event triggers visibles pertenecen a la plataforma Supabase; no son políticas ministeriales.
  - **Condiciones antes de autorizar despliegue:** probar en un proyecto Supabase no productivo que la identidad administrativa permita crear los roles/grants mínimos y transferir ownership sin usar esa identidad como operador rutinario. `postgres` observado tiene BYPASSRLS/CREATEROLE y no será runtime. Preaprovisionar `mlp_runtime` y `mlp_security_definer` con atributos/membresías restringidos; 005 ahora los exige y no crea roles. Ejecutar 001–005 solo tras autorización separada y validar después la membresía/atributos del LOGIN `mlp_api_runtime`, los dos helpers `SECURITY DEFINER`, ACL sin EXECUTE de PUBLIC y políticas RLS por sede. No ejecutar esas acciones en esta fase.
- **AC-017 — APROBADO localmente:** PostgreSQL 17.11 aislado en loopback; baseline real `--schema-only` restaurado en una base nueva con once tablas y datos ficticios. `pg_dump` custom se verificó con `pg_restore --list` y se restauró en bases locales nuevas. El LOGIN DDL no tenía SUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB ni REPLICATION; asumió un owner NOLOGIN con propiedad solo sobre los objetos que requieren DDL. Un administrador separado preaprovisionó `mlp_runtime` y `mlp_security_definer` sin atributos privilegiados. Los cinco scripts pasaron en orden bajo el LOGIN restringido. CREATE de base se revocó después de 001 y se verificó que los pasos posteriores seguían funcionando. Hashes de filas y OID de las once tablas ministeriales no cambiaron; se verificaron cuatro FK validadas, RLS/políticas en las once tablas, aislamiento por sede y rechazo de una transición inválida sin cambiar la fila. El respaldo posterior se restauró y verificó. Esto no acredita los privilegios reales del operador Supabase ni la compatibilidad de datos productivos.
- **AC-019 — APROBADO para el snapshot Git anterior:** en la auditoría previa Git 2.53.0 estaba disponible; 122 rutas en `git status --short --untracked-files=all` (13 modificadas/eliminadas y 109 sin seguimiento), cero rutas staged. No se alteraron ni descartaron esos cambios. Se analizaron 337 archivos rastreados/sin seguimiento y 87 commits; no aparecieron claves privadas, URI PostgreSQL con credenciales, claves cloud reconocibles ni archivos sensibles por nombre rastreados. Las coincidencias amplias de asignación de credenciales restantes están en código de pruebas y comandos/documentación, no en configuraciones de conexión con valores. `.env`, `.env.*`, `backend/.local/` y `appsettings.Local.json` están excluidos. Se corrigió la brecha de exclusión de `*.pfx`, `*.p12`, `*.pem` y `*.key`, confirmada con `git check-ignore`; no hay archivos de esos tipos en Git. `.env.example` contiene campos de secretos vacíos. DPAPI queda limitado al handoff local Windows; el procedimiento productivo usa secretos del host y key ring persistente cifrado con certificado.

## Paso 21 — seguridad de roles y autorización previa

- 005 requiere que el administrador preaprovisione `mlp_runtime` y `mlp_security_definer`; no intenta crear roles ni requiere CREATEROLE del LOGIN DDL. Solo hay dos helpers `SECURITY DEFINER`, con owner NOLOGIN exclusivo, `search_path=''`, EXECUTE revocado de PUBLIC y concedido al runtime. El helper tiene SELECT explícito y políticas de lectura no recursivas en `rol`/`sede`; no tiene BYPASSRLS, CREATE ni ownership de tablas.
- El LOGIN temporal hereda únicamente el owner DDL NOLOGIN; el grupo helper solo se asume temporalmente para transferir los helpers. CREATE de base se necesita únicamente para 001 y se revoca después; CREATE de `iglesia` y membresía helper se revocan tras 005. El owner permanece NOLOGIN y nunca se asigna al runtime.
- Prueba final local: restore previamente disponible; `dotnet test MisionLiderParis.slnx --no-restore -c Release`: 41 unitarias + 27 integración, 68/68, 0 fallidas/omitidas; el build Release terminó con 0 warnings/errores. La base de prueba termina en `_tests`, loopback; el clúster y su directorio temporal se limpiaron. No se conectó ni aplicó DDL a Supabase.
- **AC-016 permanece APROBADO CON CONDICIONES.** El snapshot READ ONLY de Supabase es evidencia histórica, no una verificación de preflight actual. La compatibilidad de Supabase para aprovisionar roles, memberships y transferir ownership debe probarse en un proyecto no productivo antes de decidir sobre producción. `mlp_inspector` aún requiere revocar su USAGE en `iglesia` en una ventana autorizada.
- **AC-017 APROBADO en el alcance local restringido.** No demuestra que el rol administrativo real del servicio admita las mismas operaciones ni que los datos actuales satisfagan 003/004.
- **Riesgo residual:** runtime conserva DML de tablas Identity necesario para las operaciones de la API. `mlp.actor_id` es un GUC de sesión que la credencial runtime puede cambiar; RLS limita errores de filtro de sede, pero no es una defensa contra SQL arbitrario/credencial comprometida. Mantener API y secreto privados y prevenir SQL injection.
- **Git en esta sesión:** `git.exe` no está disponible en PATH, por lo que no se volvió a inspeccionar el índice/staged status después de estas ediciones. AC-019 refiere al snapshot anterior ya auditado; en este Paso 21 solo se modificaron SQL/código de seguridad, pruebas y documentación, sin agregar credenciales, certificados ni contraseñas reales. Repetir el check de Git al recuperar la herramienta.

Los apartados siguientes conservan la evidencia histórica anterior a esta activación; sus suspensiones, procesos detenidos y pruebas pendientes describen aquel momento, no el estado vigente.

## Historial de la fase anterior a la activación

En una fase anterior, el usuario había diferido las pruebas unitarias y se documentaron resultados incompletos. El 2026-10-24 autorizó expresamente retomar las pruebas automatizadas del backend; el cierre vigente está en la sección superior y las pruebas unitarias de Angular siguen diferidas.

El fallo histórico de metadatos EF en `MinistryModelBoundaryTests` se corrigió antes de la activación; la suite backend completa pasó después en esta revisión.

## Inspección real previa a EF

- Conexión IPv4 al Session pooler suministrado por el usuario, con TLS VerifyFull y CA pública de Supabase. El fallo inicial del host directo IPv6 quedó resuelto; ya no faltan credenciales ni conectividad para inspección.
- PostgreSQL 17.6: once tablas reales inspeccionadas en READ ONLY, restricciones/índices y cuerpos de las tres funciones/triggers. Sin consultas a registros personales, sin reconstrucción ni DDL remoto.
- Sin diferencias en columnas/tipos/defaults/nullabilidad/relaciones. Se revisaron 37 observaciones: once flags RLS y representación de CHECK/predicados/cuerpos de funciones. RLS habilitado sin políticas; rol de inspección BYPASSRLS. auth_app ausente en Supabase.
- Catálogos confirmados: tres roles, 24 permisos activos, 40 enlaces rol/permiso, cinco estados y sus flags finales.
- Mapeos implementados después de esta inspección; --verify-mappings confirmó en READ ONLY los once conjuntos con filtros vacíos.
- Snapshot de metadatos y dump real solo de estructura conservados por hash en docs/reference/README.md. El SQL de reconstrucción recibido nunca se ejecutó, tampoco en tests.

## Integración PostgreSQL local

Se inició PostgreSQL 17.11 en loopback:55432, sin servicio del sistema. Se creó una base nueva mlp_final_tests y se restauró exclusivamente allí el dump real de estructura, sin datos de producción. La fixture aplicó las migraciones auth_app y scripts 003/004/005, con catálogo ficticio basado en códigos verificados y un LOGIN temporal NOSUPERUSER NOBYPASSRLS.

Comando de cierre, con MLP_TEST_DATABASE exclusivamente local:

```powershell
dotnet test tests/MisionLiderParis.IntegrationTests/MisionLiderParis.IntegrationTests.csproj --no-restore -c Release --logger trx --results-directory artifacts/test-results
```

**24 correctas, 0 fallidas, 0 omitidas**: trece HTTP, siete Identity/PostgreSQL y cuatro escenarios ministeriales persistentes. TRX local ignorado: artifacts/test-results/rodrigo.jimenez_PMVM1018_2026-10-24_00_46_05_net10.0.trx.

Comportamientos verificados:

- HTTP: CSRF, cookies seguras, CORS, 401/ProblemDetails, rate limit, OpenAPI y fallo de readiness sin configuración.
- Identity real: login, credenciales inválidas/inexistentes, cuentas inactivas/bloqueadas/sin confirmar, confirmación, recuperación de token de un uso, cambio de contraseña y revocación de cookie copiada por logout.
- RLS: administrador de sede crea persona/documento/vínculo transaccional; persona ajena devuelve 404, filtro de sede ajena 403, consulta EF deliberadamente sin filtro de aplicación no ve personas ajenas. Nueva conexión sin actor no hereda visibilidad del pool.
- Operador sin permisos no consulta ni crea personas. BranchAdmin crea operador con permiso explícito PERSON_VIEW, sin promover a SUPER_ADMIN ni sustituir grants sin USER_ASSIGN_ROLE. El operador consulta personas, no administra usuarios; desactivación invalida su sesión.
- Asignaciones: responsable de otra sede y duplicado abierto rechazados; transición inválida/reapertura rechazadas; retiro de PENDING conserva inicio nulo y fecha final; nueva asignación tras retiro y secuencia de inicio/suspensión/reanudación/finalización.
- Traslado y baja de responsable rechazados con procesos abiertos; traslado permitido después del cierre y sede nueva persistida.
- Reportes: conteos de personas frente a asignaciones, estados vacíos con cero, agrupación paginada por responsable, categorías y CSV.
- Dos solicitudes concurrentes de la misma asignación producen exactamente un 201 y un 409.

Las primeras ejecuciones detectaron una expectativa incorrecta del test para estados vacíos y un fallo real de traducción EF al ordenar reportes después de construir DTOs. Se corrigió la expectativa y se proyectaron campos anónimos antes de ordenar/paginar en SQL; la ejecución final anterior verificó ambos reportes.

## Criterios

| Criterio | Estado | Evidencia / límite |
| --- | --- | --- |
| AC-001 | Verificado | API/integración compilan Release; build Angular correcto. |
| AC-002 | Verificado | Inspección real READ ONLY y once mapeos consultados sin filas. |
| AC-003 | Parcial | Siete escenarios persistentes correctos. No envío SMTP externo ni ejecución del bootstrap contra Supabase. |
| AC-004 | Verificado | Trece escenarios HTTP; readiness saludable con runtime y scripts aplicados localmente. |
| AC-005 | Verificado localmente | Delegación, operadores, IDOR, RLS y revocación observados en PostgreSQL NOBYPASSRLS. |
| AC-006 | Parcial | CRUD implementados y flujos ministeriales principales verificados. No cobertura exhaustiva de todas las actualizaciones, documentos/colisiones y combinaciones de concurrencia. |
| AC-007 | Verificado localmente | Conteos, agrupación, paginación de reportes y exportación ejecutados contra datos ficticios persistidos. |
| AC-008 | Verificado como artefactos | Specs, documentación, SQL, contrato y CI reproducible preparados; workflow remoto no ejecutado. |
| AC-009 | Verificado | Comparación viva y revisión explícita de diferencias; referencia nunca ejecutada. |
| AC-010 | Verificado localmente | USER_* por operación, operador con permisos explícitos y rechazo de escalada/reemplazo no autorizado. |
| AC-011 | Verificado | Restore locked, build Release (0 advertencias/errores) y 68 pruebas backend correctas. |
| AC-012 | Verificado localmente | Scripts 001–005 con filas existentes; datos/OID de las once tablas conservados. Runtime requiere `mlp_runtime` y rechaza membresía propietaria y `pg_read_all_data`. |
| AC-013 | Verificado localmente | Respaldos/restauraciones previos y posteriores; preflight inválido aborta sin reparar ni perder filas. |
| AC-014 | Verificado localmente | Bootstrap único, contraseña débil/repetición rechazadas, primer login HTTPS y logout. |
| AC-015 | Verificado como documentación | Procedimiento y guía exactos, sin DDL productivo. |
| AC-016 | Aprobado con condiciones | Comparación estructural y SQL 018 READ ONLY completados; riesgos predespliegue y faltantes esperados documentados. |
| AC-017 | Verificado localmente | Los cinco scripts pasaron, en orden, bajo operador NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE con `mlp_runtime` preaprovisionado; conservación de once tablas, FKs, RLS, aislamiento por sede, integridad y recuperación verificados. Permisos reales de Supabase pendientes. |
| AC-018 | Verificado | Suite completa ejecutada sobre PostgreSQL efímero aislado; ninguna prueba omitida. |
| AC-019 | Verificado | Git disponible; cero staged; 13 cambios rastreados y 109 sin seguimiento preservados. Sin secretos detectados; `.env*`, `.local` y formatos de llaves/certificados privados excluidos. |
| AC-020 | Verificado como procedimiento | Prerrequisitos, comandos, consultas, bootstrap de producción, salud y recuperación documentados; requiere autorización antes de ejecutar en Supabase. |

## Checks del repositorio

- `dotnet test MisionLiderParis.slnx --no-restore -c Release`: 41 unitarias + 27 integración, 68 correctas, cero fallidas/omitidas, en base loopback `_tests` restaurada desde estructura solamente.
- npm run spec:check: correcto tras corregir referencias de trazabilidad a helpers inexistentes.
- npm run deps:check: correcto.
- npm run skills:check: correcto.
- npm run format:check: correcto; solo comprobación, sin reescrituras.
- npm run build: correcto; 31 referencias de recursos verificadas, Angular compilado.
- Sin cambios de UI: no aplica revisión visual ni design:check.
- No se ejecutaron pruebas unitarias de Angular ni tests frontend.

## Pendientes operativos

No se aplicaron scripts ni cambios de datos en Supabase. Pendientes: respaldo/revisión/preflight y aplicación 001–005, LOGIN runtime sin BYPASSRLS, primer administrador, SMTP, claves persistentes y verificación de navegador/despliegue. Readiness actual no sustituye una auditoría de cada política/FK instalada. La inspección no leyó datos existentes, por lo que no acredita que el preflight productivo pase.

El PostgreSQL local temporal se detuvo al terminar; los archivos locales permanecen ignorados. Sin ejecución de GitHub Actions, envío de correos reales, despliegue ni integración de sesión Angular. No hay historiales de procesos/responsables/seguimientos ni módulos financieros. Procedimiento concreto en docs/database-rollout.md.

En la auditoría anterior Git estuvo disponible; en Paso 21 no está en PATH. No se creó commit ni se hizo push y los cambios preexistentes se preservaron.
## Diagnóstico ejecutable 2026-11-23 — FR-026/AC-030

Instrumentación opt-in por solicitud y spans Npgsql sin SQL/PII, fases de cookie/autorización/servicio/resultado/contexto, apertura lógica/física y control transaccional separado. 113 unitarias backend correctas, incluidas cuatro nuevas de aislamiento AsyncLocal, concurrencia, privacidad, límite256 e Identity pooling explícito/acotado. Tres casos del middleware verifican activación por ambiente y rutas plantilla sin datos privados.

Pruebas HTTP focalizadas:15 correctas y1 fallo de DevelopmentOpenApiDescribesImplementedRoutesAndRequestContracts por CryptographicException al cargar el certificado privado de Data Protection sin contraseña disponible en el host Development. No se cambia la protección de claves para aprobar el test. El resto de los casos verifica CSRF, cookies seguras,401/403, CORS, rate limiting y readiness sin base. No se ejecuta integración PostgreSQL con escrituras ni bootstrap contra Supabase.

Repetición separando el caso Development:15/15 correctas. API Release reiniciada con opciones explícitas Performance/PooledIdentity; verificación remota solo lectura correcta: TLS validado, roles runtime/Identity sin privilegios indebidos,11 tablas con RLS, contexto firmado aceptado y eliminado tras rollback, readiness200 y anónimos401. No se enviaron correos ni se modificaron datos/secretos. Comprobación HTTPS real de health/live:200, X-MLP-TraceId coherente con log y Server-Timing; JSON técnico final2,438ms/0comandos. Este health no acredita rendimiento de listados autenticados. Readiness inicial3304,645ms/10comandos muestra aperturas físicas y seis operaciones de control transaccional separadas: tampoco se usa como sustituto de esos listados.

Seguimiento:20 E2E controlados correctos, escritorio/móvil, sin artefactos visuales ni peticiones de escritura reales. Detalle de límites y proxy de pruebas en specs/015-assignment-follow-up/validation.md del repositorio raíz.

Actualización tras participación del usuario: corrigió el arranque local del frontend para confiar en el certificado mediante el helper existente; session anónimo401 y csrf200 verificados a través de4200, sin desactivar TLS. El usuario inició sesión y confirmó consultas reales. Métricas HTTP API200:login4017,152ms;session1895,368ms;sedes1800,287ms;personas1938,925 y1853,885ms;Seguimiento2504,542ms sin aperturas y4425,070ms con dos aperturas físicas/2041,119ms. Tabla de fases/SQL en docs/performance-and-local-development.md; artefacto técnico local http-pooled-observed.json. Estas muestras posteriores no sustituyen una línea base HTTP anterior ni acreditan P95≤2s. Continúan pendientes formularios, guardados, carga concurrente y repeticiones comparables suficientes; no se automatizan escrituras ministeriales para medir.

### Continuación — FR-027/028, AC-031/032

105 lecturas remotas de servicio en tres etapas, sin escrituras ministeriales, con cinco muestras por operación y mediana de cuatro posteriores. Pool antes / lotes / ámbito firmado único:sedes1702,6/1299,9/933,1ms;personas1827,9/1409,8/1036,6ms;categorías1717,8/1285,8/938,7ms;procesos1734,3/1292,3/938,1ms;Seguimiento con filtros2355,2/1919,2/1577,7ms y sin filtros1836,0/1434,6/1058,2ms. Artefactos y límites en docs/performance-and-local-development.md. No son HTTP ni P95; ninguna promesa95%.

114 unitarias correctas (nuevo conteo de sentencias/lotes y restauración de ámbitos anidados);89 integraciones focalizadas correctas en mlp_user_validation_tests, puerto57693, roles separados y modo preaprovisionado sin migraciones. Nueva MinisterialHttpReadSharesOneTransactionForPermissionsAndRows verifica dos peticiones reales TestServer con una transacción ministerial cada una. Los casos existentes prueban seguridad firmada, aislamiento, rollback/cancelación, revocación y operaciones ministeriales. TRX local:artifacts/performance/shared-read-security/shared-read.trx.15 HTTP/diagnóstico sin base correctas.

Batería amplia inicial:88/91 correctas, tres fallos conservados en artifacts/performance/batch-security/batch-security.trx:RegistrationOptionsUseCreatePermissionAndActiveBranchesWithoutViewPermissions503;BranchScopeAndDatabaseRlsPreventForeignReadsAndOperatorWrites readiness503;BranchAdministrationCrudValidationVersionsAndEmptyDeactivation precisión UpdatedAt (siete vs seis decimales). No se certifica la suite completa;89 focalizados excluyen esos tres e incluyen uno nuevo. No confundir con el fallo OpenAPI/certificado anterior. Clúster aislado detenido después.

Compilación Release API y diagnóstico correcta, sin advertencias/errores. API nueva ejecutándose con pool y métricas; verificación remota de solo lectura correcta (TLS, roles, RLS, contexto válido/limpio,200/401), sin escrituras/secretos modificados/correos. Un operador concurrente fue rechazado por su lock; repetición secuencial correcta. Solicitado al usuario repetir recorrido HTTP; no usar las métricas de la versión anterior como medición posterior del filtro nuevo.

El usuario confirmó después el recorrido: HTTP API200 login1639,600ms/sesión861,851ms;sedes1061,364/1008,324ms;personas1350,470/1146,306ms;categorías1044,577/1003,545ms;procesos1032,618/1030,819ms;Seguimiento1808,252/1609,684ms con metadatos y1131,534ms sin reconstruirlos. Sin nuevas aperturas en esas muestras. No son muestras controladas ni P95. Detalles/fases en artifacts/performance/http-shared-scope-observed.json y tabla en docs/performance-and-local-development.md.

Se detectó en Usuarios administration-options2258–2354ms/27sentencias/4transacciones y se extendió el filtro a sus GET. Caso HTTP ampliado a listado y opciones correcto (una transacción cada uno);10 regresiones específicas CustomUserAccess, vinculación, revocación y ámbito de sede correctas. El primer filtro de tests por nombre de clase solo seleccionó1caso porque las clases son parciales; se corrigió por nombres de métodos y se ejecutaron10. Resultado artifacts/performance/users-regressions/users-regressions.trx. Clúster aislado detenido tras finalizar.

20 lecturas de servicio pareadas de Usuarios con lotes en ambos: listado1250,0→1027,5ms/16→11sentencias; opciones1981,4→1031,0ms/26→11sentencias. Medianas de4 posteriores entre5muestras, misma página10/USER_VIEW. Ejecutor local requirió registrar dependencias existentes de DataProtection/IHostEnvironment antes de medir; fallos de configuración no se cuentan como muestras. No se envió correo ni se llamó a invitaciones. API Release final y verificación remota solo lectura correctas; ninguna captura HTTP de Usuarios de esta ampliación aún disponible.

Release de la solución correcto, cero advertencias/errores. Angular production build correcto con advertencia existente de presupuesto inicial583,76kB frente a500kB.26 unitarias Angular focalizadas correctas y design:check correcto. Comparación reproducible local de servicios reales con actor existente:35 muestras antes y35 con pooling Identity, cinco por operación; tabla y límites en docs/performance-and-local-development.md. Medianas de cuatro muestras posteriores mejoran51,7–65,8%; sin caché de permisos, mismas consultas y cero DDL/escrituras. No mide HTTP autenticado, arranque frío total ni P95; iniciales están separadas en los artefactos locales.

