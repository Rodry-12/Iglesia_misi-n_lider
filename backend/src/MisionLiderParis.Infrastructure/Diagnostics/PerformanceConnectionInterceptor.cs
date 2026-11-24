using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MisionLiderParis.Infrastructure.Diagnostics;

/// <summary>Logical Open includes pool acquisition and, when needed, physical establishment/TLS.
/// It is deliberately not reported as isolated pool wait.</summary>
public sealed class PerformanceConnectionInterceptor : DbConnectionInterceptor
{
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData) => Record(eventData);
    public override Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    { Record(eventData); return Task.CompletedTask; }
    private static void Record(ConnectionEndEventData data)
    {
        // EF owns this duration; raw Identity Open is measured explicitly by ActorTransactionContext.
        PerformanceDiagnostics.Current?.RecordConnectionOpen(data.Duration);
    }
}
