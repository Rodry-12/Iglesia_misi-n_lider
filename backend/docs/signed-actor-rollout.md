# Contexto RLS firmado: implementación y despliegue

Preparado el 2026-11-07. **Despliegue SQL autorizado aplicado el 2026-11-08 (Colombia): GRANT USAGE + 100 una vez + 102. Registro HMAC, contraseña Identity y configuración del backend pendientes; no ejecutados.** Proyecto operativo: `sneceodpvscrvjrlqwgw`. No arrancar la aplicación contra PostgreSQL local. Las bases de loopback descritas aquí son exclusivamente pruebas aisladas.

## Resultado del despliegue controlado

Respaldo completo de iglesia/auth_app y roles/membresías, con almacenamiento cifrado y restauración aislada verificada. Hash SHA-256 del archivo: `87ED538A50AF4E7354A8E30B0E2848D4867E69B763A750DC07615F48312772C3`. Antes de escribir, se compararon los datos y metadatos de seguridad del destino real con la restauración; coincidieron. Servidor de recuperación detenido.

Se ejecutó únicamente `GRANT USAGE ON SCHEMA extensions TO mlp_security_definer`, el archivo 100 íntegro (hash `D53817C8B96CC7F80A81352D0B5D7F8E9C37C1B013A0F6CF8BB9338436626F86`) una vez, y 102. Commit confirmado. Verificación posterior: 2 roles Identity seguros, 7 funciones con propietario/search_path/EXECUTE correctos, 27 políticas, 11 tablas con RLS, cero acceso directo del runtime a Identity/clave, cero membresías temporales y **cero claves registradas**. Datos de las 18 tablas originales sin cambios por comparación de conteos y huellas antes/después. No se ejecutaron 001–090, 101, migraciones, bootstrap, cambios de contraseña ni User Secrets. Evidencia local de operación: `.local/supabase-backup-review/deployment-status.json` y su directorio privado de auditoría.

## Siguiente paso propuesto, pendiente de revisión y autorización

Estado vigente 2026-11-09: la alternativa pgcrypto fue autorizada y completada en Supabase real. Se registró exactamente una clave; USAGE temporal de extensions para mlp_ddl_owner y membresía temporal del operador retirados antes del commit, con ACL original verificada después. Recuperación cifrada y User Secrets coincidentes verificados. API Production en HTTPS localhost:7243 con Identity, contexto firmado y RLS comprobados mediante lectura real. Ready 200; Gmail sin sesión 401. OAuth y envío siguen pendientes de intervención manual. Evidencia vigente en `backend/specs/001-ministry-backend/validation.md`; los párrafos siguientes describen la preparación histórica y no autorizan repetir el registro.

Actualización 2026-11-09: el registro se bloqueó antes de escribir porque Supabase permite auto_explain y no concede SET de sus parámetros al operador. Alternativa local comprobada: overload `ActorKeyProvisioner.InsertAsync(connection, transaction, keyId, ct)` genera 32 bytes mediante `pgcrypto.gen_random_bytes`, devuelve el material por TLS y exige recuperación cifrada verificada antes del commit. No envía la clave como literal ni parámetro; la reconciliación compara en memoria, sin enviarla de vuelta a SQL. Rechaza cambios en columnas, índices, restricciones, defaults, triggers/reglas y comprueba que el generador pertenece a pgcrypto y es VOLATILE. Conserva el control estricto para la inserción antigua; el flujo nuevo valida cliente/logging de errores y la ausencia de rutas que impriman la fila. No requiere SET de logging, cambios globales, tablas, funciones ni políticas. Pendiente de aprobación remota; no se registró ninguna clave real.

Ejecutor temporal preparado en `backend/.local/supabase-key-review/Program.cs` (proyecto `KeyOperator.csproj`), pendiente de autorización remota. Invoca `ActorKeyProvisioner.InsertAsync`; no implementa otra firma ni inserciones SQL paralelas. Compilación y recuperación cifrada entre procesos comprobadas sin red, sin modificar User Secrets y con rechazo de ciphertext adulterado. No se ha ejecutado el registro real.

Los modos `--register-only`, `--configure-hmac-secrets` y `--configure-identity-secrets` separan el registro, la reconciliación de la clave y la conexión Identity. La recuperación queda cifrada bajo el perfil privado antes del commit; los secretos se transmiten a .NET por stdin y se comprueba que las demás configuraciones no cambien. `backend/scripts/Set-SupabaseLoginPassword.ps1 -Role mlp_identity_runtime` reutiliza el prompt oculto de psql, sin contraseña en argumentos.

1. Validar proyecto/base/identidad administrativa y TLS VerifyFull. Recibir credenciales mediante entrada oculta local. Comprobar que no se registren parámetros sensibles en cliente, PostgreSQL ni auditoría de plataforma; detenerse si no puede garantizarse.
2. Consultar solo existencia/estado del almacén. Si ya hay una clave válida, detenerse y recuperar su material del gestor correspondiente; no generar otra ni sobrescribirla.
3. Con almacén vacío y estructura/función verificadas, generar 32 bytes dentro del INSERT mediante el CSPRNG de pgcrypto y un KeyId único válido. Recibir el resultado exclusivamente por TLS, preparar y recuperar la copia cifrada con el Data Protection persistente existente, bajo el perfil privado y fuera del repositorio, antes del commit. Un fallo de recuperación revierte la inserción; un fallo posterior al commit requiere reconciliar esa misma clave.
4. Invocar `ActorKeyProvisioner.InsertAsync` dentro de una transacción administrativa. El operador necesita INSERT: si requiere membresía temporal de `mlp_ddl_owner`, su concesión/SET ROLE y retirada dentro de esa misma transacción deben autorizarse expresamente. Conservar las membresías originales de otros grantors. No modificar políticas ni registrar más de una clave.
5. Configurar una contraseña exclusiva de `mlp_identity_runtime` mediante el prompt oculto `psql \password mlp_identity_runtime`, también con autorización adicional. No usar postgres ni credenciales expuestas como runtime.
6. Tras el commit, configurar `Database:IdentityConnectionString`, `DatabaseActor:KeyId` y `DatabaseActor:SigningKeyBase64` por JSON en memoria canalizado a User Secrets, preservando la conexión ministerial. Los bytes deben ser exactamente los registrados. Conservar la recuperación cifrada hasta validar la configuración; si falla la escritura local, recuperar esa misma clave, sin insertar otra.
7. Revisar el código del ejecutor antes de usarlo y obtener autorización separada. Después corresponderá comprobar Identity, firma/RLS y HTTPS real. El arranque y la autorización Gmail no se acreditan con el despliegue SQL actual.

## Decisiones de seguridad

- `mlp.actor_id`, `mlp.new_person_id` y `mlp.write_branch_id` dejan de autorizar. No existe compatibilidad con actores sin firma.
- .NET firma HMAC-SHA256 un formato canónico versionado: identificador de clave, actor, security stamp, vencimiento, xid8, PID PostgreSQL, base, session_user e intención opcional de creación persona/sede. PostgreSQL verifica todos los campos. La prueba dura 60 segundos; el verificador rechaza vencimientos superiores a 120 segundos. Los relojes deben estar sincronizados.
- `set_config('mlp.actor_proof', ..., true)` solo vive en la transacción. La firma está vinculada a esa transacción y conexión; copiarla a otra transacción no autoriza. Las consultas EF sin transacción explícita reciben una transacción READ ONLY que dura hasta cerrar el lector. SaveChanges siempre utiliza transacción. Excepciones y cancelaciones revierten y liberan el contexto.
- No se permite Multiplexing, No Reset On Close ni incorporar transacciones externas con UseTransaction. No se utiliza DbContext pooling. Un DbContext sigue siendo de uso secuencial; la concurrencia utiliza scopes separados.
- La cookie autenticada aporta el security stamp original; no se sustituye por uno nuevo para revivir una sesión revocada. SQL también comprueba estado activo, correo confirmado, bloqueo y stamp. Una revocación invalida la prueba en la siguiente sentencia bajo READ COMMITTED; no interrumpe retroactivamente una sentencia ya ejecutándose.
- `AuthDbContext` utiliza una credencial independiente. `mlp_runtime` pierde todo acceso directo a las seis tablas Identity. `mlp_identity_runtime`, mediante `mlp_identity`, administra Identity y solo consulta los catálogos necesarios. Ninguna de ambas identidades puede leer la clave HMAC.
- La revocación vinculada a personas pasa por `auth_app.revoke_person_sessions(uuid)`: verifica actor firmado, sede y permiso PERSON_DEACTIVATE; una cuenta de sede no puede revocar cuentas SUPER_ADMIN vinculadas. Solo actualiza security_stamp y concurrency_stamp.
- `iglesia.persona_documento` conserva su modelo y su identificación obligatoria. No se reconstruyen tablas ministeriales ni se modifican contratos HTTP.

Una credencial SQL ministerial comprometida, por sí sola, ya no permite elegir un UUID ni modificar Identity para conseguir acceso. Esta garantía no cubre compromiso del proceso .NET, de la clave de firma, del operador o de la credencial Identity: esta última puede administrar cuentas y debe protegerse como credencial de autenticación. Una inyección SQL dentro de una transacción ya autorizada conserva el alcance de ese actor. RLS aísla sedes; los permisos de cada operación siguen siendo responsabilidad adicional del backend.

## Archivos y orden

Inventario de código de este incremento (rutas relativas a backend):

- `src/MisionLiderParis.Application/Access/ActorContext.cs`.
- `src/MisionLiderParis.Api/Program.cs`, `Controllers/AuthController.cs`, `Security/RuntimeDatabaseValidator.cs` y `appsettings.json`.
- `src/MisionLiderParis.Infrastructure/DependencyInjection.cs` y `Configuration/BackendOptions.cs`.
- `src/MisionLiderParis.Infrastructure/Database/RuntimeDatabaseSafety.cs`, `IdentityDatabaseSafety.cs` y `ActorKeyProvisioner.cs`.
- `src/MisionLiderParis.Infrastructure/Ministry/ActorProof.cs`, `ActorTransactionContext.cs`, `ActorTransactionInterceptor.cs`, `ActorCommandInterceptor.cs`, `TransactionReader.cs`, `MinistryDbContext.cs` y `PeopleService.cs`. Se elimina `ActorConnectionInterceptor.cs`.
- `tests/MisionLiderParis.UnitTests/ActorProofTests.cs` y `ActorContextTests.cs`.
- `tests/MisionLiderParis.IntegrationTests/SignedActorTests.cs`, `SignedTestConfiguration.cs`, `BranchIsolationTests.cs` y `PostgresIdentityTests.cs`.
- Este documento, el enlace de `docs/database-rollout.md` y spec/plan/tasks/validation/traceability de `specs/001-ministry-backend/`.

1. `sql/100-signed-actor-context.sql`: incremento único y transaccional; roles Identity, almacén privado de claves, verificadores, helpers, dos políticas de persona y revocación de sesiones. No contiene passwords ni claves.
2. `sql/102-verify-signed-context-readonly.sql`: consulta exclusivamente metadatos, propietarios, search_path, EXECUTE público, políticas y privilegios.
3. `sql/101-suspend-signed-context.sql`: recuperación posterior al commit mediante contención cerrada. Inhabilita claves y LOGINs; conserva objetos y datos. **No restaura el diseño vulnerable.**

Los scripts históricos 010–080 y las migraciones EF permanecen intactos. El nuevo incremento no lo ejecuta la API al iniciar. Las funciones tienen search_path vacío, nombres cualificados y EXECUTE público revocado; los helpers privados no se exponen al runtime.

## Antes de solicitar autorización remota

### Revisión del bloqueo de arranque — 2026-11-08

El SQL para revisión sigue siendo **`sql/100-signed-actor-context.sql` íntegro**, sin extraer solo los roles y sin modificar 010–080. Es transaccional y de ejecución única, no idempotente: rechaza una segunda ejecución cuando encuentra `actor_context_keys`. Este procedimiento no acredita el estado remoto actual ni autoriza ejecución.

Primero obtener estos metadatos con la identidad de inspección autorizada o el operador, dentro de una transacción de solo lectura. No consultar material criptográfico, contraseñas ni registros personales:

```sql
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS inspected_as;
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls,
       rolcreaterole, rolcreatedb, rolreplication
FROM pg_catalog.pg_roles
WHERE rolname IN ('mlp_ddl_owner','mlp_security_definer','mlp_runtime',
                 'mlp_api_runtime','mlp_identity','mlp_identity_runtime');
SELECT nspname, pg_catalog.pg_get_userbyid(nspowner) AS owner
FROM pg_catalog.pg_namespace WHERE nspname IN ('auth_app','iglesia');
SELECT pg_catalog.to_regclass('auth_app.actor_context_keys') AS key_store,
       pg_catalog.to_regprocedure('auth_app.verified_actor_context()') AS verifier,
       pg_catalog.to_regprocedure('auth_app.verified_actor_id()') AS actor_reader,
       pg_catalog.to_regprocedure('auth_app.has_global_access()') AS global_helper,
       pg_catalog.to_regprocedure('auth_app.can_access_branch(uuid)') AS branch_helper;
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='iglesia' AND c.relkind='r' ORDER BY c.relname;
SELECT e.extname, n.nspname AS extension_schema
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
WHERE e.extname='pgcrypto';
ROLLBACK;
```

Completar con `sql/102-verify-signed-context-readonly.sql`: membresías/atributos previstos, privilegios, propietarios de funciones, search_path, EXECUTE público y políticas. Las filas ausentes deben contrastarse con el inventario esperado; ausencia de filas no equivale a verificación aprobada. Si el almacén existe, un operador autorizado puede comprobar **solo** `key_id`, `enabled` y `octet_length(key_material)`, nunca mostrar `key_material`. Recuperar cualquier clave existente del gestor de secretos correspondiente; no elegir otra clave ni repetir 100 sin revisar un estado parcial.

**Respaldo:** `scripts/Backup-Supabase.ps1` pertenece a la activación inicial: exige la configuración inspectora y su `pg_dump` incluye únicamente `--schema=iglesia`. No acredita por sí solo el respaldo requerido ahora. Utilizar el procedimiento de respaldo de `docs/database-rollout.md`, incluyendo ambos esquemas en la misma captura y preservando ACL/ownership:

```powershell
# Solo preparación: variables PG* y carpeta privada ya verificadas; password oculto mediante -W.
& "$taskPgBin/pg_dump.exe" -W --format=custom --strict-names --schema=iglesia --schema=auth_app --lock-wait-timeout=5000 --file "$taskBackupDirectory/before-signed-context.dump"
& "$taskPgBin/pg_restore.exe" --list "$taskBackupDirectory/before-signed-context.dump"
& "$taskPgBin/pg_restore.exe" --file NUL "$taskBackupDirectory/before-signed-context.dump"
Get-FileHash -Algorithm SHA256 -LiteralPath "$taskBackupDirectory/before-signed-context.dump"
```

Detenerse ante cualquier código de salida distinto de cero. Guardar también metadatos de roles/membresías y ensayar restauración en destino aislado aprobado. Los comandos anteriores no crean ni verifican por sí solos esa restauración. La carpeta debe ser privada y cifrada; el dump contiene datos de Identity. No sobrescribir tablas remotas ni usar `--clean`.

Después de respaldo y aprobación, el orden es: **100 completo → 102 → contraseña exclusiva del LOGIN Identity → registro de clave por `ActorKeyProvisioner.InsertAsync` → secretos locales → validación/arranque**. No ejecutar 101 en el despliegue normal: es contención posterior al commit, con aprobación separada. No repetir 001–005, migraciones, bootstrap ni 090.

El SQL 100 también crea seis políticas de lectura para Identity/definer y modifica `mlp_runtime_person_read` / `mlp_runtime_person_insert`. Conserva las columnas, documentos, UUID, relaciones y registros ministeriales; no desactiva RLS ni FORCE RLS. Esos cambios de políticas y helpers deben incluirse expresamente en la aprobación; ejecutar solamente los GRANT de Identity dejaría incompleta la protección.

La contraseña se establece en una sesión `psql` administrativa aprobada mediante `\password mlp_identity_runtime` (prompt oculto, no SQL Editor). Usar una contraseña nueva y exclusiva; no utilizar credenciales expuestas en chat. La clave nueva solo se genera después de verificar que no existe una clave válida recuperable: CSPRNG .NET `RandomNumberGenerator.GetBytes(32)` proporciona 256 bits; el aprovisionador admite 32–64 bytes y KeyId de 1–64 caracteres `[A-Za-z0-9_-]`. El método existente inserta con parámetros `@id` / `@key`; no hay comando CLI productivo implementado para invocarlo y no debe presentarse como uno. No usar las fixtures de integración para aprovisionar Supabase.

Para User Secrets del proyecto `src/MisionLiderParis.Api`, guardar únicamente después de validar credencial y correspondencia de clave:

| Clave | Origen exacto |
| --- | --- |
| `Database:IdentityConnectionString` | Session pooler `aws-1-us-east-2.pooler.supabase.com:5432`, base `postgres`, usuario `mlp_identity_runtime.sneceodpvscrvjrlqwgw`, contraseña exclusiva, SSL Mode VerifyFull y Root Certificate CA existente |
| `DatabaseActor:KeyId` | El mismo identificador registrado en `auth_app.actor_context_keys` |
| `DatabaseActor:SigningKeyBase64` | Base64 de los mismos bytes insertados por el aprovisionador; no otra clave |

La operación local prevista es construir en memoria un objeto JSON con esas tres propiedades y canalizarlo a `dotnet user-secrets set --project backend/src/MisionLiderParis.Api`, sin argumentos con valores, archivos temporales ni salida de secretos. Obtener los valores desde el gestor de secretos o entrada oculta local (`Read-Host -AsSecureString`), no desde el chat. Mantener intacta `Database:ConnectionString`. User Secrets no cifra su JSON: conservar ACL privada. En Production, inyectar estas claves con el mecanismo seguro del proceso, pues User Secrets no se carga automáticamente; mantener Data Protection persistente y protegido.

1. Detener escritores/API. Obtener y verificar un respaldo de `iglesia` y `auth_app`, sus funciones, políticas, propietarios y ACL, mediante el procedimiento existente de `database-rollout.md` / `supabase-activation-2026-11-06.md`. Proteger el respaldo: después de este incremento contendrá también material criptográfico privado. Registrar hash y ensayo de restauración en destino aislado; nunca restaurar sobre las once tablas productivas.
2. Confirmar PostgreSQL 17 compatible y pgcrypto ya instalado. El script localiza su esquema real; exige que mlp_security_definer tenga USAGE de ese esquema y EXECUTE de hmac(bytea,bytea,text). Si falta algo, detenerse y revisar ese permiso concreto; no conceder acceso amplio ni instalar extensiones automáticamente.
3. Confirmar que el operador aprobado puede crear roles y transferir ownership a mlp_ddl_owner/mlp_security_definer sin SUPERUSER. La base productiva `postgres` exige auth_app propiedad de mlp_ddl_owner. Las membresías temporales del operador se retiran al terminar. Una limitación de Supabase debe abortar el incremento, no debilitar sus verificaciones.
4. Preparar credencial fuerte y exclusiva para mlp_identity_runtime mediante el mecanismo seguro existente, fuera del SQL Editor y sin contraseñas literales. El script crea el LOGIN sin password; no abre autenticación por contraseña hasta aprovisionarla. No reutilizar mlp_migrator, postgres ni mlp_inspector para la API.
5. Preparar una clave aleatoria criptográfica de 32–64 bytes y un KeyId único en el gestor de secretos. No copiarla a SQL, argumentos de consola, historial, archivos del proyecto ni registros. La aplicación y el operador reciben la misma clave por canales privados; el rol runtime nunca la obtiene desde PostgreSQL.

**Punto de aprobación:** presentar respaldo comprobado, estos tres archivos, comandos, ventana de parada y recuperación. Obtener autorización expresa antes de cualquier escritura remota. Este trabajo no la ejecuta ni presupone.

## Ejecución después de la aprobación

Usar psql contra Session pooler, puerto 5432, TLS VerifyFull y CA existente. Estos comandos son para una consola cuya configuración PGHOST/PGPORT/PGDATABASE/PGUSER/PGSSLMODE/PGSSLROOTCERT ya fue validada por el operador; la contraseña se solicita oculta con `-W`. No exportar ni imprimir cadenas completas. PGUSER debe ser el operador aprobado del proyecto, **no el runtime**.

```powershell
psql -X -W -v ON_ERROR_STOP=1 -f backend/sql/100-signed-actor-context.sql
# DETENERSE ante cualquier error. No continuar con una transacción abortada.
psql -X -W -v ON_ERROR_STOP=1 -f backend/sql/102-verify-signed-context-readonly.sql
```

Se prefiere psql para conservar exactamente los cuerpos SQL, sin transformaciones automáticas del SQL Editor. No ejecutar los cinco scripts históricos, bootstrap, migraciones ni 090. Una segunda ejecución de 100 se rechaza deliberadamente.

Comprobar que las filas `unexpected_access_must_be_false` y `public_execute_must_be_false` son falsas. Los verificadores SECURITY DEFINER deben pertenecer a mlp_security_definer y mostrar search_path vacío; actor_hmac es un wrapper invoker privado. Comparar el inventario de las once tablas y los checkpoints del respaldo.

Provisionar la clave con `Infrastructure/Database/ActorKeyProvisioner.InsertAsync`, sobre una conexión **administrativa aprobada**, obteniendo el byte[] desde el gestor de secretos y borrándolo de memoria al terminar. Utiliza parámetros Npgsql; no es un endpoint ni se ejecuta al iniciar. Desactivar registro de parámetros SQL tanto en cliente como en la plataforma durante el aprovisionamiento; si no puede garantizarse, detenerse. La ausencia de clave válida deniega el acceso: nunca habilitar un fallback.

Configurar mediante el gestor de secretos del entorno, sin cambiar la cadena ministerial existente:

| Configuración | Valor requerido |
| --- | --- |
| Database:ConnectionString | Existente: mlp_api_runtime, Session pooler, VerifyFull y CA vigente |
| Database:IdentityConnectionString | Misma base/proyecto y TLS; Username mlp_identity_runtime con el sufijo del proyecto en el pooler; password exclusivo |
| DatabaseActor:KeyId | Identificador aprovisionado |
| DatabaseActor:SigningKeyBase64 | Material privado, Base64, 32–64 bytes decodificados |
| Security:KeyRingPath / KeyCertificatePath / KeyCertificatePassword | Configuración persistente protegida existente; conservarla |

En variables de entorno, sustituir `:` por `__`. Production no carga User Secrets automáticamente: utilizar el proveedor seguro que ya sirve ese entorno. No rebajar a Development para omitir Data Protection. El arranque valida separación de identidades, privilegios, TLS y configuración criptográfica. Un desajuste de clave entre .NET y SQL falla en la primera transacción autenticada.

Desplegar backend y configuración juntos, conservando las claves Data Protection y cookies existentes. El binario anterior **no es compatible** con los nuevos permisos/contexto. Iniciar solo después de validar SQL, credenciales y clave.

## Aceptación remota pendiente

- HTTPS real: CSRF, login, session SUPER_ADMIN global, permisos, logout y session posterior 401. Sin imprimir cookies/tokens.
- Dos cuentas controladas de sedes distintas: acceso propio permitido y ajeno 403/404, incluidos documentos, procesos y reportes. No usar registros ministeriales reales para pruebas de escritura.
- Conexión nueva ministerial sin prueba: row_security_active verdadero; persona devuelve cero; helpers no autorizan aunque se cambie mlp.actor_id; acceso directo Identity/clave devuelve 42501.
- Firma vencida/manipulada/reutilizada: acceso denegado; revocación/desactivación invalida sesión. Vigilar tiempo de consulta, conexiones y expiración bajo carga real del Session pooler. Cada transacción añade desafío/verificación y una lectura Identity; no se ha medido latencia en Supabase.

Estas comprobaciones productivas requieren autorización y cuentas/datos de prueba acordados. La evidencia local no acredita aceptación remota ni una prueba de navegador Angular en este incremento.

## Recuperación

Si 100 falla antes del commit, PostgreSQL revierte sus objetos/ACL/roles dentro de esa transacción. Cerrar la sesión fallida y revisar el error; no ejecutar bloques posteriores sueltos ni repetir históricos.

Después de un commit, detener API y ejecutar, solo con aprobación:

```powershell
psql -X -W -v ON_ERROR_STOP=1 -f backend/sql/101-suspend-signed-context.sql
```

Es una reversión operativa segura: revoca la capacidad de autenticar nuevas conexiones y deshabilita todas las claves. NOLOGIN no termina conexiones abiertas: detener todos los procesos/pools antes; las claves deshabilitadas impiden autorizar nuevas sentencias. No restaurar UUID sin firma ni los GRANT antiguos. Mantener servicio detenido hasta desplegar una corrección revisada; reactivar únicamente claves/login aprobados con un cambio explícito. No se proporciona un down inseguro que vuelva a exponer los datos. Una restauración completa solo se ensaya en destino aislado, sin sobrescribir tablas productivas.

## Reproducción de las pruebas

Utilizar exclusivamente una base ya preparada en loopback con sufijo `_tests`, tablas ministeriales de referencia, catálogo de pruebas y el incremento 100 instalado. No usar User Secrets ni conexiones Supabase para los tests. Configurar temporalmente MLP_TEST_DATABASE (login ministerial), MLP_TEST_IDENTITY_DATABASE (login Identity), MLP_TEST_OPERATOR_DATABASE (operador de la misma base aislada) y MLP_TEST_PREPROVISIONED=1. La fixture valida host/base, no migra y aprovisiona una clave aleatoria solo en esa base.

```powershell
dotnet restore backend/MisionLiderParis.slnx --locked-mode
dotnet build backend/MisionLiderParis.slnx -c Release --no-restore
dotnet test backend/MisionLiderParis.slnx -c Release --no-build --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger trx --results-directory backend/artifacts/signed-actor
npm run spec:check
node backend/scripts/prepare-supabase-sql-editor.mjs --check
```

Se excluye expresamente PostgresActivationTests: ejecuta el despliegue histórico, migraciones y bootstrap, fuera de la autorización actual y del contrato nuevo. El workflow histórico de CI necesita una base preaprovisionada con este incremento y las cuatro variables anteriores antes de ejecutar esta selección; no debe utilizar el login propietario como runtime. No se ha ejecutado ese workflow remoto ni bootstrap para esta remediación.
