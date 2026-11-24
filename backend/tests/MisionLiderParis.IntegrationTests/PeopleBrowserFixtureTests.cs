using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed class PeopleBrowserFactAttribute : FactAttribute
{
    public PeopleBrowserFactAttribute()
    {
        if(Environment.GetEnvironmentVariable("MLP_RUN_PEOPLE_BROWSER")!="1")
            Skip="Requires explicit isolated browser fixture opt-in; no real account is used.";
    }
}

public sealed partial class PeopleBrowserFixtureTests(PostgresApiFactory factory) : IClassFixture<PostgresApiFactory>
{
    [PeopleBrowserFact]
    public async Task BrowserCreatesAndReadsPersonThroughRealHttpsAndIsolatedPostgres()
    {
        var runtime=Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")!;
        var settings=new NpgsqlConnectionStringBuilder(runtime);
        Assert.True(settings.Host is "127.0.0.1" or "localhost" && settings.Database!.EndsWith("_tests",StringComparison.Ordinal));
        var root=new DirectoryInfo(AppContext.BaseDirectory);
        while(root is not null&&!Directory.Exists(Path.Combine(root.FullName,"frontend"))) root=root.Parent;
        Assert.NotNull(root);
        var output=Path.Combine(root.FullName,"backend",".local","people-browser",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(output);
        var apiPort=FreePort();var frontendPort=FreePort();while(frontendPort==apiPort)frontendPort=FreePort();
        var password="Aa1!"+Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var certificatePassword=Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var email=$"browser-{Guid.NewGuid():N}@example.invalid";
        var catalogEmail=$"catalog-browser-{Guid.NewGuid():N}@example.invalid";
        var assignEmail=$"assign-browser-{Guid.NewGuid():N}@example.invalid";
        var participantDocument=Guid.NewGuid().ToString("N");
        var responsibleDocument=Guid.NewGuid().ToString("N");
        var assignmentCategory="HU008 " + Guid.NewGuid().ToString("N");
        var stateBrowser=Environment.GetEnvironmentVariable("MLP_RUN_ASSIGNMENT_STATE_BROWSER")=="1";
        var responsibleBrowser=Environment.GetEnvironmentVariable("MLP_RUN_ASSIGNMENT_RESPONSIBLE_BROWSER")=="1";
        var replacementDocument=Guid.NewGuid().ToString("N");
        // Synthetic account/catalog rows only, in the guarded test database. No bootstrap/migration.
        await using(var admin=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")))
        {
            await admin.OpenAsync();
            var db=new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql(admin).Options);
            var branch=new Branch {Code="B"+Guid.NewGuid().ToString("N")[..12],Name="Browser isolated branch"};
            db.Branches.Add(branch);await db.SaveChangesAsync();
            var permissions=await db.Permissions.Where(p=>p.Code=="PERSON_CREATE"||p.Code=="PERSON_VIEW"||p.Code=="PERSON_UPDATE"||p.Code=="PERSON_DEACTIVATE").Select(p=>p.Id).ToArrayAsync();Assert.Equal(4,permissions.Length);
            await using var scope=factory.Services.CreateAsyncScope();
            var user=new ApplicationUser {UserName=email,Email=email,DisplayName="Isolated browser operator",EmailConfirmed=true,
                AccessGrants=[new UserAccessGrant {RoleId=TestCatalog.OperatorRoleId,BranchId=branch.Id,Permissions=permissions.Select(p=>new UserGrantPermission {PermissionId=p}).ToList()}]};
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user,password)).Succeeded);
            var catalogUser=new ApplicationUser {UserName=catalogEmail,Email=catalogEmail,DisplayName="Isolated catalog administrator",EmailConfirmed=true,
                AccessGrants=[new UserAccessGrant {RoleId=TestCatalog.GlobalRoleId}]};
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(catalogUser,password)).Succeeded);
            var assignPermissions=await db.Permissions.Where(p=>p.Code=="PROCESS_ASSIGN"||p.Code=="PROCESS_VIEW"||(stateBrowser&&p.Code=="PROCESS_CHANGE_STATUS")||
                (responsibleBrowser&&p.Code=="PROCESS_CHANGE_RESPONSIBLE"))
                .Select(p=>p.Id).ToArrayAsync();Assert.Equal(2+(stateBrowser?1:0)+(responsibleBrowser?1:0),assignPermissions.Length);
            var assignUser=new ApplicationUser {UserName=assignEmail,Email=assignEmail,DisplayName="Isolated assignment operator",EmailConfirmed=true,
                AccessGrants=[new UserAccessGrant {RoleId=TestCatalog.OperatorRoleId,BranchId=branch.Id,
                    Permissions=assignPermissions.Select(p=>new UserGrantPermission {PermissionId=p}).ToList()}]};
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(assignUser,password)).Succeeded);
            var participant=new Person {FirstNames="HU008",LastNames="Participante", Documents=[new PersonDocument {DocumentType="TEST",DocumentNumber=participantDocument}],
                Memberships=[new PersonBranch {BranchId=branch.Id}]};
            var responsible=new Person {FirstNames="HU008",LastNames="Responsable", Documents=[new PersonDocument {DocumentType="TEST",DocumentNumber=responsibleDocument}],
                Memberships=[new PersonBranch {BranchId=branch.Id}]};
            var category=new ProcessCategory {Name=assignmentCategory};
            db.People.AddRange(participant,responsible);db.Categories.Add(category);
            if(responsibleBrowser) db.People.Add(new Person {FirstNames="HU011",LastNames="Relevo",
                Documents=[new PersonDocument {DocumentType="TEST",DocumentNumber=replacementDocument}], Memberships=[new PersonBranch {BranchId=branch.Id}]});
            db.Processes.AddRange(new MinistryProcess {CategoryId=category.Id,Name="HU008 desktop"},new MinistryProcess {CategoryId=category.Id,Name="HU008 mobile"});
            await db.SaveChangesAsync();
        }
        using var rsa=RSA.Create(2048);var request=new CertificateRequest("CN=localhost",rsa,HashAlgorithmName.SHA256,RSASignaturePadding.Pkcs1);
        var san=new SubjectAlternativeNameBuilder();san.AddDnsName("localhost");san.AddIpAddress(IPAddress.Loopback);request.CertificateExtensions.Add(san.Build());
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false,false,0,true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection {new("1.3.6.1.5.5.7.3.1")},false));
        using var certificate=request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5),DateTimeOffset.UtcNow.AddHours(2));
        var pfx=Path.Combine(output,"test.pfx");var pem=Path.Combine(output,"public.crt");
        await File.WriteAllBytesAsync(pfx,certificate.Export(X509ContentType.Pfx,certificatePassword));await File.WriteAllTextAsync(pem,certificate.ExportCertificatePem());
        Process? api=null;
        try
        {
            var apiInfo=new ProcessStartInfo("dotnet") {WorkingDirectory=root.FullName,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
            apiInfo.ArgumentList.Add(Path.Combine(root.FullName,"backend","src","MisionLiderParis.Api","bin","Release","net10.0","MisionLiderParis.Api.dll"));
            foreach(var pair in new Dictionary<string,string> {
                ["ASPNETCORE_ENVIRONMENT"]="Testing",["DOTNET_ENVIRONMENT"]="Testing",["ASPNETCORE_URLS"]=$"https://localhost:{apiPort}",
                ["Database__ConnectionString"]=runtime,["Database__IdentityConnectionString"]=Environment.GetEnvironmentVariable("MLP_TEST_IDENTITY_DATABASE")!,
                ["Database__RequireVerifiedTls"]="false",["DatabaseActor__KeyId"]=SignedTestConfiguration.KeyId,["DatabaseActor__SigningKeyBase64"]=SignedTestConfiguration.SigningKey,
                ["Security__KeyRingPath"]=Path.Combine(output,"keys"),["Security__KeyCertificatePath"]=pfx,["Security__KeyCertificatePassword"]=certificatePassword,
                ["Kestrel__Certificates__Default__Path"]=pfx,["Kestrel__Certificates__Default__Password"]=certificatePassword,
                ["Security__AllowedOrigins__0"]=$"https://localhost:{frontendPort}" }) apiInfo.Environment[pair.Key]=pair.Value;
            apiInfo.Environment.Remove("MLP_TEST_OPERATOR_DATABASE");apiInfo.Environment.Remove("Database__MigrationConnectionString");
            // Each story/viewport has its own real API process so the combined regression does not
            // exhaust the unchanged production IP rate limits. No limiter is disabled/relaxed.
            var followUpOnly=Environment.GetEnvironmentVariable("MLP_RUN_ASSIGNMENT_FOLLOW_UP_BROWSER")=="1"||stateBrowser||responsibleBrowser;
            foreach(var (project,story) in new[]{("desktop","HU-008"),("desktop","HU-007"),("desktop","HU-002/003/004"),
                ("mobile","HU-008"),("mobile","HU-007"),("mobile","HU-002/003/004")}.Where(run=>!followUpOnly||run.Item2=="HU-008"))
            {
            api=Process.Start(apiInfo)!;
            // Drain without recording SQL, identities, cookies or environment values.
            var stdout=api.StandardOutput.ReadToEndAsync();var stderr=api.StandardError.ReadToEndAsync();
            using var handler=new HttpClientHandler();handler.ServerCertificateCustomValidationCallback=(_,cert,_,_)=>cert?.Thumbprint==certificate.Thumbprint;
            using var http=new HttpClient(handler) {BaseAddress=new Uri($"https://localhost:{apiPort}"),Timeout=TimeSpan.FromSeconds(2)};
            var ready=false;
            for(var attempt=0;attempt<60&&!api.HasExited;attempt++)
            {try {if((await http.GetAsync("/health/live")).IsSuccessStatusCode) {ready=true;break;}}catch(HttpRequestException){}catch(TaskCanceledException){} await Task.Delay(250);}
            Assert.True(ready,"Isolated HTTPS API did not become ready; no secret-bearing logs are printed.");
            var browserInfo=new ProcessStartInfo("node") {WorkingDirectory=Path.Combine(root.FullName,"frontend"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
            foreach(var arg in new[]{"node_modules/@playwright/test/cli.js","test","--config","playwright.people-real.config.ts","--project",project,"--grep",story}) browserInfo.ArgumentList.Add(arg);
            browserInfo.Environment["MLP_PEOPLE_REAL"]="1";browserInfo.Environment["MLP_PEOPLE_EMAIL"]=email;browserInfo.Environment["MLP_PEOPLE_PASSWORD"]=password;
            browserInfo.Environment["MLP_CATALOG_EMAIL"]=catalogEmail;
            browserInfo.Environment["MLP_ASSIGN_EMAIL"]=assignEmail;
            browserInfo.Environment["MLP_ASSIGN_PARTICIPANT_DOCUMENT"]=participantDocument;
            browserInfo.Environment["MLP_ASSIGN_RESPONSIBLE_DOCUMENT"]=responsibleDocument;
            browserInfo.Environment["MLP_ASSIGN_CATEGORY"]=assignmentCategory;
            browserInfo.Environment["MLP_ASSIGN_STATE_REAL"]=stateBrowser?"1":"0";
            browserInfo.Environment["MLP_ASSIGN_RESPONSIBLE_REAL"]=responsibleBrowser?"1":"0";
            browserInfo.Environment["MLP_ASSIGN_REPLACEMENT_DOCUMENT"]=replacementDocument;
            browserInfo.Environment["MLP_PEOPLE_FRONTEND_PORT"]=frontendPort.ToString();browserInfo.Environment["MLP_API_PROXY_TARGET"]=$"https://localhost:{apiPort}";
            browserInfo.Environment["NODE_EXTRA_CA_CERTS"]=pem;
            browserInfo.Environment["MLP_PEOPLE_RESULTS_DIR"]=Path.Combine(output,"browser-results",project,story.Replace('/','-'));
            using var browser=Process.Start(browserInfo)!;var browserOutput=browser.StandardOutput.ReadToEndAsync();var browserErrors=browser.StandardError.ReadToEndAsync();
            using var deadline=new CancellationTokenSource(TimeSpan.FromMinutes(4));
            try {await browser.WaitForExitAsync(deadline.Token);}catch {if(!browser.HasExited)browser.Kill(true);throw;}
            // Persist only a summary; diagnostic text might contain credentials from a failed locator.
            var browserText=await browserOutput;var browserErrorText=await browserErrors;
            // Sanitize automatic failure context files as well as runner diagnostics.
            foreach(var contextPath in Directory.EnumerateFiles(output,"error-context.md",SearchOption.AllDirectories))
            {
                var contextText=(await File.ReadAllTextAsync(contextPath)).Replace(password,"[redacted]",StringComparison.Ordinal)
                    .Replace(email,"[ephemeral-email]",StringComparison.Ordinal).Replace(catalogEmail,"[ephemeral-catalog-email]",StringComparison.Ordinal)
                    .Replace(assignEmail,"[ephemeral-assign-email]",StringComparison.Ordinal);
                await File.WriteAllTextAsync(contextPath,contextText);
            }
            if(browser.ExitCode!=0)
            {
                var safe=(browserText+browserErrorText).Replace(assignEmail,"[ephemeral-assign-email]",StringComparison.Ordinal).Replace(catalogEmail,"[ephemeral-catalog-email]",StringComparison.Ordinal).Replace(email,"[ephemeral-email]",StringComparison.Ordinal)
                    .Replace(password,"[redacted]",StringComparison.Ordinal).Replace(certificatePassword,"[redacted]",StringComparison.Ordinal)
                    .Replace(SignedTestConfiguration.SigningKey,"[redacted]",StringComparison.Ordinal);
                await File.WriteAllTextAsync(Path.Combine(output,"browser-diagnostics.txt"),safe);
            }
            Assert.True(browser.ExitCode==0,"Isolated real browser registration failed; test traces and credentials are not retained.");
            api.Kill(true);await api.WaitForExitAsync();await Task.WhenAll(stdout,stderr);api.Dispose();api=null;
            }
            if(!followUpOnly) {
            var summary=Path.Combine(root.FullName,"backend","artifacts","people-registration");Directory.CreateDirectory(summary);
            await File.WriteAllTextAsync(Path.Combine(summary,"browser-registration-result.txt"),"desktop + mobile: real HTTPS browser/API/PostgreSQL registration, editing, deactivate/confirm/reactivate, detail/reload/list/logout passed. No remote connection.\n");
            var catalogSummary=Path.Combine(root.FullName,"backend","artifacts","process-catalog");Directory.CreateDirectory(catalogSummary);
            await File.WriteAllTextAsync(Path.Combine(catalogSummary,"browser-catalog-result.txt"),"desktop + mobile: real HTTPS browser/API/PostgreSQL category and process create/detail/edit/deactivate/reactivate, category selection and logout passed. No remote connection.\n");
            }
            var assignmentSummary=Path.Combine(root.FullName,"backend","artifacts","process-assignment");Directory.CreateDirectory(assignmentSummary);
            await File.WriteAllTextAsync(Path.Combine(assignmentSummary,"browser-assignment-result.txt"),"desktop + mobile: real HTTPS assignment selection, mandatory responsible, POST 201, persisted GET/reload and logout with PROCESS_ASSIGN/VIEW and no directory/category read grants. Isolated PostgreSQL only.\n");
            var followUpSummary=Path.Combine(root.FullName,"backend","artifacts","assignment-follow-up");Directory.CreateDirectory(followUpSummary);
            await File.WriteAllTextAsync(Path.Combine(followUpSummary,"browser-follow-up-result.txt"),"desktop + mobile: real read-only assignment follow-up, participant/document/category/process filters, URL preservation, enriched detail/reload, correct null dates and logout. HTTPS API and isolated PostgreSQL; no remote connection, image or write during HU-009 consultation.\n");
            if(stateBrowser) {
                var stateSummary=Path.Combine(root.FullName,"backend","artifacts","assignment-state");Directory.CreateDirectory(stateSummary);
                await File.WriteAllTextAsync(Path.Combine(stateSummary,"browser-state-result.txt"),"desktop + mobile: real HTTPS state options, IN_PROGRESS, terminal cancellation without write, confirmed COMPLETED, coherent persisted dates, terminal lockout, detail/list refresh and logout. Isolated PostgreSQL only; no images.\n");
            }
            if(responsibleBrowser) {
                var summary=Path.Combine(root.FullName,"backend","artifacts","assignment-responsible");Directory.CreateDirectory(summary);
                await File.WriteAllTextAsync(Path.Combine(summary,"browser-responsible-result.txt"),"desktop + mobile: real HTTPS search, confirmation cancellation without write, conditional responsible PUT 200, immutable functional fields, persisted detail/list/reload and logout. Isolated PostgreSQL only; no images.\n");
            }
        }
        finally
        {
            if(api is {HasExited:false}) {api.Kill(true);await api.WaitForExitAsync();}
            api?.Dispose();File.Delete(pfx); // Ephemeral private certificate is never retained.
        }
    }
    private static int FreePort() {using var listener=new TcpListener(IPAddress.Loopback,0);listener.Start();return ((IPEndPoint)listener.LocalEndpoint).Port;}
}
