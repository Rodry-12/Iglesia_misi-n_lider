using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace MisionLiderParis.Infrastructure.Ministry;

// EF writes use AutoTransactionBehavior.Always. Queries outside an explicit unit of work
// get a READ ONLY transaction whose lifetime includes the entire result reader.
public sealed class ActorCommandInterceptor(ActorTransactionContext context) : DbCommandInterceptor
{
    private readonly Dictionary<Guid, IDbContextTransaction> owned = [];

    private async Task StartAsync(DbCommand command, CommandEventData data, bool readOnly, CancellationToken ct)
    {
        var db = data.Context ?? throw new InvalidOperationException("Signed command requires a DbContext.");
        if (db.Database.CurrentTransaction is not null) return;
        if (readOnly) context.ReadOnlyTransactions.Add(db);
        try
        {
            var tx = await db.Database.BeginTransactionAsync(ct).ConfigureAwait(false);
            owned.Add(data.CommandId,tx);
            command.Transaction = tx.GetDbTransaction();
        }
        finally { context.ReadOnlyTransactions.Remove(db); }
    }

    private async Task FinishAsync(Guid id, bool success)
    {
        if (!owned.Remove(id,out var tx)) return;
        await using (tx.ConfigureAwait(false))
        {
            if (success) await tx.CommitAsync(CancellationToken.None).ConfigureAwait(false);
            else await tx.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
        }
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData data, InterceptionResult<DbDataReader> result)
    { StartAsync(command,data,true,CancellationToken.None).GetAwaiter().GetResult(); return result; }
    public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData data,
        InterceptionResult<DbDataReader> result, CancellationToken ct=default)
    { await StartAsync(command,data,true,ct).ConfigureAwait(false); return result; }
    public override DbDataReader ReaderExecuted(DbCommand command, CommandExecutedEventData data, DbDataReader result) =>
        owned.Remove(data.CommandId,out var tx) ? new TransactionReader(result,tx) : result;
    public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData data, DbDataReader result, CancellationToken ct=default) =>
        ValueTask.FromResult(ReaderExecuted(command,data,result));

    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData data, InterceptionResult<int> result)
    { StartAsync(command,data,false,CancellationToken.None).GetAwaiter().GetResult(); return result; }
    public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData data, InterceptionResult<int> result, CancellationToken ct=default)
    { await StartAsync(command,data,false,ct).ConfigureAwait(false); return result; }
    public override int NonQueryExecuted(DbCommand command, CommandExecutedEventData data, int result)
    { FinishAsync(data.CommandId,true).GetAwaiter().GetResult(); return result; }
    public override async ValueTask<int> NonQueryExecutedAsync(DbCommand command, CommandExecutedEventData data, int result, CancellationToken ct=default)
    { await FinishAsync(data.CommandId,true).ConfigureAwait(false); return result; }
    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData data, InterceptionResult<object> result)
    { StartAsync(command,data,true,CancellationToken.None).GetAwaiter().GetResult(); return result; }
    public override async ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand command, CommandEventData data, InterceptionResult<object> result, CancellationToken ct=default)
    { await StartAsync(command,data,true,ct).ConfigureAwait(false); return result; }
    public override object? ScalarExecuted(DbCommand command, CommandExecutedEventData data, object? result)
    { FinishAsync(data.CommandId,true).GetAwaiter().GetResult(); return result; }
    public override async ValueTask<object?> ScalarExecutedAsync(DbCommand command, CommandExecutedEventData data, object? result, CancellationToken ct=default)
    { await FinishAsync(data.CommandId,true).ConfigureAwait(false); return result; }
    public override void CommandFailed(DbCommand command, CommandErrorEventData data) => FinishAsync(data.CommandId,false).GetAwaiter().GetResult();
    public override Task CommandFailedAsync(DbCommand command, CommandErrorEventData data, CancellationToken ct=default) => FinishAsync(data.CommandId,false);
    public override void CommandCanceled(DbCommand command, CommandEndEventData data) => FinishAsync(data.CommandId,false).GetAwaiter().GetResult();
    public override Task CommandCanceledAsync(DbCommand command, CommandEndEventData data, CancellationToken ct=default) => FinishAsync(data.CommandId,false);
}
