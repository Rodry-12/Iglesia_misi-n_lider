using System.Diagnostics;
using System.Text.Json;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.UnitTests;

public sealed class PerformanceDiagnosticsTests
{
    [Fact]
    public void BatchesCountStatementsSeparatelyFromExecutionsAndRestoreScope()
    {
        using var listener = new NpgsqlPerformanceListener();
        using var source = new ActivitySource("Npgsql");
        using var state = PerformanceDiagnostics.Begin(true);
        using (PerformanceDiagnostics.BeginBatch(2))
        {
            using (source.StartActivity("batch")) { }
            using (PerformanceDiagnostics.BeginBatch(3))
            using (source.StartActivity("batch")) { }
            using (source.StartActivity("batch")) { }
        }
        using (source.StartActivity("command")) { }
        var snapshot = state.Snapshot("batch-test", 200);
        Assert.Equal(8, snapshot.SqlCommands);
        Assert.Equal(4, snapshot.DatabaseExecutions);
        Assert.Equal(new[] {2, 3, 2, 1}, snapshot.Commands.Select(c => c.StatementCount));
    }
    [Fact]
    public void IdentityPoolingIsExplicitBoundedAndRetainsSecuritySettings()
    {
        var options = new MisionLiderParis.Infrastructure.Configuration.DatabaseOptions {
            IdentityConnectionString = "Host=localhost;Database=tests;Username=identity;Pooling=false;SSL Mode=VerifyFull" };
        Assert.False(new Npgsql.NpgsqlConnectionStringBuilder(options.RuntimeIdentityConnectionString()).Pooling);
        options.IdentityPoolingEnabled = true;
        var pooled = new Npgsql.NpgsqlConnectionStringBuilder(options.RuntimeIdentityConnectionString());
        Assert.True(pooled.Pooling); Assert.False(pooled.NoResetOnClose); Assert.False(pooled.Multiplexing);
        Assert.Equal(10, pooled.MaxPoolSize); Assert.Equal(0, pooled.MinPoolSize);
        Assert.Equal(Npgsql.SslMode.VerifyFull, pooled.SslMode); Assert.Equal("identity", pooled.Username);
        Assert.Contains("Pooling=false", options.IdentityConnectionString);
        options.IdentityPoolMaximumSize = 21;
        Assert.Throws<InvalidOperationException>(() => options.RuntimeIdentityConnectionString());
        options.IdentityPoolMaximumSize = 10;
        options.IdentityConnectionString += ";No Reset On Close=true";
        Assert.Throws<InvalidOperationException>(() => options.RuntimeIdentityConnectionString());
    }
    [Fact]
    public void DisabledScopeDoesNotCollectAndDetailsNeverContainCommandData()
    {
        using var listener = new NpgsqlPerformanceListener();
        using var source = new ActivitySource("Npgsql");
        Assert.Null(PerformanceDiagnostics.Current);
        using (source.StartActivity("SELECT secret_password, personal_document")) { }
        using var state = PerformanceDiagnostics.Begin(true);
        using (var command = source.StartActivity("SELECT secret_password, personal_document"))
        { command?.SetTag("db.query.text", "private SQL"); command?.SetTag("password", "private credential"); }
        using (source.StartActivity("CONNECT private_database")) { }
        var snapshot = state.Snapshot("/api/v1/people/{id}", 200);
        Assert.Equal(1, snapshot.SqlCommands);
        Assert.Equal(1, snapshot.PhysicalConnectionsOpened);
        Assert.Single(snapshot.Commands);
        var json = JsonSerializer.Serialize(snapshot);
        foreach (var secret in new[] { "secret_password", "personal_document", "private SQL", "private credential", "private_database" })
            Assert.DoesNotContain(secret, json);
    }

    [Fact]
    public async Task ParallelRequestsAndNestedScopesDoNotShareMeasurements()
    {
        using var outer = PerformanceDiagnostics.Begin();
        var first = Task.Run(async () => {
            using var state = PerformanceDiagnostics.Begin();
            using (PerformanceDiagnostics.Measure(PerformancePhase.AccessResolution)) await Task.Delay(5);
            return state.Snapshot("first", 200);
        });
        var second = Task.Run(() => {
            using var state = PerformanceDiagnostics.Begin();
            return state.Snapshot("second", 403);
        });
        Assert.Contains(nameof(PerformancePhase.AccessResolution), (await first).PhasesMs.Keys);
        Assert.Empty((await second).PhasesMs);
        Assert.Same(outer, PerformanceDiagnostics.Current);
        Assert.Empty(outer.Snapshot("outer", 200).PhasesMs);
    }

    [Fact]
    public void PhaseDisposalIsIdempotentAndCommandDetailsAreBounded()
    {
        using var listener = new NpgsqlPerformanceListener();
        using var source = new ActivitySource("Npgsql");
        using var state = PerformanceDiagnostics.Begin(true);
        var phase = PerformanceDiagnostics.Measure(PerformancePhase.Authentication);
        phase.Dispose();
        var before = state.Snapshot("test", 200).PhasesMs[nameof(PerformancePhase.Authentication)];
        phase.Dispose();
        Assert.Equal(before, state.Snapshot("test", 200).PhasesMs[nameof(PerformancePhase.Authentication)]);
        for (var i = 0; i < 300; ++i) using (source.StartActivity("SELECT 1")) { }
        var result = state.Snapshot("test", 200);
        Assert.Equal(300, result.SqlCommands);
        Assert.Equal(256, result.Commands.Count);
        Assert.True(result.CommandsTruncated);
    }
}
