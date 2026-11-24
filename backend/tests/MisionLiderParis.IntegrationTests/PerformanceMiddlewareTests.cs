using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MisionLiderParis.Api.Diagnostics;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.IntegrationTests;

public sealed class PerformanceMiddlewareTests
{
    [Theory]
    [InlineData(false, "Testing", false)]
    [InlineData(true, "Testing", true)]
    [InlineData(true, "Production", false)]
    public async Task OnlyOptedInEnvironmentRecordsTechnicalData(bool enabled, string environment, bool expected)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["Diagnostics:Performance:Enabled"] = enabled.ToString() }).Build();
        var logger = new CaptureLogger();
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/people/private-person-id";
        context.Request.QueryString = new QueryString("?search=private-document");
        context.Request.Headers.Cookie = "private-cookie";
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask, RoutePatternFactory.Parse("/api/v1/people/{id}"), 0, new EndpointMetadataCollection(), "private-name"));
        var middleware = new RequestPerformanceMiddleware(_ => {
            using var phase = PerformanceDiagnostics.Measure(PerformancePhase.Action);
            context.Response.StatusCode = 403;
            return Task.CompletedTask;
        }, configuration, new TestEnvironment { EnvironmentName = environment }, logger);
        using var listener = new NpgsqlPerformanceListener();
        await middleware.InvokeAsync(context, listener);
        Assert.Equal(expected ? 1 : 0, logger.Messages.Count);
        if (expected)
        {
            var value = Assert.Single(logger.Messages);
            Assert.Contains("/api/v1/people/{id}", value);
            Assert.DoesNotContain("private-", value);
            var snapshot = JsonSerializer.Deserialize<PerformanceSnapshot>(value)!;
            Assert.Equal(403, snapshot.Status);
            Assert.Equal(32, snapshot.TraceId.Length);
            Assert.Contains(nameof(PerformancePhase.Action), snapshot.PhasesMs.Keys);
        }
        Assert.Null(PerformanceDiagnostics.Current);
    }
    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName {get;set;} = "Testing";
        public string ApplicationName {get;set;} = "Tests";
        public string ContentRootPath {get;set;} = "";
        public IFileProvider ContentRootFileProvider {get;set;} = new NullFileProvider();
    }
    private sealed class CaptureLogger : ILogger<RequestPerformanceMiddleware>
    {
        public List<string> Messages {get;} = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (state is IEnumerable<KeyValuePair<string,object?>> fields)
                Messages.Add((string)fields.Single(f => f.Key == "Metrics").Value!);
        }
    }
}
