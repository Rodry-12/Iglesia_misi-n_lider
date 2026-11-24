using System.Text.RegularExpressions;
using System.Security.Cryptography;
using Npgsql;

namespace MisionLiderParis.Infrastructure.Database;

// Operator-only utility; deliberately not registered as an HTTP service or invoked at startup.
public static class ActorKeyProvisioner
{
    // Managed PostgreSQL alternative: the private bytes are NEVER SQL inputs.
    // The caller must persist encrypted recovery and verify it BEFORE committing tx.
    public static async Task<byte[]> InsertAsync(NpgsqlConnection connection, NpgsqlTransaction tx,
        string keyId, CancellationToken ct)
    {
        if (!Regex.IsMatch(keyId,"\\A[A-Za-z0-9_-]{1,64}\\z") || tx.Connection != connection)
            throw new ArgumentException("A valid key identifier and caller-owned transaction are required.");
        await using (var locked = new NpgsqlCommand(
            "LOCK TABLE auth_app.actor_context_keys IN SHARE ROW EXCLUSIVE MODE", connection, tx))
            await locked.ExecuteNonQueryAsync(ct);

        // Reject schema drift BEFORE generation. In particular, failing CHECK/trigger
        // DETAIL messages could otherwise contain the generated tuple and its secret.
        await using (var shape = new NpgsqlCommand("""
            SELECT c.relkind='r' AND NOT c.relispartition AND NOT c.relrowsecurity
              AND NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=c.oid)
              AND NOT EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=c.oid)
              AND (SELECT count(*)=3 AND bool_and(NOT attisdropped AND attnotnull
                AND attgenerated='' AND attidentity='' AND
                  ((attname='key_id' AND atttypid='text'::regtype AND NOT atthasdef)
                  OR (attname='key_material' AND atttypid='bytea'::regtype AND NOT atthasdef)
                  OR (attname='enabled' AND atttypid='boolean'::regtype AND atthasdef)))
                FROM pg_attribute WHERE attrelid=c.oid AND attnum>0)
              AND (SELECT count(*)=1 AND bool_and(pg_get_expr(adbin,adrelid)='true')
                FROM pg_attrdef WHERE adrelid=c.oid)
              AND (SELECT count(*)=1 AND bool_and(indisprimary AND indisvalid AND indexprs IS NULL AND indpred IS NULL)
                FROM pg_index WHERE indrelid=c.oid)
            FROM pg_class c WHERE c.oid='auth_app.actor_context_keys'::regclass
            """, connection, tx))
            if (await shape.ExecuteScalarAsync(ct) is not true)
                throw new InvalidOperationException("UnexpectedKeyStoreShape");
        var expected = new HashSet<string>(StringComparer.Ordinal) {
            "PRIMARYKEY(key_id)",
            "CHECK((key_id~'^[A-Za-z0-9_-]{1,64}$'::text))",
            "CHECK((octet_length(key_material)>=32))"
        };
        await using (var constraints = new NpgsqlCommand("""
            SELECT pg_get_constraintdef(oid), convalidated AND NOT condeferrable
            FROM pg_constraint WHERE conrelid='auth_app.actor_context_keys'::regclass
            """, connection, tx))
        {
            await using var reader = await constraints.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                if (!reader.GetBoolean(1) || !expected.Remove(reader.GetString(0).Replace(" ","")))
                    throw new InvalidOperationException("UnexpectedKeyStoreConstraint");
        }
        if (expected.Count != 0) throw new InvalidOperationException("UnexpectedKeyStoreConstraint");

        string schema;
        await using (var crypto = new NpgsqlCommand("""
            SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
            JOIN pg_proc p ON p.pronamespace=n.oid AND p.proname='gen_random_bytes'
            JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid
              AND d.refclassid='pg_extension'::regclass AND d.refobjid=e.oid AND d.deptype='e'
            WHERE e.extname='pgcrypto' AND p.proargtypes='23'::oidvector
              AND p.prorettype='bytea'::regtype AND p.provolatile='v'
              AND has_schema_privilege(current_user,n.oid,'USAGE')
              AND has_function_privilege(current_user,p.oid,'EXECUTE')
            """, connection, tx))
            schema = await crypto.ExecuteScalarAsync(ct) as string
                ?? throw new InvalidOperationException("TrustedCryptoGeneratorUnavailable");
        using var quoting = new NpgsqlCommandBuilder();
        await using var query = new NpgsqlCommand(
            $"INSERT INTO auth_app.actor_context_keys(key_id,key_material) VALUES (@id,{quoting.QuoteIdentifier(schema)}.gen_random_bytes(32)) RETURNING key_material",
            connection, tx);
        query.Parameters.AddWithValue("id",keyId); // Non-secret identifier only.
        var material = await query.ExecuteScalarAsync(ct) as byte[];
        if (material is not { Length: 32 })
        {
            if (material is not null) CryptographicOperations.ZeroMemory(material);
            throw new InvalidOperationException("InvalidGeneratedKeyLength");
        }
        return material;
    }

    // Legacy caller-supplied material requires the original strict logging preflight.
    public static async Task InsertAsync(NpgsqlConnection administrativeConnection,string keyId,byte[] key,CancellationToken ct)
    {
        if (!Regex.IsMatch(keyId,"\\A[A-Za-z0-9_-]{1,64}\\z") || key.Length is < 32 or > 64)
            throw new ArgumentException("A valid key identifier and 256 to 512 bit key are required.");
        await using var query=new NpgsqlCommand("INSERT INTO auth_app.actor_context_keys(key_id,key_material) VALUES (@id,@key)",administrativeConnection);
        query.Parameters.AddWithValue("id",keyId); query.Parameters.AddWithValue("key",key);
        await query.ExecuteNonQueryAsync(ct);
    }
}
