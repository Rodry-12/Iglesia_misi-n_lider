using System.Net;
using System.Net.Http.Json;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task CatalogReadPermissionsAreIndependentAndBranchWriteCodesNeverGrantGlobalAdministration()
    {
        var root = await AccountAsync(); using var global = root.Client; var branch = await BranchAsync(global);
        using var categories = await PersonViewerAsync((branch.Id, "CATEGORY_VIEW"));
        await ExpectAsync(await categories.GetAsync("/api/v1/process-categories"), HttpStatusCode.OK);
        await ExpectAsync(await categories.GetAsync("/api/v1/processes"), HttpStatusCode.Forbidden);
        using var processes = await PersonViewerAsync((branch.Id, "PROCESS_VIEW"));
        await ExpectAsync(await processes.GetAsync("/api/v1/processes"), HttpStatusCode.OK);
        await ExpectAsync(await processes.GetAsync("/api/v1/process-categories"), HttpStatusCode.Forbidden);
        using var writer = await PersonViewerAsync((branch.Id, "CATEGORY_CREATE"), (branch.Id, "CATEGORY_UPDATE"), (branch.Id, "PROCESS_CREATE"), (branch.Id, "PROCESS_UPDATE"));
        var category = await CreateAsync<CategoryDto>(global, "/api/v1/process-categories", new CategoryRequest("Scope " + Guid.NewGuid(), null));
        var process = await CreateAsync<ProcessDto>(global, "/api/v1/processes", new ProcessRequest(category.Id, "Scope process", null));
        foreach (var request in new[] { ("/api/v1/process-categories", (object)new CategoryRequest("Denied " + Guid.NewGuid(), null)), ("/api/v1/processes", new ProcessRequest(category.Id, "Denied", null)) })
            await ExpectAsync(await WriteAsync(writer, request.Item1, request.Item2), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(writer, $"/api/v1/process-categories/{category.Id}", new CategoryRequest("Denied", null), true), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(writer, $"/api/v1/processes/{process.Id}", new ProcessRequest(category.Id, "Denied", null), true), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(writer, $"/api/v1/process-categories/{category.Id}/active", new ActiveRequest(false), true), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(writer, $"/api/v1/processes/{process.Id}/active", new ActiveRequest(false), true), HttpStatusCode.Forbidden);
        // Catalog access does not grant permission to assign anyone.
        await ExpectAsync(await WriteAsync(processes, "/api/v1/process-assignments", new AssignProcessRequest(Guid.NewGuid(), process.Id, Guid.NewGuid(), branch.Id)), HttpStatusCode.Forbidden);
    }

    [PostgresFact]
    public async Task CatalogLifecycleReturnsRealFieldsPreservesUuidAndAllowsSupportedCategoryMovesWithoutChangingAssignments()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var unique = "Cat " + Guid.NewGuid();
        var a = await CreateAsync<CategoryDto>(client, "/api/v1/process-categories", new CategoryRequest(" " + unique + " ", " Descripción real ", 7));
        Assert.Equal(unique, a.Name); Assert.Equal("Descripción real", a.Description); Assert.Equal(7, a.SortOrder);
        Assert.NotNull(a.CreatedAt); Assert.NotNull(a.UpdatedAt);
        Assert.Equal(a, await client.GetFromJsonAsync<CategoryDto>($"/api/v1/process-categories/{a.Id}"));
        var categoryResponse = await WriteAsync(client, $"/api/v1/process-categories/{a.Id}", new CategoryRequest(unique + " editada", null, 8), true);
        await ExpectAsync(categoryResponse, HttpStatusCode.OK); var edited = (await categoryResponse.Content.ReadFromJsonAsync<CategoryDto>())!;
        Assert.Equal(a.Id, edited.Id); Assert.Equal(a.CreatedAt, edited.CreatedAt); Assert.True(edited.UpdatedAt > a.UpdatedAt);
        var b = await CreateAsync<CategoryDto>(client, "/api/v1/process-categories", new CategoryRequest("Destino " + Guid.NewGuid(), null));
        var process = await CreateAsync<ProcessDto>(client, "/api/v1/processes", new ProcessRequest(a.Id, " Proceso real ", " Texto ", 3));
        Assert.Equal("Proceso real", process.Name); Assert.Equal(edited.Name, process.CategoryName); Assert.True(process.CategoryIsActive);
        Assert.NotNull(process.CreatedAt); Assert.NotNull(process.UpdatedAt);
        var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id); var responsible = await PersonAsync(client, branch.Id);
        var assignment = await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id));
        assignment = (await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"))!;
        var update = await WriteAsync(client, $"/api/v1/processes/{process.Id}", new ProcessRequest(b.Id, "Editado", "Descripción editada", 9), true);
        await ExpectAsync(update, HttpStatusCode.OK); var moved = (await update.Content.ReadFromJsonAsync<ProcessDto>())!;
        Assert.Equal(process.Id, moved.Id); Assert.Equal(process.CreatedAt, moved.CreatedAt); Assert.Equal(b.Id, moved.CategoryId); Assert.Equal(b.Name, moved.CategoryName);
        // Query DTO now projects the current catalog; immutable assignment references/dates remain unchanged.
        assignment = assignment with { ProcessName = moved.Name, CategoryId = moved.CategoryId, CategoryName = moved.CategoryName, ProcessDescription = moved.Description };
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-categories/{b.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        Assert.Equal(assignment, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"));
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}/active", new ActiveRequest(true), true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-categories/{b.Id}/active", new ActiveRequest(true), true), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}/active", new ActiveRequest(true), true), HttpStatusCode.NoContent);
        Assert.Equal(assignment, await client.GetFromJsonAsync<AssignmentDto>($"/api/v1/process-assignments/{assignment.Id}"));
    }

    [PostgresFact]
    public async Task CatalogRejectsInvalidDuplicateAndMissingOrInactiveCategoriesWithExistingHttpContracts()
    {
        var root = await AccountAsync(); using var client = root.Client; var name = "Unique " + Guid.NewGuid();
        var category = await CreateAsync<CategoryDto>(client, "/api/v1/process-categories", new CategoryRequest(name, null));
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-categories", new CategoryRequest(name, null)), HttpStatusCode.Conflict);
        foreach (var request in new[] { new CategoryRequest(" ", null), new CategoryRequest(new string('x', 151), null), new CategoryRequest("Bad", new string('x', 4001)), new CategoryRequest("Bad", null, -1) })
            await ExpectAsync(await WriteAsync(client, "/api/v1/process-categories", request), HttpStatusCode.BadRequest);
        var process = await CreateAsync<ProcessDto>(client, "/api/v1/processes", new ProcessRequest(category.Id, "Same", null));
        await ExpectAsync(await WriteAsync(client, "/api/v1/processes", new ProcessRequest(category.Id, "Same", null)), HttpStatusCode.Conflict);
        var second = await CreateAsync<CategoryDto>(client, "/api/v1/process-categories", new CategoryRequest("Second " + Guid.NewGuid(), null));
        await CreateAsync<ProcessDto>(client, "/api/v1/processes", new ProcessRequest(second.Id, "Same", null));
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}", new ProcessRequest(second.Id, "Same", null), true), HttpStatusCode.Conflict);
        Assert.Equal(category.Id, (await client.GetFromJsonAsync<ProcessDto>($"/api/v1/processes/{process.Id}"))!.CategoryId);
        await ExpectAsync(await WriteAsync(client, "/api/v1/processes", new ProcessRequest(Guid.NewGuid(), "Missing", null)), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(client, "/api/v1/processes", new ProcessRequest(Guid.Empty, "Empty", null)), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(client, "/api/v1/processes", new ProcessRequest(category.Id, " ", null)), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-categories/{second.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, "/api/v1/processes", new ProcessRequest(second.Id, "Inactive", null)), HttpStatusCode.NotFound);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}", new ProcessRequest(second.Id, "Inactive", null), true), HttpStatusCode.NotFound);
        await ExpectAsync(await client.GetAsync($"/api/v1/processes/{Guid.NewGuid()}"), HttpStatusCode.NotFound);
        await ExpectAsync(await client.DeleteAsync($"/api/v1/processes/{process.Id}"), HttpStatusCode.MethodNotAllowed);
    }

    [PostgresFact]
    public async Task InactiveCatalogIsExcludedFromAvailabilityAndCannotReceiveAssignmentsButRetainsItsOwnState()
    {
        var root = await AccountAsync(); using var client = root.Client; var process = await ProcessAsync(client);
        var branch = await BranchAsync(client); var person = await PersonAsync(client, branch.Id); var responsible = await PersonAsync(client, branch.Id);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-categories/{process.CategoryId}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        var active = (await client.GetFromJsonAsync<Page<ProcessDto>>($"/api/v1/processes?categoryId={process.CategoryId}&isActive=true"))!; Assert.Empty(active.Items);
        var retained = (await client.GetFromJsonAsync<ProcessDto>($"/api/v1/processes/{process.Id}"))!;
        Assert.True(retained.IsActive); Assert.False(retained.CategoryIsActive);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id)), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/process-categories/{process.CategoryId}/active", new ActiveRequest(true), true), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/processes/{process.Id}/active", new ActiveRequest(false), true), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(client, "/api/v1/process-assignments", new AssignProcessRequest(person.Id, process.Id, responsible.Id, branch.Id)), HttpStatusCode.Conflict);
    }

    [PostgresFact]
    public async Task CatalogPaginationSelectionSearchAndConcurrentUniquenessUseTheDatabase()
    {
        var root = await AccountAsync(); using var first = root.Client; var other = await AccountAsync(); using var second = other.Client;
        var name = "Concurrent " + Guid.NewGuid();
        var results = await Task.WhenAll(WriteAsync(first, "/api/v1/process-categories", new CategoryRequest(name, null)), WriteAsync(second, "/api/v1/process-categories", new CategoryRequest(name, null)));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.Created); Assert.Single(results, r => r.StatusCode == HttpStatusCode.Conflict);
        var category = (await results.Single(r => r.StatusCode == HttpStatusCode.Created).Content.ReadFromJsonAsync<CategoryDto>())!;
        var query = (await first.GetFromJsonAsync<Page<CategoryDto>>("/api/v1/process-categories?search=" + Uri.EscapeDataString(name)))!;
        Assert.Single(query.Items); Assert.Equal(category.Id, query.Items[0].Id);
        for (var i = 0; i < 3; i++) await CreateAsync<ProcessDto>(first, "/api/v1/processes", new ProcessRequest(category.Id, "Page " + i, null, i));
        var page = (await first.GetFromJsonAsync<Page<ProcessDto>>($"/api/v1/process-categories/{category.Id}/processes?page=2&pageSize=2&search=Page"))!;
        Assert.Equal(3, page.TotalCount); Assert.Single(page.Items); Assert.Equal("Page 2", page.Items[0].Name);
        foreach (var response in results) response.Dispose();
    }
}
