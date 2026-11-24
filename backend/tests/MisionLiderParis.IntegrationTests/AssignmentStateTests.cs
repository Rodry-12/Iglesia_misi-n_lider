using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task AssignmentStateOptionsAndWritesRequireEffectiveChangePermissionWithoutGrantingDetailRead()
    {
        var root = await AccountAsync(); using var global = root.Client; var branch = await BranchAsync(global); var foreignBranch = await BranchAsync(global);
        var person = await PersonAsync(global, branch.Id); var responsible = await PersonAsync(global, branch.Id); var process = await ProcessAsync(global);
        var created = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        var baseline = (await global.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        using var viewer = await PersonViewerAsync((branch.Id, "PROCESS_VIEW"));
        await ExpectAsync(await viewer.GetAsync($"/api/v1/process-assignments/states?assignmentId={created.Id}"), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(viewer, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.Forbidden);
        using var changer = await PersonViewerAsync((branch.Id, "PROCESS_CHANGE_STATUS"));
        await ExpectAsync(await changer.GetAsync($"/api/v1/process-assignments/{created.Id}"), HttpStatusCode.Forbidden);
        await ExpectAsync(await changer.GetAsync("/api/v1/process-assignments/states"), HttpStatusCode.Forbidden);
        var options = (await changer.GetFromJsonAsync<StateDto[]>($"/api/v1/process-assignments/states?assignmentId={created.Id}"))!;
        Assert.Equal(new[] {"IN_PROGRESS", "WITHDRAWN"}, options.Select(s => s.Code).Order().ToArray());
        Assert.True(options.Single(s => s.Code == "WITHDRAWN").IsFinal);
        await ExpectAsync(await WriteAsync(changer, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("COMPLETED"), true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(changer, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("FORGED"), true), HttpStatusCode.BadRequest);
        using var foreign = await PersonViewerAsync((foreignBranch.Id, "PROCESS_CHANGE_STATUS"));
        await ExpectAsync(await foreign.GetAsync($"/api/v1/process-assignments/states?assignmentId={created.Id}"), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(foreign, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.NotFound);
        await ExpectAsync(await changer.GetAsync($"/api/v1/process-assignments/states?assignmentId={Guid.NewGuid()}"), HttpStatusCode.NotFound);
        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost"), HandleCookies = false});
        await ExpectAsync(await anonymous.GetAsync($"/api/v1/process-assignments/states?assignmentId={created.Id}"), HttpStatusCode.Unauthorized);
        var changedResponse = await WriteAsync(changer, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("IN_PROGRESS"), true);
        await ExpectAsync(changedResponse, HttpStatusCode.OK);
        var changed = (await changedResponse.Content.ReadFromJsonAsync<AssignmentDto>())!;
        Assert.Null(changed.PersonName); Assert.Null(changed.DocumentNumber);
        var current = (await global.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.Equal(current.StartedAt, changed.StartedAt); Assert.Equal(current.AssignedAt, changed.AssignedAt);
        Assert.Equal(baseline.AssignedAt, current.AssignedAt); Assert.NotNull(current.StartedAt); Assert.Null(current.FinishedAt);
    }

    [PostgresFact]
    public async Task AssignmentStateTransitionsDatesTerminalRulesAndInactivePeopleKeepExistingSemantics()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        var person = await PersonAsync(client, branch.Id); var responsible = await PersonAsync(client, branch.Id); var process = await ProcessAsync(client);
        var created = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        var url = $"/api/v1/process-assignments/{created.Id}/state";
        foreach (var state in new[] {"IN_PROGRESS", "SUSPENDED", "IN_PROGRESS"})
        {
            var before = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
            await ExpectAsync(await WriteAsync(client, url, new ChangeAssignmentStateRequest(state), true), HttpStatusCode.OK);
            var after = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
            Assert.Equal(before.Id, after.Id); Assert.Equal(before.PersonId, after.PersonId); Assert.Equal(before.ResponsiblePersonId, after.ResponsiblePersonId);
            Assert.Equal(before.BranchId, after.BranchId); Assert.Equal(before.ProcessId, after.ProcessId); Assert.Equal(before.AssignedAt, after.AssignedAt);
            if (before.StartedAt is not null) Assert.Equal(before.StartedAt, after.StartedAt);
            Assert.Null(after.FinishedAt);
        }
        var permitted = (await client.GetFromJsonAsync<StateDto[]>($"/api/v1/process-assignments/states?assignmentId={created.Id}"))!;
        Assert.Equal(new[] {"COMPLETED", "SUSPENDED", "WITHDRAWN"}, permitted.Select(s => s.Code).Order().ToArray());
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        async Task<DateTime> Version()
        {await using var version = new NpgsqlCommand("SELECT fecha_actualizacion FROM iglesia.persona_proceso WHERE id=@id", admin); version.Parameters.AddWithValue("id", created.Id); return (DateTime)(await version.ExecuteScalarAsync())!;}
        var versionBeforeRepeat = await Version();
        await ExpectAsync(await WriteAsync(client, url, new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.OK);
        Assert.Equal(versionBeforeRepeat, await Version());
        await using (var inactive = new NpgsqlCommand("UPDATE iglesia.persona SET activa=false WHERE id=@person OR id=@responsible", admin))
        {inactive.Parameters.AddWithValue("person", person.Id); inactive.Parameters.AddWithValue("responsible", responsible.Id); await inactive.ExecuteNonQueryAsync();}
        await ExpectAsync(await WriteAsync(client, url, new ChangeAssignmentStateRequest("SUSPENDED"), true), HttpStatusCode.Conflict);
        Assert.Equal(versionBeforeRepeat, await Version());
        // Existing policy permits terminal closure even if a participant/responsible is inactive.
        await ExpectAsync(await WriteAsync(client, url, new {stateCode = "COMPLETED", finishedAt = "1900-01-01T00:00:00Z"}, true), HttpStatusCode.OK);
        var completed = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.NotNull(completed.FinishedAt); Assert.True(completed.FinishedAt >= completed.StartedAt); Assert.True(completed.StartedAt >= completed.AssignedAt);
        Assert.Empty((await client.GetFromJsonAsync<StateDto[]>($"/api/v1/process-assignments/states?assignmentId={created.Id}"))!);
        var terminalVersion = await Version();
        await ExpectAsync(await WriteAsync(client, url, new ChangeAssignmentStateRequest("COMPLETED"), true), HttpStatusCode.OK);
        Assert.Equal(terminalVersion, await Version());
        Assert.Equal(completed, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"));
        await ExpectAsync(await WriteAsync(client, url, new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.Conflict);
    }

    [PostgresFact]
    public async Task ConcurrentAssignmentStateChangesSerializeWithoutReopeningOrCorruptingDates()
    {
        var root = await AccountAsync(); using var first = root.Client; var other = await AccountAsync(); using var second = other.Client;
        var branch = await BranchAsync(first); var person = await PersonAsync(first, branch.Id); var responsible = await PersonAsync(first, branch.Id); var process = await ProcessAsync(first);
        var created = await CreateAsync<AssignmentDto>(first, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        await CsrfAsync(first); await CsrfAsync(second); var url = $"/api/v1/process-assignments/{created.Id}/state";
        var responses = await Task.WhenAll(first.PutAsJsonAsync(url, new ChangeAssignmentStateRequest("IN_PROGRESS")), second.PutAsJsonAsync(url, new ChangeAssignmentStateRequest("WITHDRAWN")));
        Assert.Equal(HttpStatusCode.OK, responses[1].StatusCode); Assert.Contains(responses[0].StatusCode, new[] {HttpStatusCode.OK, HttpStatusCode.Conflict});
        var final = (await first.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.Equal("WITHDRAWN", final.StateCode); Assert.NotNull(final.FinishedAt); Assert.True(final.FinishedAt >= final.AssignedAt);
        if (final.StartedAt is not null) Assert.True(final.FinishedAt >= final.StartedAt);
        Assert.Equal(person.Id, final.PersonId); Assert.Equal(responsible.Id, final.ResponsiblePersonId); Assert.Equal(process.Id, final.ProcessId); Assert.Equal(branch.Id, final.BranchId);
        foreach (var response in responses) response.Dispose();
    }

    private sealed class FailAssignmentCommit : DbTransactionInterceptor
    {
        public override ValueTask<InterceptionResult> TransactionCommittingAsync(DbTransaction transaction, TransactionEventData data,
            InterceptionResult result, CancellationToken ct = default)
        {
            if (data.Context?.ChangeTracker.Entries<ProcessAssignment>().Any() == true)
                throw new ApiException(409, "controlled_assignment_commit_failure", "Controlled isolated commit failure.");
            return ValueTask.FromResult(result);
        }
    }

    [PostgresFact]
    public async Task AssignmentStateCommitFailureRollsBackPersistedStateAndDates()
    {
        var root = await AccountAsync(); using var global = root.Client; var branch = await BranchAsync(global);
        var person = await PersonAsync(global, branch.Id); var responsible = await PersonAsync(global, branch.Id); var process = await ProcessAsync(global);
        var created = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        var before = (await global.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        using var failing = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<MinistryDbContext>((_, options) => options.AddInterceptors(new FailAssignmentCommit()))));
        using var client = failing.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await using var scope = factory.Services.CreateAsyncScope(); var user = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(root.UserId.ToString());
        await CsrfAsync(client); await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new {email = user!.Email, password = Password}), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("IN_PROGRESS"), true), HttpStatusCode.Conflict);
        Assert.Equal(before, await global.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"));
    }
}
