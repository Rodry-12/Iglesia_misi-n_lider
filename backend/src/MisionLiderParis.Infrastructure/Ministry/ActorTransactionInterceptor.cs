using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class ActorTransactionInterceptor(ActorTransactionContext context) : DbTransactionInterceptor
{
    public override DbTransaction TransactionStarted(DbConnection connection, TransactionEndEventData eventData, DbTransaction result)
    {
        try { context.InstallAsync(connection,result,eventData.Context is { } db && context.ReadOnlyTransactions.Contains(db),CancellationToken.None).GetAwaiter().GetResult(); }
        catch { result.Dispose(); throw; }
        return result;
    }

    public override async ValueTask<DbTransaction> TransactionStartedAsync(DbConnection connection, TransactionEndEventData eventData,
        DbTransaction result, CancellationToken cancellationToken = default)
    {
        try { await context.InstallAsync(connection,result,eventData.Context is { } db && context.ReadOnlyTransactions.Contains(db),cancellationToken).ConfigureAwait(false); }
        catch { await result.DisposeAsync().ConfigureAwait(false); throw; }
        return result;
    }

    public override DbTransaction TransactionUsed(DbConnection connection, TransactionEventData eventData, DbTransaction result) =>
        throw new InvalidOperationException("Externally supplied transactions are not supported by signed authorization.");

    public override ValueTask<DbTransaction> TransactionUsedAsync(DbConnection connection, TransactionEventData eventData,
        DbTransaction result, CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("Externally supplied transactions are not supported by signed authorization.");
}
