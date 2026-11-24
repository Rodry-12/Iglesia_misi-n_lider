using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PeopleBrowserFixtureTests
{
    [PeopleBrowserFact]
    public async Task BranchBrowserCrudUsesRealHttpsAndIsolatedPostgresWithoutExternalMail()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "frontend"))) root = root.Parent;
        Assert.NotNull(root);
        var output = Path.Combine(root.FullName, "backend", ".local", "branch-browser", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(output);
        var apiPort = FreePort(); var frontendPort = FreePort(); while (frontendPort == apiPort) frontendPort = FreePort();
        var password = "Aa1!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var email = $"branch-browser-{Guid.NewGuid():N}@example.invalid";
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("localhost"); san.AddIpAddress(IPAddress.Loopback); request.CertificateExtensions.Add(san.Build());
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.1") }, false));
        using var generated = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddHours(2));
        var certificatePassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        using var certificate = X509CertificateLoader.LoadPkcs12(generated.Export(X509ContentType.Pfx, certificatePassword), certificatePassword);
        var pem = Path.Combine(output, "public.crt"); await File.WriteAllTextAsync(pem, certificate.ExportCertificatePem());
        using var host = factory.WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Security:AllowedOrigins:0"] = $"https://localhost:{frontendPort}" }));
            builder.ConfigureTestServices(services => services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(output, "keys"))).ProtectKeysWithCertificate(certificate));
        });
        host.UseKestrel(options => options.ListenLocalhost(apiPort, listen => listen.UseHttps(certificate)));
        await using (var scope = host.Services.CreateAsyncScope()) {
            var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = "HU013 isolated browser", AccessGrants = [new() { RoleId = TestCatalog.GlobalRoleId }] };
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user, password)).Succeeded);
        }
        var start = new ProcessStartInfo("node") { WorkingDirectory = Path.Combine(root.FullName, "frontend"), UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in new[] { "node_modules/@playwright/test/cli.js", "test", "--config", "playwright.people-real.config.ts", "--grep", "HU-013" }) start.ArgumentList.Add(arg);
        foreach (var pair in new Dictionary<string, string> { ["MLP_BRANCH_BROWSER"] = "1", ["MLP_PEOPLE_EMAIL"] = email, ["MLP_PEOPLE_PASSWORD"] = password,
            ["MLP_PEOPLE_FRONTEND_PORT"] = frontendPort.ToString(), ["MLP_API_PROXY_TARGET"] = $"https://localhost:{apiPort}", ["NODE_EXTRA_CA_CERTS"] = pem, ["MLP_PEOPLE_RESULTS_DIR"] = Path.Combine(output, "results") }) start.Environment[pair.Key] = pair.Value;
        using var browser = Process.Start(start)!;
        var stdout = browser.StandardOutput.ReadToEndAsync(); var stderr = browser.StandardError.ReadToEndAsync();
        using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(4));
        try { await browser.WaitForExitAsync(deadline.Token); }
        catch { if (!browser.HasExited) browser.Kill(true); throw; }
        var diagnostic = (await stdout) + (await stderr);
        diagnostic = diagnostic.Replace(password, "[redacted]");
        if (browser.ExitCode != 0) await File.WriteAllTextAsync(Path.Combine(output, "diagnostics.txt"), diagnostic);
        Assert.True(browser.ExitCode == 0, "HU013 isolated real browser failed; see sanitized local diagnostics.");
    }
}
