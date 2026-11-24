#requires -Version 5.1
# Separate privileged operation, NEVER executed by SQL Editor or API startup.
# Invoke manually only after provisioning and explicit activation authorization.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('mlp_api_runtime','mlp_migrator','mlp_identity_runtime')][string]$Role)
$ErrorActionPreference = 'Stop'
$taskBackend = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPsql = Join-Path $taskBackend '.local/postgresql-17.11/pgsql/bin/psql.exe'
if (!(Test-Path -LiteralPath $taskPsql)) { throw 'Cliente existente no disponible. No se instala ningun servidor.' }
$taskSecrets = Get-Content -Raw -LiteralPath (Join-Path $env:APPDATA 'Microsoft/UserSecrets/mision-lider-paris-backend-development/secrets.json') | ConvertFrom-Json
$taskInspector = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskInspectorConnection = [string]$taskSecrets.'Database:InspectorConnectionString'
if ([string]::IsNullOrWhiteSpace($taskInspectorConnection)) { $taskInspectorConnection = [string]$taskSecrets.'Database:ConnectionString' }
$taskInspector.set_ConnectionString($taskInspectorConnection)
if ($taskInspector['Host'] -ne 'aws-1-us-east-2.pooler.supabase.com' -or
    $taskInspector['Database'] -ne 'postgres' -or $taskInspector['Port'] -ne '5432' -or
    $taskInspector['Username'] -ne 'mlp_inspector.sneceodpvscrvjrlqwgw' -or $taskInspector['SSL Mode'] -ne 'VerifyFull') {
    throw 'La configuracion no coincide con el proyecto autorizado.'
}
$taskCa = [string]$taskInspector['Root Certificate']
if (!(Test-Path -LiteralPath $taskCa)) { throw 'CA publica no disponible.' }
if ((Read-Host ('Confirma autorizacion para asignar la contrasena del rol: escribe ' + $Role)) -cne $Role) { throw 'Operacion cancelada.' }
$taskNames = @('PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT','PGPASSWORD','PGOPTIONS','PGSERVICE','PGSERVICEFILE')
$taskPrevious = @{}
foreach ($taskName in $taskNames) { $taskPrevious[$taskName] = [Environment]::GetEnvironmentVariable($taskName,'Process') }
try {
    foreach ($taskName in @('PGPASSWORD','PGOPTIONS','PGSERVICE','PGSERVICEFILE')) { [Environment]::SetEnvironmentVariable($taskName,$null,'Process') }
    $env:PGHOST='aws-1-us-east-2.pooler.supabase.com'; $env:PGPORT='5432'; $env:PGDATABASE='postgres'
    $env:PGUSER='postgres.sneceodpvscrvjrlqwgw'; $env:PGSSLMODE='verify-full'; $env:PGSSLROOTCERT=$taskCa
    # psql prompts for the existing admin password, then the new role password twice.
    # It computes the verifier locally; no cleartext role password in arguments/history/SQL Editor.
    & $taskPsql -X -W -v ON_ERROR_STOP=1 -c ('\password ' + $Role)
    if ($LASTEXITCODE -ne 0) { throw 'Asignacion de contrasena no completada. No afirmar conexion runtime valida.' }
    Write-Host 'Solicitud de contrasena completada. Falta comprobar la conexion real del LOGIN.'
} finally {
    foreach ($taskName in $taskNames) { [Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process') }
}
