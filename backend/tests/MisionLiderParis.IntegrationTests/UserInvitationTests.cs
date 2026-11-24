using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Infrastructure.Identity;
using Npgsql;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Users;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task UserAdministrationOptionsAndDocumentLookupStayScopedAndExcludeAlreadyLinkedPeople()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client); var local = await PersonAsync(client,a.Id); var foreign = await PersonAsync(client,b.Id);
        var admin = await AccountAsync(a.Id,root.UserId); using var branch = admin.Client;
        var options = (await branch.GetFromJsonAsync<UserAdministrationOptions>("/api/v1/users/administration-options"))!;
        Assert.Equal("OPERATOR", Assert.Single(options.Roles).Code); Assert.Equal(a.Id, Assert.Single(options.Branches).Id);
        await using var scope = factory.Services.CreateAsyncScope(); scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var ministry = scope.ServiceProvider.GetRequiredService<MisionLiderParis.Infrastructure.Ministry.MinistryDbContext>();
        var number = await ministry.Documents.Where(d=>d.PersonId==local.Id&&d.IsCurrent).Select(d=>d.DocumentNumber).SingleAsync();
        var foreignNumber = await ministry.Documents.Where(d=>d.PersonId==foreign.Id&&d.IsCurrent).Select(d=>d.DocumentNumber).SingleAsync();
        var candidates = (await branch.GetFromJsonAsync<MisionLiderParis.Application.Common.Page<UserPersonOption>>("/api/v1/users/people-options?search="+number))!;
        Assert.Equal(local.Id, Assert.Single(candidates.Items).Id);
        var hidden = (await branch.GetFromJsonAsync<MisionLiderParis.Application.Common.Page<UserPersonOption>>("/api/v1/users/people-options?search="+foreignNumber))!;
        Assert.Empty(hidden.Items);
        await InvitationAsync(client,a.Id,local.Id);
        Assert.Empty((await branch.GetFromJsonAsync<MisionLiderParis.Application.Common.Page<UserPersonOption>>("/api/v1/users/people-options?search="+number))!.Items);
        await ExpectAsync(await branch.GetAsync("/api/v1/users/people-options?search="+number+"&operation=USER_VIEW"),HttpStatusCode.Forbidden);
        // Legacy HTTP path must also ignore the administrator's supplied password.
        var created = await CreateAsync<UserDto>(client,"/api/v1/users",new CreateUserRequest($"legacy-{Guid.NewGuid():N}@example.invalid",Password,"Legacy route",null,[new(TestCatalog.OperatorRoleId,a.Id)]));
        Assert.False(created.HasPassword); Assert.False(created.EmailConfirmed);
    }
    [PostgresFact]
    public async Task InvitationDeliveryFailurePreservesSingleRecoverablePasswordlessAccountAndExpiredTokensFail()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        var email = $"delivery-{Guid.NewGuid():N}@example.invalid";
        var request = new InviteUserRequest(email, "Pending delivery", null, [new(TestCatalog.OperatorRoleId, branch.Id)]);
        factory.Mailbox.FailInvitations = true;
        InvitationResult result;
        try {result = await CreateAsync<InvitationResult>(client, "/api/v1/users/invitations", request);}
        finally {factory.Mailbox.FailInvitations = false;}
        Assert.Equal("unconfirmed", result.DeliveryStatus); Assert.False(result.User.HasPassword);
        await using var scope = factory.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
        Assert.Equal(1, await db.Users.CountAsync(u => u.Email == email));
        await ExpectAsync(await WriteAsync(client, "/api/v1/users/invitations", request), HttpStatusCode.BadRequest);
        // Short-lived verifier is installed only in this test host, without waiting or altering production options.
        var invite = await InvitationAsync(client, branch.Id);
        using var expired = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IOptions<InvitationTokenOptions>>(Options.Create(new InvitationTokenOptions {Name = "MLP.Invitation", TokenLifespan = TimeSpan.FromTicks(-1)}))));
        using var recipient = expired.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/activate-invitation", new {email = invite.Result.User.Email, token = invite.Token, newPassword = Password}), HttpStatusCode.BadRequest);
    }
    private async Task<(InvitationResult Result,string Token)> InvitationAsync(HttpClient client, Guid branch, Guid? person = null)
    {
        var result = await CreateAsync<InvitationResult>(client, "/api/v1/users/invitations",
            new InviteUserRequest($"invited-{Guid.NewGuid():N}@example.invalid", "Invited operator", person, [new(TestCatalog.OperatorRoleId, branch)]));
        return (result, factory.Mailbox.InvitationTokens[result.User.Email]);
    }
    [PostgresFact]
    public async Task InvitationCreatesPasswordlessAccountActivatesOnceAndDoesNotExposeTokensOrAllowAlternateConfirmation()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id);
        var invite = await InvitationAsync(client, branch.Id, person.Id); var user = invite.Result.User;
        Assert.False(user.HasPassword); Assert.False(user.EmailConfirmed); Assert.Equal("accepted", invite.Result.DeliveryStatus);
        Assert.DoesNotContain(invite.Token, System.Text.Json.JsonSerializer.Serialize(invite.Result));
        using var recipient = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/login", new {email = user.Email, password = Password}), HttpStatusCode.Unauthorized);
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/resend-confirmation", new {email = user.Email}), HttpStatusCode.Accepted);
        Assert.False(factory.Mailbox.ConfirmationTokens.ContainsKey(user.Email));
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/activate-invitation", new {email = user.Email, token = invite.Token, newPassword = "weak"}), HttpStatusCode.BadRequest);
        var payload = new {email = user.Email, token = invite.Token, newPassword = Password};
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/activate-invitation", payload), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/activate-invitation", payload), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(recipient, "/api/v1/auth/login", new {email = user.Email, password = Password}), HttpStatusCode.OK);
        var session = await recipient.GetFromJsonAsync<System.Text.Json.JsonElement>("/api/v1/auth/session");
        Assert.Equal(branch.Id, session.GetProperty("grants")[0].GetProperty("branchId").GetGuid());
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/revoke-sessions", new {}), HttpStatusCode.NoContent);
        await ExpectAsync(await recipient.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
    }
    [PostgresFact]
    public async Task ConcurrentInvitationActivationSucceedsExactlyOnce()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client); var invite = await InvitationAsync(client, branch.Id);
        using var first = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        using var second = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await CsrfAsync(first); await CsrfAsync(second);
        var body = new {email = invite.Result.User.Email, token = invite.Token, newPassword = Password};
        var results = await Task.WhenAll(first.PostAsJsonAsync("/api/v1/auth/activate-invitation", body), second.PostAsJsonAsync("/api/v1/auth/activate-invitation", body));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.NoContent); Assert.Single(results, r => r.StatusCode == HttpStatusCode.BadRequest);
        foreach (var result in results) result.Dispose();
    }
    [PostgresFact]
    public async Task InvitationResendIsAuthorizedThrottledAndInvalidatesEarlierLink()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client); var foreign = await BranchAsync(client);
        var invite = await InvitationAsync(client, branch.Id); var user = invite.Result.User;
        using var viewer = await PersonViewerAsync((branch.Id, "USER_VIEW"));
        await ExpectAsync(await WriteAsync(viewer, $"/api/v1/users/{user.Id}/invitation", new {}), HttpStatusCode.Forbidden);
        var other = await AccountAsync(foreign.Id, root.UserId); using var otherClient = other.Client;
        await ExpectAsync(await WriteAsync(otherClient, $"/api/v1/users/{user.Id}/invitation", new {}), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/invitation", new {}), HttpStatusCode.TooManyRequests);
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        await using var reset = new NpgsqlCommand("DELETE FROM auth_app.user_tokens WHERE user_id=@id AND login_provider='MLP' AND name='InvitationLastAttempt'", admin);
        reset.Parameters.AddWithValue("id", user.Id); await reset.ExecuteNonQueryAsync();
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/invitation", new {}), HttpStatusCode.Accepted);
        var next = factory.Mailbox.InvitationTokens[user.Email]; Assert.NotEqual(invite.Token, next);
        await ExpectAsync(await WriteAsync(client, "/api/v1/auth/activate-invitation", new {email = user.Email, token = invite.Token, newPassword = Password}), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(client, "/api/v1/auth/activate-invitation", new {email = user.Email, token = next, newPassword = Password}), HttpStatusCode.NoContent);
    }
    [PostgresFact]
    public async Task InactiveLockedRevokedAndWrongAccountInvitationsCannotActivate()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        foreach (var kind in new[] {"inactive", "locked", "revoked", "wrong-account"})
        {
            var invite = await InvitationAsync(client, branch.Id); var user = invite.Result.User;
            if (kind == "inactive") await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/active", new {isActive = false}, true), HttpStatusCode.NoContent);
            if (kind == "revoked") await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/revoke-sessions", new {}), HttpStatusCode.NoContent);
            if (kind == "locked") {await using var scope = factory.Services.CreateAsyncScope(); var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(); var account = (await manager.FindByIdAsync(user.Id.ToString()))!; Assert.True((await manager.SetLockoutEndDateAsync(account, DateTimeOffset.UtcNow.AddHours(1))).Succeeded);}
            await ExpectAsync(await WriteAsync(client, "/api/v1/auth/activate-invitation", new {email = kind == "wrong-account" ? "unrelated@example.invalid" : user.Email, token = invite.Token, newPassword = Password}), HttpStatusCode.BadRequest);
        }
    }
}
