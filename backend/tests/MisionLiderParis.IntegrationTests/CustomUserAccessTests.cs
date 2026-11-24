using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task CustomUserAccessListsAndUpdatesOnlyDelegableAccountsInItsAuthorizedBranch()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global);
        var own = await CreateAccountAsync(global, null, new GrantReference(TestCatalog.OperatorRoleId, a.Id));
        var foreign = await CreateAccountAsync(global, null, new GrantReference(TestCatalog.OperatorRoleId, b.Id));
        var administrator = await CreateAccountAsync(global, null, new GrantReference(TestCatalog.BranchRoleId, a.Id));
        var mixed = await CreateAccountAsync(global, null, new(TestCatalog.OperatorRoleId, a.Id), new(TestCatalog.OperatorRoleId, b.Id));
        using var custom = await PersonViewerAsync((a.Id, "USER_VIEW"), (a.Id, "USER_UPDATE"), (b.Id, "PERSON_VIEW"));
        var options = (await custom.GetFromJsonAsync<UserAdministrationOptions>("/api/v1/users/administration-options?operation=USER_VIEW"))!;
        Assert.Equal(a.Id, Assert.Single(options.Branches).Id);
        var page = (await custom.GetFromJsonAsync<Page<UserDto>>("/api/v1/users"))!;
        Assert.Contains(page.Items, u => u.Id == own.Id);
        Assert.DoesNotContain(page.Items, u => new[] { foreign.Id, administrator.Id, root.UserId, mixed.Id }.Contains(u.Id));
        await ExpectAsync(await custom.GetAsync($"/api/v1/users?branchId={b.Id}"), HttpStatusCode.Forbidden);
        foreach (var id in new[] { foreign.Id, administrator.Id, root.UserId, mixed.Id })
        {
            await ExpectAsync(await custom.GetAsync($"/api/v1/users/{id}"), HttpStatusCode.NotFound);
            await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{id}", new UpdateUserRequest("Denied", null), true), HttpStatusCode.NotFound);
        }
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}", new UpdateUserRequest("Updated by custom access", null), true), HttpStatusCode.OK);
        Assert.Equal("Updated by custom access", (await global.GetFromJsonAsync<UserDto>($"/api/v1/users/{own.Id}"))!.DisplayName);
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/revoke-sessions", new {}), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/active", new { isActive = false }, true), HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/grants", new ReplaceGrantsRequest([new(TestCatalog.OperatorRoleId, a.Id)]), true), HttpStatusCode.Forbidden);
    }

    [PostgresFact]
    public async Task CustomUserAccessCanCreateAssignStatusAndRevokeWithoutEscalation()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var a = await BranchAsync(global); var b = await BranchAsync(global);
        using var custom = await PersonViewerAsync((a.Id, "USER_VIEW"), (a.Id, "USER_CREATE"),
            (a.Id, "USER_ASSIGN_ROLE"), (a.Id, "USER_CHANGE_STATUS"), (a.Id, "PERSON_VIEW"));
        Guid viewId; Guid createId;
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            viewId = await db.Permissions.Where(p => p.Code == "PERSON_VIEW").Select(p => p.Id).SingleAsync();
            createId = await db.Permissions.Where(p => p.Code == "PERSON_CREATE").Select(p => p.Id).SingleAsync();
        }
        var own = await CreateAccountAsync(custom, null, new GrantReference(TestCatalog.OperatorRoleId, a.Id, [viewId]));
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/grants", new ReplaceGrantsRequest([new(TestCatalog.OperatorRoleId, a.Id, [viewId])]), true), HttpStatusCode.NoContent);
        foreach (var grant in new GrantReference[] {
            new(TestCatalog.GlobalRoleId, null), new(TestCatalog.BranchRoleId, a.Id),
            new(TestCatalog.OperatorRoleId, b.Id), new(TestCatalog.OperatorRoleId, a.Id, [createId]) })
        {
            await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/grants", new ReplaceGrantsRequest([grant]), true), HttpStatusCode.Forbidden);
            await ExpectAsync(await WriteAsync(custom, "/api/v1/users", new CreateUserRequest(
                $"denied-{Guid.NewGuid():N}@example.invalid", Password, "Denied", null, [grant])), HttpStatusCode.Forbidden);
        }
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/revoke-sessions", new {}), HttpStatusCode.NoContent);
        await ExpectAsync(await WriteAsync(custom, $"/api/v1/users/{own.Id}/active", new { isActive = false }, true), HttpStatusCode.NoContent);
        Assert.False((await global.GetFromJsonAsync<UserDto>($"/api/v1/users/{own.Id}"))!.IsActive);
    }
}
