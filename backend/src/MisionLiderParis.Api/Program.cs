using System.Security.Cryptography.X509Certificates;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using MisionLiderParis.Api.Errors;
using MisionLiderParis.Api.Health;
using MisionLiderParis.Api.Security;
using MisionLiderParis.Infrastructure;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Database;
using MisionLiderParis.Infrastructure.Identity;
using Npgsql;
using MisionLiderParis.Api.Diagnostics;
using MisionLiderParis.Infrastructure.Diagnostics;
using System.Text.Json;
using MisionLiderParis.Infrastructure.Ministry;
using MisionLiderParis.Application.Access;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args.Where(a => a is not "--inspect-schema" and not "--compare-schema" and not "--verify-mappings" and not "--inspect-live-security" and not "--bootstrap-admin").ToArray());
if (args.Contains("--bootstrap-admin"))
{
    var migrationConnection = builder.Configuration["Database:MigrationConnectionString"];
    if (string.IsNullOrWhiteSpace(migrationConnection))
    {
        Console.Error.WriteLine("Bootstrap requires Database:MigrationConnectionString supplied separately from the runtime connection. No account was created.");
        Environment.ExitCode = 2;
        return;
    }
    // The migration credential is only selected for this explicit, terminating operator command.
    builder.Configuration["Database:IdentityConnectionString"] = migrationConnection;
}
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddTrustedReverseProxy(builder.Configuration);
builder.Services.AddScoped<AdministratorBootstrap>();
builder.Services.AddHostedService<RuntimeDatabaseValidator>();
var security = builder.Configuration.GetSection(SecurityOptions.Section).Get<SecurityOptions>() ?? new();
var databaseOptions = builder.Configuration.GetSection(DatabaseOptions.Section).Get<DatabaseOptions>() ?? new();
if (args.Contains("--inspect-live-security"))
{
    if (string.IsNullOrWhiteSpace(databaseOptions.ConnectionString))
    {
        Console.Error.WriteLine("Database:ConnectionString is missing. Configure User Secrets or environment variables. No database command was executed.");
        Environment.ExitCode = 2;
        return;
    }
    try
    {
        var connection = new NpgsqlConnectionStringBuilder(databaseOptions.ConnectionString);
        if (connection.SslMode != SslMode.VerifyFull)
            throw new InvalidOperationException("Live security metadata inspection requires Ssl Mode=VerifyFull.");

        var scriptPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath,
            "sql", "review", "018-live-security-metadata.sql"));
        if (!File.Exists(scriptPath))
            scriptPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath,
                "..", "..", "sql", "review", "018-live-security-metadata.sql"));
        var script = await File.ReadAllTextAsync(scriptPath);
        if (!script.Contains("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;", StringComparison.Ordinal) ||
            !script.TrimEnd().EndsWith("ROLLBACK;", StringComparison.Ordinal))
            throw new InvalidOperationException("The security metadata script is not explicitly read-only.");

        await using var db = new NpgsqlConnection(databaseOptions.ConnectionString);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        await db.OpenAsync(timeout.Token);
        await using var command = new NpgsqlCommand(script, db) { CommandTimeout = 30 };
        await using var reader = await command.ExecuteReaderAsync(timeout.Token);
        string? metadata = null;
        do
        {
            if (reader.FieldCount == 0)
                continue;
            while (await reader.ReadAsync(timeout.Token))
                if (!reader.IsDBNull(0))
                    metadata = reader.GetString(0);
        } while (await reader.NextResultAsync(timeout.Token));

        if (string.IsNullOrWhiteSpace(metadata))
            throw new InvalidOperationException("The read-only security metadata query returned no result.");
        var outputPath = Path.Combine(builder.Environment.ContentRootPath, "schema-security-metadata.json");
        await File.WriteAllTextAsync(outputPath, metadata, timeout.Token);
        Console.WriteLine("Live read-only security metadata collected. No DDL executed.");
        Console.WriteLine($"Review local output: {outputPath}");
    }
    catch (Exception exception) when (exception is not OutOfMemoryException)
    {
        var causes = new List<string>();
        for (Exception? cause = exception; cause is not null; cause = cause.InnerException)
            causes.Add(cause switch
            {
                System.Net.Sockets.SocketException socket => $"SocketException:{socket.SocketErrorCode}",
                PostgresException postgres => $"PostgresException:SQLSTATE={postgres.SqlState}",
                _ => cause.GetType().Name
            });
        Console.Error.WriteLine($"Live security metadata inspection did not complete ({string.Join(" -> ", causes)}). No verification is claimed.");
        Environment.ExitCode = 2;
    }
    return;
}
if (!string.IsNullOrWhiteSpace(databaseOptions.ConnectionString))
{
    var connection = new NpgsqlConnectionStringBuilder(databaseOptions.ConnectionString);
    if (databaseOptions.RequireVerifiedTls && connection.SslMode != SslMode.VerifyFull)
        throw new InvalidOperationException("Database TLS must use Ssl Mode=VerifyFull.");
}
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing") && !databaseOptions.RequireVerifiedTls)
    throw new InvalidOperationException("Production requires verified database TLS.");
if (security.AllowedOrigins.Any(origin => !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
    uri.Scheme != "https" || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) ||
    !string.IsNullOrEmpty(uri.Fragment) || !string.IsNullOrEmpty(uri.UserInfo) || origin.EndsWith('/')))
    throw new InvalidOperationException("AllowedOrigins must be explicit HTTPS origins without a trailing slash.");

if (args.Contains("--inspect-schema") || args.Contains("--compare-schema") || args.Contains("--verify-mappings"))
{
    if (string.IsNullOrWhiteSpace(databaseOptions.ConnectionString))
    {
        Console.Error.WriteLine("Database:ConnectionString is missing. Configure User Secrets or environment variables. No database command was executed.");
        Environment.ExitCode = 2;
        return;
    }
    try
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        if (args.Contains("--verify-mappings"))
        {
            await MinistryMappingVerifier.VerifyReadOnlyAsync(databaseOptions.ConnectionString, timeout.Token);
            Console.WriteLine("All 11 ministerial entity mappings verified using read-only, zero-row PostgreSQL queries. No DDL or personal records accessed.");
            return;
        }
        var json = await SchemaInspector.InspectAsync(databaseOptions.ConnectionString, timeout.Token);
        await File.WriteAllTextAsync("schema-inspection.json", json, timeout.Token);
        if (args.Contains("--compare-schema"))
        {
            var reference = MinistrySchemaReference.Read(await File.ReadAllBytesAsync(
                Path.Combine(AppContext.BaseDirectory, "schema-reference.txt"), timeout.Token));
            using var snapshot = JsonDocument.Parse(json);
            var report = SchemaComparison.Compare(reference, snapshot.RootElement);
            var output = JsonSerializer.Serialize(new { inspectedAtUtc = DateTimeOffset.UtcNow,
                source = "live-postgresql-read-only", report }, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync("schema-comparison.json", output, timeout.Token);
            Console.WriteLine($"Live read-only comparison: {report.Findings.Count} findings. Review schema-comparison.json. No DDL executed.");
            if (report.HasPendingReview) Environment.ExitCode = 2;
        }
        else Console.WriteLine("Metadata exported to schema-inspection.json. No DDL executed.");
    }
    catch (Exception exception) when (exception is not OutOfMemoryException)
    {
        var causes = new List<string>();
        for (Exception? cause = exception; cause is not null; cause = cause.InnerException)
            causes.Add(cause switch
            {
                System.Net.Sockets.SocketException socket => $"SocketException:{socket.SocketErrorCode}",
                PostgresException postgres => $"PostgresException:SQLSTATE={postgres.SqlState}",
                _ => cause.GetType().Name
            });
        Console.Error.WriteLine($"Schema inspection did not complete ({string.Join(" -> ", causes)}). No verification is claimed. Check connection, privileges and TLS locally.");
        Environment.ExitCode = 2;
    }
    return;
}

var dataProtection = builder.Services.AddDataProtection().SetApplicationName("MisionLiderParis");
if (!string.IsNullOrWhiteSpace(security.KeyRingPath))
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(security.KeyRingPath));
if (!string.IsNullOrWhiteSpace(security.KeyCertificatePath))
    dataProtection.ProtectKeysWithCertificate(X509CertificateLoader.LoadPkcs12FromFile(
        security.KeyCertificatePath, security.KeyCertificatePassword));
if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing") &&
    (string.IsNullOrWhiteSpace(security.KeyRingPath) || string.IsNullOrWhiteSpace(security.KeyCertificatePath)))
    throw new InvalidOperationException("Production requires a persistent, certificate-protected data protection key ring.");

builder.Services.AddScoped<ActiveAccountCookieEvents>();
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddCookie(IdentityConstants.ApplicationScheme, options =>
{
    options.Cookie.Name = "__Host-mlp-session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
    options.ExpireTimeSpan = TimeSpan.FromMinutes(security.CookieMinutes);
    options.SlidingExpiration = true;
    options.EventsType = typeof(ActiveAccountCookieEvents);
});
builder.Services.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser().Build());
builder.Services.AddScoped<IAuthorizationHandler, BranchPermissionHandler>();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = "__Host-mlp-antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
});
builder.Services.AddCors();
builder.Services.AddOptions<Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions>()
    .Configure<IOptions<SecurityOptions>>((options, settings) => options.AddDefaultPolicy(policy =>
        policy.WithOrigins(settings.Value.AllowedOrigins).AllowCredentials()
            .WithHeaders("Content-Type", "X-XSRF-TOKEN").WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.AddPolicy("authentication", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    // Shared across monitor callers, so changing source IP cannot multiply database work.
    options.AddFixedWindowLimiter(DatabaseMonitorEndpoint.RateLimitPolicy, limiter =>
    {
        limiter.PermitLimit = 6;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});
builder.Services.AddSingleton(_ => new HealthMonitorCredential(Environment.GetEnvironmentVariable("MLP_HEALTH_TOKEN")));
builder.Services.AddControllers(options => {
    options.Filters.Add<PerformanceActionFilter>();
    options.Filters.Add<MinistryReadScopeFilter>();
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Info.Title = "Misión Líder París API";
    document.Info.Version = "v1";
    document.Info.Description = "Identity cookie authentication with CSRF; ministerial resources authorized by permission and branch.";
    return Task.CompletedTask;
}));
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"])
    .AddCheck<MinistrySchemaHealthCheck>("ministry-schema", tags: ["ready"]);

var app = builder.Build();
if (args.Contains("--bootstrap-admin"))
{
    try
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        using var scope = app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AdministratorBootstrap>().CreateFirstAsync(
            Environment.GetEnvironmentVariable("MLP_BOOTSTRAP_EMAIL") ?? "",
            Environment.GetEnvironmentVariable("MLP_BOOTSTRAP_PASSWORD") ?? "", timeout.Token);
        Console.WriteLine("First administrator created.");
    }
    catch (Exception exception) when (exception is not OutOfMemoryException)
    {
        Console.Error.WriteLine($"Bootstrap did not complete ({exception.GetType().Name}). Check credentials, catalog and whether an account already exists. No credentials or account details are logged.");
        Environment.ExitCode = 2;
    }
    return;
}
app.UseForwardedHeaders();
app.UseMiddleware<RequestPerformanceMiddleware>();
app.UseExceptionHandler();
app.UseStatusCodePages(async status =>
{
    var service = status.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
    await service.TryWriteAsync(new ProblemDetailsContext
    {
        HttpContext = status.HttpContext,
        ProblemDetails = new ProblemDetails { Status = status.HttpContext.Response.StatusCode,
            Title = "No fue posible completar la solicitud." }
    });
});
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing")) app.UseHsts();
app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
app.UseRouting();
app.UseCors();
app.UseRateLimiter();
app.BeginPerformancePhase(PerformancePhase.Authentication);
app.UseAuthentication();
app.EndPerformancePhase(PerformancePhase.Authentication);
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true &&
        Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var actorId))
    {
        var stampType=context.RequestServices.GetRequiredService<IOptions<IdentityOptions>>().Value.ClaimsIdentity.SecurityStampClaimType;
        context.RequestServices.GetRequiredService<ActorContext>().BindAuthenticatedSession(actorId,
            context.User.FindFirstValue(stampType) ?? "");
    }
    await next();
});
app.BeginPerformancePhase(PerformancePhase.AuthorizationMiddleware);
app.UseAuthorization();
app.EndPerformancePhase(PerformancePhase.AuthorizationMiddleware);
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") &&
        !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method) &&
        !HttpMethods.IsOptions(context.Request.Method) && !HttpMethods.IsTrace(context.Request.Method))
        await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
    if (context.Request.Path.StartsWithSegments("/api") && context.Request.Path != "/api/v1/auth/csrf" &&
        context.GetEndpoint()?.Metadata.GetMetadata<DatabaseMonitorMetadata>() is null &&
        string.IsNullOrWhiteSpace(context.RequestServices.GetRequiredService<IOptions<DatabaseOptions>>().Value.ConnectionString))
        throw new MisionLiderParis.Application.Common.ApiException(503, "database_not_configured",
            "La conexión de base de datos no está configurada.");
    await next();
});
app.MapControllers();
app.MapDatabaseMonitor();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();
if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();
app.Run();

public partial class Program;
