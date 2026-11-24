using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task SuperAdministratorCannotCreateBranchBAccountLinkedToBranchAPerson()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branchA = await BranchAsync(client); var branchB = await BranchAsync(client);
        var person = await PersonAsync(client, branchA.Id);
        var email = $"mismatched-{Guid.NewGuid():N}@example.invalid";
        var response = await WriteAsync(client, "/api/v1/users", new CreateUserRequest(
            email, Password, "Mismatched account", person.Id,
            [new GrantReference(TestCatalog.OperatorRoleId, branchB.Id)]));

        await ExpectAsync(response, HttpStatusCode.NotFound);
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.False(await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AnyAsync(u => u.Email == email));
    }

    private static Task<UserDto> CreateAccountAsync(HttpClient client, Guid? person, params GrantReference[] grants) =>
        CreateAsync<UserDto>(client, "/api/v1/users", new CreateUserRequest(
            $"scope-{Guid.NewGuid():N}@example.invalid", Password, "Recipient scope account", person, grants));

    private async Task<HttpClient> LoginAccountAsync(UserDto user)
    {
        var client = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await CsrfAsync(client);
        await using var scope = factory.Services.CreateAsyncScope();
        var current = (await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == user.Id));
        if (current.PasswordHash is null)
        {
            await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/activate-invitation", new {
                email = user.Email, token = factory.Mailbox.InvitationTokens[user.Email], newPassword = Password }), HttpStatusCode.NoContent);
        }
        else if (!current.EmailConfirmed)
        {
            await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/resend-confirmation", new { email = user.Email }), HttpStatusCode.Accepted);
            await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/confirm-email",
                new { email = user.Email, token = factory.Mailbox.ConfirmationTokens[user.Email] }), HttpStatusCode.NoContent);
        }
        await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = Password }), HttpStatusCode.OK);
        return client;
    }

    [PostgresFact]
    public async Task RecipientRolesAllowMatchingMembershipMultipleBranchesAndOptionalPerson()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var person = await PersonAsync(client, a.Id);
        await using (var scope = factory.Services.CreateAsyncScope())
            Assert.False(await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AnyAsync(u => u.PersonId == person.Id));

        var op = await CreateAccountAsync(client, person.Id, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        using var opSession = await LoginAccountAsync(op);
        var adminPerson = await PersonAsync(client, a.Id);
        var admin = await CreateAccountAsync(client, adminPerson.Id, new GrantReference(TestCatalog.BranchRoleId, a.Id));
        using var adminSession = await LoginAccountAsync(admin);
        var multiPerson = await PersonAsync(client, a.Id);
        var multi = await CreateAccountAsync(client, multiPerson.Id, new GrantReference(TestCatalog.OperatorRoleId, b.Id), new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        using var multiSession = await LoginAccountAsync(multi);

        // A global account may link an active person with no membership at all.
        var unassigned = new Person { FirstNames = "Unassigned", LastNames = "Local test",
            Documents = [new PersonDocument {DocumentType = "TEST", DocumentNumber = Guid.NewGuid().ToString("N")}] };
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
            var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            db.People.Add(unassigned); await db.SaveChangesAsync();
        }
        await ExpectAsync(await WriteAsync(client, "/api/v1/users", new CreateUserRequest(
            $"no-membership-{Guid.NewGuid():N}@example.invalid", Password, "Missing membership", unassigned.Id,
            [new(TestCatalog.OperatorRoleId, a.Id)])), HttpStatusCode.NotFound);
        var global = await CreateAccountAsync(client, unassigned.Id, new GrantReference(TestCatalog.GlobalRoleId, null));
        using var globalSession = await LoginAccountAsync(global);
        var unlinked = await CreateAccountAsync(client, null, new GrantReference(TestCatalog.OperatorRoleId, b.Id));
        using var unlinkedSession = await LoginAccountAsync(unlinked);
        var unlinkedGlobal = await CreateAccountAsync(client, null, new GrantReference(TestCatalog.GlobalRoleId, null));
        using var unlinkedGlobalSession = await LoginAccountAsync(unlinkedGlobal);
        await ExpectAsync(await globalSession.GetAsync("/api/v1/branches"), HttpStatusCode.OK);
    }

    [PostgresFact]
    public async Task PersonIdEditsValidateRecipientScopePreserveRejectedChangesAndRevokeOldSessions()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var original = await PersonAsync(client, a.Id); var replacement = await PersonAsync(client, a.Id);
        var foreign = await PersonAsync(client, b.Id);
        var user = await CreateAccountAsync(client, original.Id, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        using var session = await LoginAccountAsync(user);

        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Rejected", foreign.Id), true), HttpStatusCode.NotFound);
        var unchanged = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        Assert.Equal(original.Id, unchanged.PersonId); Assert.Equal(user.DisplayName, unchanged.DisplayName);
        await ExpectAsync(await session.GetAsync("/api/v1/auth/session"), HttpStatusCode.OK);

        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Relinked", replacement.Id), true), HttpStatusCode.OK);
        await ExpectAsync(await session.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        var relinked = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        using var relinkedSession = await LoginAccountAsync(relinked);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Unlinked", null), true), HttpStatusCode.OK);
        await ExpectAsync(await relinkedSession.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        var unlinked = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        Assert.Null(unlinked.PersonId);
        using var unlinkedSession = await LoginAccountAsync(unlinked);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Linked again", replacement.Id), true), HttpStatusCode.OK);
        await ExpectAsync(await unlinkedSession.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        using var linkedAgain = await LoginAccountAsync((await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/revoke-sessions", new { }), HttpStatusCode.NoContent);
        await ExpectAsync(await linkedAgain.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
    }

    [PostgresFact]
    public async Task ReplacingGrantsRequiresRecipientMembershipAndRevokesOnlySuccessfulChanges()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var person = await PersonAsync(client, a.Id);
        var user = await CreateAccountAsync(client, person.Id, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        using var session = await LoginAccountAsync(user);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/grants",
            new ReplaceGrantsRequest([new(TestCatalog.OperatorRoleId, b.Id)]), true), HttpStatusCode.NotFound);
        var unchanged = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        Assert.Equal(a.Id, Assert.Single(unchanged.Grants).BranchId);
        await ExpectAsync(await session.GetAsync("/api/v1/auth/session"), HttpStatusCode.OK);

        Guid viewPermission;
        await using (var scope = factory.Services.CreateAsyncScope())
            viewPermission = await scope.ServiceProvider.GetRequiredService<MinistryDbContext>().Permissions
                .Where(p => p.Code == "PERSON_VIEW").Select(p => p.Id).SingleAsync();
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/grants", new ReplaceGrantsRequest(
            [new(TestCatalog.OperatorRoleId, b.Id), new(TestCatalog.OperatorRoleId, a.Id, [viewPermission])]), true), HttpStatusCode.NoContent);
        await ExpectAsync(await session.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        var changed = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        Assert.Equal(viewPermission, Assert.Single(changed.Grants.Single(g => g.BranchId == a.Id).PermissionIds!));
        using var newSession = await LoginAccountAsync(changed);
        await ExpectAsync(await newSession.GetAsync($"/api/v1/people?branchId={a.Id}"), HttpStatusCode.OK);
        await ExpectAsync(await newSession.GetAsync($"/api/v1/people?branchId={b.Id}"), HttpStatusCode.Forbidden);
        // Promote a recipient to valid SUPER_ADMIN without requiring a branch or a person membership.
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/grants",
            new ReplaceGrantsRequest([new(TestCatalog.GlobalRoleId, null)]), true), HttpStatusCode.NoContent);
        await ExpectAsync(await newSession.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        using var globalSession = await LoginAccountAsync((await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!);
        await ExpectAsync(await globalSession.GetAsync("/api/v1/branches"), HttpStatusCode.OK);
    }

    [PostgresFact]
    public async Task TransferAndDeactivationRevokeSessionsAndLoginUsesCurrentMembership()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var person = await PersonAsync(client, a.Id);
        var user = await CreateAccountAsync(client, person.Id, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        using var session = await LoginAccountAsync(user);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}/transfer",
            new TransferPersonRequest(b.Id, "Local membership validation")), HttpStatusCode.NoContent);
        await ExpectAsync(await session.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        await CsrfAsync(session);
        await ExpectAsync(await session.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = Password }), HttpStatusCode.Unauthorized);

        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}/grants",
            new ReplaceGrantsRequest([new(TestCatalog.OperatorRoleId, b.Id)]), true), HttpStatusCode.NoContent);
        var changed = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        using var movedSession = await LoginAccountAsync(changed);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await movedSession.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        await CsrfAsync(movedSession);
        await ExpectAsync(await movedSession.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = Password }), HttpStatusCode.Unauthorized);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Inactive person", person.Id), true), HttpStatusCode.NotFound);
    }

    [PostgresFact]
    public async Task GlobalAccountsStillRejectInactivePeopleAndInvalidGlobalScopes()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        var response = await WriteAsync(client, "/api/v1/users", new CreateUserRequest(
            $"inactive-{Guid.NewGuid():N}@example.invalid", Password, "Inactive global person", person.Id, [new(TestCatalog.GlobalRoleId, null)]));
        await ExpectAsync(response, HttpStatusCode.NotFound);
        var global = await CreateAccountAsync(client, null, new GrantReference(TestCatalog.GlobalRoleId, null));
        await ExpectAsync(await WriteAsync(client, $"/api/v1/users/{global.Id}", new UpdateUserRequest("Inactive link", person.Id), true), HttpStatusCode.NotFound);
        var invalidGlobal = await WriteAsync(client, "/api/v1/users", new CreateUserRequest(
            $"invalid-global-{Guid.NewGuid():N}@example.invalid", Password, "Invalid global scope", null, [new(TestCatalog.GlobalRoleId, branch.Id)]));
        await ExpectAsync(invalidGlobal, HttpStatusCode.Forbidden);
        var invalidBranch = await WriteAsync(client, "/api/v1/users", new CreateUserRequest(
            $"invalid-branch-{Guid.NewGuid():N}@example.invalid", Password, "Invalid branch scope", null, [new(TestCatalog.OperatorRoleId, null)]));
        await ExpectAsync(invalidBranch, HttpStatusCode.Forbidden);
    }

    [PostgresFact]
    public async Task BranchAdministratorCannotLinkForeignPeopleOrEscalateRecipientGrants()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var person = await PersonAsync(client, a.Id); var foreign = await PersonAsync(client, b.Id);
        var admin = await AccountAsync(a.Id, root.UserId); using var adminClient = admin.Client;
        var user = await CreateAccountAsync(adminClient, person.Id, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/users/{user.Id}", new UpdateUserRequest("Foreign", foreign.Id), true), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/users/{user.Id}/grants",
            new ReplaceGrantsRequest([new(TestCatalog.GlobalRoleId, null)]), true), HttpStatusCode.Forbidden);
        var forbidden = await WriteAsync(adminClient, "/api/v1/users", new CreateUserRequest(
            $"forbidden-{Guid.NewGuid():N}@example.invalid", Password, "Forbidden", null, [new(TestCatalog.GlobalRoleId, null)]));
        await ExpectAsync(forbidden, HttpStatusCode.Forbidden);
        var unchanged = (await client.GetFromJsonAsync<UserDto>($"/api/v1/users/{user.Id}"))!;
        Assert.Equal(person.Id, unchanged.PersonId);
        Assert.Equal(TestCatalog.OperatorRoleId, Assert.Single(unchanged.Grants).RoleId);
    }
}
