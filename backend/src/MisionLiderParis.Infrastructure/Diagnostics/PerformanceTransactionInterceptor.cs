using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MisionLiderParis.Infrastructure.Diagnostics;

public sealed class PerformanceTransactionInterceptor : DbTransactionInterceptor
{
    public override DbTransaction TransactionStarted(DbConnection connection, TransactionEndEventData data, DbTransaction result)
    { Record(data); return result; }
    public override ValueTask<DbTransaction> TransactionStartedAsync(DbConnection connection, TransactionEndEventData data, DbTransaction result, CancellationToken ct = default)
    { Record(data); return ValueTask.FromResult(result); }
    public override void TransactionCommitted(DbTransaction transaction, TransactionEndEventData data) => Record(data);
    public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData data, CancellationToken ct = default)
    { Record(data); return Task.CompletedTask; }
    public override void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData data) => Record(data);
    public override Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData data, CancellationToken ct = default)
    { Record(data); return Task.CompletedTask; }
    private static void Record(TransactionEndEventData data) => PerformanceDiagnostics.Current?.RecordTransaction(data.Duration);
}
