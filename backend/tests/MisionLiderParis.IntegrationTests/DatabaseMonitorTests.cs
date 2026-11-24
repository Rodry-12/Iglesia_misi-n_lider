using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MisionLiderParis.Api.Health;
using MisionLiderParis.Application.Health;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed class DatabaseMonitorTests
{
    // Deliberately public test fixture, not a production credential.
    private const string Token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private const string Route = "/api/v1/health/database";

    private sealed class Probe(Func<CancellationToken, Task<bool>> run) : IDatabaseConnectivityProbe
    {
        public int Calls { get; private set; }
        public async Task<bool> CheckAsync(CancellationToken cancellationToken)
        {
            Calls++;
            return await run(cancellationToken);
        }
    }

    private sealed class Factory(Probe probe, string? token = Token) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                new Dictionary<string, string?> {
                    ["Database:ConnectionString"] = "",
                    ["Security:AllowedOrigins:0"] = "https://localhost:4200",
                    ["Security:KeyRingPath"] = "", ["Security:KeyCertificatePath"] = "" }));
            builder.ConfigureTestServices(services => {
                services.RemoveAll<IDatabaseConnectivityProbe>();
                services.AddSingleton<IDatabaseConnectivityProbe>(probe);
                services.RemoveAll<HealthMonitorCredential>();
                services.AddSingleton(new HealthMonitorCredential(token));
            });
        }
        public HttpClient Client(bool authorized = true)
        {
            var client = CreateClient(new WebApplicationFactoryClientOptions {
                BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
            if (authorized) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Token);
            return client;
        }
    }

    [Theory]
    [InlineData(true, HttpStatusCode.OK, "{\"status\":\"healthy\"}")]
    [InlineData(false, HttpStatusCode.ServiceUnavailable, "{\"status\":\"unavailable\"}")]
    public async Task ValidTokenReturnsOnlyThePublicStatus(bool healthy, HttpStatusCode status, string body)
    {
        var probe = new Probe(_ => Task.FromResult(healthy));
        using var factory = new Factory(probe);
        using var client = factory.Client();
        using var response = await client.GetAsync(Route);
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(body, await response.Content.ReadAsStringAsync());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(1, probe.Calls);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    [InlineData("Bearer short")]
    [InlineData("Basic ignored")]
    [InlineData("Bearer zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")]
    [InlineData("Bearer 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef, Bearer other")]
    public async Task InvalidOrMissingAuthorizationDoesNotTouchDatabase(string? header)
    {
        var probe = new Probe(_ => Task.FromResult(true));
        using var factory = new Factory(probe);
        using var client = factory.Client(false);
        if (header is not null) client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", header);
        using var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("", await response.Content.ReadAsStringAsync());
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(0, probe.Calls);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")]
    public async Task UnconfiguredOrInvalidExpectedTokenFailsClosed(string? expected)
    {
        var probe = new Probe(_ => Task.FromResult(true));
        using var factory = new Factory(probe, expected);
        using var client = factory.Client();
        using var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, probe.Calls);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DriverAndTimeoutFailuresNeverExposeInternalDetails(bool timeout)
    {
        var probe = new Probe(_ => Task.FromException<bool>(timeout
            ? new TimeoutException("private Host=secret;Password=secret;member=private")
            : new NpgsqlException("private Host=secret;Password=secret;member=private")));
        using var factory = new Factory(probe);
        using var client = factory.Client();
        using var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("{\"status\":\"unavailable\"}", await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(Token, response.ToString());
    }

    [Fact]
    public async Task DeadlineCancelsAnUnresponsiveProbeAndReturns503()
    {
        var canceled = false;
        var probe = new Probe(async ct => {
            try { await Task.Delay(Timeout.InfiniteTimeSpan, ct); }
            catch (OperationCanceledException) { canceled = ct.IsCancellationRequested; throw; }
            return true;
        });
        using var factory = new Factory(probe);
        using var client = factory.Client();
        var elapsed = Stopwatch.StartNew();
        using var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.True(canceled);
        Assert.True(elapsed.Elapsed < TimeSpan.FromSeconds(10));
        Assert.Equal("{\"status\":\"unavailable\"}", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("https://localhost:4200")]
    [InlineData("https://attacker.invalid")]
    public async Task MonitorNeverEnablesCorsEvenForTheAngularOrigin(string origin)
    {
        var probe = new Probe(_ => Task.FromResult(true));
        using var factory = new Factory(probe);
        using var client = factory.Client();
        client.DefaultRequestHeaders.Add("Origin", origin);
        using var response = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        using var preflight = new HttpRequestMessage(HttpMethod.Options, Route);
        preflight.Headers.Add("Access-Control-Request-Method", "GET");
        preflight.Headers.Add("Access-Control-Request-Headers", "authorization");
        using var options = await client.SendAsync(preflight);
        Assert.False(options.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task MonitorIsRateLimitedBeforeMoreDatabaseWork()
    {
        var probe = new Probe(_ => Task.FromResult(true));
        using var factory = new Factory(probe);
        using var client = factory.Client();
        for (var i = 0; i < 6; i++)
        {
            using var permitted = await client.GetAsync(Route);
            Assert.Equal(HttpStatusCode.OK, permitted.StatusCode);
        }
        using var rejected = await client.GetAsync(Route);
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.True(rejected.Headers.CacheControl?.NoStore);
        Assert.Equal(6, probe.Calls);
    }

    [Theory]
    [InlineData("/api/v1/auth/session")]
    [InlineData("/api/v1/users")]
    [InlineData("/api/v1/branches")]
    [InlineData("/api/v1/people")]
    [InlineData("/api/v1/process-categories")]
    [InlineData("/api/v1/processes")]
    [InlineData("/api/v1/process-assignments/participants")]
    public async Task MonitorTokenDoesNotAuthorizeApplicationResources(string route)
    {
        var probe = new Probe(_ => Task.FromResult(true));
        using var factory = new Factory(probe);
        using var client = factory.Client();
        using var response = await client.GetAsync(route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, probe.Calls);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }
}
