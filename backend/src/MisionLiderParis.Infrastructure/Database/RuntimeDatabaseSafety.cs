using Npgsql;

namespace MisionLiderParis.Infrastructure.Database;

public static class RuntimeDatabaseSafety
{
    // Membership is checked, not just active attributes: SET ROLE must not provide a path around RLS.
    public const string UnsafeRoleQuery = """
        SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
            WHERE (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
                OR r.rolname LIKE 'pg\_%' ESCAPE '\')
              AND pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
            WHERE r.oid <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
              AND r.rolname <> 'mlp_runtime'
              AND pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
              AND pg_catalog.pg_has_role(current_user, c.relowner, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('iglesia', 'auth_app')
              AND pg_catalog.pg_has_role(current_user, p.proowner, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
            WHERE n.nspname IN ('iglesia', 'auth_app')
              AND pg_catalog.pg_has_role(current_user, n.nspowner, 'MEMBER'))
          OR pg_catalog.pg_has_role(current_user,
              (SELECT d.datdba FROM pg_catalog.pg_database d WHERE d.datname = current_database()), 'MEMBER')
          OR pg_catalog.has_schema_privilege(current_user, 'iglesia', 'CREATE')
          OR pg_catalog.has_schema_privilege(current_user, 'auth_app', 'CREATE')
          OR NOT COALESCE((SELECT pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')
            FROM pg_catalog.pg_roles r WHERE r.rolname = 'mlp_runtime'), false) AS "Value"
        """;

    public static async Task VerifyAsync(string connectionString, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = new NpgsqlCommand(UnsafeRoleQuery, connection);
        if ((bool)(await command.ExecuteScalarAsync(ct))!)
            throw new InvalidOperationException("Runtime connection must not own application tables, create objects, inherit privileged roles or bypass RLS. Use a separate runtime login.");
        await using var hardened = new NpgsqlCommand("""
            SELECT has_table_privilege(current_user,'auth_app.users','SELECT')
              OR has_table_privilege(current_user,'auth_app.users','INSERT')
              OR has_table_privilege(current_user,'auth_app.users','UPDATE')
              OR has_table_privilege(current_user,'auth_app.user_access_grants','INSERT')
              OR has_table_privilege(current_user,'auth_app.user_access_grants','UPDATE')
              OR to_regprocedure('auth_app.verified_actor_id()') IS NULL
            """,connection);
        if (await hardened.ExecuteScalarAsync(ct) is true)
            throw new InvalidOperationException("Signed actor SQL and Identity privilege separation are required.");
    }
}
