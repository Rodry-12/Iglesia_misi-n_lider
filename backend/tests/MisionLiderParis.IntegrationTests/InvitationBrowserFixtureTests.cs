using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Server.Kestrel.Https;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PeopleBrowserFixtureTests
{
    [PeopleBrowserFact]
    public async Task InvitationBrowserCreatesActivatesAndAuthenticatesThroughRealHttpsWithoutExternalMail()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !Directory.Exists(Path.Combine(root.FullName, "frontend"))) root = root.Parent;
        Assert.NotNull(root);
        var output = Path.Combine(root.FullName, "backend", ".local", "invitation-browser", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(output);
        var apiPort = FreePort(); var frontendPort = FreePort(); while (frontendPort == apiPort) frontendPort = FreePort();
        var password = "Aa1!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var adminEmail = $"invite-admin-{Guid.NewGuid():N}@example.invalid";
        using var rsa = RSA.Create(2048); var certificateRequest = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("localhost"); san.AddIpAddress(IPAddress.Loopback); certificateRequest.CertificateExtensions.Add(san.Build());
        certificateRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(false,false,0,true));
        certificateRequest.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection {new("1.3.6.1.5.5.7.3.1")},false));
        using var generated = certificateRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddHours(2));
        // Reimport the ephemeral certificate for Windows Schannel's server-key support; no PFX file.
        var pfxPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        using var certificate = X509CertificateLoader.LoadPkcs12(generated.Export(X509ContentType.Pfx, pfxPassword), pfxPassword);
        var pem = Path.Combine(output,"public.crt"); await File.WriteAllTextAsync(pem,certificate.ExportCertificatePem());
        using var host = factory.WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((_,configuration)=>configuration.AddInMemoryCollection(new Dictionary<string,string?> {
                ["Security:AllowedOrigins:0"]=$"https://localhost:{frontendPort}" }));
            builder.ConfigureTestServices(services=>services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(output,"keys"))).ProtectKeysWithCertificate(certificate));
        });
        host.UseKestrel(options=>options.ListenLocalhost(apiPort,listen=>listen.UseHttps(certificate)));
        await using(var scope = host.Services.CreateAsyncScope())
        {
            var user = new ApplicationUser {Id=Guid.NewGuid(),UserName=adminEmail,Email=adminEmail,EmailConfirmed=true,DisplayName="Browser invitation admin",
                AccessGrants=[new UserAccessGrant {RoleId=TestCatalog.GlobalRoleId}]};
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user,password)).Succeeded);
        }
        using(var handler = new HttpClientHandler {ServerCertificateCustomValidationCallback = (_,cert,_,_) => cert?.Thumbprint == certificate.Thumbprint})
        using(var health = new HttpClient(handler))
            Assert.True((await health.GetAsync($"https://localhost:{apiPort}/health/live")).IsSuccessStatusCode, "Isolated Kestrel HTTPS must be ready before running browser.");
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        await using var ministry = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql(admin).Options);
        var branch = new Branch {Name="HU012 Browser " + Guid.NewGuid().ToString("N"),Code="U"+Guid.NewGuid().ToString("N")[..12]}; ministry.Branches.Add(branch); await ministry.SaveChangesAsync();
        foreach(var project in new[]{"desktop","mobile"})
        {
            var recipient=$"recipient-{Guid.NewGuid():N}@example.invalid";
            foreach(var phase in new[]{"create","activate"})
            {
                var start=new ProcessStartInfo("node") {WorkingDirectory=Path.Combine(root.FullName,"frontend"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
                foreach(var arg in new[]{"node_modules/@playwright/test/cli.js","test","--config","playwright.people-real.config.ts","--project",project,"--grep","HU-012 "+phase})start.ArgumentList.Add(arg);
                var token=phase=="activate"?factory.Mailbox.InvitationTokens[recipient]:"";
                foreach(var pair in new Dictionary<string,string>{["MLP_USER_BROWSER"]="1",["MLP_INVITATION_PHASE"]=phase,["MLP_INVITED_EMAIL"]=recipient,
                    ["MLP_INVITATION_TOKEN"]=token,["MLP_PEOPLE_EMAIL"]=adminEmail,["MLP_PEOPLE_PASSWORD"]=password,["MLP_USER_BRANCH"]=branch.Name,
                    ["MLP_PEOPLE_FRONTEND_PORT"]=frontendPort.ToString(),["MLP_API_PROXY_TARGET"]=$"https://localhost:{apiPort}",["NODE_EXTRA_CA_CERTS"]=pem,
                    ["MLP_PEOPLE_RESULTS_DIR"]=Path.Combine(output,project,phase)})start.Environment[pair.Key]=pair.Value;
                start.Environment.Remove("MLP_TEST_OPERATOR_DATABASE");
                using var browser=Process.Start(start)!;var stdout=browser.StandardOutput.ReadToEndAsync();var stderr=browser.StandardError.ReadToEndAsync();
                using var deadline=new CancellationTokenSource(TimeSpan.FromMinutes(4));
                try {await browser.WaitForExitAsync(deadline.Token);}catch {if(!browser.HasExited)browser.Kill(true);throw;}
                string Safe(string value) {foreach(var secret in new[]{password,adminEmail,recipient,token}.Where(s=>s.Length>0))value=value.Replace(secret,"[redacted]",StringComparison.Ordinal);return value;}
                var diagnostics=Safe(await stdout+await stderr);
                foreach(var path in Directory.EnumerateFiles(output,"error-context.md",SearchOption.AllDirectories))await File.WriteAllTextAsync(path,Safe(await File.ReadAllTextAsync(path)));
                if(browser.ExitCode!=0)await File.WriteAllTextAsync(Path.Combine(output,"diagnostics.txt"),diagnostics);
                Assert.True(browser.ExitCode==0,"Real isolated invitation browser failed; sanitized diagnostics only, no external mail.");
            }
        }
        var evidence=Path.Combine(root.FullName,"backend","artifacts","user-invitations");Directory.CreateDirectory(evidence);
        await File.WriteAllTextAsync(Path.Combine(evidence,"browser-invitation-result.txt"),"desktop + mobile: real admin browser creates passwordless account, synthetic mailbox captures Identity invitation in memory, recipient activates through HTTPS, sets password, logs in with scoped permissions and logs out. PostgreSQL loopback only. No external mail, image, token file or production change.\n");
    }
}
