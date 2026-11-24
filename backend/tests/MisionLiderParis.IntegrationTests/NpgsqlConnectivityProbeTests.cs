using System.Net;
using System.Diagnostics;
using System.Net.Sockets;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Database;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed class NpgsqlConnectivityProbeTests
{
    [Fact]
    public async Task MissingRuntimeConnectionIsUnavailable()
    {
        var probe = new NpgsqlConnectivityProbe(Options.Create(new DatabaseOptions()));
        Assert.False(await probe.CheckAsync(CancellationToken.None));
    }

    [Fact]
    public async Task UnavailablePostgresFailsWithoutWaitingForDefaultTimeout()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        var probe = Create(port);
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        await Assert.ThrowsAnyAsync<NpgsqlException>(() => probe.CheckAsync(deadline.Token));
    }

    [Fact]
    public async Task UnresponsiveHandshakeIsBoundedEvenWhenDriverCannotCancelImmediately()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var accept = listener.AcceptTcpClientAsync();
        var probe = Create(((IPEndPoint)listener.LocalEndpoint).Port);
        using var deadline = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));
        var elapsed = Stopwatch.StartNew();
        var operation = probe.CheckAsync(deadline.Token);
        using var socket = await accept.WaitAsync(TimeSpan.FromSeconds(3));
        var exception = await Record.ExceptionAsync(() => operation);
        Assert.True(exception is OperationCanceledException or NpgsqlException);
        Assert.True(deadline.IsCancellationRequested);
        Assert.True(elapsed.Elapsed < TimeSpan.FromSeconds(5));
    }

    [PostgresFact]
    public async Task ExistingIsolatedPostgresExecutesRealSelectOneWithoutSchemaChanges()
    {
        var connection = Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")!;
        var settings = new NpgsqlConnectionStringBuilder(connection);
        if (settings.Host is not ("localhost" or "127.0.0.1" or "::1") ||
            settings.Database?.EndsWith("_tests", StringComparison.Ordinal) != true)
            throw new InvalidOperationException("Probe tests only permit loopback databases ending in _tests.");
        var probe = new NpgsqlConnectivityProbe(Options.Create(new DatabaseOptions { ConnectionString = connection }));
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        Assert.True(await probe.CheckAsync(deadline.Token));
    }

    private static NpgsqlConnectivityProbe Create(int port) => new(Options.Create(new DatabaseOptions {
        ConnectionString = $"Host=127.0.0.1;Port={port};Database=monitor_tests;Username=monitor;Password=fixture;SSL Mode=Disable;Pooling=false" }));
}
