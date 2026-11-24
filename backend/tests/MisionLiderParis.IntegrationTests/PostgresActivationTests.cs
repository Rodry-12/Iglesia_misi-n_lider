using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Database;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed class PostgresActivationTests
{
    private static readonly string[] Tables = ["sede", "persona", "persona_documento", "persona_sede", "categoria_proceso",
        "proceso", "estado_proceso", "persona_proceso", "rol", "permiso", "rol_permiso"];
    private static readonly string[] Scripts = ["001-auth-app.sql", "002-explicit-operator-permissions.sql",
        "003-assignment-integrity.sql", "004-auth-ministry-references.sql", "005-runtime-role-rls.sql"];
    private const string Review = "SET mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2';";
    private sealed record DeploymentPrincipal(string ConnectionString, string OwnerRole, string LoginRole);

    [PostgresFact]
    public async Task ReviewedSqlPreservesDataBackupRestoresAndBootstrapLogsInOverRealHttps()
    {
        var settings = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE"));
        Assert.True(settings.Host is "localhost" or "127.0.0.1" or "::1" && settings.Database!.EndsWith("_tests", StringComparison.Ordinal));
        var backendRoot = FindBackendRoot();
        var name = "mlp_activation_" + Guid.NewGuid().ToString("N")[..12] + "_tests";
        var recoveryName = name.Replace("activation", "recovery", StringComparison.Ordinal);
        var activatedRecoveryName = name.Replace("activation", "restored_active", StringComparison.Ordinal);
        var output = Path.Combine(backendRoot, "artifacts", "activation", name);
        Directory.CreateDirectory(output);
        var owner = new NpgsqlConnectionStringBuilder(settings.ConnectionString) { Database = name };
        await using (var control = new NpgsqlConnection(settings.ConnectionString))
        {
            await control.OpenAsync();
            await SqlAsync(control, $"CREATE DATABASE {name}");
            await SqlAsync(control, $"CREATE DATABASE {recoveryName}");
            await SqlAsync(control, $"CREATE DATABASE {activatedRecoveryName}");
        }
        var baseline = Path.Combine(AppContext.BaseDirectory, "activation", "live-ministry-baseline.sql.txt");
        Assert.Equal("A6723E5F406CF80B0CDD34A2A4C2724706ADCA58E03709A2665DF2410F9F31C9",
            Convert.ToHexString(SHA256.HashData(await File.ReadAllBytesAsync(baseline))));
        await PgAsync("psql", owner, ["-X", "-v", "ON_ERROR_STOP=1", "-f", baseline], backendRoot);
        await TestDatabaseSetup.SeedCatalogAsync(owner.ConnectionString);
        await SeedExistingRowsAsync(owner.ConnectionString);
        await using var connection = new NpgsqlConnection(owner.ConnectionString);
        await connection.OpenAsync();
        var before = await FingerprintAsync(connection);
        var tableIds = await TableIdsAsync(connection);
        var triggerBefore = await ScalarAsync<string>(connection, """
            SELECT string_agg(pg_get_triggerdef(oid), E'\n' ORDER BY tgname) FROM pg_trigger
            WHERE tgrelid = 'iglesia.persona_proceso'::regclass AND tgname <> 'trg_validar_estado_fechas' AND NOT tgisinternal
            """);
        var backup = Path.Combine(output, "before-activation.dump");
        await PgAsync("pg_dump", owner, ["--format=custom", "--schema=iglesia", "--file", backup], backendRoot);
        var deployment = await PrepareRestrictedDeploymentAsync(connection, owner.ConnectionString);
        await using (var ddlConnection = new NpgsqlConnection(deployment.ConnectionString))
        {
            await ddlConnection.OpenAsync();
            await SqlAsync(ddlConnection, $"SET ROLE {new NpgsqlCommandBuilder().QuoteIdentifier(deployment.OwnerRole)}");
            await using var roleCheck = new NpgsqlCommand("""
                SELECT current_user = @owner AND NOT r.rolsuper AND NOT r.rolbypassrls
                  AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND NOT r.rolreplication
                FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
                """, ddlConnection);
            roleCheck.Parameters.AddWithValue("owner", deployment.OwnerRole);
            Assert.True((bool)(await roleCheck.ExecuteScalarAsync())!);
            await SqlAsync(ddlConnection, Review);
            foreach (var script in Scripts)
            {
                await SqlAsync(ddlConnection, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "reviewed-sql", script)));
                Assert.Equal(before, await FingerprintAsync(connection));
                Assert.Equal(tableIds, await TableIdsAsync(connection));
                if (script == "001-auth-app.sql")
                {
                    using var quoting = new NpgsqlCommandBuilder();
                    await SqlAsync(connection,
                        $"REVOKE CREATE ON DATABASE {quoting.QuoteIdentifier(name)} FROM {quoting.QuoteIdentifier(deployment.OwnerRole)}");
                    await using var createCheck = new NpgsqlCommand(
                        "SELECT pg_catalog.has_database_privilege(@owner, current_database(), 'CREATE')", connection);
                    createCheck.Parameters.AddWithValue("owner", deployment.OwnerRole);
                    Assert.False((bool)(await createCheck.ExecuteScalarAsync())!);
                }
            }
            // Identity scripts are idempotent; later reviewed SQL is deliberately not blindly rerun.
            foreach (var script in Scripts.Take(2))
                await SqlAsync(ddlConnection, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "reviewed-sql", script)));
        }
        Assert.Equal(2L, await ScalarAsync<long>(connection, "SELECT count(*) FROM auth_app.__ef_migrations_history"));
        Assert.Equal(4L, await ScalarAsync<long>(connection, """
            SELECT count(*) FROM pg_constraint WHERE conname IN
              ('fk_users_person', 'fk_access_grants_role', 'fk_access_grants_branch', 'fk_grant_permissions_permission') AND convalidated
            """));
        Assert.True(await ScalarAsync<bool>(connection, """
            SELECT count(*) = 2 AND bool_and(p.prosecdef
                AND p.proconfig @> ARRAY['search_path=""']
                AND pg_catalog.pg_get_userbyid(p.proowner) = 'mlp_security_definer'
                AND pg_catalog.has_function_privilege('mlp_runtime', p.oid, 'EXECUTE')
                AND NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(p.proacl) a
                    WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'))
            FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'auth_app' AND p.proname IN ('has_global_access', 'can_access_branch')
            """));
        Assert.True(await ScalarAsync<bool>(connection, """
            SELECT NOT r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
              AND NOT pg_catalog.has_schema_privilege('mlp_security_definer', 'auth_app', 'CREATE')
              AND NOT pg_catalog.has_table_privilege('mlp_security_definer', 'auth_app.users', 'INSERT')
              AND pg_catalog.has_table_privilege('mlp_security_definer', 'auth_app.users', 'SELECT')
              AND count(*) = 2
            FROM pg_catalog.pg_roles r
            CROSS JOIN pg_catalog.pg_policies p
            WHERE r.rolname = 'mlp_security_definer' AND p.schemaname = 'iglesia'
              AND p.policyname IN ('mlp_security_definer_role_read', 'mlp_security_definer_branch_read')
            GROUP BY r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolcreaterole
            """));
        await SqlAsync(connection, $"REVOKE mlp_security_definer FROM {new NpgsqlCommandBuilder().QuoteIdentifier(deployment.OwnerRole)}; REVOKE CREATE ON SCHEMA iglesia FROM {new NpgsqlCommandBuilder().QuoteIdentifier(deployment.OwnerRole)}");
        Assert.Equal(triggerBefore, await ScalarAsync<string>(connection, """
            SELECT string_agg(pg_get_triggerdef(oid), E'\n' ORDER BY tgname) FROM pg_trigger
            WHERE tgrelid = 'iglesia.persona_proceso'::regclass AND tgname <> 'trg_validar_estado_fechas' AND NOT tgisinternal
            """));
        var recovery = new NpgsqlConnectionStringBuilder(owner.ConnectionString) { Database = recoveryName };
        await PgAsync("pg_restore", recovery, ["--exit-on-error", "--single-transaction", "--no-owner", "--no-acl", "--dbname", recoveryName, backup], backendRoot);
        await using (var restored = new NpgsqlConnection(recovery.ConnectionString))
        {
            await restored.OpenAsync();
            Assert.Equal(before, await FingerprintAsync(restored));
            Assert.True(await ScalarAsync<bool>(restored, "SELECT to_regnamespace('auth_app') IS NULL"));
            // Valid under the old CHECK but inconsistent with PENDING: preflight must reject without repairing data.
            await SqlAsync(restored, "UPDATE iglesia.persona_proceso SET fecha_inicio = fecha_asignacion");
            var invalidBefore = await FingerprintAsync(restored);
            await SqlAsync(restored, Review);
            var failure = await Assert.ThrowsAsync<PostgresException>(() => SqlAsync(restored,
                File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "reviewed-sql", Scripts[2]))));
            Assert.Equal("P0001", failure.SqlState);
            await SqlAsync(restored, "ROLLBACK");
            Assert.Equal(invalidBefore, await FingerprintAsync(restored));
            Assert.False(await ScalarAsync<bool>(restored, "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'ck_persona_proceso_fechas_v2')"));
        }
        var runtime = new NpgsqlConnectionStringBuilder(owner.ConnectionString)
        { Username = "mlp_activation_" + Guid.NewGuid().ToString("N")[..12], Password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)) };
        await SqlAsync(connection, $"CREATE ROLE {runtime.Username} LOGIN PASSWORD '{runtime.Password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION; GRANT mlp_runtime TO {runtime.Username}");
        await RuntimeDatabaseSafety.VerifyAsync(runtime.ConnectionString, CancellationToken.None);
        var unassignedRole = "mlp_unassigned_" + Guid.NewGuid().ToString("N")[..12];
        var unassignedPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        await SqlAsync(connection, $"CREATE ROLE {unassignedRole} LOGIN PASSWORD '{unassignedPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION");
        var unassignedConnection = new NpgsqlConnectionStringBuilder(owner.ConnectionString) { Username = unassignedRole, Password = unassignedPassword };
        await Assert.ThrowsAsync<InvalidOperationException>(() => RuntimeDatabaseSafety.VerifyAsync(unassignedConnection.ConnectionString, CancellationToken.None));
        await SqlAsync(connection, $"DROP ROLE {unassignedRole}");
        await Assert.ThrowsAsync<InvalidOperationException>(() => RuntimeDatabaseSafety.VerifyAsync(owner.ConnectionString, CancellationToken.None));
        // NOBYPASSRLS alone is insufficient: inheriting the table owner must also be rejected.
        var unsafeRole = "mlp_unsafe_" + Guid.NewGuid().ToString("N")[..12];
        await SqlAsync(connection, $"CREATE ROLE {unsafeRole} NOLOGIN NOSUPERUSER NOBYPASSRLS");
        await SqlAsync(connection, $"ALTER TABLE iglesia.sede OWNER TO {unsafeRole}; GRANT {unsafeRole} TO {runtime.Username}");
        await Assert.ThrowsAsync<InvalidOperationException>(() => RuntimeDatabaseSafety.VerifyAsync(runtime.ConnectionString, CancellationToken.None));
        using (var quoting = new NpgsqlCommandBuilder())
            await SqlAsync(connection, $"ALTER TABLE iglesia.sede OWNER TO {quoting.QuoteIdentifier(deployment.OwnerRole)}; REVOKE {unsafeRole} FROM {runtime.Username}");
        await RuntimeDatabaseSafety.VerifyAsync(runtime.ConnectionString, CancellationToken.None);
        await SqlAsync(connection, "GRANT pg_read_all_data TO mlp_runtime");
        await Assert.ThrowsAsync<InvalidOperationException>(() => RuntimeDatabaseSafety.VerifyAsync(runtime.ConnectionString, CancellationToken.None));
        var unsafeRuntimeScript = await Assert.ThrowsAsync<PostgresException>(() => SqlAsync(connection,
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "reviewed-sql", Scripts[4]))));
        Assert.Contains("must not inherit or assume other roles", unsafeRuntimeScript.MessageText);
        await SqlAsync(connection, "ROLLBACK");
        await SqlAsync(connection, "REVOKE pg_read_all_data FROM mlp_runtime");
        await RuntimeDatabaseSafety.VerifyAsync(runtime.ConnectionString, CancellationToken.None);
        var adminEmail = "activation-admin@example.invalid";
        var adminPassword = "Aa1!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var environment = new Dictionary<string, string> {
            ["ASPNETCORE_ENVIRONMENT"] = "Testing", ["Database__RequireVerifiedTls"] = "false",
            ["Database__ConnectionString"] = runtime.ConnectionString,
            ["Database__MigrationConnectionString"] = deployment.ConnectionString,
            ["MLP_BOOTSTRAP_EMAIL"] = adminEmail, ["MLP_BOOTSTRAP_PASSWORD"] = adminPassword };
        var api = Path.Combine(backendRoot, "src", "MisionLiderParis.Api", "bin", "Release", "net10.0", "MisionLiderParis.Api.dll");
        environment["Security__PasswordLength"] = "4";
        var weakConfiguration = await RunAsync("dotnet", [api, "--bootstrap-admin"], environment, backendRoot);
        Assert.Equal(2, weakConfiguration.ExitCode);
        Assert.Equal(0L, await ScalarAsync<long>(connection, "SELECT count(*) FROM auth_app.users"));
        environment.Remove("Security__PasswordLength");
        var bootstrap = await RunAsync("dotnet", [api, "--bootstrap-admin"], environment, backendRoot);
        Assert.True(bootstrap.ExitCode == 0, bootstrap.Output);
        Assert.Contains("First administrator created.", bootstrap.Output);
        var repeat = await RunAsync("dotnet", [api, "--bootstrap-admin"], environment, backendRoot);
        Assert.Equal(2, repeat.ExitCode);
        Assert.DoesNotContain(adminEmail, repeat.Output); Assert.DoesNotContain(adminPassword, repeat.Output);
        Assert.Equal(1L, await ScalarAsync<long>(connection, "SELECT count(*) FROM auth_app.users WHERE email_confirmed AND is_active AND password_hash IS NOT NULL"));
        using (var quoting = new NpgsqlCommandBuilder())
            await SqlAsync(connection, $"REVOKE {quoting.QuoteIdentifier(deployment.OwnerRole)} FROM {quoting.QuoteIdentifier(deployment.LoginRole)}; DROP ROLE {quoting.QuoteIdentifier(deployment.LoginRole)}");
        Assert.True(await ScalarAsync<bool>(connection, """
            SELECT EXISTS(SELECT 1 FROM auth_app.users u JOIN auth_app.user_access_grants g ON g.user_id = u.id
              JOIN iglesia.rol r ON r.id = g.role_id WHERE r.codigo = 'SUPER_ADMIN' AND g.branch_id IS NULL)
            """));
        var activatedBackup = Path.Combine(output, "after-bootstrap.dump");
        await PgAsync("pg_dump", owner, ["--format=custom", "--schema=iglesia", "--schema=auth_app", "--file", activatedBackup], backendRoot);
        var restoredActive = new NpgsqlConnectionStringBuilder(owner.ConnectionString) { Database = activatedRecoveryName };
        // Preserve ACLs here: the same isolated cluster already contains the referenced runtime group/login.
        await PgAsync("pg_restore", restoredActive, ["--exit-on-error", "--single-transaction", "--no-owner", "--dbname", activatedRecoveryName, activatedBackup], backendRoot);
        await using (var activeRestore = new NpgsqlConnection(restoredActive.ConnectionString))
        {
            await activeRestore.OpenAsync();
            Assert.Equal(before, await FingerprintAsync(activeRestore));
            Assert.Equal(await ScalarAsync<string>(connection, "SELECT password_hash FROM auth_app.users"),
                await ScalarAsync<string>(activeRestore, "SELECT password_hash FROM auth_app.users"));
            Assert.Equal(1L, await ScalarAsync<long>(activeRestore, "SELECT count(*) FROM auth_app.user_access_grants"));
        }
        var restoredRuntime = new NpgsqlConnectionStringBuilder(runtime.ConnectionString) { Database = activatedRecoveryName };
        await RuntimeDatabaseSafety.VerifyAsync(restoredRuntime.ConnectionString, CancellationToken.None);
        await using (var restoredSession = new NpgsqlConnection(restoredRuntime.ConnectionString))
        {
            await restoredSession.OpenAsync();
            Assert.Equal(1L, await ScalarAsync<long>(restoredSession, "SELECT count(*) FROM auth_app.users"));
        }
        using var key = RSA.Create(2048);
        var request = new CertificateRequest("CN=localhost", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("localhost"); request.CertificateExtensions.Add(san.Build());
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, false, 0, true));
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddDays(1));
        var certPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var certificatePath = Path.Combine(output, "localhost.pfx");
        await File.WriteAllBytesAsync(certificatePath, certificate.Export(X509ContentType.Pfx, certPassword));
        using var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
        var baseUrl = $"https://localhost:{port}";
        environment.Remove("Database__MigrationConnectionString"); environment.Remove("MLP_BOOTSTRAP_EMAIL"); environment.Remove("MLP_BOOTSTRAP_PASSWORD");
        environment["ASPNETCORE_URLS"] = baseUrl;
        environment["Kestrel__Certificates__Default__Path"] = certificatePath;
        environment["Kestrel__Certificates__Default__Password"] = certPassword;
        using var process = Start("dotnet", [api], environment, backendRoot);
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        try
        {
            using var handler = new HttpClientHandler { ServerCertificateCustomValidationCallback = (_, peer, _, errors) =>
            {
                if (peer is null || (errors & ~SslPolicyErrors.RemoteCertificateChainErrors) != SslPolicyErrors.None ||
                    !peer.RawData.AsSpan().SequenceEqual(certificate.RawData)) return false;
                using var chain = new X509Chain(); chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
                chain.ChainPolicy.CustomTrustStore.Add(certificate); chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                return chain.Build(peer);
            } };
            using var client = new HttpClient(handler) { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(5) };
            var ready = false;
            for (var attempt = 0; attempt < 60 && !process.HasExited; attempt++)
            {
                try { ready = (await client.GetAsync("/health/ready")).IsSuccessStatusCode; if (ready) break; }
                catch (HttpRequestException) { }
                await Task.Delay(250);
            }
            Assert.True(ready, "Real HTTPS Kestrel did not become ready with the isolated runtime connection.");
            await SetCsrfAsync(client);
            var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = adminEmail, password = adminPassword });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var sessionCookie = Assert.Single(login.Headers.GetValues("Set-Cookie"), c => c.StartsWith("__Host-mlp-session=", StringComparison.Ordinal));
            Assert.Contains("secure", sessionCookie); Assert.Contains("httponly", sessionCookie);
            var session = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/session");
            Assert.Equal("SUPER_ADMIN", session.GetProperty("grants")[0].GetProperty("roleCode").GetString());
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/branches")).StatusCode);
            await SetCsrfAsync(client);
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/logout", null)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/session")).StatusCode);
            // Optional Windows-only operator handoff: secrets are DPAPI-encrypted through stdin, never printed or versioned.
            if (OperatingSystem.IsWindows() && Environment.GetEnvironmentVariable("MLP_KEEP_LOCAL_ACTIVATION") == "1")
            {
                var protectedPath = Path.Combine(backendRoot, ".local", "activation.credential");
                var secrets = JsonSerializer.Serialize(new { connectionString = runtime.ConnectionString, email = adminEmail,
                    password = adminPassword, certificatePath, certificatePassword = certPassword, baseUrl });
                var protect = await RunAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
                    "$taskSecret=[Console]::In.ReadToEnd(); $taskSecure=ConvertTo-SecureString $taskSecret -AsPlainText -Force; $taskSecure | ConvertFrom-SecureString | Set-Content -LiteralPath $env:MLP_ACTIVATION_CREDENTIAL -Encoding ASCII"],
                    new Dictionary<string, string> { ["MLP_ACTIVATION_CREDENTIAL"] = protectedPath }, backendRoot, secrets);
                Assert.Equal(0, protect.ExitCode);
            }
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync(); await stdout; await stderr;
        }
        Assert.Equal(before, await FingerprintAsync(connection));
        await File.WriteAllTextAsync(Path.Combine(output, "result.json"), JsonSerializer.Serialize(new {
            database = name, recoveryDatabase = recoveryName, activatedRecoveryDatabase = activatedRecoveryName, scripts = Scripts, preservedTables = 11,
            backupRestored = true, bootstrapRepeatedRejected = true, httpsLogin = true, runtimeRls = true,
            productionAccessed = false, verifiedAtUtc = DateTimeOffset.UtcNow }, new JsonSerializerOptions { WriteIndented = true }));
    }

    private static async Task SeedExistingRowsAsync(string connectionString)
    {
        await using var db = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql(connectionString).Options);
        var branch = new Branch { Code = "PRESERVE", Name = "Preserve local data" };
        var person = new Person { FirstNames = "Preserved", LastNames = "Participant" };
        var responsible = new Person { FirstNames = "Preserved", LastNames = "Responsible" };
        var category = new ProcessCategory { Name = "Preserved category" };
        var process = new MinistryProcess { CategoryId = category.Id, Name = "Preserved process" };
        db.AddRange(branch, person, responsible, category, process); await db.SaveChangesAsync();
        db.AddRange(new PersonBranch { PersonId = person.Id, BranchId = branch.Id }, new PersonBranch { PersonId = responsible.Id, BranchId = branch.Id },
            new PersonDocument { PersonId = person.Id, DocumentType = "TEST", DocumentNumber = "PRESERVE-P", IssuingCountry = "CO" },
            new PersonDocument { PersonId = responsible.Id, DocumentType = "TEST", DocumentNumber = "PRESERVE-R", IssuingCountry = "CO" });
        await db.SaveChangesAsync();
        db.Assignments.Add(new ProcessAssignment { PersonId = person.Id, ResponsiblePersonId = responsible.Id,
            BranchId = branch.Id, ProcessId = process.Id, StateId = await db.States.Where(s => s.Code == "PENDING").Select(s => s.Id).SingleAsync() });
        await db.SaveChangesAsync();
    }

    private static async Task SetCsrfAsync(HttpClient client)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", csrf.GetProperty("token").GetString());
    }
    private static Task<string> FingerprintAsync(NpgsqlConnection connection) => ScalarAsync<string>(connection,
        string.Join(" UNION ALL ", Tables.Select(t => $"SELECT '{t}' AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM iglesia.{t} t"))
            .Insert(0, "SELECT jsonb_object_agg(name, rows)::text FROM (") + ") data");
    private static Task<string> TableIdsAsync(NpgsqlConnection connection) => ScalarAsync<string>(connection,
        "SELECT string_agg(relname || ':' || c.oid::text, ',' ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iglesia' AND relkind='r'");
    private static async Task SqlAsync(NpgsqlConnection connection, string sql)
    { await using var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 60 }; await command.ExecuteNonQueryAsync(); }
    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    { await using var command = new NpgsqlCommand(sql, connection); return (T)(await command.ExecuteScalarAsync())!; }
    private static async Task<DeploymentPrincipal> PrepareRestrictedDeploymentAsync(
        NpgsqlConnection admin, string adminConnectionString)
    {
        var settings = new NpgsqlConnectionStringBuilder(adminConnectionString);
        var ownerRole = "mlp_ddl_owner_" + Guid.NewGuid().ToString("N")[..12];
        var loginRole = "mlp_migrator_" + Guid.NewGuid().ToString("N")[..12];
        var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        using var quoting = new NpgsqlCommandBuilder();
        var owner = quoting.QuoteIdentifier(ownerRole);
        var login = quoting.QuoteIdentifier(loginRole);
        var database = quoting.QuoteIdentifier(settings.Database!);
        await SqlAsync(admin, """
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
            """);
        var ownership = $"""
            CREATE ROLE {owner} NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
            GRANT CREATE ON DATABASE {database} TO {owner};
            GRANT CONNECT ON DATABASE {database} TO {owner};
            GRANT USAGE, CREATE ON SCHEMA iglesia TO {owner};
            GRANT CONNECT ON DATABASE {database} TO mlp_runtime;
            GRANT USAGE ON SCHEMA iglesia TO mlp_runtime, mlp_security_definer;
            GRANT mlp_security_definer TO {owner};
            ALTER TABLE iglesia.sede OWNER TO {owner};
            ALTER TABLE iglesia.persona OWNER TO {owner};
            ALTER TABLE iglesia.persona_documento OWNER TO {owner};
            ALTER TABLE iglesia.persona_sede OWNER TO {owner};
            ALTER TABLE iglesia.categoria_proceso OWNER TO {owner};
            ALTER TABLE iglesia.proceso OWNER TO {owner};
            ALTER TABLE iglesia.estado_proceso OWNER TO {owner};
            ALTER TABLE iglesia.persona_proceso OWNER TO {owner};
            ALTER TABLE iglesia.rol OWNER TO {owner};
            ALTER TABLE iglesia.permiso OWNER TO {owner};
            ALTER TABLE iglesia.rol_permiso OWNER TO {owner};
            ALTER FUNCTION iglesia.validar_asignacion_proceso() OWNER TO {owner};
            ALTER FUNCTION iglesia.validar_estado_fechas() OWNER TO {owner};
            ALTER FUNCTION iglesia.validar_proceso_duplicado() OWNER TO {owner};
            CREATE ROLE {login} LOGIN INHERIT PASSWORD '{password}'
                NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
            GRANT {owner} TO {login};
            """;
        await SqlAsync(admin, ownership);
        var deployer = new NpgsqlConnectionStringBuilder(settings.ConnectionString)
        { Username = loginRole, Password = password, Pooling = false };
        return new DeploymentPrincipal(deployer.ConnectionString, ownerRole, loginRole);
    }
    private static string FindBackendRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "MisionLiderParis.slnx"))) directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Backend root not found.");
    }
    private static async Task PgAsync(string tool, NpgsqlConnectionStringBuilder settings, string[] arguments, string root)
    {
        var bin = Environment.GetEnvironmentVariable("MLP_POSTGRES_BIN");
        if (string.IsNullOrEmpty(bin) && OperatingSystem.IsWindows()) bin = Path.Combine(root, ".local", "postgresql-17.11", "pgsql", "bin");
        var executable = string.IsNullOrEmpty(bin) ? tool : Path.Combine(bin, tool + (OperatingSystem.IsWindows() ? ".exe" : ""));
        var result = await RunAsync(executable, arguments, new Dictionary<string, string> {
            ["PGHOST"] = settings.Host!, ["PGPORT"] = settings.Port.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["PGUSER"] = settings.Username!, ["PGPASSWORD"] = settings.Password!, ["PGDATABASE"] = settings.Database! }, root);
        Assert.True(result.ExitCode == 0, $"{tool} failed; inspect the isolated database locally. Exit code {result.ExitCode}.");
    }
    private static Process Start(string file, string[] arguments, IReadOnlyDictionary<string, string> environment, string root)
    {
        var info = new ProcessStartInfo(file) { WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true };
        foreach (var arg in arguments) info.ArgumentList.Add(arg);
        foreach (var entry in environment) info.Environment[entry.Key] = entry.Value;
        return Process.Start(info) ?? throw new InvalidOperationException("Cannot start isolated verification process.");
    }
    private static async Task<(int ExitCode, string Output)> RunAsync(string file, string[] arguments,
        IReadOnlyDictionary<string, string> environment, string root, string? input = null)
    {
        using var process = Start(file, arguments, environment, root);
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        if (input is not null) await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        return (process.ExitCode, await stdout + await stderr);
    }
}
