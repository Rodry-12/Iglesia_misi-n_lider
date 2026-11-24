# Backend Misión Líder París

API REST ASP.NET Core 10, EF Core 10, Npgsql e Identity, con capas Domain/Application/Infrastructure/Api. Especificaciones y evidencia en [specs/001-ministry-backend](specs/001-ministry-backend/spec.md).

Las once tablas existentes de `iglesia` se inspeccionaron en Supabase mediante Session pooler con TLS VerifyFull **antes de implementar sus mapeos EF**. Se implementaron cuentas, autenticación, autorización por sede, personas/documentos/traslados, sedes, categorías/procesos, asignaciones y reportes. **Los scripts incrementales no se han aplicado en Supabase**. No se ejecutó la reconstrucción adjunta.

**Activación local verificada (2026-10-24):** 41 unitarias y 27 de integración correctas; SQL real aplicado con filas existentes, respaldo/restauración antes y después del bootstrap, SuperAdministrador inicial y primer login Kestrel HTTPS comprobados. Ver [revisión de activación](docs/activation-review.md) y [comandos operativos](docs/database-rollout.md). API local preparada con credencial runtime y secretos DPAPI fuera de Git.

## Comandos

SDK .NET 10. Desde `backend/`:

```powershell
dotnet restore src/MisionLiderParis.Api/MisionLiderParis.Api.csproj --locked-mode
dotnet build src/MisionLiderParis.Api/MisionLiderParis.Api.csproj --no-restore -c Release
dotnet run --project src/MisionLiderParis.Api
```

La fase de activación retoma explícitamente unitarias del backend; Angular sigue sin unitarias. Para la suite backend completa:

```powershell
dotnet test MisionLiderParis.slnx -c Release
```

Sin `MLP_TEST_DATABASE` se omiten los escenarios PostgreSQL. Para ejecutarlos se requiere una base exclusiva de loopback con nombre terminado en `_tests`, restaurando primero **solo allí** `docs/reference/live-ministry-baseline.sql.txt`. La fixture agrega catálogos ficticios con códigos verificados, aplica scripts incrementales y usa un usuario NOBYPASSRLS. No usa datos personales de producción ni envía correo real.

## Configuración

No hay secretos en appsettings ni archivos versionados. Usar User Secrets en Development o variables del host:

```powershell
dotnet user-secrets set 'Database:ConnectionString' '<conexión Npgsql autorizada>' --project src/MisionLiderParis.Api
```

La conexión de producción debe usar `SSL Mode=VerifyFull`; si el pooler requiere la CA pública de Supabase, agregar `Root Certificate=<ruta al certificado público>`. Construir una conexión Npgsql con campos separados evita problemas con contraseñas que contienen caracteres reservados de URI. No usar una API key Supabase como conexión PostgreSQL.

Configurar AllowedHosts, Security:AllowedOrigins, SMTP STARTTLS/remitente y URLs HTTPS de confirmación/recuperación. Producción exige Security:KeyRingPath persistente, Security:KeyCertificatePath y Security:KeyCertificatePassword. No se aceptan callbacks arbitrarios del cliente. El limitador es por IP y por instancia.

La API de producción rechaza usuarios PostgreSQL superuser o BYPASSRLS. Usar un LOGIN propio miembro de `mlp_runtime`, separado del usuario DDL. El backend fija el actor en cada conexión; RLS restringe las sedes y los servicios exigen además cada permiso funcional.

## Inspección y mapeos

```powershell
dotnet run --project src/MisionLiderParis.Api -- --inspect-schema
dotnet run --project src/MisionLiderParis.Api -- --compare-schema
dotnet run --project src/MisionLiderParis.Api -- --verify-mappings
```

Son comandos locales de lectura: no publican metadatos por HTTP ni aplican cambios. La comparación devuelve salida 2 cuando requiere revisión; no tratar diferencias de formato como equivalencia automática. La verificación de mapeos consulta conjuntos vacíos de las once tablas. Fuentes, hashes y diferencias en [schema-review.md](docs/schema-review.md).

`AuthDbContext` administra únicamente `auth_app`, sin roles Identity duplicados. `MinistryDbContext` excluye todas sus tablas de migraciones. Nunca ejecutar EnsureCreated/EnsureDeleted ni migraciones ministeriales generadas a partir del modelo.

## Preparar Supabase

Revisar [el procedimiento de aplicación](docs/database-rollout.md). Los cinco scripts están preparados y se verifican solo en PostgreSQL local aislado:

1. `sql/001-auth-app.sql`: cuentas y auxiliares Identity.
2. `sql/002-explicit-operator-permissions.sql`: permisos explícitos por concesión.
3. `sql/proposals/003-assignment-integrity.sql`: fechas, transiciones e índice único de asignaciones abiertas.
4. `sql/004-auth-ministry-references.sql`: FK verificadas y validación de concesiones.
5. `sql/005-runtime-role-rls.sql`: grupo de ejecución y políticas RLS sin ampliar anon/authenticated/PUBLIC.

No son un comando automático de despliegue. El script 003 exige constancia de revisión y aborta ante datos incompatibles, sin repararlos ni borrarlos. Respaldar y revisar preflight/bloqueos antes de aplicar. La API nunca migra al iniciar.

Después, con conexión administrativa temporal en **Database:MigrationConnectionString**, proporcionar MLP_BOOTSTRAP_EMAIL/MLP_BOOTSTRAP_PASSWORD y ejecutar `--bootstrap-admin`. El comando selecciona esa conexión solo para bootstrap, usa transacción serializable/advisory lock y rechaza una base con cuentas existentes. Retirar las tres variables; el inicio normal usa exclusivamente Database:ConnectionString runtime. No existe registro público ni contraseña sembrada. El bootstrap real ya se verificó en la instancia local.

## Contrato y límites

Cookie HttpOnly/Secure/SameSite Strict, CSRF también en login, revocación por security stamp, bloqueo de cinco fallos durante quince minutos y tokens Identity para confirmación/recuperación. SMTP se sustituye por un buzón en memoria en integración; no se acredita entrega externa.

OpenAPI Development: `/openapi/v1.json`; salud: `/health/live` y `/health/ready`. Readiness comprueba conexión, autenticación y requisitos de integridad ministerial; sin preparar la base debe fallar.

Ver [contrato Angular](docs/angular-api-contract.md) para rutas/DTOs y [validation.md](specs/001-ministry-backend/validation.md) para evidencia y pendientes. La etapa 2.1 conecta login, sesión y logout Angular: [guía de autenticación](../docs/angular-authentication.md). Sin nuevos CRUD Angular, finanzas, diezmos, ofrendas ni historiales de procesos/responsables/seguimientos.
