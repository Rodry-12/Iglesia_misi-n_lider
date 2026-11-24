using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

internal static class TestCatalog
{
    public static readonly Guid GlobalRoleId = Guid.Parse("d1b475b7-3855-4172-b8e0-60f8a7fdf001");
    public static readonly Guid BranchRoleId = Guid.Parse("d1b475b7-3855-4172-b8e0-60f8a7fdf002");
    public static readonly Guid OperatorRoleId = Guid.Parse("d1b475b7-3855-4172-b8e0-60f8a7fdf003");
}

internal static class TestDatabaseSetup
{
    private static readonly SemaphoreSlim Gate = new(1);
    private static string? _runtimeConnection;
    public static async Task<string> InitializeAsync(string ownerConnection)
    {
        var settings = new NpgsqlConnectionStringBuilder(ownerConnection);
        if (settings.Database?.EndsWith("_tests", StringComparison.Ordinal) != true ||
            settings.Host is not ("localhost" or "127.0.0.1" or "::1"))
            throw new InvalidOperationException("Only an explicitly supplied loopback database ending in _tests is allowed.");
        await Gate.WaitAsync();
        try
        {
            if (_runtimeConnection is not null) return _runtimeConnection;
            await using var auth = new AuthDbContext(new DbContextOptionsBuilder<AuthDbContext>().UseNpgsql(ownerConnection,
                p => p.MigrationsHistoryTable("__ef_migrations_history", "auth_app")).Options);
            await auth.Database.MigrateAsync();
            await SeedCatalogAsync(ownerConnection);
            await using var connection = new NpgsqlConnection(ownerConnection);
            await connection.OpenAsync();
            await using (var roles = new NpgsqlCommand("""
                DO $roles$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'mlp_runtime') THEN
                        CREATE ROLE mlp_runtime NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'mlp_security_definer') THEN
                        CREATE ROLE mlp_security_definer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
                    END IF;
                END;
                $roles$;
                DO $connect$
                BEGIN
                    EXECUTE pg_catalog.format('GRANT CONNECT ON DATABASE %I TO mlp_runtime', current_database());
                END;
                $connect$;
                GRANT USAGE ON SCHEMA iglesia TO mlp_runtime, mlp_security_definer;
                GRANT mlp_security_definer TO CURRENT_USER;
                """, connection))
                await roles.ExecuteNonQueryAsync();
            await using (var review = new NpgsqlCommand("SET mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2'", connection))
                await review.ExecuteNonQueryAsync();
            foreach (var script in new[] { "003-assignment-integrity.sql", "004-auth-ministry-references.sql", "005-runtime-role-rls.sql" })
            {
                var appliedQuery = script.StartsWith("003", StringComparison.Ordinal)
                    ? "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'ck_persona_proceso_fechas_v2' AND conrelid = 'iglesia.persona_proceso'::regclass)"
                    : script.StartsWith("004", StringComparison.Ordinal)
                    ? "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conname = 'fk_users_person' AND conrelid = 'auth_app.users'::regclass)"
                    : "SELECT to_regprocedure('auth_app.can_access_branch(uuid)') IS NOT NULL";
                await using var applied = new NpgsqlCommand(appliedQuery, connection);
                if ((bool)(await applied.ExecuteScalarAsync())!) continue;
                var sql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "reviewed-sql", script));
                await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 60 };
                await command.ExecuteNonQueryAsync();
            }
            var password = Guid.NewGuid().ToString("N");
            var runtimeLogin = "mlp_test_runtime_" + Guid.NewGuid().ToString("N")[..12];
            // Generated identifier/password contain only a fixed identifier and hex digits, never client input.
            await using (var login = new NpgsqlCommand($"CREATE ROLE {runtimeLogin} LOGIN PASSWORD '{password}' NOSUPERUSER NOBYPASSRLS; GRANT mlp_runtime TO {runtimeLogin}", connection))
                await login.ExecuteNonQueryAsync();
            settings.Username = runtimeLogin; settings.Password = password;
            _runtimeConnection = settings.ConnectionString;
            return _runtimeConnection;
        }
        finally { Gate.Release(); }
    }

    internal static async Task SeedCatalogAsync(string ownerConnection)
    {
        await using var ministry = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql(ownerConnection).Options);
        if (await ministry.Roles.AnyAsync()) return;
        ministry.Roles.AddRange(new FunctionalRole { Id = TestCatalog.GlobalRoleId, Code = "SUPER_ADMIN", Name = "Test global", IsGlobal = true },
            new FunctionalRole { Id = TestCatalog.BranchRoleId, Code = "BRANCH_ADMIN", Name = "Test branch" },
            new FunctionalRole { Id = TestCatalog.OperatorRoleId, Code = "OPERATOR", Name = "Test operator" });
        ministry.States.AddRange(new ProcessState { Code = "PENDING", Name = "Pending" }, new ProcessState { Code = "IN_PROGRESS", Name = "In progress" },
            new ProcessState { Code = "SUSPENDED", Name = "Suspended" }, new ProcessState { Code = "COMPLETED", Name = "Completed", IsFinal = true },
            new ProcessState { Code = "WITHDRAWN", Name = "Withdrawn", IsFinal = true });
        using var snapshot = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "verified-catalog.json")));
        foreach (var item in snapshot.RootElement.GetProperty("permissions").EnumerateArray())
        {
            var permission = new FunctionalPermission { Code = item.GetProperty("code").GetString()!,
                Name = item.GetProperty("code").GetString()!, Module = item.GetProperty("module").GetString()! };
            ministry.Permissions.Add(permission);
            ministry.RolePermissions.Add(new RolePermission { RoleId = TestCatalog.GlobalRoleId, PermissionId = permission.Id });
            if (item.GetProperty("branchAdmin").GetBoolean())
                ministry.RolePermissions.Add(new RolePermission { RoleId = TestCatalog.BranchRoleId, PermissionId = permission.Id });
        }
        await ministry.SaveChangesAsync();
    }
}
