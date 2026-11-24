using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MimeKit;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Email;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Infrastructure;

namespace MisionLiderParis.UnitTests;

public sealed class GmailEmailTests
{
    [Theory]
    [InlineData("GmailApi",typeof(GmailApiAccountEmailSender))]
    [InlineData("Resend",typeof(ResendAccountEmailSender))]
    [InlineData("Smtp",typeof(SmtpAccountEmailSender))]
    public void ProviderSelectionPreservesExistingAdaptersWithoutFallback(string name,Type expected)
    {
        var services=new ServiceCollection();services.AddLogging();services.AddDataProtection();
        services.AddSingleton<IHostEnvironment>(new EnvironmentStub());
        services.AddInfrastructure(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["Email:Provider"]=name}).Build());
        using var provider=services.BuildServiceProvider();using var scope=provider.CreateScope();
        Assert.IsType(expected,scope.ServiceProvider.GetRequiredService<IAccountEmailSender>());
    }
    private sealed class Clock : TimeProvider
    {public DateTimeOffset Now {get;set;}=DateTimeOffset.UtcNow;public override DateTimeOffset GetUtcNow()=>Now;}
    private sealed class EnvironmentStub : IHostEnvironment
    {
        public string EnvironmentName {get;set;}="Testing";public string ApplicationName {get;set;}="GmailTests";
        public string ContentRootPath {get;set;}=Directory.GetCurrentDirectory();public IFileProvider ContentRootFileProvider {get;set;}=new NullFileProvider();
    }
    private sealed class Store : IGmailCredentialStore
    {
        public GmailCredential? Current {get;set;}
        public Task<GmailCredential?> LoadAsync(CancellationToken ct)=>Task.FromResult(Current);
        public Task SaveAsync(GmailCredential credential,CancellationToken ct){Current=new() {ClientId=credential.ClientId,RefreshToken=credential.RefreshToken,Revoked=credential.Revoked};return Task.CompletedTask;}
    }
    private sealed class Handler(Func<HttpRequestMessage,CancellationToken,Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        public int Calls {get;private set;}
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;return response(request,ct);}
    }
    private sealed class Clients(HttpMessageHandler handler) : IHttpClientFactory
    {public HttpClient CreateClient(string name)=>new(handler,false);}
    private static GoogleGmailOptions Settings()=>new() {ClientId="synthetic-client",ClientSecret="synthetic-secret"};
    private static HttpResponseMessage Json(object value,HttpStatusCode status=HttpStatusCode.OK)=>new(status) {Content=new StringContent(JsonSerializer.Serialize(value),Encoding.UTF8,"application/json")};

    [Fact]
    public void AuthorizationUsesExclusiveSendScopeOfflineS256AndOneTimeBrowserBinding()
    {
        var clock=new Clock();var options=Options.Create(Settings());var states=new GmailOAuthState(options,clock);
        var start=states.Begin(Guid.NewGuid(),"synthetic-stamp");var query=QueryHelpers.ParseQuery(new Uri(start.Url).Query);
        Assert.Equal(GoogleGmailOptions.Scope,query["scope"]);Assert.Equal("offline",query["access_type"]);
        Assert.Equal("S256",query["code_challenge_method"]);Assert.Equal(options.Value.RedirectUri,query["redirect_uri"]);
        Assert.Equal(GoogleGmailOptions.Sender,query["login_hint"]);Assert.Equal("false",query["include_granted_scopes"]);
        Assert.Throws<ApiException>(()=>states.Consume(query["state"],null));
        var flow=states.Consume(query["state"],start.Correlation);
        Assert.Equal(query["code_challenge"].ToString(),WebEncoders.Base64UrlEncode(System.Security.Cryptography.SHA256.HashData(Encoding.ASCII.GetBytes(flow.Verifier))));
        Assert.Throws<ApiException>(()=>states.Consume(query["state"],start.Correlation));
    }
    [Fact]
    public void ExpiredAlteredConfigurationAndMismatchedBrowserStatesFailClosed()
    {
        var clock=new Clock();var settings=Settings();var states=new GmailOAuthState(Options.Create(settings),clock);
        var start=states.Begin(Guid.NewGuid(),"synthetic-stamp");var state=QueryHelpers.ParseQuery(new Uri(start.Url).Query)["state"].ToString();
        Assert.Throws<ApiException>(()=>states.Consume(state,new string('a',43)));
        clock.Now=clock.Now.AddMinutes(6);Assert.Throws<ApiException>(()=>states.Consume(state,start.Correlation));
        start=states.Begin(Guid.NewGuid(),"synthetic-stamp");state=QueryHelpers.ParseQuery(new Uri(start.Url).Query)["state"].ToString();settings.ClientId="changed-client";
        Assert.Throws<ApiException>(()=>states.Consume(state,start.Correlation));
    }
    [Fact]
    public async Task ConcurrentStateConsumptionSucceedsOnlyOnce()
    {
        var states=new GmailOAuthState(Options.Create(Settings()),new Clock());var start=states.Begin(Guid.NewGuid(),"synthetic-stamp");
        var state=QueryHelpers.ParseQuery(new Uri(start.Url).Query)["state"].ToString();
        var results=await Task.WhenAll(Enumerable.Range(0,8).Select(_=>Task.Run(()=>{try{states.Consume(state,start.Correlation);return true;}catch(ApiException){return false;}})));
        Assert.Single(results,r=>r);
    }
    [Theory]
    [InlineData("http://localhost:7243/api/v1/integrations/google/callback")]
    [InlineData("https://localhost:7243/wrong")]
    [InlineData("https://localhost:7243/api/v1/integrations/google/callback?redirect=evil")]
    public void UnsafeRedirectsAreRejected(string redirect)
    {var options=Settings();options.RedirectUri=redirect;Assert.Throws<ApiException>(()=>new GmailOAuthState(Options.Create(options),new Clock()).Begin(Guid.NewGuid(),"synthetic-stamp"));}

    [Fact]
    public async Task CodeExchangeCarriesVerifierAndRejectsBroaderScopeOrMissingRefreshToken()
    {
        var calls=0;
        using var handler=new Handler(async(request,ct)=>{
            Assert.Equal("https://oauth2.googleapis.com/token",request.RequestUri!.ToString());
            var form=QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(ct));
            Assert.Equal("authorization_code",form["grant_type"]);Assert.Equal("verifier",form["code_verifier"]);
            Assert.Equal(Settings().RedirectUri,form["redirect_uri"]);calls++;
            return calls==1?Json(new {access_token="synthetic-access",refresh_token="synthetic-refresh",expires_in=3600,token_type="Bearer",scope=GoogleGmailOptions.Scope+" other-scope"}):
                Json(new {access_token="synthetic-access",expires_in=3600,token_type="Bearer",scope=GoogleGmailOptions.Scope});
        });
        using var client=new HttpClient(handler);var google=new GoogleGmailClient(client,Options.Create(Settings()));
        var flow=new GmailPendingAuthorization(Guid.NewGuid(),"stamp","verifier","unused",Settings().ClientId,Settings().RedirectUri,DateTimeOffset.UtcNow.AddMinutes(5));
        await Assert.ThrowsAsync<ApiException>(()=>google.ExchangeAsync("synthetic-code",flow,default));
        await Assert.ThrowsAsync<ApiException>(()=>google.ExchangeAsync("synthetic-code",flow,default));
    }

    [Fact]
    public async Task ExpirationRefreshesOnceAcrossConcurrentSendersAndPersistsRotation()
    {
        var clock=new Clock();var settings=Settings();var store=new Store {Current=new() {ClientId=settings.ClientId,RefreshToken="synthetic-refresh"}};
        using var handler=new Handler((request,ct)=>Task.FromResult(Json(new {access_token="synthetic-access",refresh_token="rotated-refresh",expires_in=3600,token_type="Bearer"})));
        var tokens=new GmailAccessTokens(store,new Clients(handler),Options.Create(settings),clock);
        await Task.WhenAll(Enumerable.Range(0,8).Select(_=>tokens.GetAsync(default)));Assert.Equal(1,handler.Calls);Assert.Equal("rotated-refresh",store.Current!.RefreshToken);
        clock.Now=clock.Now.AddHours(1);await tokens.GetAsync(default);Assert.Equal(2,handler.Calls);
    }
    [Fact]
    public async Task InvalidGrantMarksCredentialRevokedAndNeverFallsBackToConfiguredOldRefreshToken()
    {
        var settings=Settings();settings.RefreshToken="old-configured-token";var store=new Store {Current=new() {ClientId=settings.ClientId,RefreshToken="synthetic-refresh"}};
        using var handler=new Handler((request,ct)=>Task.FromResult(Json(new {error="invalid_grant"},HttpStatusCode.BadRequest)));
        var tokens=new GmailAccessTokens(store,new Clients(handler),Options.Create(settings),new Clock());
        await Assert.ThrowsAsync<ApiException>(()=>tokens.GetAsync(default));await Assert.ThrowsAsync<ApiException>(()=>tokens.GetAsync(default));
        Assert.True(store.Current!.Revoked);Assert.Empty(store.Current.RefreshToken);Assert.Equal(1,handler.Calls);
    }
    [Fact]
    public async Task DiagnosticUsesExistingSenderOnceWithoutIdentityLinksOrTokens()
    {
        var options=Options.Create(Settings());var store=new Store();
        using var handler=new Handler(async(request,ct)=>{
            using var json=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            using var stream=new MemoryStream(WebEncoders.Base64UrlDecode(json.RootElement.GetProperty("raw").GetString()!));
            using var mime=await MimeMessage.LoadAsync(stream,ct);
            Assert.Equal(GoogleGmailOptions.Sender,Assert.Single(mime.From.Mailboxes).Address);
            Assert.Equal("recipient@example.invalid",Assert.Single(mime.To.Mailboxes).Address);
            Assert.Contains("Prueba de envío Gmail API",mime.Subject);
            Assert.Equal("Este es un correo de prueba enviado desde el sistema Misión Líder París mediante Gmail API. Su finalidad es verificar el funcionamiento del servicio de correo institucional. No requiere ninguna acción.",mime.TextBody?.TrimEnd('\r','\n'));
            Assert.Empty(mime.Cc);Assert.Empty(mime.Bcc);
            Assert.DoesNotContain("token=",mime.TextBody);Assert.DoesNotContain("href=",mime.HtmlBody);
            Assert.Contains(Uri.EscapeDataString(GoogleGmailOptions.Sender),request.RequestUri!.ToString());
            return Json(new{id="synthetic-diagnostic-id"});
        });
        var tokens=new GmailAccessTokens(store,new Clients(handler),options,new Clock());
        await tokens.SaveAuthorizationAsync(new("synthetic-access","synthetic-refresh",3600),default);
        using var http=new HttpClient(handler);
        var sender=new GmailApiAccountEmailSender(new(http,options),tokens,new(Options.Create(new EmailOptions()),new EnvironmentStub()));
        await sender.SendDiagnosticAsync("recipient@example.invalid",default);Assert.Equal(1,handler.Calls);
    }

    [Theory]
    [InlineData("recipient@example.invalid\r\nBcc: other@example.invalid")]
    [InlineData("Name <recipient@example.invalid>")]
    public async Task DiagnosticRejectsMalformedRecipientsBeforeAnyHttpRequest(string recipient)
    {
        var options=Options.Create(Settings());using var handler=new Handler((r,ct)=>Task.FromResult(Json(new{})));
        using var http=new HttpClient(handler);
        var sender=new GmailApiAccountEmailSender(new(http,options),new(new Store(),new Clients(handler),options,new Clock()),new(Options.Create(new EmailOptions()),new EnvironmentStub()));
        await Assert.ThrowsAsync<ApiException>(()=>sender.SendDiagnosticAsync(recipient,default));Assert.Equal(0,handler.Calls);
    }

    [Theory]
    [InlineData("invitation")][InlineData("confirmation")][InlineData("recovery")]
    public async Task GmailBuildsRealMimeWithFixedInstitutionalMailboxAndExistingHtmlText(string kind)
    {
        var settings=Settings();var options=Options.Create(settings);var clock=new Clock();var store=new Store();
        var mail=new EmailOptions {From="other@example.invalid",InvitationUrl="https://example.invalid/activar-cuenta",ConfirmationUrl="https://example.invalid/confirmar-correo",RecoveryUrl="https://example.invalid/restablecer-contrasena"};
        using var handler=new Handler(async(request,ct)=>{
            Assert.Contains(Uri.EscapeDataString(GoogleGmailOptions.Sender),request.RequestUri!.ToString());Assert.DoesNotContain("/users/me/",request.RequestUri.ToString());
            Assert.Equal("Bearer",request.Headers.Authorization!.Scheme);
            using var json=JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            using var stream=new MemoryStream(WebEncoders.Base64UrlDecode(json.RootElement.GetProperty("raw").GetString()!));using var mime=await MimeMessage.LoadAsync(stream,ct);
            Assert.Equal(GoogleGmailOptions.Sender,Assert.Single(mime.From.Mailboxes).Address);Assert.Equal("recipient@example.invalid",Assert.Single(mime.To.Mailboxes).Address);
            Assert.Contains("#email=",mime.TextBody);Assert.Contains("<a href=",mime.HtmlBody);Assert.Contains("synthetic-token",mime.TextBody);
            return Json(new {id="synthetic-message-id"});
        });
        var tokens=new GmailAccessTokens(store,new Clients(handler),options,clock);await tokens.SaveAuthorizationAsync(new("synthetic-access","synthetic-refresh",3600),default);
        using var http=new HttpClient(handler);var sender=new GmailApiAccountEmailSender(new(http,options),tokens,new(Options.Create(mail),new EnvironmentStub()));
        if(kind=="invitation")await sender.SendInvitationAsync("recipient@example.invalid","synthetic-token",default);
        else if(kind=="recovery")await sender.SendRecoveryAsync("recipient@example.invalid","synthetic-token",default);
        else await sender.SendConfirmationAsync("recipient@example.invalid","synthetic-token",default);
        Assert.Equal(1,handler.Calls);
    }
    [Theory]
    [InlineData(401)][InlineData(403)][InlineData(429)][InlineData(500)]
    public async Task GmailFailuresNeverRetryMessagesOrSwitchProviders(int status)
    {
        var options=Options.Create(Settings());var store=new Store();using var handler=new Handler((_,_)=>Task.FromResult(Json(new {error="synthetic"},(HttpStatusCode)status)));
        var tokens=new GmailAccessTokens(store,new Clients(handler),options,new Clock());await tokens.SaveAuthorizationAsync(new("synthetic-access","synthetic-refresh",3600),default);
        using var http=new HttpClient(handler);var sender=new GmailApiAccountEmailSender(new(http,options),tokens,new(Options.Create(new EmailOptions {InvitationUrl="https://example.invalid/activar-cuenta"}),new EnvironmentStub()));
        await Assert.ThrowsAsync<ApiException>(()=>sender.SendInvitationAsync("recipient@example.invalid","synthetic-token",default));Assert.Equal(1,handler.Calls);
        Assert.Equal(status==401,store.Current!.Revoked);
    }
    [Fact]
    public async Task EncryptedStoreRoundTripsOutsideRepositoryAndRejectsTampering()
    {
        var basePath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MlpGmailTests");
        var directory=Path.GetFullPath(Path.Combine(basePath,Guid.NewGuid().ToString("N")));
        Assert.StartsWith(Path.GetFullPath(basePath)+Path.DirectorySeparatorChar,directory,StringComparison.OrdinalIgnoreCase);
        var settings=Settings();settings.TokenStorePath=Path.Combine(directory,"credential.bin");
        var store=new ProtectedGmailCredentialStore(Options.Create(settings),new EphemeralDataProtectionProvider(),new EnvironmentStub());
        try {
            await store.SaveAsync(new() {ClientId=settings.ClientId,RefreshToken="synthetic-private-refresh"},default);
            Assert.DoesNotContain("synthetic-private-refresh",await File.ReadAllTextAsync(settings.TokenStorePath));
            Assert.Equal("synthetic-private-refresh",(await store.LoadAsync(default))!.RefreshToken);
            if(OperatingSystem.IsWindows())
            {
                var acl=System.IO.FileSystemAclExtensions.GetAccessControl(new FileInfo(settings.TokenStorePath));
                Assert.True(acl.AreAccessRulesProtected);
                using var identity=System.Security.Principal.WindowsIdentity.GetCurrent();
                var rule=Assert.Single(acl.GetAccessRules(true,true,typeof(System.Security.Principal.SecurityIdentifier))
                    .Cast<System.Security.AccessControl.FileSystemAccessRule>());
                Assert.Equal(identity.User,rule.IdentityReference);
            }
            await File.WriteAllTextAsync(settings.TokenStorePath,"tampered");await Assert.ThrowsAsync<ApiException>(()=>store.LoadAsync(default));
        }
        finally {if(Directory.Exists(directory))Directory.Delete(directory,true);}
    }
}
