using System.Collections.Concurrent;
using System.Diagnostics;

namespace MisionLiderParis.Infrastructure.Diagnostics;

public enum PerformancePhase { Authentication, AuthorizationMiddleware, AccessResolution, SignedContext, Action, Result, ConnectionOpen, TransactionControl }
public sealed record CommandTiming(int Number, double Milliseconds, bool Failed, int StatementCount = 1);
public sealed record PerformanceSnapshot(string TraceId, string Operation, int Status, double TotalMs,
    IReadOnlyDictionary<string, double> PhasesMs, double DatabaseClientMs, int SqlCommands,
    double PhysicalConnectionOpenMs, int PhysicalConnectionsOpened, IReadOnlyList<CommandTiming> Commands, bool CommandsTruncated,
    int TransactionControlOperations = 0, bool RequestAborted = false, int DatabaseExecutions = 0);

/// <summary>Opt-in, request-local technical timings. Never accepts SQL, parameter values or user data.</summary>
public sealed class PerformanceDiagnostics : IDisposable
{
    private static readonly AsyncLocal<PerformanceDiagnostics?> ambient = new();
    private static readonly AsyncLocal<int> batchStatements = new();
    internal static int BatchStatementCount => Math.Max(1, batchStatements.Value);
    public static IDisposable BeginBatch(int statements) => Current is null ? Empty.Instance : new BatchScope(statements);
    public static PerformanceDiagnostics? Current => ambient.Value;
    private readonly PerformanceDiagnostics? previous;
    private readonly long started = Stopwatch.GetTimestamp();
    private readonly ConcurrentDictionary<PerformancePhase, long> phases = new();
    private readonly ConcurrentQueue<CommandTiming> commands = new();
    private long databaseTicks, physicalTicks;
    private int commandCount, physicalCount, transactionCount, executionCount;
    private readonly bool details;
    private bool disposed;
    public string TraceId { get; }

    private PerformanceDiagnostics(string traceId, bool details)
    { TraceId = traceId; this.details = details; previous = ambient.Value; ambient.Value = this; }
    public static PerformanceDiagnostics Begin(bool commandDetails = false) =>
        new(Activity.Current?.TraceId.ToHexString() ?? Guid.NewGuid().ToString("N"), commandDetails);
    public static IDisposable Measure(PerformancePhase phase) => Current is { } state ? new Timing(state, phase) : Empty.Instance;
    internal void DatabaseOperation(TimeSpan duration, bool physical, bool failed, int statements = 1)
    {
        if (physical) { Interlocked.Add(ref physicalTicks, duration.Ticks); Interlocked.Increment(ref physicalCount); return; }
        var number = Interlocked.Add(ref commandCount, statements) - statements + 1;
        Interlocked.Increment(ref executionCount);
        Interlocked.Add(ref databaseTicks, duration.Ticks);
        if (details && number <= 256) commands.Enqueue(new(number, Math.Round(duration.TotalMilliseconds, 3), failed, statements));
    }
    internal void RecordConnectionOpen(TimeSpan duration) => phases.AddOrUpdate(PerformancePhase.ConnectionOpen, duration.Ticks, (_, ticks) => ticks + duration.Ticks);
    internal void RecordTransaction(TimeSpan duration)
    {
        Interlocked.Increment(ref transactionCount);
        phases.AddOrUpdate(PerformancePhase.TransactionControl, duration.Ticks, (_, ticks) => ticks + duration.Ticks);
    }
    public PerformanceSnapshot Snapshot(string operation, int status) => new(TraceId, operation, status,
        Math.Round(Stopwatch.GetElapsedTime(started).TotalMilliseconds, 3),
        phases.ToDictionary(p => p.Key.ToString(), p => Math.Round(TimeSpan.FromTicks(p.Value).TotalMilliseconds, 3)),
        Math.Round(TimeSpan.FromTicks(Interlocked.Read(ref databaseTicks)).TotalMilliseconds, 3), commandCount,
        Math.Round(TimeSpan.FromTicks(Interlocked.Read(ref physicalTicks)).TotalMilliseconds, 3), physicalCount,
        commands.OrderBy(c => c.Number).ToArray(), details && commandCount > 256, transactionCount, false, executionCount);
    public void Dispose() { if (disposed) return; disposed = true; ambient.Value = previous; }
    private sealed class Empty : IDisposable { public static readonly Empty Instance = new(); public void Dispose() { } }
    private sealed class BatchScope : IDisposable
    {
        private readonly int previous;
        private int finished;
        public BatchScope(int statements) { previous = batchStatements.Value; batchStatements.Value = Math.Max(1, statements); }
        public void Dispose() { if (Interlocked.Exchange(ref finished, 1) == 0) batchStatements.Value = previous; }
    }
    private sealed class Timing(PerformanceDiagnostics state, PerformancePhase phase) : IDisposable
    {
        private readonly long start = Stopwatch.GetTimestamp();
        private int finished;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref finished, 1) == 0)
            {
                var elapsed = Stopwatch.GetElapsedTime(start).Ticks;
                state.phases.AddOrUpdate(phase, elapsed, (_, ticks) => ticks + elapsed);
            }
        }
    }
}

/// <summary>Consumes built-in Npgsql spans once, including raw commands used by signed RLS.
/// No exporter, SQL text, activity tags, connection strings or exception messages are recorded.</summary>
public sealed class NpgsqlPerformanceListener : IDisposable
{
    private const string Owner = "mlp.performance.owner";
    private readonly ActivityListener listener = new()
    {
        ShouldListenTo = source => source.Name == "Npgsql",
        Sample = (ref ActivityCreationOptions<ActivityContext> _) => PerformanceDiagnostics.Current is null
            ? ActivitySamplingResult.None : ActivitySamplingResult.PropagationData,
        SampleUsingParentId = (ref ActivityCreationOptions<string> _) => PerformanceDiagnostics.Current is null
            ? ActivitySamplingResult.None : ActivitySamplingResult.PropagationData,
        ActivityStarted = activity => {
            activity.SetCustomProperty(Owner, PerformanceDiagnostics.Current);
            activity.SetCustomProperty("mlp.performance.statements", PerformanceDiagnostics.BatchStatementCount);
        },
        ActivityStopped = activity =>
        {
            if (activity.GetCustomProperty(Owner) is PerformanceDiagnostics owner)
                owner.DatabaseOperation(activity.Duration, activity.OperationName.StartsWith("CONNECT ", StringComparison.Ordinal), activity.Status == ActivityStatusCode.Error,
                    activity.GetCustomProperty("mlp.performance.statements") is int count ? count : 1);
        }
    };
    public NpgsqlPerformanceListener() => ActivitySource.AddActivityListener(listener);
    public void Dispose() => listener.Dispose();
}
