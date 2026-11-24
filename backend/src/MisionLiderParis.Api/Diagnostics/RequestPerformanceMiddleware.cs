using System.Globalization;
using System.Text.Json;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.Api.Diagnostics;

public sealed class RequestPerformanceMiddleware(RequestDelegate next, IConfiguration configuration,
    IHostEnvironment environment, ILogger<RequestPerformanceMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, NpgsqlPerformanceListener listener)
    {
        var enabled = configuration.GetValue<bool>("Diagnostics:Performance:Enabled") &&
            (environment.IsDevelopment() || environment.IsEnvironment("Testing") || configuration.GetValue<bool>("Diagnostics:Performance:AllowProduction")) &&
            logger.IsEnabled(LogLevel.Information);
        if (!enabled) { await next(context); return; }
        using var state = PerformanceDiagnostics.Begin(configuration.GetValue<bool>("Diagnostics:Performance:CommandDetails"));
        context.Response.OnStarting(() =>
        {
            var sample = state.Snapshot("headers", context.Response.StatusCode);
            context.Response.Headers["X-MLP-TraceId"] = sample.TraceId;
            context.Response.Headers["Server-Timing"] = string.Create(CultureInfo.InvariantCulture,
                $"app_headers;dur={sample.TotalMs}, db_client;dur={sample.DatabaseClientMs}, access;dur={sample.PhasesMs.GetValueOrDefault(nameof(PerformancePhase.AccessResolution))}");
            return Task.CompletedTask;
        });
        try { await next(context); }
        finally
        {
            var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unmatched";
            // Only route templates, never route values, query strings, request/response bodies or headers.
            logger.LogInformation("MLP_PERFORMANCE {Metrics}", JsonSerializer.Serialize(state.Snapshot(route, context.Response.StatusCode) with { RequestAborted = context.RequestAborted.IsCancellationRequested }));
        }
    }
}

public static class PerformancePipeline
{
    public static IApplicationBuilder BeginPerformancePhase(this IApplicationBuilder app, PerformancePhase phase) =>
        app.Use(async (context, next) =>
        {
            using var timing = PerformanceDiagnostics.Measure(phase);
            context.Items[phase] = timing;
            await next();
        });
    public static IApplicationBuilder EndPerformancePhase(this IApplicationBuilder app, PerformancePhase phase) =>
        app.Use(async (context, next) =>
        {
            if (context.Items.Remove(phase, out var value) && value is IDisposable timing) timing.Dispose();
            await next();
        });
}
