using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task AssignmentQueriesProjectMinimumVisibleDataAndApplyAllFiltersWithoutExtraReadGrants()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global); var hiddenBranch = await BranchAsync(global);
        var person = await PersonAsync(global, a.Id); var responsible = await PersonAsync(global, a.Id);
        var notYetResponsible = await PersonAsync(global, a.Id);
        var second = await PersonAsync(global, b.Id); var otherResponsible = await PersonAsync(global, b.Id);
        var hidden = await PersonAsync(global, hiddenBranch.Id); var hiddenResponsible = await PersonAsync(global, hiddenBranch.Id);
        var process = await ProcessAsync(global); var otherProcess = await ProcessAsync(global); var secretProcess = await ProcessAsync(global);
        var one = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, a.Id));
        var two = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, otherProcess.Id, responsible.Id, a.Id));
        var three = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(second.Id, process.Id, otherResponsible.Id, b.Id));
        var foreign = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(hidden.Id, secretProcess.Id, hiddenResponsible.Id, hiddenBranch.Id));
        using var viewer = await PersonViewerAsync((a.Id, "PROCESS_VIEW"), (b.Id, "PROCESS_VIEW"));
        var result = (await viewer.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments?includeFilters=true"))!;
        Assert.Equal(3, result.TotalCount); Assert.Equal(3, result.Items.Count); Assert.DoesNotContain(result.Items, x => x.Id == foreign.Id);
        var participants = (await viewer.GetFromJsonAsync<AssignmentParticipantPage>("/api/v1/process-assignments/participants?includeFilters=true"))!;
        Assert.Equal(2, participants.TotalCount);
        Assert.Equal(2, participants.Items.Select(p => p.PersonId).Distinct().Count());
        Assert.DoesNotContain(participants.Items, p => p.PersonId == hidden.Id);
        Assert.Equal(a.Id, Assert.Single(participants.Items.Single(p => p.PersonId == person.Id).Branches).Id);
        Assert.NotNull(participants.Filters);
        var firstPerson = (await viewer.GetFromJsonAsync<AssignmentParticipantPage>("/api/v1/process-assignments/participants?pageSize=1"))!;
        var nextPerson = (await viewer.GetFromJsonAsync<AssignmentParticipantPage>("/api/v1/process-assignments/participants?pageSize=1&page=2"))!;
        Assert.Equal(2, nextPerson.TotalCount);
        Assert.NotEqual(Assert.Single(firstPerson.Items).PersonId, Assert.Single(nextPerson.Items).PersonId);
        Assert.Equal(person.Id, Assert.Single((await viewer.GetFromJsonAsync<AssignmentParticipantPage>($"/api/v1/process-assignments/participants?processId={otherProcess.Id}"))!.Items).PersonId);
        Assert.Empty((await viewer.GetFromJsonAsync<AssignmentParticipantPage>($"/api/v1/process-assignments/participants?processId={otherProcess.Id}&responsiblePersonId={otherResponsible.Id}"))!.Items);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/process-assignments/participants?branchId={hiddenBranch.Id}"), HttpStatusCode.Forbidden);
        var dto = result.Items.Single(x => x.Id == one.Id);
        Assert.Equal(person.FirstNames + " " + person.LastNames, dto.PersonName); Assert.Equal(person.Documents.Single().DocumentNumber, dto.DocumentNumber);
        Assert.Equal(process.Name, dto.ProcessName); Assert.Equal(process.CategoryId, dto.CategoryId); Assert.NotNull(dto.CategoryName);
        Assert.Equal(responsible.FirstNames + " " + responsible.LastNames, dto.ResponsibleName); Assert.Equal(a.Name, dto.BranchName); Assert.NotNull(dto.StateName);
        Assert.Null(dto.StartedAt); Assert.Null(dto.FinishedAt);
        Assert.Equal(dto, await viewer.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{one.Id}"));
        var filters = result.Filters!; Assert.Equal(2, filters.Branches.Count);
        Assert.DoesNotContain(filters.Branches, x => x.Id == hiddenBranch.Id);
        // Active catalogs are global; person/assignment data remains scoped to authorized branches.
        Assert.Contains(filters.Processes, x => x.Id == secretProcess.Id);
        Assert.Contains(filters.Categories, x => x.Id == secretProcess.CategoryId);
        Assert.DoesNotContain(filters.ResponsiblePeople, x => x.Id == hiddenResponsible.Id);
        Assert.Contains(filters.ResponsiblePeople, x => x.Id == person.Id); // A participant can also teach another process.
        Assert.Contains(filters.ResponsiblePeople, x => x.Id == notYetResponsible.Id);
        Assert.Contains(filters.States, x => x.Code == "PENDING");
        foreach (var path in new[] {"/api/v1/people", "/api/v1/process-categories"}) await ExpectAsync(await viewer.GetAsync(path), HttpStatusCode.Forbidden);
        foreach (var (filter, count) in new[] {($"branchId={a.Id}", 2), ($"processId={otherProcess.Id}", 1), ($"categoryId={otherProcess.CategoryId}", 1),
            ($"responsiblePersonId={otherResponsible.Id}", 1), ($"personId={person.Id}", 2), ("stateCode=PENDING", 3), ("stateCode=COMPLETED", 0),
            ("search=" + Uri.EscapeDataString(person.LastNames), 2), ("search=" + person.Documents.Single().DocumentNumber, 2)})
            Assert.Equal(count, (await viewer.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments?" + filter))!.TotalCount);
        var pageOne = (await viewer.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments?page=1&pageSize=2"))!;
        var pageTwo = (await viewer.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments?page=2&pageSize=2"))!;
        Assert.Equal(2, pageOne.Items.Count); Assert.Single(pageTwo.Items); Assert.Equal(3, pageTwo.TotalCount);
        Assert.Empty(pageOne.Items.Select(x => x.Id).Intersect(pageTwo.Items.Select(x => x.Id)));
        await ExpectAsync(await viewer.GetAsync($"/api/v1/process-assignments?branchId={hiddenBranch.Id}"), HttpStatusCode.Forbidden);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/process-assignments/{foreign.Id}"), HttpStatusCode.NotFound);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/process-assignments/{Guid.NewGuid()}"), HttpStatusCode.NotFound);
        await ExpectAsync(await viewer.GetAsync("/api/v1/process-assignments?stateCode=FORGED"), HttpStatusCode.BadRequest);
        await ExpectAsync(await viewer.GetAsync("/api/v1/process-assignments?search=" + new string('x', 151)), HttpStatusCode.BadRequest);
        using var assignOnly = await PersonViewerAsync((a.Id, "PROCESS_ASSIGN"));
        await ExpectAsync(await assignOnly.GetAsync("/api/v1/process-assignments/participants"), HttpStatusCode.Forbidden);
        await ExpectAsync(await assignOnly.GetAsync("/api/v1/process-assignments?includeFilters=true"), HttpStatusCode.Forbidden);
        using var anonymous = factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost"), HandleCookies = false});
        await ExpectAsync(await anonymous.GetAsync("/api/v1/process-assignments"), HttpStatusCode.Unauthorized);
        Assert.Equal(dto, await viewer.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{one.Id}"));
    }

    [PostgresFact]
    public async Task AssignmentReadPreservesHistoricalRowsButDoesNotExposePersonHiddenByRlsOrInventLegacyDocuments()
    {
        var root = await AccountAsync(); using var global = root.Client; var a = await BranchAsync(global); var b = await BranchAsync(global);
        var person = await PersonAsync(global, a.Id); var responsible = await PersonAsync(global, a.Id); var process = await ProcessAsync(global);
        var created = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, a.Id));
        await ExpectAsync(await WriteAsync(global, $"/api/v1/process-assignments/{created.Id}/state", new ChangeAssignmentStateRequest("WITHDRAWN"), true), HttpStatusCode.OK);
        await ExpectAsync(await WriteAsync(global, $"/api/v1/people/{person.Id}/transfer", new TransferPersonRequest(b.Id, "Isolated visibility test")), HttpStatusCode.NoContent);
        using var origin = await PersonViewerAsync((a.Id, "PROCESS_VIEW"));
        var retained = (await origin.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.Null(retained.PersonName); Assert.Null(retained.DocumentNumber); Assert.Equal(a.Id, retained.BranchId);
        var groupedHistorical = Assert.Single((await origin.GetFromJsonAsync<AssignmentParticipantPage>("/api/v1/process-assignments/participants"))!.Items);
        Assert.Equal(person.Id, groupedHistorical.PersonId); Assert.Null(groupedHistorical.PersonName); Assert.Null(groupedHistorical.DocumentNumber);
        Assert.Equal("WITHDRAWN", retained.StateCode); Assert.Null(retained.StartedAt); Assert.NotNull(retained.FinishedAt);
        Assert.Single((await origin.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments"))!.Items);
        Assert.Empty((await origin.GetFromJsonAsync<AssignmentPage>("/api/v1/process-assignments?search=" + person.Documents.Single().DocumentNumber))!.Items);
        // Legacy document loss does not erase an assignment and does not substitute a past document.
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
        await using var command = new NpgsqlCommand("UPDATE iglesia.persona_documento SET vigente=false,fecha_finalizacion=now() WHERE persona_id=@id", admin);
        command.Parameters.AddWithValue("id", person.Id); await command.ExecuteNonQueryAsync();
        var legacy = (await global.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{created.Id}"))!;
        Assert.NotNull(legacy.PersonName); Assert.Null(legacy.DocumentNumber); Assert.Null(legacy.DocumentType);
    }

    private sealed class AssignmentReadCounter : DbCommandInterceptor
    {
        public int Reads;
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData data,
            InterceptionResult<DbDataReader> result, CancellationToken ct = default)
        { Interlocked.Increment(ref Reads); return ValueTask.FromResult(result); }
    }

    [PostgresFact]
    public async Task AssignmentProjectionUsesConstantRoundTripsForOneOrSeveralRows()
    {
        var root = await AccountAsync(); using var global = root.Client; var branch = await BranchAsync(global);
        var responsible = await PersonAsync(global, branch.Id); var process = await ProcessAsync(global);
        for (var i = 0; i < 3; i++) {var person = await PersonAsync(global, branch.Id); await CreateAsync<AssignmentDto>(global,
            "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));}
        var counter = new AssignmentReadCounter();
        using var counted = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.ConfigureDbContext<MinistryDbContext>((_, options) => options.AddInterceptors(counter))));
        using var client = counted.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress = new Uri("https://localhost")});
        await using var scope = factory.Services.CreateAsyncScope();
        var user = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(root.UserId.ToString());
        await CsrfAsync(client); await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login", new {email = user!.Email, password = Password}), HttpStatusCode.OK);
        counter.Reads = 0; var small = (await client.GetFromJsonAsync<AssignmentPage>($"/api/v1/process-assignments?branchId={branch.Id}&pageSize=1"))!;
        var firstCount = counter.Reads;
        counter.Reads = 0; var large = (await client.GetFromJsonAsync<AssignmentPage>($"/api/v1/process-assignments?branchId={branch.Id}&pageSize=3"))!;
        Assert.Single(small.Items); Assert.Equal(3, large.Items.Count); Assert.All(large.Items, x => Assert.NotNull(x.PersonName));
        Assert.Equal(firstCount, counter.Reads);
    }
}
