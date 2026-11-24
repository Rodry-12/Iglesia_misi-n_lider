using System.Data;
using System.Text.Json;
using Npgsql;

namespace MisionLiderParis.Infrastructure.Database;

public static class SchemaInspector
{
    // Read only PostgreSQL catalogs; do not require SELECT grants on ministry tables.
    public const string Query = """
        SELECT jsonb_build_object(
          'schema', 'iglesia',
          'serverVersion', current_setting('server_version'),
          'databaseRole', current_user,
          'roleBypassesRls', (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user),
          'authAppTables', COALESCE((SELECT jsonb_agg(c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'auth_app' AND c.relkind IN ('r', 'p')), '[]'::jsonb),
          'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'table_name', cl.relname,
              'column_name', a.attname,
              'data_type', pg_catalog.format_type(a.atttypid, NULL),
              'character_maximum_length', CASE WHEN t.typname IN ('varchar', 'bpchar') AND a.atttypmod > 4
                THEN a.atttypmod - 4 ELSE NULL END,
              'is_nullable', CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END,
              'column_default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
              'is_identity', CASE WHEN a.attidentity <> '' THEN 'YES' ELSE 'NO' END,
              'is_generated', CASE WHEN a.attgenerated <> '' THEN 'ALWAYS' ELSE 'NEVER' END,
              'ordinal_position', a.attnum)
            ORDER BY cl.relname, a.attnum)
            FROM pg_attribute a
            JOIN pg_class cl ON cl.oid = a.attrelid
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE ns.nspname = 'iglesia' AND cl.relkind IN ('r', 'p')
              AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
          'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'table', cl.relname, 'name', co.conname, 'definition', pg_get_constraintdef(co.oid),
            'kind', co.contype, 'validated', co.convalidated,
            'columns', (SELECT jsonb_agg(a.attname ORDER BY k.position)
              FROM unnest(co.conkey) WITH ORDINALITY k(number, position)
              JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.number),
            'principalTable', CASE WHEN co.confrelid <> 0 THEN co.confrelid::regclass::text ELSE NULL END,
            'principalColumns', (SELECT jsonb_agg(a.attname ORDER BY k.position)
              FROM unnest(co.confkey) WITH ORDINALITY k(number, position)
              JOIN pg_attribute a ON a.attrelid = co.confrelid AND a.attnum = k.number),
            'deleteAction', co.confdeltype))
            FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace WHERE ns.nspname = 'iglesia'), '[]'::jsonb),
          'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i
            WHERE i.schemaname = 'iglesia'), '[]'::jsonb),
          'indexesDetailed', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'name', ic.relname, 'table', tc.relname, 'unique', ix.indisunique,
            'valid', ix.indisvalid, 'ready', ix.indisready,
            'columns', (SELECT jsonb_agg(pg_get_indexdef(ix.indexrelid, p, true) ORDER BY p)
              FROM generate_series(1, ix.indnkeyatts) p),
            'predicate', pg_get_expr(ix.indpred, ix.indrelid)))
            FROM pg_index ix JOIN pg_class ic ON ic.oid = ix.indexrelid
            JOIN pg_class tc ON tc.oid = ix.indrelid JOIN pg_namespace ns ON ns.oid = tc.relnamespace
            WHERE ns.nspname = 'iglesia'), '[]'::jsonb),
          'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'table', cl.relname, 'name', t.tgname, 'enabled', t.tgenabled,
            'definition', pg_get_triggerdef(t.oid), 'function', pg_get_functiondef(t.tgfoid),
            'functionName', p.proname, 'functionSchema', pn.nspname, 'functionBody', p.prosrc,
            'functionConfig', p.proconfig, 'securityDefiner', p.prosecdef))
            FROM pg_trigger t JOIN pg_class cl ON cl.oid = t.tgrelid
            JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_namespace pn ON pn.oid = p.pronamespace
            JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            WHERE ns.nspname = 'iglesia' AND NOT t.tgisinternal), '[]'::jsonb),
          'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p
            WHERE p.schemaname = 'iglesia'), '[]'::jsonb),
          'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', cl.relname,
            'rowSecurity', cl.relrowsecurity, 'forceRowSecurity', cl.relforcerowsecurity))
            FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
            WHERE ns.nspname = 'iglesia' AND cl.relkind IN ('r', 'p')), '[]'::jsonb)
        )::text;
        """;

    public static async Task<string> InspectAsync(string connectionString, CancellationToken ct)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        await using (var readOnly = new NpgsqlCommand("SET TRANSACTION READ ONLY", connection, transaction))
            await readOnly.ExecuteNonQueryAsync(ct);
        await using (var settings = new NpgsqlCommand("SET LOCAL search_path = pg_catalog", connection, transaction))
            await settings.ExecuteNonQueryAsync(ct);
        await using var command = new NpgsqlCommand(Query, connection, transaction) { CommandTimeout = 30 };
        var result = (string)(await command.ExecuteScalarAsync(ct))!;
        using var document = JsonDocument.Parse(result);
        if (document.RootElement.GetProperty("columns").GetArrayLength() == 0)
            throw new InvalidOperationException("No visible iglesia schema. Check metadata privileges.");
        await transaction.RollbackAsync(ct);
        return JsonSerializer.Serialize(document.RootElement, new JsonSerializerOptions { WriteIndented = true });
    }
}
