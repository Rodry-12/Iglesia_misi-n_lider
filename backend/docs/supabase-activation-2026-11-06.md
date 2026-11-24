# Activación incremental de Supabase — 2026-11-06

Estado: **PREPARADA; NO AUTORIZADA NI EJECUTADA**. Destino único operativo:
`sneceodpvscrvjrlqwgw`, base `postgres`, Session pooler
`aws-1-us-east-2.pooler.supabase.com:5432`, TLS VerifyFull.
La inspección 009.1 ya confirmó once tablas, ausencia de `auth_app` y de los cinco
roles de despliegue. No repetir esa auditoría. No cambiar frontend ni servicios.
La base local deja de ser destino operativo de la aplicación; los helpers locales
anteriores son históricos y no se deben utilizar para este arranque.
El inventario exacto de diez archivos con sus SHA-256 está en
`supabase-activation-manifest.json`; verificarlo antes de autorizar/ejecutar.

## Paso actual: respaldo sin DDL

Desde la raíz del repositorio, en una consola propia:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\Backup-Supabase.ps1
```

Primero confirmar en Connect > Session pooler el usuario administrativo del
proyecto. El script lo solicita; espera `postgres.sneceodpvscrvjrlqwgw` y se
detiene si no coincide. Las contraseñas se introducen únicamente en los prompts
`Password` de los clientes; no enviarlas por chat. No rotar ninguna contraseña.
Confirmar que no hay escritores externos durante la ventana.

El script usa los clientes 17.11 ya presentes, sin instalar ni iniciar PostgreSQL.
Lee la CA pública de la configuración inspectora, sin usar su contraseña para
el respaldo. Destino por defecto: `%LOCALAPPDATA%\MisionLiderParis\SupabaseBackups\`
con subdirectorio único y ACL del usuario actual. Debe estar en almacenamiento
cifrado; una ACL privada **no equivale a cifrado**. Para otro volumen protegido:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\Backup-Supabase.ps1 -BackupRoot 'E:\RespaldosCifrados\MisionLiderParis'
```

Produce `before-activation.dump` con estructura/datos/ACL de `iglesia`, lista TOC,
preflight agregado, conteos/fingerprints antes/después, metadatos de 009.1 y
`manifest.json` con tamaños y SHA-256. No exporta hashes de contraseñas de roles.
No usa `--enable-row-security` ni omite ACL/ownership al capturar el dump.
Requiere las once entradas TABLE y TABLE DATA, decodifica todo el archivo con
`pg_restore --file NUL` sin conexión y exige contenido estable durante la copia.
Si falla cualquier comprobación, no existe respaldo aceptado para activar.

Los fingerprints MD5 detectan cambios de contenido entre pasos; el SHA-256 del
archivo es la comprobación de integridad del respaldo. Los snapshots separados
presuponen ausencia de escritores externos: el respaldo no bloquea toda escritura.
Los fingerprints requieren ordenar contenido; timeout de 60 s: si se supera,
detenerse y revisar volumen/ventana, sin aumentar límites silenciosamente.

**Verificar archivo no equivale a ensayar restauración.** `restoreRehearsed` queda
en `false`. No presentar un backup de plataforma, PITR ni una restauración como
verificados si no hay evidencia. Los respaldos administrados/PITR dependen del
plan real y pueden implicar restauración del proyecto, incompatible con recuperar
automáticamente encima de las tablas actuales.

## Precondiciones y aprobación

No hay credencial administrativa configurada disponible para esta preparación;
solo existe la inspectora sin SELECT. Por eso aún no se ejecutaron respaldo ni
preflight de datos reales. El primer paso manual anterior resuelve esa dependencia
sin persistir secretos. `010-data-preflight-readonly.sql` debe confirmar:

- Cinco estados conocidos y ninguna semántica extra; cero fechas incompatibles
  y cero grupos de asignaciones abiertas duplicadas, según el preflight de 003.
- Exactamente un rol ministerial `SUPER_ADMIN` activo/global; no inventar IDs.
- `auth_app` y los cinco roles aún ausentes; once tablas propiedad de `postgres`.
- Operador `postgres` y transacción READ ONLY. No reparar datos automáticamente.

Tras verificar el respaldo y acordar un destino de ensayo de recuperación vacío,
presentar sus rutas/hash, resultados del preflight y este inventario; solicitar
autorización expresa para 020, 001–005, concesiones/revocaciones, runtime y bootstrap.
El marcador psql `MLP_APPROVED_PROJECT` **no sustituye** esa autorización humana.
No crear otro proyecto Supabase ni un servidor local para satisfacer un ensayo.
Si no existe destino de recuperación autorizado, registrarlo como pendiente antes
de autorizar DDL; no llamar al respaldo “restauración probada”.

La política anterior pedía ensayar roles/ownership en otro Supabase. El usuario
ahora prohíbe crear otro proyecto: ese ensayo no está acreditado. La compatibilidad
de CREATE ROLE/GRANT/ALTER OWNER sigue pendiente; cualquier ejecución real requiere
autorización y debe abortar transaccionalmente ante una limitación del proveedor.
No conceder BYPASSRLS/CREATEROLE al migrator ni usar postgres como API.

## Comandos de cambio preparados — NO ejecutar todavía

Desde `backend`, abrir PowerShell. Configuración común de clientes:

```powershell
$taskPgBin = (Resolve-Path '.local/postgresql-17.11/pgsql/bin').Path
$taskAdmin = Read-Host 'Usuario administrativo EXACTO de Connect > Session pooler'
$taskMigrator = 'mlp_migrator.sneceodpvscrvjrlqwgw'
$env:PGHOST = 'aws-1-us-east-2.pooler.supabase.com'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGSSLMODE = 'verify-full'
$taskSecretsFile = Join-Path $env:APPDATA 'Microsoft/UserSecrets/mision-lider-paris-backend-development/secrets.json'
$taskSecrets = Get-Content -Raw -LiteralPath $taskSecretsFile | ConvertFrom-Json
$taskInspector = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskInspectorConnection = [string]$taskSecrets.'Database:InspectorConnectionString'
if ([string]::IsNullOrWhiteSpace($taskInspectorConnection)) { $taskInspectorConnection = [string]$taskSecrets.'Database:ConnectionString' }
$taskInspector.set_ConnectionString($taskInspectorConnection)
$env:PGSSLROOTCERT = [string]$taskInspector['Root Certificate']
foreach ($taskName in @('PGPASSWORD','PGOPTIONS','PGSERVICE','PGSERVICEFILE')) {
    [Environment]::SetEnvironmentVariable($taskName, $null, 'Process')
}
$env:PGUSER = $taskAdmin
```

Solo después de autorización, ejecutar uno por uno. Cada `-W` pide contraseña.
Ante cualquier exit distinto de cero detenerse; no continuar ni reintentar a ciegas.

```powershell
# 020: roles, ownership y retiro del USAGE adicional del inspector. Transaccional.
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -v MLP_APPROVED_PROJECT=sneceodpvscrvjrlqwgw -f sql/activation/020-provision-roles-and-ownership.sql
if ($LASTEXITCODE -ne 0) { throw 'Aprovisionamiento incompleto; detener ventana.' }
# El archivo solicita \password mlp_migrator sin incluirla en SQL ni historial.

$env:PGUSER = $taskMigrator
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/001-auth-app.sql
if ($LASTEXITCODE -ne 0) { throw '001 fallo.' }

$env:PGUSER = $taskAdmin
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'REVOKE CREATE ON DATABASE postgres FROM mlp_ddl_owner'
if ($LASTEXITCODE -ne 0) { throw 'Retiro de CREATE de base fallo.' }

$env:PGUSER = $taskMigrator
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/002-explicit-operator-permissions.sql
if ($LASTEXITCODE -ne 0) { throw '002 fallo.' }
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c "SET ROLE mlp_ddl_owner; SET mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2'" -f sql/proposals/003-assignment-integrity.sql
if ($LASTEXITCODE -ne 0) { throw '003 fallo; no reparar filas automaticamente.' }
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/004-auth-ministry-references.sql
if ($LASTEXITCODE -ne 0) { throw '004 fallo.' }
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'SET ROLE mlp_ddl_owner' -f sql/005-runtime-role-rls.sql
if ($LASTEXITCODE -ne 0) { throw '005 fallo.' }

$env:PGUSER = $taskAdmin
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'REVOKE mlp_security_definer FROM mlp_ddl_owner; REVOKE CREATE ON SCHEMA iglesia FROM mlp_ddl_owner'
if ($LASTEXITCODE -ne 0) { throw 'Retiro de privilegios temporales fallo.' }
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -v MLP_APPROVED_PROJECT=sneceodpvscrvjrlqwgw -f sql/activation/030-create-runtime-login.sql
if ($LASTEXITCODE -ne 0) { throw 'Runtime incompleto; no iniciar API.' }
# El archivo solicita \password mlp_api_runtime.
```

Entre cada paso: comparar OID/filas/fingerprints con el respaldo y ejecutar las
consultas posteriores del apartado 5 de `database-rollout.md`. 003 agrega la
función `validar_estado_fechas_v2`, CHECK e índice parcial y cambia el trigger;
no transforma filas. Los scripts no son una transacción global y 003–005 no son
idempotentes. No envolver todos en `--single-transaction`: ya gestionan sus límites.
No publicar API mientras falte algún checkpoint.

## Configuración runtime y bootstrap preparados

No cambiar el User Secret inspector por la conexión runtime. El proceso operativo
se ejecuta con `Production`, incluso si Angular/API corren en este computador.
No volver a usar `.local/angular-auth-local.ps1 -Mode Api`, que apunta a la base local.

Variables del proceso API (secretos mediante prompt seguro o almacén del host):

| Variable | Valor/precondición |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT` | `Production` |
| `Database__ConnectionString` | Session pooler, base postgres, LOGIN `mlp_api_runtime.sneceodpvscrvjrlqwgw`, contraseña privada, SSL Mode=VerifyFull y CA pública existente |
| `Database__RequireVerifiedTls` | `true` |
| `AllowedHosts` | `localhost` para el arranque privado en este computador |
| `Security__AllowedOrigins__0` | `https://localhost:4200` |
| `Security__KeyRingPath` | Directorio persistente privado para este destino, separado del ensayo local |
| `Security__KeyCertificatePath` / `Security__KeyCertificatePassword` | PFX aprobado para cifrar el key ring; no reutilizar credenciales del ensayo |
| `Kestrel__Certificates__Default__Path` / `Kestrel__Certificates__Default__Password` | Certificado HTTPS localhost válido y su contraseña |

Para construir la conexión sin imprimirla:

```powershell
function Read-SecretText([string]$Prompt) {
    $taskSecret = Read-Host $Prompt -AsSecureString
    [Net.NetworkCredential]::new('', $taskSecret).Password
}
$taskRuntime = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskRuntime['Host'] = 'aws-1-us-east-2.pooler.supabase.com'
$taskRuntime['Port'] = 5432
$taskRuntime['Database'] = 'postgres'
$taskRuntime['Username'] = 'mlp_api_runtime.sneceodpvscrvjrlqwgw'
$taskRuntime['Password'] = Read-SecretText 'Contrasena runtime'
$taskRuntime['SSL Mode'] = 'VerifyFull'
$taskRuntime['Root Certificate'] = $env:PGSSLROOTCERT
$taskRuntime['Timeout'] = 15
$taskRuntime['Command Timeout'] = 30
$env:Database__ConnectionString = $taskRuntime.get_ConnectionString()
$taskRuntime.Clear()
$env:Database__RequireVerifiedTls = 'true'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:DOTNET_ENVIRONMENT = 'Production'
$env:AllowedHosts = 'localhost'
$env:Security__AllowedOrigins__0 = 'https://localhost:4200'
$env:Security__KeyRingPath = Read-Host 'Ruta persistente privada del key ring para Supabase'
$env:Security__KeyCertificatePath = Read-Host 'Ruta del PFX de proteccion de datos'
$env:Security__KeyCertificatePassword = Read-SecretText 'Contrasena PFX de proteccion de datos'
$env:Kestrel__Certificates__Default__Path = Read-Host 'Ruta del PFX HTTPS localhost'
$env:Kestrel__Certificates__Default__Password = Read-SecretText 'Contrasena PFX HTTPS'
```

Bootstrap CLI existente, solo tras 001–005 verificados y autorización. Correo real
cuya titularidad confirma el operador; el bootstrap lo marca confirmado, no envía
SMTP y admite persona nula. Rechaza si ya existe cualquier cuenta. No usar el
correo/password del ensayo local.

```powershell
$taskBootstrapConnection = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskBootstrapConnection.set_ConnectionString($env:Database__ConnectionString)
$taskBootstrapConnection['Username'] = 'mlp_migrator.sneceodpvscrvjrlqwgw'
$taskBootstrapConnection['Password'] = Read-SecretText 'Contrasena temporal migrator'
$env:Database__MigrationConnectionString = $taskBootstrapConnection.get_ConnectionString()
$taskBootstrapConnection.Clear()
$env:MLP_BOOTSTRAP_EMAIL = Read-Host 'Correo real del SuperAdministrador verificado'
$env:MLP_BOOTSTRAP_PASSWORD = Read-SecretText 'Contrasena inicial fuerte (minimo 12 caracteres)'
try {
    dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api -- --bootstrap-admin
    if ($LASTEXITCODE -ne 0) { throw 'Bootstrap incompleto; no repetir sin comprobar cuentas.' }
} finally {
    foreach ($taskName in @('Database__MigrationConnectionString','MLP_BOOTSTRAP_EMAIL','MLP_BOOTSTRAP_PASSWORD')) {
        [Environment]::SetEnvironmentVariable($taskName, $null, 'Process')
    }
}
$env:PGUSER = $taskAdmin
& "$taskPgBin/psql.exe" -X -W -v ON_ERROR_STOP=1 -c 'REVOKE mlp_ddl_owner FROM mlp_migrator; ALTER ROLE mlp_migrator NOLOGIN'
if ($LASTEXITCODE -ne 0) { throw 'Cerrar acceso DDL antes de iniciar API.' }
dotnet run --no-launch-profile --no-build -c Release --project src/MisionLiderParis.Api --urls https://localhost:7243
```

En otra consola, desde la raíz, con el certificado público del HTTPS de la API:

```powershell
$env:NODE_EXTRA_CA_CERTS = Read-Host 'Ruta al certificado publico/CA del HTTPS de la API (no PFX)'
$env:MLP_API_PROXY_TARGET = 'https://localhost:7243'
npm start
```

No es necesario cambiar el proxy ni interceptores. La API debe validar su LOGIN
runtime al iniciar. No usar inspector/postgres ni variables de integración local.
Retirar secretos del entorno al detener el proceso y no guardar el key ring en Git.

## Verificaciones de aceptación reales

1. `/health/ready` = 200; roles runtime sin ownership, CREATE ni BYPASSRLS;
   únicamente membresía `mlp_runtime`; once tablas con RLS y sus políticas; helpers
   con owner `mlp_security_definer`, search_path vacío y sin EXECUTE de PUBLIC.
2. `/auth/csrf` = 200; login = 200; `/auth/session` = 200 con SUPER_ADMIN global;
   cookies HttpOnly/Secure/SameSite Strict y encabezado `X-XSRF-TOKEN` en escrituras.
3. `GET /api/v1/people?page=1&pageSize=1` = 200, `totalCount` real. Si hay registros,
   detalle de un ID devuelto; no exportar cuerpos personales a logs/capturas públicas.
   Sin personas existentes, registrar límite: no inventar datos ni declarar detalle probado.
4. Con cuentas de sede autorizadas existentes: listado filtrado; detalle ajeno 404;
   `branchId` ajeno 403; sin PERSON_VIEW, listado 403. SuperAdministrador solo no
   prueba aislamiento. Si faltan esas cuentas, su creación requiere alcance aprobado
   y confirmación de correo mediante el flujo existente; no marcar esa prueba como aprobada.
5. Con conexión runtime y actor vacío, SELECT de personas sin resultados; con actor
   de sede, solo ámbito permitido. Ejecutar únicamente lecturas en transacción con
   rollback; no suplantar actores en la API ni ejecutar suites destructivas.
6. Angular `/acceso` -> login -> `/gestion`, recarga mantiene sesión; logout = 204,
   sesión posterior = 401. `/gestion/personas` aún no existe: corresponde a SPEC 009.
   Login/logout pueden escribir metadatos Identity; no modifican datos ministeriales.
7. Conservar evidencia sanitaria de estados HTTP y permisos, sin cookies, tokens,
   contraseñas, documentos ni nombres de personas. SMTP/recuperación no se consideran
   probados por el bootstrap inicial; dependen de configuración de correo aprobada.

## Riesgos y recuperación sin sobrescribir tablas

- 003 necesita locks y escaneo/índice no concurrente; timeout de bloqueo 5 s y de
  sentencia 60 s. Fechas incompatibles/duplicados bloquean, no se reparan solos.
- Ownership y políticas cambian privilegios reales. Supabase puede rechazar alguna
  operación aun cuando los atributos de catálogo parezcan suficientes. Abortar.
- Cada archivo revierte su propia transacción fallida; los COMMIT anteriores quedan.
  Un fallo en `\password` ocurre después de COMMIT: no repetir 020/030; resolver
  exclusivamente la contraseña del LOGIN ya creado mediante paso autorizado.
- Conservar checkpoint/errores y mantener API detenida si falla un paso. Revisar
  corrección hacia adelante antes de continuar; no ejecutar Down, DROP, TRUNCATE,
  reconstrucción ni restauración sobre las once tablas existentes.
- La recuperación completa se prepara para una **base vacía existente y autorizada**,
  diferente del destino operativo; este paquete no crea proyectos ni servidores.
  Si ese destino no existe, el ensayo de restauración sigue pendiente y debe
  resolverse antes de afirmar que hay recuperación probada.

Comandos de recuperación preparados, no ejecutados:

```powershell
# Solo con PGHOST/PGDATABASE/PGUSER apuntando a un destino VACIO autorizado.
# Comprobar expresamente que NO sea la base operativa de sneceodpvscrvjrlqwgw.
# Aprovisionar allí referencias mínimas de roles de ACL bajo autorización propia.
# Nunca usar --clean ni --create ni --dbname apuntando al proyecto operativo.
& "$taskPgBin/pg_restore.exe" --exit-on-error --single-transaction --no-owner --dbname $env:PGDATABASE '<ruta privada>/before-activation.dump'
if ($LASTEXITCODE -ne 0) { throw 'Restauracion fallida; no cambiar conexiones.' }
# Comparar contenido/fingerprints/constraints y reinstalar ownership/ACL segun destino.
# No cambiar la aplicación de destino como parte de este ensayo.
```

Conservar también roles/ACL capturados, CA, configuración y luego las claves de
protección de datos del destino real. El dump de `iglesia` no respalda todo Supabase
ni Storage; un backup posterior debe incluir `auth_app`. Ningún archivo del paquete
acredita por sí solo un respaldo ejecutado, una restauración o un login remoto.

Referencias oficiales consultadas: [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
[respaldos y PITR](https://supabase.com/docs/guides/platform/backups).
