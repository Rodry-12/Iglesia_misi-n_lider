using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Infrastructure.Configuration;
using Npgsql;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class ActorTransactionContext(ActorContext actor, ActorProof proof, IOptions<DatabaseOptions> options)
{
    internal HashSet<DbContext> ReadOnlyTransactions { get; } = [];

    // Share installation across related reads without retaining authorization across requests.
    // The caller owns/disposes this transaction; existing write transactions must be reused instead.
    public async Task<IDbContextTransaction> BeginReadOnlyAsync(DbContext db, CancellationToken ct)
    {
        ReadOnlyTransactions.Add(db);
        try { return await db.Database.BeginTransactionAsync(ct).ConfigureAwait(false); }
        finally { ReadOnlyTransactions.Remove(db); }
    }

    public async Task InstallAsync(DbConnection connection, DbTransaction transaction, bool readOnly,
        CancellationToken ct, Guid? person = null, Guid? branch = null)
    {
        var db = (NpgsqlConnection)connection; var tx = (NpgsqlTransaction)transaction;
        using var timing = MisionLiderParis.Infrastructure.Diagnostics.PerformanceDiagnostics.Measure(MisionLiderParis.Infrastructure.Diagnostics.PerformancePhase.SignedContext);
        string token = "";
        if (actor.UserId is { } id)
        {
            // This credential is separate from the ministerial runtime. Never send the signing key to SQL.
            await using var identity = new NpgsqlConnection(options.Value.RuntimeIdentityConnectionString());
            using (MisionLiderParis.Infrastructure.Diagnostics.PerformanceDiagnostics.Measure(MisionLiderParis.Infrastructure.Diagnostics.PerformancePhase.ConnectionOpen))
                await identity.OpenAsync(ct).ConfigureAwait(false);
            await using var user = new NpgsqlCommand("""
                SELECT security_stamp FROM auth_app.users WHERE id=@actor AND is_active AND email_confirmed
                  AND NOT two_factor_enabled AND (lockout_end IS NULL OR lockout_end<=clock_timestamp())
                """,identity);
            user.Parameters.AddWithValue("actor",id);
            var stamp = await user.ExecuteScalarAsync(ct).ConfigureAwait(false) as string;
            if (string.IsNullOrWhiteSpace(stamp) || (actor.SessionStamp is not null && actor.SessionStamp!=stamp))
                throw MisionLiderParis.Application.Common.ApiException.Forbidden();
            // PostgreSQL executes these in order in the same explicit transaction.
            // READ ONLY must precede the challenge, but does not need a separate network exchange.
            await using var challenge = new NpgsqlBatch(db, tx);
            if (readOnly) challenge.BatchCommands.Add(new("SET TRANSACTION READ ONLY"));
            challenge.BatchCommands.Add(new("SELECT pg_current_xact_id()::text, pg_backend_pid(), current_database(), session_user"));
            using (PerformanceDiagnostics.BeginBatch(challenge.BatchCommands.Count))
            await using (var reader = await challenge.ExecuteReaderAsync(ct).ConfigureAwait(false))
            {
                while (reader.FieldCount == 0 && await reader.NextResultAsync(ct).ConfigureAwait(false)) { }
                if (!await reader.ReadAsync(ct).ConfigureAwait(false))
                    throw new InvalidOperationException("Database actor challenge missing.");
                token = proof.Sign(id,stamp,reader.GetString(0),reader.GetInt32(1),reader.GetString(2),reader.GetString(3),
                    DateTimeOffset.UtcNow.AddSeconds(60),person,branch);
            }
        }
        await using var install = new NpgsqlBatch(db, tx);
        if (!actor.UserId.HasValue && readOnly) install.BatchCommands.Add(new("SET TRANSACTION READ ONLY"));
        var set = new NpgsqlBatchCommand("SELECT set_config('mlp.actor_proof',@proof,true)");
        set.Parameters.AddWithValue("proof",token);
        install.BatchCommands.Add(set);
        if (actor.UserId is { } expected)
        {
            var verify = new NpgsqlBatchCommand("SELECT auth_app.verified_actor_id()=@actor");
            verify.Parameters.AddWithValue("actor",expected);
            install.BatchCommands.Add(verify);
        }
        using (PerformanceDiagnostics.BeginBatch(install.BatchCommands.Count))
        await using (var reader = await install.ExecuteReaderAsync(ct).ConfigureAwait(false))
        {
            // Consume set_config before advancing to the independent verification result.
            while (reader.FieldCount == 0 && await reader.NextResultAsync(ct).ConfigureAwait(false)) { }
            if (!await reader.ReadAsync(ct).ConfigureAwait(false))
                throw new InvalidOperationException("Database actor installation missing.");
            if (actor.UserId.HasValue &&
                (!await reader.NextResultAsync(ct).ConfigureAwait(false) ||
                 !await reader.ReadAsync(ct).ConfigureAwait(false) || reader.IsDBNull(0) || !reader.GetBoolean(0)))
                throw new InvalidOperationException("Database rejected the signed actor context.");
        }
    }

    public Task SetPersonInsertAsync(DbContext db, Guid person, Guid branch, CancellationToken ct)
    {
        var transaction = db.Database.CurrentTransaction ?? throw new InvalidOperationException("Person creation requires a transaction.");
        return InstallAsync(db.Database.GetDbConnection(),transaction.GetDbTransaction(),false,ct,person,branch);
    }
}
