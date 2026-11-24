using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using MisionLiderParis.Infrastructure.Database;

namespace MisionLiderParis.Api.Health;

public sealed class DatabaseHealthCheck(AuthDbContext database, IOptions<DatabaseOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.Value.ConnectionString)) return HealthCheckResult.Unhealthy();
        try
        {
            // Confirms auth tables, not merely TCP connectivity. No writes or migrations.
            await database.Users.AsNoTracking().Select(x => x.Id).Take(1).ToArrayAsync(ct);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        { return HealthCheckResult.Unhealthy(); }
    }
}

public sealed class MinistrySchemaHealthCheck(MinistryDbContext database, IWebHostEnvironment environment) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            var integrity = await database.Database.SqlQueryRaw<bool>("""
                SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE
                    conrelid = 'iglesia.persona_proceso'::regclass AND conname = 'ck_persona_proceso_fechas_v2' AND convalidated)
                  AND EXISTS (SELECT 1 FROM pg_catalog.pg_index WHERE indexrelid = to_regclass('iglesia.ux_persona_proceso_abierto_fecha')
                    AND indisunique AND indisvalid AND indisready) AS "Value"
                """).SingleAsync(ct);
            if (!integrity) return HealthCheckResult.Unhealthy();
            if (!environment.IsDevelopment() && !environment.IsEnvironment("Testing"))
            {
                var privileged = await database.Database.SqlQueryRaw<bool>(RuntimeDatabaseSafety.UnsafeRoleQuery).SingleAsync(ct);
                if (privileged) return HealthCheckResult.Unhealthy();
            }
            // Presence by name alone is insufficient: require validated cross-schema references and runtime policies.
            var accessReady = await database.Database.SqlQueryRaw<bool>("""
                WITH expected(name) AS (VALUES ('sede'),('persona'),('persona_documento'),('persona_sede'),
                    ('categoria_proceso'),('proceso'),('estado_proceso'),('persona_proceso'),('rol'),('permiso'),
                    ('rol_permiso'),('tipo_documento'))
                SELECT (SELECT count(*) FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid = c.connamespace
                    WHERE n.nspname = 'auth_app' AND c.contype = 'f' AND c.convalidated AND c.conname IN
                        ('fk_users_person', 'fk_access_grants_role', 'fk_access_grants_branch', 'fk_grant_permissions_permission')) = 4
                  AND (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'iglesia' AND c.relkind = 'r' AND c.relrowsecurity
                      AND c.relname IN (SELECT name FROM expected)) = (SELECT count(*) FROM expected)
                  AND has_table_privilege(current_user, 'iglesia.tipo_documento', 'SELECT')
                  AND to_regprocedure('auth_app.can_access_branch(uuid)') IS NOT NULL
                  AND (SELECT count(DISTINCT schemaname || '.' || tablename) FROM pg_catalog.pg_policies
                    WHERE schemaname = 'iglesia' AND 'mlp_runtime' = ANY(roles)
                      AND tablename IN (SELECT name FROM expected)) = (SELECT count(*) FROM expected) AS "Value"
                """).SingleAsync(ct);
            if (!accessReady) return HealthCheckResult.Unhealthy();
            var states = await database.States.AsNoTracking().Select(s => new { s.Code, s.IsFinal }).ToListAsync(ct);
            return states.Count == 5 && states.Count(s => s.IsFinal && (s.Code == "COMPLETED" || s.Code == "WITHDRAWN")) == 2 &&
                states.Count(s => !s.IsFinal && (s.Code == "PENDING" || s.Code == "IN_PROGRESS" || s.Code == "SUSPENDED")) == 3
                ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        { return HealthCheckResult.Unhealthy(); }
    }
}
