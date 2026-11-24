using Npgsql;

namespace MisionLiderParis.Infrastructure.Database;

public static class IdentityDatabaseSafety
{
    public static async Task VerifyAsync(string connectionString,CancellationToken ct)
    {
        await using var connection=new NpgsqlConnection(connectionString); await connection.OpenAsync(ct);
        await using var query=new NpgsqlCommand("""
            SELECT EXISTS (SELECT 1 FROM pg_roles r WHERE
                (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolname LIKE 'pg\_%' ESCAPE '\')
                AND pg_has_role(current_user,r.oid,'MEMBER'))
              OR EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname<>current_user AND r.rolname<>'mlp_identity'
                AND pg_has_role(current_user,r.oid,'MEMBER'))
              OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname IN ('auth_app','iglesia') AND pg_has_role(current_user,c.relowner,'MEMBER'))
              OR has_schema_privilege(current_user,'auth_app','CREATE')
              OR has_schema_privilege(current_user,'iglesia','CREATE')
              OR has_table_privilege(current_user,'auth_app.actor_context_keys','SELECT,INSERT,UPDATE,DELETE')
              OR has_table_privilege(current_user,'iglesia.persona','INSERT,UPDATE,DELETE')
              OR NOT pg_has_role(current_user,'mlp_identity','MEMBER')
              OR NOT has_table_privilege(current_user,'auth_app.users','SELECT')
              OR NOT has_table_privilege(current_user,'auth_app.users','INSERT')
            """,connection);
        if (await query.ExecuteScalarAsync(ct) is true)
            throw new InvalidOperationException("Identity connection must be a restricted, separate Identity login without signing-key access.");
    }
}
