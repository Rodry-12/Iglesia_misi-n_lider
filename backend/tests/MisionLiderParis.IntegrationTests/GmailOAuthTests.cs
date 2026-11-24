using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MisionLiderParis.Infrastructure.Email;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    private sealed class OAuthStore : IGmailCredentialStore
    {
        public GmailCredential? Saved {get;private set;}
        public Task<GmailCredential?> LoadAsync(CancellationToken ct)=>Task.FromResult(Saved);
        public Task SaveAsync(GmailCredential credential,CancellationToken ct){Saved=credential;return Task.CompletedTask;}
    }
    private sealed class OAuthHandler(Func<Task>? duringExchange=null) : HttpMessageHandler
    {
        public int Calls {get;private set;}
        public string? Verifier {get;private set;}
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Calls++;
            Assert.Equal("https://oauth2.googleapis.com/token",request.RequestUri!.AbsoluteUri);
            var body=QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(ct));
            Assert.Equal("authorization_code",body["grant_type"]);
            Verifier=body["code_verifier"];
            if(duringExchange is not null)await duringExchange();
            return new(HttpStatusCode.OK) {Content=new StringContent("""
                {"access_token":"synthetic-access","refresh_token":"synthetic-refresh","expires_in":3600,
                "token_type":"Bearer","scope":"https://www.googleapis.com/auth/gmail.send"}
                """,Encoding.UTF8,"application/json")};
        }
    }
    private WebApplicationFactory<Program> OAuthFactory(OAuthStore store,OAuthHandler handler)=>factory.WithWebHostBuilder(builder=>
    {
        builder.ConfigureAppConfiguration((_,config)=>config.AddInMemoryCollection(new Dictionary<string,string?> {
            ["GoogleGmail:ClientId"]="synthetic-client",["GoogleGmail:ClientSecret"]="synthetic-secret",
            ["GoogleGmail:RedirectUri"]="https://localhost:7243/api/v1/integrations/google/callback"}));
        builder.ConfigureTestServices(services=>{
            services.RemoveAll<IGmailCredentialStore>();services.AddSingleton<IGmailCredentialStore>(store);
            services.AddHttpClient("GoogleGmail").ConfigurePrimaryHttpMessageHandler(()=>handler);
        });
    });
    private async Task<HttpClient> OAuthLoginAsync(WebApplicationFactory<Program> app,Guid userId)
    {
        await using var scope=factory.Services.CreateAsyncScope();
        var user=await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(userId.ToString());
        var client=app.CreateClient(new() {BaseAddress=new Uri("https://localhost:7243"),AllowAutoRedirect=false});
        await CsrfAsync(client);
        await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login",new {email=user!.Email,password=Password}),HttpStatusCode.OK);
        return client;
    }
    private static async Task<(string State,string Cookie,string Challenge)> BeginOAuthAsync(HttpClient admin)
    {
        var setup=await admin.GetAsync("/api/v1/integrations/google");
        await ExpectAsync(setup,HttpStatusCode.OK);
        Assert.Contains("https://accounts.google.com",Assert.Single(setup.Headers.GetValues("Content-Security-Policy")));
        var hidden=System.Text.RegularExpressions.Regex.Match(await setup.Content.ReadAsStringAsync(),"name=\"([^\"]+)\" value=\"([^\"]+)\"");
        Assert.True(hidden.Success);
        admin.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        var response=await admin.PostAsync("/api/v1/integrations/google/authorize",new FormUrlEncodedContent(new Dictionary<string,string> {
            [WebUtility.HtmlDecode(hidden.Groups[1].Value)]=WebUtility.HtmlDecode(hidden.Groups[2].Value)}));
        await ExpectAsync(response,HttpStatusCode.Redirect);
        var query=QueryHelpers.ParseQuery(response.Headers.Location!.Query);
        var cookie=response.Headers.GetValues("Set-Cookie").Single(v=>v.StartsWith("__Host-mlp-gmail-oauth="));
        Assert.Contains("secure",cookie,StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly",cookie,StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax",cookie,StringComparison.OrdinalIgnoreCase);
        return(query["state"].ToString(),cookie.Split(';')[0],query["code_challenge"].ToString());
    }
    private static HttpClient CallbackBrowser(WebApplicationFactory<Program> app,string cookie)
    {
        // Google returns cross-site: the existing SameSite=Strict Identity cookie is absent.
        var browser=app.CreateClient(new() {BaseAddress=new Uri("https://localhost:7243"),AllowAutoRedirect=false,HandleCookies=false});
        browser.DefaultRequestHeaders.Add("Cookie",cookie);return browser;
    }
    [PostgresFact]
    public async Task GmailOAuthCallbackUsesBrowserStateWithoutIdentityCookieAndRejectsReplay()
    {
        var root=await AccountAsync();using var rootClient=root.Client;
        var store=new OAuthStore();var handler=new OAuthHandler();using var app=OAuthFactory(store,handler);
        using var admin=await OAuthLoginAsync(app,root.UserId);var flow=await BeginOAuthAsync(admin);
        using var browser=CallbackBrowser(app,flow.Cookie);
        var response=await browser.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&code=synthetic-code");
        await ExpectAsync(response,HttpStatusCode.SeeOther);
        Assert.Equal("/api/v1/integrations/google/complete",response.Headers.Location!.OriginalString);
        Assert.Equal("synthetic-refresh",store.Saved!.RefreshToken);Assert.Equal(1,handler.Calls);
        Assert.Equal(flow.Challenge,WebEncoders.Base64UrlEncode(System.Security.Cryptography.SHA256.HashData(Encoding.ASCII.GetBytes(handler.Verifier!))));
        Assert.DoesNotContain("synthetic-refresh",await response.Content.ReadAsStringAsync());
        await ExpectAsync(await browser.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&code=replay"),HttpStatusCode.BadRequest);
        Assert.Equal(1,handler.Calls);
    }
    [PostgresFact]
    public async Task GmailOAuthRejectsAnonymousBranchAdministratorAndMissingCsrf()
    {
        var root=await AccountAsync();using var rootClient=root.Client;var branch=await BranchAsync(rootClient);
        var branchAdmin=await AccountAsync(branch.Id,root.UserId);using var branchClient=branchAdmin.Client;
        var store=new OAuthStore();var handler=new OAuthHandler();using var app=OAuthFactory(store,handler);
        using var anonymous=app.CreateClient(new() {BaseAddress=new Uri("https://localhost:7243"),AllowAutoRedirect=false});
        await ExpectAsync(await anonymous.GetAsync("/api/v1/integrations/google"),HttpStatusCode.Unauthorized);
        using var limited=await OAuthLoginAsync(app,branchAdmin.UserId);
        await ExpectAsync(await limited.GetAsync("/api/v1/integrations/google"),HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(limited,"/api/v1/integrations/google/authorize",new {}),HttpStatusCode.Forbidden);
        using var admin=await OAuthLoginAsync(app,root.UserId);admin.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        await ExpectAsync(await admin.PostAsJsonAsync("/api/v1/integrations/google/authorize",new {}),HttpStatusCode.BadRequest);
        Assert.Equal(0,handler.Calls);Assert.Null(store.Saved);
    }
    [PostgresFact]
    public async Task GmailOAuthInvalidBrowserAndGoogleDenialNeverExchangeCode()
    {
        var root=await AccountAsync();using var rootClient=root.Client;
        var store=new OAuthStore();var handler=new OAuthHandler();using var app=OAuthFactory(store,handler);
        using var admin=await OAuthLoginAsync(app,root.UserId);var flow=await BeginOAuthAsync(admin);
        using var wrong=CallbackBrowser(app,"__Host-mlp-gmail-oauth="+new string('x',43));
        await ExpectAsync(await wrong.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&code=synthetic"),HttpStatusCode.BadRequest);
        using var browser=CallbackBrowser(app,flow.Cookie);
        await ExpectAsync(await browser.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&error=access_denied"),HttpStatusCode.BadRequest);
        Assert.Equal(0,handler.Calls);Assert.Null(store.Saved);
    }
    [PostgresFact]
    public async Task GmailOAuthSessionRevokedBeforeCallbackPreventsExchange()
    {
        var root=await AccountAsync();using var rootClient=root.Client;
        var store=new OAuthStore();var handler=new OAuthHandler();using var app=OAuthFactory(store,handler);
        using var admin=await OAuthLoginAsync(app,root.UserId);var flow=await BeginOAuthAsync(admin);
        await RevokeOAuthAdministratorAsync(root.UserId);
        using var browser=CallbackBrowser(app,flow.Cookie);
        await ExpectAsync(await browser.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&code=synthetic"),HttpStatusCode.Forbidden);
        Assert.Equal(0,handler.Calls);Assert.Null(store.Saved);
    }
    [PostgresFact]
    public async Task GmailOAuthSessionRevokedDuringExchangeCannotPersistCredential()
    {
        var root=await AccountAsync();using var rootClient=root.Client;
        var store=new OAuthStore();var handler=new OAuthHandler(()=>RevokeOAuthAdministratorAsync(root.UserId));
        using var app=OAuthFactory(store,handler);using var admin=await OAuthLoginAsync(app,root.UserId);
        var flow=await BeginOAuthAsync(admin);using var browser=CallbackBrowser(app,flow.Cookie);
        await ExpectAsync(await browser.GetAsync($"/api/v1/integrations/google/callback?state={flow.State}&code=synthetic"),HttpStatusCode.Forbidden);
        Assert.Equal(1,handler.Calls);Assert.Null(store.Saved);
    }
    private async Task RevokeOAuthAdministratorAsync(Guid id)
    {
        await using var scope=factory.Services.CreateAsyncScope();var manager=scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user=await manager.FindByIdAsync(id.ToString());Assert.True((await manager.UpdateSecurityStampAsync(user!)).Succeeded);
    }
}
