#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$AdminPoolerUser,
    [string]$BackupRoot = (Join-Path $env:LOCALAPPDATA 'MisionLiderParis\SupabaseBackups')
)
$ErrorActionPreference = 'Stop'
$taskBackend = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskBin = Join-Path $taskBackend '.local/postgresql-17.11/pgsql/bin'
$taskSecretsPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/mision-lider-paris-backend-development/secrets.json'
$taskSecrets = Get-Content -Raw -LiteralPath $taskSecretsPath | ConvertFrom-Json
$taskInspector = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskInspectorConnection = [string]$taskSecrets.'Database:InspectorConnectionString'
if ([string]::IsNullOrWhiteSpace($taskInspectorConnection)) { $taskInspectorConnection = [string]$taskSecrets.'Database:ConnectionString' }
$taskInspector.set_ConnectionString($taskInspectorConnection)
if ($taskInspector['Host'] -ne 'aws-1-us-east-2.pooler.supabase.com' -or
    $taskInspector['Database'] -ne 'postgres' -or $taskInspector['Port'] -ne '5432' -or
    $taskInspector['Username'] -ne 'mlp_inspector.sneceodpvscrvjrlqwgw' -or
    $taskInspector['SSL Mode'] -ne 'VerifyFull') { throw 'El destino de inspeccion no coincide con el proyecto autorizado.' }
$taskCa = [string]$taskInspector['Root Certificate']
if (!(Test-Path -LiteralPath $taskCa)) { throw 'No se encontro la CA publica de Supabase.' }
foreach ($taskTool in @('psql.exe', 'pg_dump.exe', 'pg_restore.exe')) {
    if (!(Test-Path -LiteralPath (Join-Path $taskBin $taskTool))) { throw "Cliente existente no disponible: $taskTool. No se instala nada." }
}
if (!$AdminPoolerUser) { $AdminPoolerUser = Read-Host 'Usuario administrativo Session pooler, copiado de Connect (sin contrasena)' }
if ($AdminPoolerUser -cne 'postgres.sneceodpvscrvjrlqwgw') { throw 'Usuario administrativo inesperado. Revisar Connect antes de continuar.' }
Write-Host 'Solo respaldo y consultas READ ONLY. No se aplica SQL de activacion.'
Write-Host 'El respaldo contiene datos personales: BackupRoot debe estar en almacenamiento privado cifrado.'
if ((Read-Host 'Confirma que detuviste todas las escrituras externas: escribe RESPALDAR') -cne 'RESPALDAR') { throw 'Respaldo cancelado.' }
$taskDestination = Join-Path ([IO.Path]::GetFullPath($BackupRoot)) ('sneceodpvscrvjrlqwgw-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $taskDestination | Out-Null
$taskAcl = Get-Acl -LiteralPath $taskDestination
$taskAcl.SetAccessRuleProtection($true, $false)
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskRule = [Security.AccessControl.FileSystemAccessRule]::new($taskIdentity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$taskAcl.AddAccessRule($taskRule)
Set-Acl -LiteralPath $taskDestination -AclObject $taskAcl
$taskEnvironmentNames = @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT','PGPASSWORD','PGPASSFILE','PGOPTIONS','PGSERVICE','PGSERVICEFILE')
$taskOldEnvironment = @{}
foreach ($taskName in $taskEnvironmentNames) { $taskOldEnvironment[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process') }
function Invoke-ReadOnlyEvidence([string]$Sql, [string]$OutputName) {
    & (Join-Path $taskBin 'psql.exe') -X -W -q -A -t -v ON_ERROR_STOP=1 --file $Sql --output (Join-Path $taskDestination $OutputName)
    if ($LASTEXITCODE -ne 0) { throw "Consulta READ ONLY incompleta: $OutputName. No continuar." }
}
try {
    foreach ($taskName in @('PGPASSWORD','PGSERVICE','PGSERVICEFILE')) { [Environment]::SetEnvironmentVariable($taskName, $null, 'Process') }
    $env:PGHOST = 'aws-1-us-east-2.pooler.supabase.com'
    $env:PGPORT = '5432'; $env:PGDATABASE = 'postgres'; $env:PGUSER = $AdminPoolerUser
    $env:PGSSLMODE = 'verify-full'; $env:PGSSLROOTCERT = $taskCa
    $env:PGPASSFILE = Join-Path $taskDestination 'unused-password-file'
    $env:PGOPTIONS = '-c default_transaction_read_only=on -c statement_timeout=60000'
    Invoke-ReadOnlyEvidence (Join-Path $taskBackend 'sql/activation/010-data-preflight-readonly.sql') 'data-preflight.json'
    $taskPreflight = Get-Content -Raw -LiteralPath (Join-Path $taskDestination 'data-preflight.json') | ConvertFrom-Json
    if ($taskPreflight.database -ne 'postgres' -or $taskPreflight.operator -ne 'postgres' -or
        $taskPreflight.readOnly -ne 'on' -or !$taskPreflight.operatorCanReadAllRows) {
        throw 'Identidad, destino o lectura completa no verificados. No continuar.'
    }
    $taskPreflightPassed = $taskPreflight.authAppAbsent -and $taskPreflight.deploymentRolesAbsent -and
        $taskPreflight.validStateCount -eq 5 -and $taskPreflight.unexpectedStateCount -eq 0 -and
        $taskPreflight.invalidAssignmentDateCount -eq 0 -and $taskPreflight.openDuplicateGroupCount -eq 0 -and
        $taskPreflight.activeGlobalSuperAdminRoleCount -eq 1 -and @($taskPreflight.tables).Count -eq 11 -and
        @($taskPreflight.tables | Where-Object owner -ne 'postgres').Count -eq 0
    if (!$taskPreflightPassed) {
        Write-Warning 'Preflight incompatible con la activacion prevista. Se conserva respaldo para revision, sin reparar ni desplegar.'
    }
    Invoke-ReadOnlyEvidence (Join-Path $taskBackend 'sql/activation/011-content-fingerprints-readonly.sql') 'content-before.json'
    $taskDump = Join-Path $taskDestination 'before-activation.dump'
    & (Join-Path $taskBin 'pg_dump.exe') -W --format=custom --strict-names --schema=iglesia --lock-wait-timeout=5000 --file $taskDump
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump fallo. El archivo parcial no acredita respaldo.' }
    & (Join-Path $taskBin 'pg_restore.exe') --list --file (Join-Path $taskDestination 'archive-list.txt') $taskDump
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el indice del respaldo.' }
    $taskList = Get-Content -Raw -LiteralPath (Join-Path $taskDestination 'archive-list.txt')
    if ([regex]::Matches($taskList, '(?m)^\d+;\s+\d+\s+\d+\s+TABLE\s+iglesia\s+').Count -ne 11 -or
        [regex]::Matches($taskList, '(?m)^\d+;\s+\d+\s+\d+\s+TABLE DATA\s+iglesia\s+').Count -ne 11) {
        throw 'El archivo no contiene las once tablas y once entradas TABLE DATA esperadas.'
    }
    # Decode the entire archive offline; this does not connect or execute restoration SQL.
    & (Join-Path $taskBin 'pg_restore.exe') --file NUL $taskDump
    if ($LASTEXITCODE -ne 0) { throw 'La decodificacion completa del respaldo fallo.' }
    Invoke-ReadOnlyEvidence (Join-Path $taskBackend 'sql/activation/011-content-fingerprints-readonly.sql') 'content-after.json'
    $taskBefore = (Get-Content -Raw -LiteralPath (Join-Path $taskDestination 'content-before.json')).Trim()
    $taskAfter = (Get-Content -Raw -LiteralPath (Join-Path $taskDestination 'content-after.json')).Trim()
    if ($taskBefore -cne $taskAfter) { throw 'El contenido cambio durante el respaldo. Revisar escritores externos y repetir el respaldo antes de activar.' }
    $taskSourceEvidence = Join-Path $taskBackend '.local/supabase-inspection-0091'
    foreach ($taskName in @('current-schema-security-metadata.json','current-schema-inspection.json','current-supplemental-metadata.json')) {
        Copy-Item -LiteralPath (Join-Path $taskSourceEvidence $taskName) -Destination (Join-Path $taskDestination $taskName)
    }
    $taskHashes = @()
    foreach ($taskFile in (Get-ChildItem -LiteralPath $taskDestination -File)) {
        $taskHashes += [ordered]@{file=$taskFile.Name; bytes=$taskFile.Length; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $taskFile.FullName).Hash}
    }
    $taskManifest = [ordered]@{project='sneceodpvscrvjrlqwgw';database='postgres';schema='iglesia';createdAtUtc=[DateTime]::UtcNow.ToString('o');tls='verify-full';format='pg_dump custom';archiveDecoded=$true;tableDataEntries=11;contentStable=$true;preflightPassed=$taskPreflightPassed;restoreRehearsed=$false;ddlExecuted=$false;files=$taskHashes}
    $taskManifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $taskDestination 'manifest.json')
    Write-Host ('Respaldo verificado como archivo: ' + $taskDestination)
    Write-Host ('SHA256: ' + (Get-FileHash -Algorithm SHA256 -LiteralPath $taskDump).Hash)
    Write-Host 'No se ensayo una restauracion. No se autoriza DDL por crear este respaldo.'
} finally {
    foreach ($taskName in $taskEnvironmentNames) { [Environment]::SetEnvironmentVariable($taskName, $taskOldEnvironment[$taskName], 'Process') }
}
