using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    private static Task<HttpResponseMessage> StateAsync(HttpClient client, Guid person, bool active) =>
        WriteAsync(client, $"/api/v1/people/{person}/active", new ActiveRequest(active), true);

    [PostgresFact]
    public async Task ReactivationRequiresCurrentDocumentAndCurrentMembershipInActiveBranch()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id);
        await ExpectAsync(await StateAsync(client, person.Id, false), HttpStatusCode.NoContent);
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));
        await admin.OpenAsync();
        async Task Execute(string sql)
        {
            await using var command = new NpgsqlCommand(sql, admin);
            command.Parameters.AddWithValue("id", person.Id); command.Parameters.AddWithValue("branch", branch.Id);
            await command.ExecuteNonQueryAsync();
        }
        await Execute("UPDATE iglesia.persona_documento SET vigente=false,fecha_finalizacion=now() WHERE persona_id=@id");
        await ExpectAsync(await StateAsync(client, person.Id, true), HttpStatusCode.Conflict);
        Assert.False((await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!.IsActive);
        await Execute("UPDATE iglesia.persona_documento SET vigente=true,fecha_finalizacion=NULL WHERE persona_id=@id");
        await Execute("UPDATE iglesia.persona_sede SET fecha_fin=now() WHERE persona_id=@id");
        await ExpectAsync(await StateAsync(client, person.Id, true), HttpStatusCode.Conflict);
        await Execute("UPDATE iglesia.persona_sede SET fecha_fin=NULL WHERE persona_id=@id");
        await Execute("UPDATE iglesia.sede SET activa=false WHERE id=@branch");
        await ExpectAsync(await StateAsync(client, person.Id, true), HttpStatusCode.Conflict);
        await Execute("UPDATE iglesia.sede SET activa=true WHERE id=@branch");
        await ExpectAsync(await StateAsync(client, person.Id, true), HttpStatusCode.NoContent);
    }

    [PostgresFact]
    public async Task StateChangesPreservePersonalDataAndRevokeLinkedSessionsWithoutChangingCredentials()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branch = await BranchAsync(global); var created = await PersonAsync(global, branch.Id);
        var before = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        var user = await CreateAccountAsync(global, before.Id, new GrantReference(TestCatalog.OperatorRoleId, branch.Id));
        using var linked = await LoginAccountAsync(user);
        string? originalHash;
        await using (var scope = factory.Services.CreateAsyncScope())
            originalHash = (await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == user.Id)).PasswordHash;
        // A capability-only operator can change state without gaining PERSON_VIEW or USER_ADMIN.
        using var op = await PersonViewerAsync((branch.Id, "PERSON_DEACTIVATE"));
        await ExpectAsync(await StateAsync(op, before.Id, false), HttpStatusCode.NoContent);
        var disabled = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{before.Id}"))!;
        Assert.False(disabled.IsActive); Assert.True(disabled.UpdatedAt > before.UpdatedAt);
        Assert.Equal(before, disabled with { IsActive = before.IsActive, UpdatedAt = before.UpdatedAt, Documents = before.Documents });
        Assert.Equal(before.Documents, disabled.Documents);
        await ExpectAsync(await linked.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        await CsrfAsync(linked);
        await ExpectAsync(await linked.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = Password }), HttpStatusCode.Unauthorized);
        await ExpectAsync(await StateAsync(op, before.Id, true), HttpStatusCode.NoContent);
        using var restored = await LoginAccountAsync(user with { EmailConfirmed = true });
        await ExpectAsync(await restored.GetAsync("/api/v1/auth/session"), HttpStatusCode.OK);
        // Old sessions do not resurrect after reactivation.
        await ExpectAsync(await linked.GetAsync("/api/v1/auth/session"), HttpStatusCode.Unauthorized);
        await using var finalScope = factory.Services.CreateAsyncScope();
        var account = await finalScope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == user.Id);
        Assert.Equal(originalHash, account.PasswordHash); Assert.True(account.IsActive); Assert.Equal(before.Id, account.PersonId);
        Assert.Equal(before.BranchId, (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{before.Id}"))!.BranchId);
    }

    [PostgresFact]
    public async Task StateEndpointRejectsAnonymousViewOnlyForeignBranchAndMissingPerson()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global); var person = await PersonAsync(global, a.Id);
        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await ExpectAsync(await StateAsync(anonymous, person.Id, false), HttpStatusCode.Unauthorized);
        using var viewer = await PersonViewerAsync((a.Id, "PERSON_VIEW"));
        await ExpectAsync(await StateAsync(viewer, person.Id, false), HttpStatusCode.Forbidden);
        var admin = await AccountAsync(b.Id, root.UserId); using var foreign = admin.Client;
        await ExpectAsync(await StateAsync(foreign, person.Id, false), HttpStatusCode.NotFound);
        await ExpectAsync(await StateAsync(global, Guid.NewGuid(), false), HttpStatusCode.NotFound);
        var own = await AccountAsync(a.Id, root.UserId); using var authorized = own.Client;
        await ExpectAsync(await StateAsync(authorized, person.Id, false), HttpStatusCode.NoContent);
        await ExpectAsync(await StateAsync(authorized, person.Id, true), HttpStatusCode.NoContent);
    }

    [PostgresFact]
    public async Task ActiveLinkedGlobalAccountBlocksDeactivationAndRemainsUsable()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branch = await BranchAsync(global); var created = await PersonAsync(global, branch.Id);
        var person = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        await CreateAccountAsync(global, person.Id, new GrantReference(TestCatalog.GlobalRoleId, null));
        await ExpectAsync(await StateAsync(global, person.Id, false), HttpStatusCode.Conflict);
        var after = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(person, after with { Documents = person.Documents });
        await ExpectAsync(await global.GetAsync("/api/v1/auth/session"), HttpStatusCode.OK);
    }

    [PostgresFact]
    public async Task SqlRevocationDenialForInactiveGlobalAccountReturnsForbiddenAndRollsBackState()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branch = await BranchAsync(global); var created = await PersonAsync(global, branch.Id);
        var person = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        var user = await CreateAccountAsync(global, person.Id, new GrantReference(TestCatalog.GlobalRoleId, null));
        // API intentionally forbids disabling global accounts. Model a legacy inactive global link
        // only in the guarded isolated test fixture, without changing the production Identity rule.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var account = (await manager.FindByIdAsync(user.Id.ToString()))!;
            account.IsActive = false; Assert.True((await manager.UpdateAsync(account)).Succeeded);
        }
        var admin = await AccountAsync(branch.Id, root.UserId); using var restricted = admin.Client;
        // Existing helper denies revoking ANY linked global account from branch scope, even inactive.
        // This happens after the person UPDATE and must abort its transaction rather than return 503.
        await ExpectAsync(await StateAsync(restricted, person.Id, false), HttpStatusCode.Forbidden);
        var after = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(person, after with { Documents = person.Documents });
        Assert.Equal(person.Documents, after.Documents);
    }

    [PostgresFact]
    public async Task OpenAssignmentsBlockDeactivationForParticipantAndResponsibleAndFinalizedAssignmentsArePreserved()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id);
        var responsible = await PersonAsync(client, branch.Id); var process = await ProcessAsync(client);
        var assignment = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        assignment = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"))!;
        foreach (var id in new[] { person.Id, responsible.Id })
        {
            await ExpectAsync(await StateAsync(client, id, false), HttpStatusCode.Conflict);
            Assert.True((await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{id}"))!.IsActive);
        }
        Assert.Equal(assignment, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"));
        var finished = await WriteAsync(client, $"/api/v1/process-assignments/{assignment.Id}/state", new ChangeAssignmentStateRequest("WITHDRAWN"), true);
        await ExpectAsync(finished, HttpStatusCode.OK);
        var final = await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}");
        await ExpectAsync(await StateAsync(client, person.Id, false), HttpStatusCode.NoContent);
        await ExpectAsync(await StateAsync(client, responsible.Id, false), HttpStatusCode.NoContent);
        Assert.Equal(final, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"));
    }

    [PostgresFact]
    public async Task InactivePeopleCannotBeAssignedOrSelectedAsNewResponsible()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var inactive = await PersonAsync(client, branch.Id);
        var a = await PersonAsync(client, branch.Id); var b = await PersonAsync(client, branch.Id); var process = await ProcessAsync(client);
        await ExpectAsync(await StateAsync(client, inactive.Id, false), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments", new AssignProcessRequest(inactive.Id, process.Id, a.Id, branch.Id)), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments", new AssignProcessRequest(a.Id, process.Id, inactive.Id, branch.Id)), HttpStatusCode.Conflict);
        var assignment = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(a.Id, process.Id, b.Id, branch.Id));
        assignment = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"))!;
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-assignments/{assignment.Id}/responsible", new { responsiblePersonId = inactive.Id }, true), HttpStatusCode.Conflict);
        Assert.Equal(assignment, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"));
    }

    [PostgresFact]
    public async Task ConcurrentStateChangesAreIdempotentAndCannotRaceAnOpenAssignment()
    {
        var root = await AccountAsync(); using var first = root.Client;
        var other = await AccountAsync(); using var second = other.Client;
        var branch = await BranchAsync(first); var person = await PersonAsync(first, branch.Id); var responsible = await PersonAsync(first, branch.Id);
        var process = await ProcessAsync(first);
        var outcomes = await Task.WhenAll(StateAsync(first, person.Id, false), WriteAsync(second, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id)));
        Assert.True(outcomes[0].StatusCode == HttpStatusCode.NoContent && outcomes[1].StatusCode == HttpStatusCode.Conflict ||
            outcomes[0].StatusCode == HttpStatusCode.Conflict && outcomes[1].StatusCode == HttpStatusCode.Created);
        var clean = await PersonAsync(first, branch.Id);
        var repeated = await Task.WhenAll(StateAsync(first, clean.Id, false), StateAsync(second, clean.Id, false));
        foreach (var response in repeated) await ExpectAsync(response, HttpStatusCode.NoContent);
        var disabled = (await first.GetFromJsonAsync<PersonDto>($"/api/v1/people/{clean.Id}"))!;
        await ExpectAsync(await StateAsync(first, clean.Id, false), HttpStatusCode.NoContent);
        Assert.Equal(disabled.UpdatedAt, (await first.GetFromJsonAsync<PersonDto>($"/api/v1/people/{clean.Id}"))!.UpdatedAt);
        foreach (var response in outcomes.Concat(repeated)) response.Dispose();
    }

    private sealed class FailSessionRevocation : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("auth_app.revoke_person_sessions", StringComparison.Ordinal))
                throw new ApiException(409, "controlled_revocation_failure", "Controlled isolated test failure.");
            return ValueTask.FromResult(result);
        }
    }

    [PostgresFact]
    public async Task RevocationFailureRollsBackStateAndVersionAndKeepsLinkedSessionValid()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branch = await BranchAsync(global); var created = await PersonAsync(global, branch.Id);
        var before = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        var user = await CreateAccountAsync(global, before.Id, new GrantReference(TestCatalog.OperatorRoleId, branch.Id));
        using var linked = await LoginAccountAsync(user);
        using var failing = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<MinistryDbContext>((_, options) => options.AddInterceptors(new FailSessionRevocation()))));
        using var client = failing.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await using var scope = factory.Services.CreateAsyncScope();
        var rootUser = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(root.UserId.ToString());
        await CsrfAsync(client); await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new { email = rootUser!.Email, password = Password }), HttpStatusCode.OK);
        await ExpectAsync(await StateAsync(client, before.Id, false), HttpStatusCode.Conflict);
        var after = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{before.Id}"))!;
        Assert.Equal(before, after with { Documents = before.Documents }); Assert.Equal(before.Documents, after.Documents);
        await ExpectAsync(await linked.GetAsync("/api/v1/auth/session"), HttpStatusCode.OK);
    }
}
