using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Identity;
using Npgsql;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;

namespace MisionLiderParis.IntegrationTests;

public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")))
            Skip = "Requires an explicitly supplied local PostgreSQL database ending in _tests.";
    }
}

internal sealed class TestMailbox : IAccountEmailSender
{
    public bool FailInvitations {get;set;}
    public Dictionary<string, string> InvitationTokens { get; } = [];
    public Task SendInvitationAsync(string email, string token, CancellationToken ct)
    { if (FailInvitations) throw new InvalidOperationException("Controlled test delivery failure"); InvitationTokens[email] = token; return Task.CompletedTask; }
    public Dictionary<string, string> RecoveryTokens { get; } = [];
    public Dictionary<string, string> ConfirmationTokens { get; } = [];
    public Task SendRecoveryAsync(string email, string token, CancellationToken ct)
    { RecoveryTokens[email] = token; return Task.CompletedTask; }
    public Task SendConfirmationAsync(string email, string token, CancellationToken ct)
    { ConfirmationTokens[email] = token; return Task.CompletedTask; }
}

public sealed class PostgresApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private string? _connectionString;
    internal TestMailbox Mailbox { get; } = new();

    public async Task InitializeAsync()
    {
        _connectionString = Environment.GetEnvironmentVariable("MLP_TEST_DATABASE");
        if (string.IsNullOrEmpty(_connectionString)) return;
        var connection = new NpgsqlConnectionStringBuilder(_connectionString);
        if (connection.Database?.EndsWith("_tests", StringComparison.Ordinal) != true ||
            connection.Host is not ("localhost" or "127.0.0.1" or "::1"))
            throw new InvalidOperationException("Refusing test migrations: only a local database ending in _tests is allowed.");
        if (Environment.GetEnvironmentVariable("MLP_TEST_PREPROVISIONED") == "1")
        {
            await SignedTestConfiguration.ProvisionKeyAsync(_connectionString);
            // Explicit mode for already prepared isolated databases: no migrations, DDL or catalog seeding.
            await MisionLiderParis.Infrastructure.Database.RuntimeDatabaseSafety.VerifyAsync(_connectionString, CancellationToken.None);
            await MisionLiderParis.Infrastructure.Database.IdentityDatabaseSafety.VerifyAsync(
                Environment.GetEnvironmentVariable("MLP_TEST_IDENTITY_DATABASE") ?? "",CancellationToken.None);
            await using var existing = new NpgsqlConnection(_connectionString);
            await existing.OpenAsync();
            await using var check = new NpgsqlCommand("""
                SELECT (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname='auth_app' AND c.relname='__ef_migrations_history' AND c.relkind='r')=1
                  AND (SELECT count(*) FROM iglesia.rol WHERE id IN
                    ('d1b475b7-3855-4172-b8e0-60f8a7fdf001','d1b475b7-3855-4172-b8e0-60f8a7fdf002','d1b475b7-3855-4172-b8e0-60f8a7fdf003'))=3
                  AND (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='iglesia')>=21
                """, existing);
            if (await check.ExecuteScalarAsync() is not true)
                throw new InvalidOperationException("Prepared test database is incomplete; no migrations will be attempted.");
            return;
        }
        throw new InvalidOperationException("Tests require a preprovisioned isolated database; automatic migrations are disabled.");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
            new Dictionary<string, string?> { ["Database:ConnectionString"] = _connectionString,
                ["Database:IdentityConnectionString"] = Environment.GetEnvironmentVariable("MLP_TEST_IDENTITY_DATABASE"),
                ["DatabaseActor:KeyId"] = SignedTestConfiguration.KeyId,
                ["DatabaseActor:SigningKeyBase64"] = SignedTestConfiguration.SigningKey,
                ["Database:RequireVerifiedTls"] = "false" }));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IAccountEmailSender>();
            services.AddSingleton<IAccountEmailSender>(Mailbox);
            // Authentication correctness is tested separately from rate limits; many logins share TestServer's IP.
            services.RemoveAll<IConfigureOptions<RateLimiterOptions>>();
            services.Configure<RateLimiterOptions>(options => options.AddFixedWindowLimiter("authentication",
                limiter => { limiter.PermitLimit = 1000; limiter.Window = TimeSpan.FromMinutes(1); limiter.QueueLimit = 0; }));
        });
    }

    Task IAsyncLifetime.DisposeAsync() { Dispose(); return Task.CompletedTask; }
}

public sealed class PostgresIdentityTests(PostgresApiFactory factory) : IClassFixture<PostgresApiFactory>
{
    private const string Password = "IsolatedPassword123!";
    private HttpClient Client(bool cookies = true) => factory.CreateClient(new WebApplicationFactoryClientOptions
        { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false, HandleCookies = cookies });

    private async Task<ApplicationUser> CreateAsync(bool active = true, bool confirmed = true, bool locked = false)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"integration-{Guid.NewGuid():N}@example.invalid";
        var user = new ApplicationUser { Id = Guid.NewGuid(), Email = email, UserName = email,
            DisplayName = "Integration test", IsActive = active, EmailConfirmed = confirmed,
            LockoutEnd = locked ? DateTimeOffset.UtcNow.AddMinutes(15) : null,
            AccessGrants = [new UserAccessGrant { RoleId = TestCatalog.GlobalRoleId }] };
        Assert.True((await manager.CreateAsync(user, Password)).Succeeded);
        return user;
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/v1/auth/csrf");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", body.GetProperty("token").GetString());
    }

    private static async Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password = Password)
    {
        await CsrfAsync(client);
        return await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
    }

    [PostgresFact]
    public async Task CorrectCredentialsCreateSessionWithSecureCookie()
    {
        var user = await CreateAsync();
        using var client = Client();
        var response = await LoginAsync(client, user.Email!);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var cookie = response.Headers.GetValues("Set-Cookie").Single(x => x.StartsWith("__Host-mlp-session="));
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/session")).StatusCode);
    }

    [PostgresFact]
    public async Task IncorrectUnknownInactiveLockedAndUnconfirmedAccountsHaveSameSafeError()
    {
        var cases = new[] {
            ((await CreateAsync()).Email!, "WrongPassword123!"),
            ($"missing-{Guid.NewGuid():N}@example.invalid", Password),
            ((await CreateAsync(active: false)).Email!, Password),
            ((await CreateAsync(locked: true)).Email!, Password),
            ((await CreateAsync(confirmed: false)).Email!, Password)
        };
        foreach (var (email, password) in cases)
        {
            using var client = Client();
            var response = await LoginAsync(client, email, password);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("invalid_credentials", body.GetProperty("code").GetString());
            Assert.False(response.Headers.Contains("Set-Cookie"));
        }
    }

    [PostgresFact]
    public async Task LogoutRevokesPreviouslyCopiedSessionCookie()
    {
        var user = await CreateAsync();
        using var client = Client();
        var response = await LoginAsync(client, user.Email!);
        response.EnsureSuccessStatusCode();
        var cookie = response.Headers.GetValues("Set-Cookie").Single(x => x.StartsWith("__Host-mlp-session=")).Split(';')[0];
        await CsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/logout", null)).StatusCode);
        using var copied = Client(cookies: false);
        copied.DefaultRequestHeaders.Add("Cookie", cookie);
        Assert.Equal(HttpStatusCode.Unauthorized, (await copied.GetAsync("/api/v1/auth/session")).StatusCode);
    }

    [PostgresFact]
    public async Task RecoveryTokenIsSingleUseAndOldPasswordStopsWorking()
    {
        var user = await CreateAsync();
        using var client = Client();
        await CsrfAsync(client);
        var recovery = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = user.Email });
        Assert.Equal(HttpStatusCode.Accepted, recovery.StatusCode);
        var token = factory.Mailbox.RecoveryTokens[user.Email!];
        var request = new { email = user.Email, token, newPassword = "ChangedPassword456!" };
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/v1/auth/reset-password", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/reset-password", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(client, user.Email!)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(client, user.Email!, request.newPassword)).StatusCode);
    }

    [PostgresFact]
    public async Task ConfirmationAllowsAnAdministrativelyCreatedAccountToLogin()
    {
        var user = await CreateAsync(confirmed: false);
        using var client = Client();
        await CsrfAsync(client);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/v1/auth/resend-confirmation",
            new { email = user.Email })).StatusCode);
        var token = factory.Mailbox.ConfirmationTokens[user.Email!];
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/v1/auth/confirm-email",
            new { email = user.Email, token })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(client, user.Email!)).StatusCode);
    }

    [PostgresFact]
    public async Task PasswordChangeRevokesAnExistingCookie()
    {
        var user = await CreateAsync();
        using var client = Client();
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(client, user.Email!)).StatusCode);
        await CsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/v1/auth/change-password",
            new { currentPassword = Password, newPassword = "ChangedPassword456!" });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/session")).StatusCode);
    }

    [PostgresFact]
    public async Task FiveIncorrectPasswordsLockTheAccountAndDoNotIssueSessionCookies()
    {
        var user = await CreateAsync();
        using var client = Client();
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var response = await LoginAsync(client, user.Email!, "WrongPassword123!");
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.False(response.Headers.Contains("Set-Cookie"));
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(client, user.Email!)).StatusCode);
        await using var scope = factory.Services.CreateAsyncScope();
        var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var stored = (await manager.FindByIdAsync(user.Id.ToString()))!;
        Assert.True(await manager.IsLockedOutAsync(stored));
        Assert.True(stored.LockoutEnd > DateTimeOffset.UtcNow.AddMinutes(14));
    }

    [PostgresFact]
    public async Task MalformedLoginIsRejectedByDtoValidation()
    {
        using var client = Client();
        await CsrfAsync(client);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "invalid-email", password = "" })).StatusCode);
    }
}
