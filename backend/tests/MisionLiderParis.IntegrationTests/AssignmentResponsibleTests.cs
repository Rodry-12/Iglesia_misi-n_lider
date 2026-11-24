using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task ResponsibleSelectionAndWriteRequireSpecificBranchPermissionAndPreserveAssignment()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var other = await BranchAsync(client);
        var person = await PersonAsync(client, branch.Id); var current = await PersonAsync(client, branch.Id);
        var candidate = await PersonAsync(client, branch.Id); var foreign = await PersonAsync(client, other.Id);
        var process = await ProcessAsync(client);
        var created = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, current.Id, branch.Id));
        var url = $"/api/v1/process-assignments/{created.Id}";
        var before = (await client.GetFromJsonAsync<AssignmentDto>(url))!;
        foreach (var permission in new[] {"PROCESS_VIEW", "PROCESS_ASSIGN"})
        {
            using var insufficient = await PersonViewerAsync((branch.Id, permission));
            await ExpectAsync(await insufficient.GetAsync(url + "/responsible-options"), HttpStatusCode.Forbidden);
            await ExpectAsync(await WriteAsync(insufficient, url + "/responsible", new ChangeResponsibleRequest(candidate.Id, current.Id), true), HttpStatusCode.Forbidden);
        }
        using var changer = await PersonViewerAsync((branch.Id, "PROCESS_CHANGE_RESPONSIBLE"));
        await ExpectAsync(await changer.GetAsync(url), HttpStatusCode.Forbidden);
        await ExpectAsync(await changer.GetAsync("/api/v1/process-assignments/people-options"), HttpStatusCode.Forbidden);
        var options = (await changer.GetFromJsonAsync<Page<AssignmentPersonOption>>(url + "/responsible-options?pageSize=1"))!;
        Assert.Equal(candidate.Id, Assert.Single(options.Items).Id); Assert.Equal(1, options.TotalCount);
        await ExpectAsync(await changer.GetAsync(url + "/responsible-options?page=0"), HttpStatusCode.BadRequest);
        var noMatch = (await changer.GetFromJsonAsync<Page<AssignmentPersonOption>>(url + "/responsible-options?search=no-such-person"))!;
        Assert.Empty(noMatch.Items);
        using var foreignChanger = await PersonViewerAsync((other.Id, "PROCESS_CHANGE_RESPONSIBLE"));
        await ExpectAsync(await foreignChanger.GetAsync(url + "/responsible-options"), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(foreignChanger, url + "/responsible", new ChangeResponsibleRequest(candidate.Id, current.Id), true), HttpStatusCode.NotFound);
        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost"), HandleCookies = false});
        await ExpectAsync(await anonymous.GetAsync(url + "/responsible-options"), HttpStatusCode.Unauthorized);
        foreach (var invalid in new[] {Guid.Empty, person.Id})
            await ExpectAsync(await WriteAsync(changer, url + "/responsible", new ChangeResponsibleRequest(invalid, current.Id), true), HttpStatusCode.BadRequest);
        foreach (var invalid in new[] {Guid.NewGuid(), foreign.Id})
            await ExpectAsync(await WriteAsync(changer, url + "/responsible", new ChangeResponsibleRequest(invalid, current.Id), true), HttpStatusCode.Conflict);
        var result = await WriteAsync(changer, url + "/responsible", new {responsiblePersonId = candidate.Id, expectedResponsiblePersonId = current.Id,
            branchId = other.Id, stateCode = "COMPLETED", personId = foreign.Id, finishedAt = DateTimeOffset.UtcNow}, true);
        await ExpectAsync(result, HttpStatusCode.OK);
        var changed = (await result.Content.ReadFromJsonAsync<AssignmentDto>())!;
        Assert.Null(changed.PersonName); Assert.Null(changed.DocumentNumber);
        var after = (await client.GetFromJsonAsync<AssignmentDto>(url))!;
        Assert.Equal(before with {ResponsiblePersonId = after.ResponsiblePersonId, ResponsibleName = after.ResponsibleName}, after);
        Assert.Equal(candidate.Id, after.ResponsiblePersonId); Assert.Equal(after.AssignedAt, changed.AssignedAt);
        var list = (await client.GetFromJsonAsync<AssignmentPage>($"/api/v1/process-assignments?personId={person.Id}"))!;
        Assert.Equal(candidate.Id, Assert.Single(list.Items).ResponsiblePersonId);
    }

    [PostgresFact]
    public async Task ResponsibleEligibilityIsRevalidatedAtWriteAndTerminalAssignmentsCannotChange()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        var person = await PersonAsync(client, branch.Id); var current = await PersonAsync(client, branch.Id);
        var candidate = await PersonAsync(client, branch.Id); var process = await ProcessAsync(client);
        var created = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, current.Id, branch.Id));
        var url = $"/api/v1/process-assignments/{created.Id}";
        var before = (await client.GetFromJsonAsync<AssignmentDto>(url))!;
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        async Task Mutate(string sql)
        {await using var cmd = new NpgsqlCommand(sql, admin); cmd.Parameters.AddWithValue("id", candidate.Id); await cmd.ExecuteNonQueryAsync();}
        foreach (var sql in new[] {"UPDATE iglesia.persona SET activa=false WHERE id=@id",
            "UPDATE iglesia.persona SET activa=true WHERE id=@id; UPDATE iglesia.persona_sede SET fecha_fin=now() WHERE persona_id=@id",
            "UPDATE iglesia.persona_sede SET fecha_fin=NULL WHERE persona_id=@id; DELETE FROM iglesia.persona_documento WHERE persona_id=@id"})
        {
            await Mutate(sql);
            var page = (await client.GetFromJsonAsync<Page<AssignmentPersonOption>>(url + "/responsible-options"))!;
            Assert.DoesNotContain(page.Items, p => p.Id == candidate.Id);
            await ExpectAsync(await WriteAsync(client, url + "/responsible", new ChangeResponsibleRequest(candidate.Id, current.Id), true), HttpStatusCode.Conflict);
            Assert.Equal(before, await client.GetFromJsonAsync<AssignmentDto>(url));
        }
        await ExpectAsync(await WriteAsync(client, url + "/state", new ChangeAssignmentStateRequest("WITHDRAWN"), true), HttpStatusCode.OK);
        await ExpectAsync(await client.GetAsync(url + "/responsible-options"), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, url + "/responsible", new ChangeResponsibleRequest(current.Id, current.Id), true), HttpStatusCode.Conflict);
    }

    [PostgresFact]
    public async Task ConcurrentResponsibleChangesRejectStaleExpectedResponsibleWithoutLostUpdate()
    {
        var root = await AccountAsync(); using var first = root.Client; var another = await AccountAsync(); using var second = another.Client;
        var branch = await BranchAsync(first); var person = await PersonAsync(first, branch.Id); var current = await PersonAsync(first, branch.Id);
        var next = await PersonAsync(first, branch.Id); var alternative = await PersonAsync(first, branch.Id); var process = await ProcessAsync(first);
        var created = await CreateAsync<AssignmentDto>(first, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, current.Id, branch.Id));
        var url = $"/api/v1/process-assignments/{created.Id}/responsible";
        await CsrfAsync(first); await CsrfAsync(second);
        var results = await Task.WhenAll(first.PutAsJsonAsync(url, new ChangeResponsibleRequest(next.Id, current.Id)),
            second.PutAsJsonAsync(url, new ChangeResponsibleRequest(alternative.Id, current.Id)));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.OK); Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        var after = (await first.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.Contains(after.ResponsiblePersonId, new[] {next.Id, alternative.Id}); Assert.Equal("PENDING", after.StateCode);
        await ExpectAsync(await WriteAsync(first, url, new ChangeResponsibleRequest(current.Id, current.Id), true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(first, url, new ChangeResponsibleRequest(after.ResponsiblePersonId, after.ResponsiblePersonId), true), HttpStatusCode.OK);
        foreach (var result in results) result.Dispose();
    }

    [PostgresFact]
    public async Task ResponsibleCommitFailureRollsBackActualDatabaseUpdate()
    {
        var root = await AccountAsync(); using var global = root.Client; var branch = await BranchAsync(global);
        var person = await PersonAsync(global, branch.Id); var current = await PersonAsync(global, branch.Id); var next = await PersonAsync(global, branch.Id); var process = await ProcessAsync(global);
        var created = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, current.Id, branch.Id));
        var url = $"/api/v1/process-assignments/{created.Id}"; var before = (await global.GetFromJsonAsync<AssignmentDto>(url))!;
        using var failing = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<MinistryDbContext>((_, options) => options.AddInterceptors(new FailAssignmentCommit()))));
        using var client = failing.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await using var scope = factory.Services.CreateAsyncScope(); var user = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(root.UserId.ToString());
        await CsrfAsync(client); await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new {email = user!.Email, password = Password}), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(client, url + "/responsible", new ChangeResponsibleRequest(next.Id, current.Id), true), HttpStatusCode.Conflict);
        Assert.Equal(before, await global.GetFromJsonAsync<AssignmentDto>(url));
    }
}
