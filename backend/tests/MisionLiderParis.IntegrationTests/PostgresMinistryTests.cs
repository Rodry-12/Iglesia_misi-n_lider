using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.IntegrationTests;

// These scenarios exercise HTTP, Identity, PostgreSQL triggers and RLS together.
public sealed partial class PostgresMinistryTests(PostgresApiFactory factory) : IClassFixture<PostgresApiFactory>
{
    private const string Password = "IsolatedPassword123!";

    private async Task<(HttpClient Client, Guid UserId)> AccountAsync(Guid? branch = null, Guid? creator = null,
        bool operatorRole = false)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        if (creator.HasValue) scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(creator.Value);
        var email = $"ministry-{Guid.NewGuid():N}@example.invalid";
        var user = new ApplicationUser { Id = Guid.NewGuid(), Email = email, UserName = email,
            DisplayName = "Isolated ministry test", EmailConfirmed = true, IsActive = true,
            AccessGrants = [new UserAccessGrant { RoleId = operatorRole ? TestCatalog.OperatorRoleId :
                branch.HasValue ? TestCatalog.BranchRoleId : TestCatalog.GlobalRoleId, BranchId = branch }] };
        var result = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user, Password);
        Assert.True(result.Succeeded, string.Join(";", result.Errors.Select(e => e.Description)));
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions {
            BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await CsrfAsync(client);
        await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password }), HttpStatusCode.OK);
        return (client, user.Id);
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var body = await client.GetFromJsonAsync<JsonElement>("/api/v1/auth/csrf");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", body.GetProperty("token").GetString());
    }

    private static async Task<HttpResponseMessage> WriteAsync(HttpClient client, string path, object request, bool put = false)
    {
        await CsrfAsync(client);
        return put ? await client.PutAsJsonAsync(path, request) : await client.PostAsJsonAsync(path, request);
    }

    private static async Task ExpectAsync(HttpResponseMessage response, HttpStatusCode status) =>
        Assert.True(response.StatusCode == status, $"Expected {status}, got {response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

    private static async Task<T> CreateAsync<T>(HttpClient client, string path, object request)
    {
        var response = await WriteAsync(client, path, request);
        await ExpectAsync(response, HttpStatusCode.Created);
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private static Task<BranchDto> BranchAsync(HttpClient client) => CreateAsync<BranchDto>(client, "/api/v1/branches",
        new BranchRequest("T" + Guid.NewGuid().ToString("N")[..12], "Isolated branch " + Guid.NewGuid(), null, null));

    private static Task<PersonDto> PersonAsync(HttpClient client, Guid branch) => CreateAsync<PersonDto>(client, "/api/v1/people",
        new CreatePersonRequest(new PersonRequest("Isolated", "Person " + Guid.NewGuid(), null, null, null), branch,
            new DocumentRequest("TEST", Guid.NewGuid().ToString("N"))));

    private static async Task<ProcessDto> ProcessAsync(HttpClient client)
    {
        var category = await CreateAsync<CategoryDto>(client, "/api/v1/process-categories",
            new CategoryRequest("Isolated category " + Guid.NewGuid(), null));
        return await CreateAsync<ProcessDto>(client, "/api/v1/processes",
            new ProcessRequest(category.Id, "Isolated process " + Guid.NewGuid(), null));
    }

    [PostgresFact]
    public async Task BranchScopeAndDatabaseRlsPreventForeignReadsAndOperatorWrites()
    {
        var root = await AccountAsync(); using var rootClient = root.Client;
        await ExpectAsync(await rootClient.GetAsync("/health/ready"), HttpStatusCode.OK);
        var ownBranch = await BranchAsync(rootClient); var foreignBranch = await BranchAsync(rootClient);
        var foreign = await PersonAsync(rootClient, foreignBranch.Id);
        var admin = await AccountAsync(ownBranch.Id, root.UserId); using var client = admin.Client;
        var own = await PersonAsync(client, ownBranch.Id);
        await ExpectAsync(await client.GetAsync($"/api/v1/people/{foreign.Id}"), HttpStatusCode.NotFound);
        await ExpectAsync(await client.GetAsync($"/api/v1/people?branchId={foreignBranch.Id}"), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(client, "/api/v1/branches", new BranchRequest("DENIED", "Denied", null, null)), HttpStatusCode.Forbidden);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(admin.UserId);
            var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            var ids = await db.People.Select(p => p.Id).ToListAsync(); // Deliberately no application scope filter.
            Assert.Contains(own.Id, ids); Assert.DoesNotContain(foreign.Id, ids);
            Assert.All(await db.Memberships.ToListAsync(), membership => Assert.Equal(ownBranch.Id, membership.BranchId));
        }
        await using (var scope = factory.Services.CreateAsyncScope())
            Assert.Empty(await scope.ServiceProvider.GetRequiredService<MinistryDbContext>().People.ToListAsync());
        var op = await AccountAsync(ownBranch.Id, root.UserId, operatorRole: true); using var opClient = op.Client;
        await ExpectAsync(await opClient.GetAsync("/api/v1/people"), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(opClient, "/api/v1/people", new CreatePersonRequest(
            new PersonRequest("Denied", "Person", null, null, null), ownBranch.Id, new DocumentRequest("TEST", Guid.NewGuid().ToString("N")))), HttpStatusCode.Forbidden);
        var duplicate = await WriteAsync(client, "/api/v1/people", new CreatePersonRequest(
            new PersonRequest("Duplicate", "Document", null, null, null), ownBranch.Id,
            new DocumentRequest("TEST", own.Documents.Single().DocumentNumber)));
        await ExpectAsync(duplicate, HttpStatusCode.Conflict);
    }

    [PostgresFact]
    public async Task AssignmentLifecycleTransferAndReportsUsePersistedData()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var target = await BranchAsync(client);
        var person = await PersonAsync(client, branch.Id); var responsible = await PersonAsync(client, branch.Id);
        var foreign = await PersonAsync(client, target.Id); var process = await ProcessAsync(client);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments",
            new AssignProcessRequest(person.Id, process.Id, foreign.Id, branch.Id)), HttpStatusCode.Conflict);
        var request = new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id);
        var assignment = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", request);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments", request), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-assignments/{assignment.Id}/state",
            new ChangeAssignmentStateRequest("COMPLETED"), true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}/transfer",
            new TransferPersonRequest(target.Id, "Isolated test")), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{responsible.Id}/active", new ActiveRequest(false), true), HttpStatusCode.Conflict);
        var withdrawnResponse = await WriteAsync(client, $"/api/v1/process-assignments/{assignment.Id}/state",
            new ChangeAssignmentStateRequest("WITHDRAWN"), true);
        await ExpectAsync(withdrawnResponse, HttpStatusCode.OK);
        var withdrawn = (await withdrawnResponse.Content.ReadFromJsonAsync<AssignmentDto>())!;
        Assert.Null(withdrawn.StartedAt); Assert.NotNull(withdrawn.FinishedAt);
        var second = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", request);
        foreach (var state in new[] { "IN_PROGRESS", "SUSPENDED", "IN_PROGRESS", "COMPLETED" })
            await ExpectAsync(await WriteAsync(client, $"/api/v1/process-assignments/{second.Id}/state",
                new ChangeAssignmentStateRequest(state), true), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-assignments/{second.Id}/state",
            new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.Conflict);
        var summary = (await client.GetFromJsonAsync<SummaryDto>($"/api/v1/reports/branches/{branch.Id}/summary"))!;
        Assert.Equal(2, summary.TotalPeople); Assert.Equal(2, summary.TotalAssignments);
        Assert.All(summary.AssignmentsByState.Where(state => state.Assignments > 0), state => Assert.Equal(1, state.DistinctPeople));
        Assert.Equal(2, summary.AssignmentsByState.Sum(state => state.Assignments));
        await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{branch.Id}/participants-by-responsible"), HttpStatusCode.OK);
        await ExpectAsync(await client.GetAsync("/api/v1/reports/process-categories"), HttpStatusCode.OK);
        await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{branch.Id}/summary.csv"), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}/transfer",
            new TransferPersonRequest(target.Id, "Isolated transfer")), HttpStatusCode.NoContent);
        var transferred = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(target.Id, transferred.BranchId);
    }

    [PostgresFact]
    public async Task BranchAdministratorDelegatesExplicitPermissionsWithoutEscalatingRoles()
    {
        var root = await AccountAsync(); using var rootClient = root.Client;
        var branch = await BranchAsync(rootClient);
        var admin = await AccountAsync(branch.Id, root.UserId); using var adminClient = admin.Client;
        Guid viewPermission;
        await using (var scope = factory.Services.CreateAsyncScope())
            viewPermission = await scope.ServiceProvider.GetRequiredService<MinistryDbContext>()
                .Permissions.Where(p => p.Code == "PERSON_VIEW").Select(p => p.Id).SingleAsync();
        var email = $"delegated-{Guid.NewGuid():N}@example.invalid";
        var grants = new[] { new GrantReference(TestCatalog.OperatorRoleId, branch.Id, [viewPermission]) };
        var user = await CreateAsync<UserDto>(adminClient, "/api/v1/users",
            new CreateUserRequest(email, Password, "Delegated operator", null, grants));
        await ExpectAsync(await WriteAsync(adminClient, "/api/v1/users", new CreateUserRequest(
            $"escalated-{Guid.NewGuid():N}@example.invalid", Password, "Denied global role", null,
            [new GrantReference(TestCatalog.GlobalRoleId, null)])), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/users/{user.Id}/grants",
            new ReplaceGrantsRequest(grants), true), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(adminClient, "/api/v1/auth/activate-invitation",
            new {email, token = factory.Mailbox.InvitationTokens[email], newPassword = Password}), HttpStatusCode.NoContent);
        using var op = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await CsrfAsync(op);
        await ExpectAsync(await op.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password }), HttpStatusCode.OK);
        await ExpectAsync(await op.GetAsync("/api/v1/people"), HttpStatusCode.OK);
        await ExpectAsync(await op.GetAsync("/api/v1/users"), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/users/{user.Id}/active", new SetUserActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await op.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
    }

    [PostgresFact]
    public async Task PersonLinkedAccountsRespectMembershipUniquenessAndMultiBranchAdministrationScope()
    {
        var root = await AccountAsync(); using var rootClient = root.Client;
        var branch = await BranchAsync(rootClient); var foreignBranch = await BranchAsync(rootClient);
        var person = await PersonAsync(rootClient, branch.Id); var foreign = await PersonAsync(rootClient, foreignBranch.Id);
        var admin = await AccountAsync(branch.Id, root.UserId); using var adminClient = admin.Client;
        var grants = new[] { new GrantReference(TestCatalog.OperatorRoleId, branch.Id) };
        var email = $"linked-{Guid.NewGuid():N}@example.invalid";
        await ExpectAsync(await WriteAsync(adminClient, "/api/v1/users", new CreateUserRequest(
            $"foreign-{Guid.NewGuid():N}@example.invalid", Password, "Denied foreign person", foreign.Id, grants)), HttpStatusCode.NotFound);
        var linked = await CreateAsync<UserDto>(adminClient, "/api/v1/users", new CreateUserRequest(
            email, Password, "Linked local person", person.Id, grants));
        Assert.Equal(person.Id, linked.PersonId);
        await ExpectAsync(await WriteAsync(rootClient, "/api/v1/users", new CreateUserRequest(
            $"duplicate-{Guid.NewGuid():N}@example.invalid", Password, "Denied duplicate person", person.Id, grants)), HttpStatusCode.Conflict);
        var multi = await CreateAsync<UserDto>(rootClient, "/api/v1/users", new CreateUserRequest(
            $"multi-{Guid.NewGuid():N}@example.invalid", Password, "Two branch grants", null,
            [new GrantReference(TestCatalog.OperatorRoleId, branch.Id), new GrantReference(TestCatalog.OperatorRoleId, foreignBranch.Id)]));
        await ExpectAsync(await adminClient.GetAsync($"/api/v1/users/{multi.Id}"), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/users/{multi.Id}/active", new SetUserActiveRequest(false), true), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(adminClient, "/api/v1/auth/activate-invitation",
            new {email, token = factory.Mailbox.InvitationTokens[email], newPassword = Password}), HttpStatusCode.NoContent);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await CsrfAsync(client);
        await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password }), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(adminClient, $"/api/v1/people/{person.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await client.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        await CsrfAsync(client);
        var rejected = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password });
        await ExpectAsync(rejected, HttpStatusCode.Unauthorized);
        Assert.False(rejected.Headers.Contains("Set-Cookie"));
    }

    [PostgresFact]
    public async Task ConcurrentAssignmentsProduceOneOpenAssignment()
    {
        var root = await AccountAsync(); using var first = root.Client;
        var branch = await BranchAsync(first); var person = await PersonAsync(first, branch.Id);
        var responsible = await PersonAsync(first, branch.Id); var process = await ProcessAsync(first);
        var another = await AccountAsync(); using var second = another.Client;
        await CsrfAsync(first); await CsrfAsync(second);
        var request = new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id);
        var responses = await Task.WhenAll(first.PostAsJsonAsync("/api/v1/process-assignments", request),
            second.PostAsJsonAsync("/api/v1/process-assignments", request));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
    }
}
