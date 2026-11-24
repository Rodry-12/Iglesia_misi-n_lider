# Aplicación, respaldo y primer acceso

Incremento de seguridad preparado el 2026-11-07: [contexto RLS firmado y separación Identity](signed-actor-rollout.md). Requiere SQL 100 y configuración nueva coordinados; no repetir 010–080 ni utilizar los comandos históricos de activación para desplegar este cambio. No aplicado en Supabase.

SQL Editor (preparación solicitada el 2026-11-06): usar el [paquete separado por checkpoints](../sql/supabase-editor/README.md). Conserva el modelo y las reglas de 001–005 con adaptaciones de ejecución 020 (DDL a nivel superior) y 040 (cuerpos idénticos en literales E); SET ROLE local por archivo, membresías temporales concedidas/revocadas explícitamente por postgres y contraseñas separadas del Editor. No copiar metacomandos psql históricos al Editor. 010 OK fue comunicado por el operador; no repetirlo. Ninguna corrección se ha ejecutado remotamente por el agente.

Preparación vigente 2026-11-06: [paquete de activación del proyecto existente](supabase-activation-2026-11-06.md). La inspección 009.1 ya está completada. El destino operativo autorizado es Supabase `sneceodpvscrvjrlqwgw`; no iniciar la aplicación contra PostgreSQL local. Respaldo real, ensayo de recuperación, preflight de datos y cambios remotos siguen pendientes. No crear otro proyecto ni instalar PostgreSQL. Ningún cambio remoto está autorizado todavía; primero respaldo verificable, comandos/riesgos/recuperación y aprobación expresa. Los ensayos locales de abajo son evidencia histórica.

Estado al 2026-10-24: verificado en PostgreSQL local aislado. **No ejecutar esta aplicación en Supabase de producción hasta autorizar su ventana y revisar el esquema actual. No se ejecutó allí durante esta fase.**

Nunca ejecutar la reconstrucción recibida ni restaurar el baseline de tests sobre una base existente. No usar EnsureCreated/EnsureDeleted ni Down de Identity.

## 1. Evidencia de la instancia local

La activación local quedó como evidencia en `artifacts/activation/` y `artifacts/activation-test-results/`. Los helpers `Start-LocalBackend.ps1` y `Test-FirstLogin.ps1` no están presentes en este checkout; no los invoques ni asumas que la API local sigue activa. Para reproducir la validación usa la sección 2 y una base PostgreSQL local aislada. El usuario `activation-admin@example.invalid`, su credencial cifrada con DPAPI y el certificado de pruebas no sirven para producción.

DPAPI solo se usa por el ensayo Windows para proteger una entrega local ignorada por Git. En el entorno definitivo, inyecta secretos desde el administrador de secretos del hosting (por ejemplo Azure Key Vault si se despliega en Azure) y configura un key ring persistente, protegido con certificado y compartido por todas las réplicas. Restringe ACL de archivos, acceso a certificado y copias de seguridad del key ring/certificado; no guardes ninguno en `appsettings`, `.env`, argumentos de proceso ni Angular.

## 2. Reproducir la activación en otra base aislada

Requiere SDK .NET 10, PostgreSQL 17 y clientes psql/pg_dump/pg_restore 17 disponibles. MLP_TEST_DATABASE debe apuntar a una base administrativa local dedicada, existente, con nombre terminado en _tests; nunca a Supabase. Su usuario necesita crear bases/roles y restaurar el baseline en los clones.

El escenario crea tres bases nuevas con sufijo _tests; no elimina ni reutiliza bases anteriores. Si no se suministra la variable, los escenarios PostgreSQL se omiten y no acreditan activación.

```powershell
function Read-SecretText([string]$Prompt) {
    $taskValue = Read-Host $Prompt -AsSecureString
    [Net.NetworkCredential]::new('', $taskValue).Password
}
$env:MLP_TEST_DATABASE = Read-SecretText 'Conexion Npgsql administrativa LOCAL terminada en _tests'
$env:MLP_POSTGRES_BIN = '<directorio local de psql, pg_dump y pg_restore>'
$env:MLP_KEEP_LOCAL_ACTIVATION = '1' # opcional Windows: entrega local cifrada con DPAPI
try {
    dotnet restore MisionLiderParis.slnx --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'Restore fallo' }
    dotnet build MisionLiderParis.slnx --no-restore -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Build fallo' }
    dotnet test MisionLiderParis.slnx --no-build --no-restore -c Release --logger trx --results-directory artifacts/activation-test-results
    if ($LASTEXITCODE -ne 0) { throw 'Pruebas fallaron' }
} finally {
    Remove-Item Env:MLP_TEST_DATABASE, Env:MLP_KEEP_LOCAL_ACTIVATION -ErrorAction SilentlyContinue
}
```

La entrega local DPAPI solo se produce en Windows con esa opción. En CI Linux no se guardan credenciales.

El escenario restaura únicamente docs/reference/live-ministry-baseline.sql.txt con SHA-256 verificado; nunca usa ministerial-reconstruction.sql.reference.txt. Si se quiere ejecutar la suite HTTP/Identity restante sobre una base vacía local, restaurar antes el baseline real en esa base _tests, como hace el workflow.

## 3. Preparación de una instancia de pruebas tipo Supabase

Para una instancia remota autorizada, usar Session pooler 5432 y TLS VerifyFull con su CA pública, o conexión directa con conectividad disponible. No usar transaction pooler para el contexto de actor basado en sesión. Obtener del servicio el usuario exacto correspondiente al LOGIN propio; no deducirlo del usuario postgres de otro proyecto.

Separar explícitamente estas identidades:

| Rol | Atributos y ámbito | Uso |
| --- | --- | --- |
| Administrador Supabase `postgres` | En la captura AC-016 no era SUPERUSER, pero tenía BYPASSRLS, CREATEROLE, CREATEDB y REPLICATION; era propietario de `iglesia` y sus 11 tablas. | Solo aprovisionamiento inicial y transferencia de ownership, tras autorización. Es elevado; no es el operador rutinario, el propietario de helpers ni el LOGIN de API. |
| `mlp_ddl_owner` | NOLOGIN, NOINHERIT, sin SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION. Propietario de las once tablas ministeriales y las tres funciones ministeriales existentes; propietario de `auth_app` creado por 001. | Propietario DDL sin LOGIN. La propiedad de tablas le permite alterar el esquema y omitir RLS sobre esas tablas; por eso no debe recibir credencial ni membresía runtime. CREATE en `iglesia` se revoca al terminar el cambio. |
| `mlp_security_definer` | NOLOGIN, NOINHERIT y sin atributos privilegiados, membresías, ownership de tablas/esquemas/base ni CREATE. Solo SELECT en `auth_app.users`, `auth_app.user_access_grants`, `iglesia.rol` y `iglesia.sede`; EXECUTE/SELECT no se heredan a runtime. | Propietario exclusivo de los dos helpers `SECURITY DEFINER`. Tiene políticas SELECT propias, `USING (true)`, solo en `iglesia.rol` y `iglesia.sede` para evitar recursividad RLS. |
| `mlp_runtime` | NOLOGIN, NOINHERIT, sin atributos privilegiados ni memberships. Solo CONNECT, USAGE de esquema, grants DML explícitos y políticas RLS. | Grupo compartido por el LOGIN de la API. No posee objetos y no puede asumir roles privilegiados. |
| `mlp_api_runtime` | LOGIN, INHERIT, sin SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION; miembro únicamente de `mlp_runtime`. | Credencial de ejecución privada de API. No usa DDL ni la conexión de bootstrap. |
| `mlp_migrator` temporal | LOGIN, INHERIT, sin atributos privilegiados, miembro temporal de `mlp_ddl_owner`; en psql se ejecuta `SET ROLE mlp_ddl_owner`. | Conexión separada durante la ventana para 001–005 y bootstrap inicial. Revocar su membresía y eliminar/deshabilitar el LOGIN al cerrar la ventana. |

### Matriz de privilegios y helpers

| Rol | Privilegios efectivos permitidos |
| --- | --- |
| `postgres` (admin de roles) | En la captura, CREATEROLE/BYPASSRLS/CREATEDB/REPLICATION y propietario actual. Solo lo requiere el aprovisionamiento inicial, transferencias y limpieza; no queda configurado en la API. |
| `mlp_ddl_owner` | Ownership de las 11 tablas ministeriales y 3 funciones ministeriales; CONNECT a la base; CREATE temporal en `iglesia` y CREATE temporal en la base para crear `auth_app` en 001; owner de `auth_app` y objetos Identity. Se revoca CREATE de base inmediatamente después de 001 y CREATE de `iglesia` después de 005. No CREATEROLE, CREATEDB, BYPASSRLS ni LOGIN. Como propietario omite RLS, riesgo limitado por NOLOGIN. |
| `mlp_security_definer` | USAGE en `iglesia`/`auth_app`; SELECT en `auth_app.users`, `auth_app.user_access_grants`, `iglesia.rol`, `iglesia.sede`; owner solo de los dos helpers. No tiene DML, CREATE, BYPASSRLS, membresías, LOGIN ni ownership de tablas/esquemas/base. |
| `mlp_runtime` / `mlp_api_runtime` | CONNECT; USAGE en `iglesia` y `auth_app`; EXECUTE de los dos helpers; USAGE sobre secuencias `auth_app`; SELECT/INSERT/UPDATE en `auth_app.users`; SELECT/INSERT/UPDATE/DELETE en claims, logins, tokens, grants y grant-permissions; SELECT en rol, permiso, rol_permiso y estados; SELECT/INSERT/UPDATE en sede, persona, documentos, membresías, categorías, procesos y asignaciones. Sin DELETE ministerial, CREATE, ownership, auth-schema access ni membresía adicional. Las once tablas ministeriales mantienen sus políticas RLS. |
| `mlp_migrator` | LOGIN de ventana, con CONNECT heredado desde `mlp_ddl_owner`; por su membresía temporal hereda el ownership/DDL. Después de bootstrap se revoca la membresía y el LOGIN queda NOLOGIN. No debe usarse en API. |

Los helpers de 005 son únicamente:

| Función | Resultado | Lecturas | Defensa |
| --- | --- | --- | --- |
| `auth_app.has_global_access()` | Confirma cuenta activa/no bloqueada con concesión SUPER_ADMIN global activa. | `auth_app.users`, `auth_app.user_access_grants`, `iglesia.rol`. | SECURITY DEFINER propiedad de `mlp_security_definer`; `search_path=''`; sin SQL dinámico; EXECUTE solo para `mlp_runtime`. |
| `auth_app.can_access_branch(uuid)` | Confirma acceso global o concesión activa BRANCH_ADMIN/OPERATOR a la sede activa indicada. | Las cuatro tablas anteriores más `iglesia.sede`. | Mismo owner/configuración/ACL que el helper global. Su uso desde la política SELECT de `sede` no recurre: la lectura interna se ejecuta como `mlp_security_definer`, cuya política SELECT en `sede` es `USING (true)`. La política equivalente de `rol` evita RLS recursiva al resolver códigos. Ese rol es NOLOGIN y runtime no puede asumirlo. |

005 revoca el EXECUTE predeterminado de PUBLIC antes de concederlo al grupo runtime; otorga EXECUTE al grupo antes de transferir ownership para que el DDL owner no necesite ser owner del helper después. El owner helper no omite RLS: sus dos políticas específicas de lectura sustituyen un BYPASSRLS amplio. La matriz no hace de RLS una barrera contra SQL arbitrario con la credencial runtime: el backend fija `mlp.actor_id`, pero una sesión con esa credencial también puede modificar el GUC y posee DML de Identity requerido por los endpoints. Por tanto, filtrar la credencial y prevenir SQL injection siguen siendo controles críticos; el rol runtime no es una identidad de usuario final.

La inspección real muestra que un DDL operator mínimo no puede modificar objetos actualmente propiedad de `postgres`: ALTER TABLE, trigger y policy requieren propietario o membresía del propietario. Por ello, el diseño traslada ownership a un grupo NOLOGIN dedicado. Este cambio de ownership es metadato, no cambia filas ni definición de tablas, pero requiere al administrador existente y debe ser parte explícita de la autorización productiva. No se ha probado todavía en un proyecto Supabase no productivo que el rol observado pueda crear los roles y transferir cada objeto; esa compatibilidad sigue siendo un preflight obligatorio.

En el ensayo local actualizado, los cinco archivos SQL pasan bajo un LOGIN sin atributos privilegiados que asume un rol propietario NOLOGIN limitado al esquema ministerial y al nuevo esquema de Identity. El LOGIN deja de pertenecer al propietario antes de concluir la activación. No se concede CREATEROLE ni BYPASSRLS al runtime ni al owner helper. Si Supabase impide crear los roles o transferir ownership, detenerse; no elevar `mlp_migrator`, no usar `service_role` y no ejecutar 005 con el LOGIN runtime.

Npgsql:

```text
Host=<host autorizado>;Port=5432;Database=postgres;Username=<LOGIN correspondiente>;Password=<secreto>;SSL Mode=VerifyFull;Root Certificate=<ruta a CA publica si corresponde>;Timeout=15;Command Timeout=30
```

Usar variables del host o User Secrets Development. appsettings no contiene secretos; .env.example solo documenta nombres y no se carga automáticamente. No copiar conexiones, certificados privados o contraseñas a Git/Angular. En producción configurar key ring persistente cifrado con certificado y compartirlo entre réplicas; respaldar y proteger ese material por separado.

## 4. Respaldo previo y ensayo de recuperación

Comandos preparados, no ejecutados contra producción. Suspender escrituras de la API y acordar ventana; el respaldo y cada archivo SQL no forman una única transacción global.

Desde backend, con clientes PostgreSQL 17 compatibles:

```powershell
$taskPgBin = '<directorio de clientes PostgreSQL>'
$taskBackupDirectory = '<directorio privado fuera de Git y con cifrado/acceso restringido>'
$env:PGHOST = '<host autorizado>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<administrador Supabase autorizado para el respaldo inicial>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<CA publica>'
$env:PGPASSWORD = Read-SecretText 'Contrasena del operador DDL'
try {
    # Antes de la primera activacion auth_app no existe: respaldar iglesia.
    & "$taskPgBin/pg_dump" --format=custom --schema=iglesia --file "$taskBackupDirectory/before-activation.dump"
    if ($LASTEXITCODE -ne 0) { throw 'Respaldo fallo; no continuar' }
    # Si auth_app ya existe, incluir tambien --schema=auth_app en el comando anterior.
    & "$taskPgBin/pg_restore" --list "$taskBackupDirectory/before-activation.dump"
    if ($LASTEXITCODE -ne 0) { throw 'Archivo de respaldo invalido' }
    Get-FileHash "$taskBackupDirectory/before-activation.dump" -Algorithm SHA256
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
```

Además guardar metadatos de roles/grants propios y definiciones actuales de funciones, triggers, CHECK y políticas; pg_dump de una base no respalda los roles globales. Si el servicio permite una copia/PITR administrada, verificar su disponibilidad/retención y su procedimiento específico. El respaldo de iglesia/auth_app no es un respaldo de Storage ni de todos los servicios de Supabase.

Ensayar restauración en **otra base vacía**, no en la original:

```powershell
# Cambiar PGHOST/PGUSER/PGPASSWORD a la instancia aislada de recuperacion.
# Crear alli las referencias a grupos/roles propios que figuren en el archivo antes de restaurar ACL.
& "$taskPgBin/createdb" --maintenance-db=postgres mlp_recovery_validation_tests
if ($LASTEXITCODE -ne 0) { throw 'La base debe ser nueva; no reutilizar una existente' }
& "$taskPgBin/pg_restore" --exit-on-error --single-transaction --no-owner --dbname=mlp_recovery_validation_tests "$taskBackupDirectory/before-activation.dump"
if ($LASTEXITCODE -ne 0) { throw 'Restauracion fallo; no activar' }
```

No usar --clean ni DROP sobre las tablas existentes. Si se omiten ACL deliberadamente al ensayar otro clúster, revisar/reinstalar los permisos runtime con un script específico; no repetir ciegamente 005 sobre un dump completo que ya contiene sus funciones/políticas.

Verificar conteos/contenido, FK, catálogos, propietario seguro, RLS y login. En esta fase se ensayaron realmente respaldos previos y posteriores al bootstrap en el mismo clúster local, preservando datos y cuenta/hash/concesiones/ACL. No se ensayó una restauración completa de un proyecto Supabase.

## 5. Orden exacto de aplicación SQL

### Inspección live de seguridad con Npgsql

Con `Database:ConnectionString` ya guardada en User Secrets para Development con `Ssl Mode=VerifyFull`, desde `backend` ejecutar:

```powershell
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$env:ASPNETCORE_ENVIRONMENT = 'Development'
try {
    dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api -- --inspect-live-security
    if ($LASTEXITCODE -ne 0) { throw 'Inspeccion READ ONLY incompleta; no afirmar verificacion' }
} finally {
    if ($null -eq $previousEnvironment) {
        Remove-Item Env:ASPNETCORE_ENVIRONMENT -ErrorAction SilentlyContinue
    } else {
        $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
    }
}
```

Este modo verifica que la cadena use VerifyFull, lee `sql/review/018-live-security-metadata.sql` y la ejecuta con Npgsql. El SQL abre una transacción `REPEATABLE READ READ ONLY`, limita el `search_path` y el timeout, consulta solo catálogos y termina con `ROLLBACK`. La salida se guarda en `src/MisionLiderParis.Api/schema-security-metadata.json`, ignorado por Git. Trátala como metadatos de seguridad internos; no imprimir ni compartir el archivo indiscriminadamente. El modo no crea el esquema/rol runtime ni ejecuta DDL.

### Cuenta inspectora dedicada para AC-016

Este aprovisionamiento cambia solamente el catálogo global de roles y la ACL de conexión de la base `postgres`; no altera esquemas ni tablas. Ejecutarlo únicamente con una cuenta administradora autorizada. No reutilizar la contraseña anterior ni escribir ninguna contraseña en SQL, argumentos, archivos o comandos del historial.

1. En el panel Supabase, elegir **Connect > Session pooler** y confirmar host, puerto, base y el nombre de usuario del pooler para el rol personalizado. No asumir que el usuario del pooler es idéntico al nombre del rol PostgreSQL.
2. Usar la CA pública guardada en `backend/.local/certificates/supabase-prod-ca-2021.crt`. `-W` solicita la contraseña administrativa de forma interactiva; no definir `PGPASSWORD`.

```powershell
$taskPgBin = '<directorio local de psql>'
$env:PGHOST = 'aws-1-us-east-2.pooler.supabase.com'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<usuario administrativo del Session pooler, tomado del panel>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = (Resolve-Path '.local\certificates\supabase-prod-ca-2021.crt').Path
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1
```

En `psql`, comprobar primero si el rol existe. Si ya existe, detenerse y revisar sus atributos y grants; no cambiarlo ni rotar su contraseña de forma implícita. Solo si no existe, crear este LOGIN, conceder CONNECT y definir la contraseña con `\password`, que la solicita dos veces sin mostrarla:

```sql
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls, rolinherit
FROM pg_catalog.pg_roles
WHERE rolname = 'mlp_inspector';

CREATE ROLE mlp_inspector LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
    NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE postgres TO mlp_inspector;
\password mlp_inspector

SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
       rolbypassrls, rolinherit,
       has_database_privilege('mlp_inspector', 'postgres', 'CONNECT') AS can_connect;
SELECT count(*) AS ministry_table_privileges
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
WHERE n.nspname IN ('iglesia', 'auth_app')
  AND c.relkind IN ('r', 'p')
  AND has_table_privilege('mlp_inspector', c.oid, p.privilege);
```

No conceder `USAGE` sobre `iglesia`, `auth_app` o `auth`, `SELECT` sobre tablas, membresías de roles, ni privilegios de escritura o creación. Si Supabase rechaza `CREATE ROLE` o `GRANT CONNECT`, detenerse; no elevar privilegios ni sustituirlos por grants amplios. Confirmar con una reconexión del inspector que sus atributos son mínimos y que no tiene privilegios de tablas ministeriales. La lectura de `pg_catalog` no requiere grants sobre las tablas; el ensayo local confirmó que CONNECT basta.

Para ejecutar `018-live-security-metadata.sql` con el inspector, usar el usuario del pooler confirmado en el panel. Crear primero el destino local y repetir la conexión interactiva; `-W` solicita la contraseña y no usa `PGPASSWORD`:

```powershell
New-Item -ItemType Directory -Force '.local\ac016' | Out-Null
$env:PGUSER = '<usuario del Session pooler para mlp_inspector, tomado del panel>'
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -o '.local\ac016\security-metadata.json' -f 'sql\review\018-live-security-metadata.sql'
if ($LASTEXITCODE -ne 0) { throw 'Lectura de metadatos no completada' }
```

El archivo puede contener metadatos de roles, ACL y políticas: mantenerlo local, fuera de Git.

Para el comparador, componer la cadena con `DbConnectionStringBuilder` para escapar correctamente contraseñas con separadores. `Read-SecretText` está definido en la sección 2; el texto claro solo vive en memoria y en el entorno del proceso durante la ejecución:

```powershell
$builder = [System.Data.Common.DbConnectionStringBuilder]::new()
$builder['Host'] = 'aws-1-us-east-2.pooler.supabase.com'
$builder['Port'] = '5432'
$builder['Database'] = 'postgres'
$builder['Username'] = '<usuario del Session pooler para mlp_inspector, tomado del panel>'
$builder['Password'] = Read-SecretText 'Contrasena de mlp_inspector'
$builder['SSL Mode'] = 'VerifyFull'
$builder['Root Certificate'] = (Resolve-Path '.local\certificates\supabase-prod-ca-2021.crt').Path
$builder['Timeout'] = '15'
$builder['Command Timeout'] = '30'
$env:Database__ConnectionString = $builder.ConnectionString
$env:Database__RequireVerifiedTls = 'true'
try {
    dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api -- --compare-schema
    $compareExit = $LASTEXITCODE
} finally {
    Remove-Item Env:Database__ConnectionString, Env:Database__RequireVerifiedTls -ErrorAction SilentlyContinue
    $builder.Clear()
}
if ($compareExit -notin @(0, 2)) { throw 'Comparacion READ ONLY no completada; no afirmar verificacion' }
```

Código 0 significa comparación completada sin revisión pendiente; código 2 requiere leer `schema-comparison.json` y resolver/reconocer los findings, no equivale a éxito. El comando no ejecuta DDL.

Antes de aplicar, ejecutar el SQL de metadatos (transacción `READ ONLY`) y la comparación estructural con conexión autorizada de lectura; revisar diferencias actuales. Ningún comando de inspección aplica DDL:

```powershell
# PGHOST/PGPORT/PGDATABASE/PGUSER/PGSSLMODE/PGSSLROOTCERT ya definidos según la sección 4.
$taskMetadata = Join-Path $taskBackupDirectory 'preflight-security-metadata.json'
$env:PGPASSWORD = Read-SecretText 'Contrasena de lectura/DDL autorizada'
try {
    & "$taskPgBin/psql" -X -v ON_ERROR_STOP=1 -o $taskMetadata -f sql/review/018-live-security-metadata.sql
    if ($LASTEXITCODE -ne 0) { throw 'Lectura de metadatos no completada; no continuar' }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$env:Database__ConnectionString = Read-SecretText 'Conexion Npgsql VerifyFull autorizada para comparar en READ ONLY'
$compareExit = $null
try {
    dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api -- --compare-schema
    $compareExit = $LASTEXITCODE
} finally {
    Remove-Item Env:Database__ConnectionString -ErrorAction SilentlyContinue
}
if ($compareExit -notin @(0, 2)) { throw 'Comparacion READ ONLY no completada; no continuar' }
# La salida 2 exige revisión de findings; no se acepta como equivalencia automática.
```

La comparación conserva observaciones explícitas de funciones/CHECK/RLS y puede salir con 2 por revisión; no ignorarlas como un éxito automático. Revisar preflight, propietarios, volumen y bloqueos con el operador. Si no hay conexión configurada, detenerse: usar una captura anterior no acredita el estado remoto actual.

| Orden | Archivo | Condición |
| --- | --- | --- |
| 1 | sql/001-auth-app.sql | Crea auth_app e Identity; idempotente por historial EF. |
| 2 | sql/002-explicit-operator-permissions.sql | Agrega permisos explícitos; requiere 001. |
| 3 | sql/proposals/003-assignment-integrity.sql | Aplicación única, catálogo/datos compatibles y reconocimiento de revisión en la misma sesión. |
| 4 | sql/004-auth-ministry-references.sql | Aplicación única, cuatro FK validadas y triggers de concesiones. |
| 5 | sql/005-runtime-role-rls.sql | Aplica funciones y políticas; requiere roles ya aprovisionados, owner DDL y membresía temporal a `mlp_security_definer`. |

### Roles y ownership antes de aplicar los archivos

Este es un paso de cambio productivo sujeto a autorización propia. La captura READ ONLY mostró que el propietario actual es el rol Supabase `postgres`, con BYPASSRLS y CREATEROLE. Un operador sin propiedad ni membresía del propietario no puede aplicar 003–005 sobre las once tablas existentes. El procedimiento aprobado transfiere únicamente su ownership (y el de las tres funciones ministeriales existentes) a `mlp_ddl_owner`, un rol NOLOGIN de ámbito limitado; no modifica filas ni reconstruye tablas. Si la transferencia no se puede probar primero en un proyecto Supabase aislado compatible, no continuar.

Tras respaldo y verificación de que los cinco roles personalizados no existen (si alguno ya existe, detenerse y comparar sus atributos/membresías; no alterarlo automáticamente), abrir una sesión psql con el usuario administrativo exacto de Supabase. `-W` solicita su secreto interactivamente. No usar `PGPASSWORD`, `-c` con contraseñas ni incluir secretos en el SQL:

```powershell
$taskPgBin = '<directorio local de clientes PostgreSQL 17>'
$env:PGHOST = '<host Session pooler autorizado>'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<usuario administrativo exacto del proyecto>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<ruta a la CA publica Supabase>'
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1
```

En el prompt psql, primero confirmar que los roles no existen y que el LOGIN tiene los permisos para ejecutar el aprovisionamiento. A continuación, crear roles y transferir ownership en una transacción. Los roles `mlp_runtime` y `mlp_security_definer` son precondiciones que verifica 005; el archivo ya no crea roles:

```sql
SELECT names.role_name, (r.oid IS NOT NULL) AS already_exists
FROM unnest(ARRAY['mlp_ddl_owner', 'mlp_security_definer', 'mlp_runtime',
                  'mlp_migrator', 'mlp_api_runtime']) AS names(role_name)
LEFT JOIN pg_catalog.pg_roles r ON r.rolname = names.role_name
ORDER BY names.role_name;

SELECT n.nspname, c.relname, pg_catalog.pg_get_userbyid(c.relowner) AS owner
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'iglesia' AND c.relkind = 'r'
ORDER BY c.relname;
SELECT n.nspname, p.proname, pg_catalog.pg_get_userbyid(p.proowner) AS owner
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'iglesia'
  AND p.proname IN ('validar_asignacion_proceso', 'validar_estado_fechas', 'validar_proceso_duplicado')
ORDER BY p.proname;

BEGIN;
CREATE ROLE mlp_ddl_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_security_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_migrator LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CREATE ON DATABASE postgres TO mlp_ddl_owner;
GRANT CONNECT ON DATABASE postgres TO mlp_ddl_owner;
GRANT USAGE, CREATE ON SCHEMA iglesia TO mlp_ddl_owner;
GRANT CONNECT ON DATABASE postgres TO mlp_runtime;
GRANT USAGE ON SCHEMA iglesia TO mlp_runtime, mlp_security_definer;
GRANT mlp_security_definer TO mlp_ddl_owner;
GRANT mlp_ddl_owner TO mlp_migrator;
GRANT mlp_ddl_owner TO CURRENT_USER WITH ADMIN OPTION;

ALTER TABLE iglesia.sede OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_documento OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_sede OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.categoria_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.estado_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.rol OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.permiso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.rol_permiso OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_asignacion_proceso() OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_estado_fechas() OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_proceso_duplicado() OWNER TO mlp_ddl_owner;

REVOKE mlp_ddl_owner FROM CURRENT_USER;
REVOKE USAGE ON SCHEMA iglesia FROM mlp_inspector;
COMMIT;
\password mlp_migrator
```

All five roles must report `already_exists = false`; otherwise stop and reconcile the prior state rather than changing it. Confirm exactly the eleven expected tables and three expected functions are listed and currently owned by `postgres`; any count, name, owner or privilege mismatch blocks this procedure pending review. The role administrator must also be able to create roles, grant the temporary memberships and transfer ownership. The commands above are not a way to elevate `mlp_migrator`.

La transferencia de ownership no altera filas, nombres, tipos, constraints ni OID. El rol `mlp_ddl_owner` puede omitir RLS como propietario; debe permanecer NOLOGIN y no ser miembro de runtime. La pertenencia temporal de `mlp_migrator` le da esos privilegios solo durante la ventana, por lo que no debe usarse para ejecutar la API. El grupo `mlp_security_definer` no es propietario de tablas ni miembro de runtime.

`REVOKE USAGE ON SCHEMA iglesia FROM mlp_inspector` corrige la concesión adicional observada en AC-016. No revoca CONNECT ni privilegios de metadatos de otros roles. Confirmar al final `has_schema_privilege('mlp_inspector','iglesia','USAGE') = false`.

El creador y operador DDL no son intercambiables: `postgres` solo realiza este aprovisionamiento inicial elevado; los archivos 001–005 se aplican con `mlp_migrator` después de `SET ROLE mlp_ddl_owner`. Si CREATE ROLE, GRANT o ALTER OWNER es rechazado por Supabase, hacer ROLLBACK antes de continuar y resolver esa limitación sin otorgar CREATEROLE/BYPASSRLS al LOGIN runtime.

Cada archivo se ejecuta en una conexión nueva; por eso `SET ROLE` y el SQL 003 de confirmación deben ir en `-c` antes de `-f` para el mismo proceso psql. Ejecutar secuencialmente:

```powershell
$env:PGUSER = 'mlp_migrator'
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/001-auth-app.sql
if ($LASTEXITCODE -ne 0) { throw 'Paso 001 fallo' }
$previousPgUser = $env:PGUSER
try {
    $env:PGUSER = '<usuario administrativo exacto del proyecto>'
    & "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'REVOKE CREATE ON DATABASE postgres FROM mlp_ddl_owner'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo retirar CREATE de base despues de 001; detener la ventana' }
} finally {
    if ($null -eq $previousPgUser) {
        Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
    } else {
        $env:PGUSER = $previousPgUser
    }
}
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/002-explicit-operator-permissions.sql
if ($LASTEXITCODE -ne 0) { throw 'Paso 002 fallo' }
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 `
    -c "SET ROLE mlp_ddl_owner; SET mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2'" `
    -f sql/proposals/003-assignment-integrity.sql
if ($LASTEXITCODE -ne 0) { throw 'Paso 003 fallo; revisar datos, no repararlos automaticamente' }
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/004-auth-ministry-references.sql
if ($LASTEXITCODE -ne 0) { throw 'Paso 004 fallo' }
& "$taskPgBin\psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/005-runtime-role-rls.sql
if ($LASTEXITCODE -ne 0) { throw 'Paso 005 fallo' }
```

Cada `-W` solicita la contraseña del migrator de forma interactiva. Detenerse ante el primer error; no saltar un archivo ni volver a ejecutar 003–005 a ciegas. Después de 005, con la autoridad de roles:

```sql
REVOKE mlp_security_definer FROM mlp_ddl_owner;
REVOKE CREATE ON SCHEMA iglesia FROM mlp_ddl_owner;
```

Conservar `mlp_ddl_owner` NOLOGIN para ownership; su CREATE en la base se retiró tras 001 y su CREATE en `iglesia` tras 005. Retirar el acceso del LOGIN temporal después de ejecutar bootstrap de la cuenta inicial: `REVOKE mlp_ddl_owner FROM mlp_migrator; ALTER ROLE mlp_migrator NOLOGIN;`. No conceder el rol propietario a `mlp_api_runtime`.

### Impacto, bloqueos, repetición y recuperación

| Paso | Objetos y efecto | Riesgo/orden | Repetición y recuperación |
| --- | --- | --- | --- |
| 001 | Crea `auth_app`, historial EF, `users`, `user_access_grants`, `user_claims`, `user_logins`, `user_tokens`, sus PK/FK e índices. No toca `iglesia` ni `auth`. | DDL breve; requiere permiso para crear esquema/tablas/secuencias. Debe preceder a 002. | Idempotente si el historial EF está íntegro. Todo el archivo está ahora dentro de una transacción. Un error revierte también esquema e historial. |
| 002 | Crea `user_grant_permissions`, FK CASCADE a la concesión, índice y segundo registro EF. | Requiere 001; no rellena permisos ni modifica usuarios existentes. | Idempotente por historial EF. Transacción atómica; ante error, detener y revisar historial/objetos antes de reintentar. |
| 003 | Añade y valida `ck_persona_proceso_fechas_v2`, reemplaza la función del trigger existente, crea el índice único parcial de asignaciones abiertas y elimina únicamente `ck_persona_proceso_fechas`. Conserva otros triggers/filas. | Preflight completo; bloquea `persona_proceso` y `estado_proceso` con `SHARE ROW EXCLUSIVE`; `VALIDATE CONSTRAINT` escanea datos y el índice único no es concurrente. Puede bloquear escrituras; `lock_timeout=5s`, `statement_timeout=60s`. | No idempotente: exige el CHECK original y rechaza objetos ya aplicados. Una excepción antes de COMMIT revierte todo. Tras COMMIT no ejecutar Down; corregir mediante plan revisado o recuperar en una base nueva. |
| 004 | Añade cuatro FK `NOT VALID` y luego las valida, dos índices, dos funciones y dos triggers en `auth_app`. | Requiere 001/002; los huérfanos hacen fallar la validación. La validación escanea tablas y requiere locks; límites 5s/60s. No repara ni elimina filas. | No idempotente. Cualquier error revierte el archivo completo; investigar huérfanos/permisos y no saltar la validación. |
| 005 | Verifica `mlp_runtime` y `mlp_security_definer` ya aprovisionados; concede CONNECT/privilegios runtime, crea dos helpers `SECURITY DEFINER`, les transfiere ownership al rol NOLOGIN dedicado y aplica políticas RLS en las once tablas. Revoca EXECUTE de PUBLIC. | Requiere 004, ownership de tablas por `mlp_ddl_owner` y que este pueda asumir temporalmente `mlp_security_definer`. Ninguno de los roles runtime/helper necesita BYPASSRLS, CREATEROLE, CREATE ni ownership ministerial. Lock timeout 5s. | No idempotente: las políticas duplicadas causan error. La transacción revierte los objetos, permisos y políticas de 005 si falla; los roles y ownership provisionados antes no se revierten con 005. No repetir a ciegas; comparar estado y preparar avance/recuperación revisados. |

Ningún paso contiene `DELETE`, `TRUNCATE`, `DROP TABLE` ni reconstrucción de las once tablas. El único `DROP` es el CHECK antiguo en 003, después de validar su reemplazo. Un COMMIT exitoso de un paso no se revierte automáticamente si falla un paso posterior. No existe rollback global transaccional entre cinco archivos.

El 003 valida antes de reemplazar el CHECK original, cambia únicamente el trigger de fechas y crea unicidad abierta; no inventa fechas de inicio para retiros. No borra ni repara filas incompatibles. Los otros dos triggers ministeriales se conservan. Cada script transaccional revierte su propio fallo; no deshace pasos anteriores ya confirmados. Si el preflight falla, detenerse y revisar datos/plan, sin forzar la migración.

Los scripts 003/004/005 no registran una migración EF y no deben repetirse automáticamente. Si hay una aplicación previa, inspeccionar objetos/constraints y decidir el punto de reanudación. No ejecutar Down de Identity ni DROP SCHEMA como reversión: eliminaría cuentas.

### Verificaciones posteriores por paso

Ejecuta cada consulta con la misma conexión autorizada; un resultado vacío o `false` detiene la activación. Guarda la salida de forma privada junto con el hash del respaldo. Estas verificaciones son de catálogo/conteos y no consultan personas ni datos de autenticación.

```sql
-- 001: namespace, tablas Identity e historial exacto.
SELECT to_regnamespace('auth_app') IS NOT NULL AS auth_app_exists;
SELECT "MigrationId", "ProductVersion" FROM auth_app.__ef_migrations_history
WHERE "MigrationId" = '20261024015144_InitialApplicationIdentity';
SELECT count(*) = 6 AS expected_auth_tables
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth_app' AND c.relkind IN ('r', 'p')
  AND c.relname IN ('__ef_migrations_history', 'users', 'user_access_grants',
    'user_claims', 'user_logins', 'user_tokens');

-- 002: segundo historial y tabla de permisos explícitos.
SELECT "MigrationId", "ProductVersion" FROM auth_app.__ef_migrations_history
WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions';
SELECT to_regclass('auth_app.user_grant_permissions') IS NOT NULL AS grant_permissions_exists;

-- 003: CHECK validado, índice único parcial válido y trigger de fechas.
SELECT convalidated FROM pg_catalog.pg_constraint
WHERE conrelid = 'iglesia.persona_proceso'::regclass AND conname = 'ck_persona_proceso_fechas_v2';
SELECT indisunique AND indisvalid AND indisready AS open_assignment_index_ready
FROM pg_catalog.pg_index WHERE indexrelid = to_regclass('iglesia.ux_persona_proceso_abierto_fecha');
SELECT pg_catalog.pg_get_triggerdef(oid) FROM pg_catalog.pg_trigger
WHERE tgrelid = 'iglesia.persona_proceso'::regclass
  AND tgname = 'trg_validar_estado_fechas' AND NOT tgisinternal;

-- 004: cuatro FK validadas y los dos triggers de concesión.
SELECT count(*) = 4 AS four_validated_references
FROM pg_catalog.pg_constraint
WHERE connamespace = 'auth_app'::regnamespace AND contype = 'f' AND convalidated
  AND conname IN ('fk_users_person', 'fk_access_grants_role',
    'fk_access_grants_branch', 'fk_grant_permissions_permission');
SELECT to_regprocedure('auth_app.validate_access_grant()') IS NOT NULL AS grant_validator_exists,
       to_regprocedure('auth_app.validate_operator_permission()') IS NOT NULL AS permission_validator_exists;

-- 005: atributos, membresía, RLS y políticas; repetir también desde el LOGIN runtime real.
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
FROM pg_catalog.pg_roles WHERE rolname IN ('mlp_runtime', 'mlp_api_runtime');
SELECT pg_catalog.pg_has_role('mlp_api_runtime', 'mlp_runtime', 'MEMBER') AS runtime_group_member,
       pg_catalog.has_schema_privilege('mlp_api_runtime', 'iglesia', 'CREATE') AS can_create_in_ministry,
       pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth_app', 'CREATE') AS can_create_in_auth_app,
       pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth', 'USAGE') AS can_use_supabase_auth;
SELECT NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
    WHERE (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
        OR r.rolname LIKE 'pg\_%' ESCAPE '\')
      AND pg_catalog.pg_has_role('mlp_api_runtime', r.oid, 'MEMBER')) AS no_privileged_membership,
       NOT pg_catalog.pg_has_role('mlp_api_runtime',
         (SELECT datdba FROM pg_catalog.pg_database WHERE datname = current_database()), 'MEMBER') AS not_database_owner;
SELECT pg_catalog.pg_has_role('mlp_api_runtime', 'mlp_runtime', 'MEMBER') AS runtime_group_member,
       NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
         WHERE r.oid <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'mlp_api_runtime')
           AND r.rolname <> 'mlp_runtime'
           AND pg_catalog.pg_has_role('mlp_api_runtime', r.oid, 'MEMBER')) AS has_only_runtime_membership;
SELECT pg_catalog.has_database_privilege('mlp_api_runtime', current_database(), 'CONNECT') AS can_connect,
       pg_catalog.has_schema_privilege('mlp_api_runtime', 'iglesia', 'USAGE') AS ministry_schema_usage,
       pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth_app', 'USAGE') AS identity_schema_usage,
       NOT pg_catalog.has_schema_privilege('mlp_api_runtime', 'iglesia', 'CREATE') AS cannot_create_ministry,
       NOT pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth_app', 'CREATE') AS cannot_create_identity,
       NOT pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth', 'USAGE') AS cannot_use_supabase_auth;
SELECT NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      AND pg_catalog.pg_has_role('mlp_api_runtime', c.relowner, 'MEMBER')) AS owns_no_application_relations,
       NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname IN ('iglesia', 'auth_app')
           AND pg_catalog.pg_has_role('mlp_api_runtime', p.proowner, 'MEMBER')) AS owns_no_application_functions;
SELECT count(*) = 11 AS all_ministry_tables_have_rls
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'iglesia' AND c.relkind = 'r' AND c.relrowsecurity;
SELECT count(DISTINCT schemaname || '.' || tablename) = 11 AS all_tables_have_runtime_policy
FROM pg_catalog.pg_policies WHERE schemaname = 'iglesia' AND 'mlp_runtime' = ANY(roles);
SELECT count(*) = 2 AS helper_reference_policies_present
FROM pg_catalog.pg_policies
WHERE schemaname = 'iglesia' AND policyname IN
  ('mlp_security_definer_role_read', 'mlp_security_definer_branch_read')
  AND 'mlp_security_definer' = ANY(roles);
SELECT p.prosecdef, p.proconfig, pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
       p.proacl
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'auth_app' AND p.proname IN
  ('has_global_access', 'can_access_branch');
```

El `mlp_api_runtime` del ejemplo es el LOGIN que se aprovisiona en la sección 6. Sustitúyelo por el nombre real aprobado. Los dos helpers deben ser `SECURITY DEFINER`, tener `search_path` vacío, pertenecer únicamente a `mlp_security_definer` y no tener EXECUTE de PUBLIC. El helper owner debe carecer de BYPASSRLS/CREATE/ownership, tener SELECT solo en las cuatro tablas de autorización y las dos políticas específicas de referencia. `mlp_inspector` debe quedar sin USAGE en `iglesia`.

Antes/después de cada paso compara el inventario de tablas ministeriales, sus OID y conteos/hash de contenido obtenidos en ventana consistente. Los cinco scripts no deben crear/eliminar/reconstruir ninguna de las once tablas de `iglesia`. Comprueba también que `auth` no cambió y que `auth_app`/`iglesia` no se agregaron al esquema expuesto por PostgREST.

## 6. Credencial runtime y bootstrap con datos propios

Después del 005, la autoridad de aprovisionamiento de roles crea un LOGIN separado, por ejemplo mlp_api_runtime. Esto es una plantilla revisable; no contiene contraseña:

```sql
CREATE ROLE mlp_api_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT mlp_runtime TO mlp_api_runtime;
```

Tras el 005, crear este LOGIN con la autoridad de roles y asignarle contraseña mediante `\password mlp_api_runtime` en psql interactivo; no incluir contraseña en SQL, argumentos ni historial. Si existe, no alterar sus atributos a ciegas: verificar primero que sea seguro. No conceder roles propietarios, CREATE de esquemas ni membresía a roles internos de Supabase. El runtime no administra migraciones ni el historial EF.

Configurar la conexión Npgsql runtime mediante entorno seguro. En una consola temporal, crear **el primer** administrador con la conexión DDL separada:

```powershell
# Funcion Read-SecretText definida en el apartado 2. Ejecutar con la configuración real del entorno.
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:Database__RequireVerifiedTls = 'true'
$env:Database__MigrationConnectionString = Read-SecretText 'Conexion Npgsql VerifyFull temporal de mlp_migrator'
$env:MLP_BOOTSTRAP_EMAIL = Read-Host 'Correo del SuperAdministrador verificado por el operador'
$env:MLP_BOOTSTRAP_PASSWORD = Read-SecretText 'Contrasena inicial (minimo 12, mayuscula, minuscula, numero y simbolo)'
# La configuración productiva exige estos valores incluso en el comando CLI.
$env:Security__KeyRingPath = '<ruta persistente protegida>'
$env:Security__KeyCertificatePath = '<ruta al certificado PFX protegido>'
$env:Security__KeyCertificatePassword = Read-SecretText 'Contrasena del certificado del key ring'
try {
    dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api -- --bootstrap-admin
    if ($LASTEXITCODE -ne 0) { throw 'Bootstrap rechazado; revisar base vacia y catalogo' }
} finally {
    Remove-Item Env:MLP_BOOTSTRAP_EMAIL, Env:MLP_BOOTSTRAP_PASSWORD, Env:Database__MigrationConnectionString,
        Env:Security__KeyCertificatePassword -ErrorAction SilentlyContinue
}
```

Al terminar correctamente el bootstrap inicial, y antes de iniciar la API normal, retirar la membresía y el LOGIN de despliegue con la autoridad de roles: `REVOKE mlp_ddl_owner FROM mlp_migrator; ALTER ROLE mlp_migrator NOLOGIN;`. Retirar `Database__MigrationConnectionString` del proceso. El runtime utiliza únicamente `Database__ConnectionString` de `mlp_api_runtime`.

No uses `Development` contra Supabase. Se resuelve el SUPER_ADMIN existente, se usa transacción serializable/advisory lock y se rechaza cualquier base que ya tenga cuentas. No siembra un rol nuevo ni permite repetir bootstrap. El operador confirma previamente la titularidad del correo inicial; el bootstrap lo marca confirmado y no envía SMTP. La relación con persona es opcional para esta cuenta inicial. El correo y contraseña de `activation-admin@example.invalid` están prohibidos en producción.

Para ejecutar la API normal, inyecta únicamente `Database__ConnectionString` runtime, `Database__RequireVerifiedTls=true`, `AllowedHosts`, `Security__AllowedOrigins` HTTPS, key ring/certificado protegidos y SMTP cuando esté aprobado. La API ignora `Database:MigrationConnectionString` al arrancar normalmente; aun así retírala del entorno del proceso. En producción/Staging se rechazan conexiones propietarias/privilegiadas y falta de TLS/key ring/certificado. Mantén la API privada hasta verificar autenticación, autorización, readiness y el proxy HTTPS; no habilites acceso público ni agregues `iglesia`/`auth_app` a PostgREST como parte de este procedimiento.

## 7. Primer login manual contra una instancia autorizada

1. Iniciar API con la credencial runtime y comprobar GET /health/ready = 200.
2. Usar un cliente HTTPS que valide el certificado y conserve cookies: GET /api/v1/auth/csrf devuelve token/headerName y cookie antiforgery.
3. POST /api/v1/auth/login con JSON email/password y encabezado X-XSRF-TOKEN. Esperar 200 y cookie __Host-mlp-session HttpOnly/Secure/SameSite Strict.
4. GET /api/v1/auth/session con esas cookies: SUPER_ADMIN con branchId nulo. Obtener CSRF nuevo al cambiar de identidad.
5. Consultar /api/v1/branches y /api/v1/users para comprobar autorización global.
6. POST /api/v1/auth/logout con CSRF de la sesión, esperar 204; GET /api/v1/auth/session posterior debe devolver 401.
7. En la instancia local, el flujo equivalente fue ejercitado por la prueba de activación Kestrel HTTPS. Para otra instancia, utilizar el certificado confiable y las credenciales propias; no reutilizar el certificado local de pruebas.

Angular requiere HTTPS en desarrollo o proxy del mismo sitio; origen permitido exacto https://localhost:4200 y withCredentials. Sin contraseñas/tokens en localStorage ni registro público. No se modificó todavía la sesión nula del frontend.

## 8. Recuperación operativa

Ante un fallo, detener nuevas escrituras y conservar logs/metadatos/checkpoint. Si falló un script, verificar su rollback y los pasos ya aplicados. Un respaldo anterior se restaura en una base/proyecto vacío de recuperación; validar antes de cambiar la conexión de la aplicación. No restaurar encima de las once tablas ni ejecutar Down para borrar Identity.

Para un respaldo posterior a activación, conservar roles/grants propios, claves de protección de datos y configuración externa. La pérdida de claves invalida cookies y tokens de Identity; planificar cierre de sesiones/recuperación de usuarios según el punto restaurado. Revisar escrituras posteriores al respaldo antes de un cambio de destino.

Fuentes operativas consultadas: [pg_dump PostgreSQL 17](https://www.postgresql.org/docs/17/app-pgdump.html), [RLS y propiedad de tablas](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [respaldos de Supabase](https://supabase.com/docs/guides/platform/backups), [configuración de Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-configuration?view=aspnetcore-10.0).
