using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace MisionLiderParis.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
            new Dictionary<string, string?> { ["Database:ConnectionString"] = "",
                ["Security:AllowedOrigins:0"] = "https://localhost:4200" }));
    }
}

public sealed class HttpSecurityTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient Client() => factory.CreateClient(new WebApplicationFactoryClientOptions
        { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });

    [Fact]
    public async Task LivenessDoesNotRequireDatabaseAccess()
    {
        using var client = Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/live")).StatusCode);
    }

    [Fact]
    public async Task MissingDatabaseAndSchemaAreNeverReportedReady()
    {
        using var client = Client();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/health/ready")).StatusCode);
    }

    [Theory]
    [InlineData("/api/v1/users")]
    [InlineData("/api/v1/roles")]
    [InlineData("/api/v1/permissions")]
    [InlineData("/api/v1/auth/session")]
    public async Task AnonymousRequestsReceive401WithoutRedirect(string route)
    {
        using var client = Client();
        var response = await client.GetAsync(route);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task AntiforgeryTokenUsesSecureHttpOnlyHostCookie()
    {
        using var client = Client();
        var response = await client.GetAsync("/api/v1/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("token").GetString()));
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.Contains("__Host-mlp-antiforgery=", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task LoginWithoutAntiforgeryTokenIsRejectedBeforeCheckingCredentials()
    {
        using var client = Client();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "example@example.invalid", password = "ExamplePassword123!" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LoginWithCsrfAndNoDatabaseReportsUnavailableWithoutFabricatingSession()
    {
        using var client = Client();
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/csrf");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", csrf.GetProperty("token").GetString());
        var response = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { email = "example@example.invalid", password = "ExamplePassword123!" });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("database_not_configured", error.GetProperty("code").GetString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task DevelopmentOpenApiDescribesImplementedRoutesAndRequestContracts()
    {
        using var development = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        using var client = development.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<JsonElement>();
        var paths = document.GetProperty("paths");
        Assert.True(paths.TryGetProperty("/api/v1/auth/login", out var login));
        Assert.True(login.GetProperty("post").TryGetProperty("requestBody", out _));
        Assert.True(paths.TryGetProperty("/api/v1/users/{id}", out _));
        Assert.True(paths.TryGetProperty("/api/v1/people", out _));
        Assert.True(paths.TryGetProperty("/api/v1/process-assignments", out _));
        Assert.True(paths.TryGetProperty("/api/v1/reports/overview", out _));
    }

    [Fact]
    public async Task CorsDoesNotAuthorizeAnUnknownOrigin()
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", "https://attacker.invalid");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        var response = await client.SendAsync(request);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task CorsAuthorizesOnlyConfiguredOriginWithCredentials()
    {
        using var client = Client();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/v1/auth/login");
        request.Headers.Add("Origin", "https://localhost:4200");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        var response = await client.SendAsync(request);
        Assert.Equal("https://localhost:4200", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
        Assert.Equal("true", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Credentials")));
    }

    [Fact]
    public async Task ExcessiveAuthenticationRequestsAreRateLimited()
    {
        using var isolated = new ApiFactory();
        using var client = isolated.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        HttpResponseMessage? last = null;
        for (var attempt = 0; attempt < 11; attempt++)
        {
            last?.Dispose();
            last = await client.PostAsJsonAsync("/api/v1/auth/login",
                new { email = "example@example.invalid", password = "ExamplePassword123!" });
        }
        using (last) Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }
}
