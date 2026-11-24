using System.Net;
using System.Net.Http.Json;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task AssignOnlyOptionsAreMinimalScopedSearchableAndDoNotGrantDirectoryOrCatalogReads()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global); var c = await BranchAsync(global);
        var person = await PersonAsync(global, a.Id); var second = await PersonAsync(global, b.Id); var hidden = await PersonAsync(global, c.Id);
        var process = await ProcessAsync(global);
        using var assign = await PersonViewerAsync((a.Id, "PROCESS_ASSIGN"), (b.Id, "PROCESS_ASSIGN"));
        var options = (await assign.GetFromJsonAsync<AssignmentSelectionOptions>("/api/v1/process-assignments/selection-options"))!;
        Assert.Contains(options.Processes, p => p.Id == process.Id); Assert.Equal("PENDING", options.InitialState.Code); Assert.False(options.InitialState.IsFinal);
        foreach (var path in new[] { "/api/v1/people", "/api/v1/processes", "/api/v1/process-categories", "/api/v1/process-assignments" })
            await ExpectAsync(await assign.GetAsync(path), HttpStatusCode.Forbidden);
        var page = (await assign.GetFromJsonAsync<Page<AssignmentPersonOption>>("/api/v1/process-assignments/people-options"))!;
        using var cacheResponse = await assign.GetAsync("/api/v1/process-assignments/people-options");
        Assert.True(cacheResponse.Headers.CacheControl!.NoStore);
        Assert.Contains(page.Items, p => p.Id == person.Id); Assert.Contains(page.Items, p => p.Id == second.Id); Assert.DoesNotContain(page.Items, p => p.Id == hidden.Id);
        foreach (var term in new[] { person.FirstNames, person.LastNames, person.Documents.Single().DocumentNumber })
        {
            var result = (await assign.GetFromJsonAsync<Page<AssignmentPersonOption>>("/api/v1/process-assignments/people-options?search=" + Uri.EscapeDataString(term)))!;
            Assert.Contains(result.Items, p => p.Id == person.Id);
        }
        await ExpectAsync(await assign.GetAsync($"/api/v1/process-assignments/people-options?branchId={c.Id}"), HttpStatusCode.Forbidden);
        var excluded = (await assign.GetFromJsonAsync<Page<AssignmentPersonOption>>($"/api/v1/process-assignments/people-options?branchId={a.Id}&excludePersonId={person.Id}"))!;
        Assert.Empty(excluded.Items);
        using var viewer = await PersonViewerAsync((a.Id, "PROCESS_VIEW"));
        await ExpectAsync(await viewer.GetAsync("/api/v1/process-assignments/selection-options"), HttpStatusCode.Forbidden);
        await ExpectAsync(await viewer.GetAsync("/api/v1/process-assignments/people-options"), HttpStatusCode.Forbidden);
        var responsible = await PersonAsync(global, b.Id);
        var created = await CreateAsync<AssignmentDto>(assign, "/api/v1/process-assignments", new AssignProcessRequest(second.Id, process.Id, responsible.Id, b.Id));
        Assert.Equal(b.Id, created.BranchId); Assert.Null(created.StartedAt); Assert.Null(created.FinishedAt);
        // ASSIGN confirms the POST receipt; it deliberately does not grant general GET access.
        await ExpectAsync(await assign.GetAsync($"/api/v1/process-assignments/{created.Id}"), HttpStatusCode.Forbidden);
    }

    [PostgresFact]
    public async Task AssignmentRejectsMissingDocumentsInactiveOrUnlinkedPeopleAndForgedReferencesAtomically()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global);
        var person = await PersonAsync(global, a.Id); var responsible = await PersonAsync(global, a.Id); var foreign = await PersonAsync(global, b.Id);
        var process = await ProcessAsync(global); using var assign = await PersonViewerAsync((a.Id, "PROCESS_ASSIGN"));
        var request = new AssignProcessRequest(person.Id, process.Id, responsible.Id, a.Id);
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        async Task Execute(string sql, Guid id)
        { await using var command = new NpgsqlCommand(sql, admin); command.Parameters.AddWithValue("id", id); await command.ExecuteNonQueryAsync(); }
        foreach (var id in new[] { person.Id, responsible.Id })
        {
            await Execute("UPDATE iglesia.persona_documento SET vigente=false,fecha_finalizacion=now() WHERE persona_id=@id", id);
            await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request), HttpStatusCode.Conflict);
            var options = (await assign.GetFromJsonAsync<Page<AssignmentPersonOption>>("/api/v1/process-assignments/people-options"))!;
            Assert.DoesNotContain(options.Items, p => p.Id == id);
            await Execute("UPDATE iglesia.persona_documento SET vigente=true,fecha_finalizacion=NULL WHERE persona_id=@id", id);
            await Execute("UPDATE iglesia.persona SET activa=false WHERE id=@id", id);
            await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request), HttpStatusCode.Conflict);
            await Execute("UPDATE iglesia.persona SET activa=true WHERE id=@id", id);
            await Execute("UPDATE iglesia.persona_sede SET fecha_fin=now() WHERE persona_id=@id", id);
            await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request), HttpStatusCode.Conflict);
            await Execute("UPDATE iglesia.persona_sede SET fecha_fin=NULL WHERE persona_id=@id", id);
        }
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { BranchId = b.Id }), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { PersonId = foreign.Id }), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { PersonId = Guid.NewGuid() }), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { ResponsiblePersonId = foreign.Id }), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { ResponsiblePersonId = Guid.Empty }), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { ResponsiblePersonId = person.Id }), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request with { ProcessId = Guid.NewGuid() }), HttpStatusCode.NotFound);
        var before = (await global.GetFromJsonAsync<Page<AssignmentDto>>($"/api/v1/process-assignments?personId={person.Id}"))!;
        Assert.Empty(before.Items);
        var unchanged = (await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(person.Id, unchanged.Id); Assert.Equal(person.BranchId, unchanged.BranchId); Assert.Equal(person.UpdatedAt, unchanged.UpdatedAt);
        var created = await CreateAsync<AssignmentDto>(assign, "/api/v1/process-assignments", request);
        Assert.Equal("PENDING", created.StateCode);
        await ExpectAsync(await WriteAsync(assign, "/api/v1/process-assignments", request), HttpStatusCode.Conflict);
        var otherProcess = await ProcessAsync(global);
        await CreateAsync<AssignmentDto>(assign, "/api/v1/process-assignments", request with { ProcessId = otherProcess.Id });
        var final = (await global.GetFromJsonAsync<Page<AssignmentDto>>($"/api/v1/process-assignments?personId={person.Id}"))!;
        Assert.Equal(2, final.TotalCount);
    }
}
