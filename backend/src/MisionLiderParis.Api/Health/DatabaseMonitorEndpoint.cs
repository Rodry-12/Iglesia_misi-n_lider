using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Cors;
using MisionLiderParis.Application.Health;
using Npgsql;

namespace MisionLiderParis.Api.Health;

public sealed class DatabaseMonitorMetadata;

public static class DatabaseMonitorEndpoint
{
    public const string RateLimitPolicy = "database-monitor";
    public const int TimeoutSeconds = 5;

    public static RouteHandlerBuilder MapDatabaseMonitor(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGet("/api/v1/health/database", HandleAsync)
            .AllowAnonymous() // This route authenticates only its independent monitor credential.
            .WithMetadata(new DisableCorsAttribute())
            .RequireRateLimiting(RateLimitPolicy)
            .WithMetadata(new DatabaseMonitorMetadata());

    private static async Task<IResult> HandleAsync(HttpContext context, HealthMonitorCredential credential,
        IDatabaseConnectivityProbe probe)
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.Features.Get<IStatusCodePagesFeature>() is { } statusPages) statusPages.Enabled = false;
        if (!context.Request.IsHttps || !credential.Accepts(context.Request.Headers.Authorization))
            return Results.StatusCode(StatusCodes.Status401Unauthorized);

        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
        deadline.CancelAfter(TimeSpan.FromSeconds(TimeoutSeconds));
        try
        {
            if (await probe.CheckAsync(deadline.Token))
                return Results.Json(new { status = "healthy" });
        }
        catch (Exception exception) when (exception is NpgsqlException or TimeoutException or OperationCanceledException)
        {
            // Never log driver exception messages, credentials, headers or connection strings.
        }
        return Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}
