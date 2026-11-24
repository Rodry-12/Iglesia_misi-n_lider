using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task BranchAdministrationCrudValidationVersionsAndEmptyDeactivation()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var created = await BranchAsync(client);
        var read = (await client.GetFromJsonAsync<BranchDto>($"/api/v1/branches/{created.Id}"))!;
        Assert.Equal(created.UpdatedAt, read.UpdatedAt);
        var edit = new BranchRequest(created.Code, "Nombre actualizado", " Dirección ", " 123 ", created.UpdatedAt);
        var response = await WriteAsync(client, $"/api/v1/branches/{created.Id}", edit, true);
        await ExpectAsync(response, HttpStatusCode.OK);
        var updated = (await response.Content.ReadFromJsonAsync<BranchDto>())!;
        Assert.Equal("Dirección", updated.Address); Assert.Equal(created.Id, updated.Id);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{created.Id}", edit, true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{created.Id}", edit with { ExpectedUpdatedAt = null }, true), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(client, "/api/v1/branches", new BranchRequest(created.Code.ToLowerInvariant(), "Otro nombre", null, null)), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, "/api/v1/branches", new BranchRequest(" ", " ", null, null)), HttpStatusCode.BadRequest);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{created.Id}/active", new BranchActiveRequest(false, created.UpdatedAt), true), HttpStatusCode.Conflict);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{created.Id}/active", new BranchActiveRequest(false, updated.UpdatedAt), true), HttpStatusCode.NoContent);
        var inactive = (await client.GetFromJsonAsync<BranchDto>($"/api/v1/branches/{created.Id}"))!;
        Assert.False(inactive.IsActive);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{created.Id}/active", new BranchActiveRequest(true, inactive.UpdatedAt), true), HttpStatusCode.NoContent);
    }

    [PostgresFact]
    public async Task BranchDeactivationRejectsMembershipAssignmentsAndRetainedIdentityGrants()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); await PersonAsync(client, branch.Id);
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{branch.Id}/active", new BranchActiveRequest(false, branch.UpdatedAt), true), HttpStatusCode.Conflict);
        var other = await BranchAsync(client); var admin = await AccountAsync(other.Id, root.UserId); admin.Client.Dispose();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
            var user = await db.Users.SingleAsync(u => u.Id == admin.UserId); user.IsActive = false; await db.SaveChangesAsync();
        }
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{other.Id}/active", new BranchActiveRequest(false, other.UpdatedAt), true), HttpStatusCode.Conflict);
        var page = (await client.GetFromJsonAsync<Page<BranchAdministratorDto>>($"/api/v1/branches/{other.Id}/administrators"))!;
        Assert.Equal(admin.UserId, Assert.Single(page.Items).UserId); Assert.False(page.Items[0].IsActive);
    }

    [PostgresFact]
    public async Task BranchEditAndAdministratorsRejectNonGlobalActorsWithExplicitWritePermissions()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var foreign = await BranchAsync(client);
        foreach (var role in new[] { TestCatalog.BranchRoleId, TestCatalog.OperatorRoleId })
        {
            var email = $"branch-policy-{Guid.NewGuid():N}@example.invalid";
            await using var scope = factory.Services.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
            var ministry = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            var ids = await ministry.Permissions.Where(p => p.Code == "BRANCH_VIEW" || p.Code == "BRANCH_UPDATE").Select(p => p.Id).ToArrayAsync();
            var user = new ApplicationUser { Email = email, UserName = email, DisplayName = "Policy", EmailConfirmed = true,
                AccessGrants = [new() { RoleId = role, BranchId = branch.Id, Permissions = role == TestCatalog.OperatorRoleId ? ids.Select(id => new UserGrantPermission { PermissionId = id }).ToList() : [] }] };
            Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user, Password)).Succeeded);
            using var local = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
            await CsrfAsync(local); await ExpectAsync(await local.PostAsJsonAsync("/api/v1/auth/login", new { email, password = Password }), HttpStatusCode.OK);
            await ExpectAsync(await WriteAsync(local, $"/api/v1/branches/{branch.Id}", new BranchRequest(branch.Code, "Denied", null, null, branch.UpdatedAt), true), HttpStatusCode.Forbidden);
            await ExpectAsync(await WriteAsync(local, $"/api/v1/branches/{branch.Id}/active", new BranchActiveRequest(false, branch.UpdatedAt), true), HttpStatusCode.Forbidden);
            await ExpectAsync(await local.GetAsync($"/api/v1/branches/{branch.Id}/administrators"), HttpStatusCode.Forbidden);
            await ExpectAsync(await local.GetAsync($"/api/v1/branches/{foreign.Id}"), HttpStatusCode.Forbidden);
        }
    }

    private static async Task WaitForBranchLockAsync()
    {
        await using var connection = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));
        await connection.OpenAsync();
        for (var attempt = 0; attempt < 200; attempt++)
        {
            await using var command = new NpgsqlCommand("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%iglesia.sede%'", connection);
            if ((long)(await command.ExecuteScalarAsync())! > 0) return;
            await Task.Delay(25);
        }
        throw new TimeoutException("The competing branch operation did not acquire its expected lock wait.");
    }

    [PostgresFact]
    public async Task BranchInvitationWaitingOnDeactivationRevalidatesAndDoesNotCreateAnAccount()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        var email = $"waiting-{Guid.NewGuid():N}@example.invalid";
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var locked = await db.Branches.FromSqlInterpolated($"SELECT * FROM iglesia.sede WHERE id={branch.Id} FOR UPDATE").SingleAsync();
        var invite = WriteAsync(client, "/api/v1/users/invitations", new InviteUserRequest(email, "Waiting", null, [new(TestCatalog.OperatorRoleId, branch.Id)]));
        await WaitForBranchLockAsync();
        locked.IsActive = false; await db.SaveChangesAsync(); await transaction.CommitAsync();
        await ExpectAsync(await invite, HttpStatusCode.Forbidden);
        Assert.False(await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AnyAsync(u => u.Email == email));
    }

    [PostgresFact]
    public async Task BranchDeactivationWaitingOnCommittedGrantRejectsWithoutChangingState()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Branches.FromSqlInterpolated($"SELECT * FROM iglesia.sede WHERE id={branch.Id} FOR NO KEY UPDATE").LoadAsync();
        // Same lock/FK ordering as HU-012: the separate Identity connection can validate
        // its FK while the branch decision remains locked, then commits the grant first.
        var email = $"grant-first-{Guid.NewGuid():N}@example.invalid";
        var user = new ApplicationUser { Email = email, UserName = email, DisplayName = "Grant first",
            AccessGrants = [new() { RoleId = TestCatalog.OperatorRoleId, BranchId = branch.Id }] };
        Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user)).Succeeded);
        var deactivate = WriteAsync(client, $"/api/v1/branches/{branch.Id}/active", new BranchActiveRequest(false, branch.UpdatedAt), true);
        await WaitForBranchLockAsync(); await transaction.CommitAsync();
        await ExpectAsync(await deactivate, HttpStatusCode.Conflict);
        Assert.True((await client.GetFromJsonAsync<BranchDto>($"/api/v1/branches/{branch.Id}"))!.IsActive);
    }

    [PostgresFact]
    public async Task BranchGrantReplacementWaitingOnDeactivationPreservesOriginalGrants()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var original = await BranchAsync(client); var target = await BranchAsync(client);
        var recipient = await AccountAsync(original.Id, root.UserId, operatorRole: true); recipient.Client.Dispose();
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync();
        var locked = await db.Branches.FromSqlInterpolated($"SELECT * FROM iglesia.sede WHERE id={target.Id} FOR NO KEY UPDATE").SingleAsync();
        var replace = WriteAsync(client, $"/api/v1/users/{recipient.UserId}/grants", new ReplaceGrantsRequest([new(TestCatalog.OperatorRoleId, target.Id)]), true);
        await WaitForBranchLockAsync(); locked.IsActive = false; await db.SaveChangesAsync(); await transaction.CommitAsync();
        await ExpectAsync(await replace, HttpStatusCode.Forbidden);
        var grants = await scope.ServiceProvider.GetRequiredService<AuthDbContext>().AccessGrants.Where(g => g.UserId == recipient.UserId).ToListAsync();
        Assert.Equal(original.Id, Assert.Single(grants).BranchId);
    }

    [PostgresFact]
    public async Task BranchConcurrentEditsWithTheSameVersionHaveOnlyOneWinner()
    {
        var first = await AccountAsync(); using var a = first.Client;
        var second = await AccountAsync(); using var b = second.Client;
        var branch = await BranchAsync(a);
        var responses = await Task.WhenAll(
            WriteAsync(a, $"/api/v1/branches/{branch.Id}", new BranchRequest(branch.Code, "Primera edición", null, null, branch.UpdatedAt), true),
            WriteAsync(b, $"/api/v1/branches/{branch.Id}", new BranchRequest(branch.Code, "Segunda edición", null, null, branch.UpdatedAt), true));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
    }

    [PostgresFact]
    public async Task BranchOpenAssignmentsPreventDeactivationEvenWithoutCurrentMemberships()
    {
        var root = await AccountAsync(); using var client = root.Client; var branch = await BranchAsync(client);
        var participant = await PersonAsync(client, branch.Id); var responsible = await PersonAsync(client, branch.Id);
        var process = await ProcessAsync(client);
        await CreateAsync<AssignmentDto>(client, "/api/v1/process-assignments", new AssignProcessRequest(participant.Id, process.Id, responsible.Id, branch.Id));
        // Reproduce a historical dependency in the disposable fixture, without invoking
        // or changing transfer behavior. The assignment must independently block closure.
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
            var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            var memberships = await db.Memberships.Where(m => m.BranchId == branch.Id && m.EndedAt == null).ToListAsync();
            foreach (var membership in memberships) { membership.EndedAt = DateTimeOffset.UtcNow; membership.DepartureReason = "Isolated historical fixture"; }
            await db.SaveChangesAsync();
        }
        await ExpectAsync(await WriteAsync(client, $"/api/v1/branches/{branch.Id}/active", new BranchActiveRequest(false, branch.UpdatedAt), true), HttpStatusCode.Conflict);
        Assert.True((await client.GetFromJsonAsync<BranchDto>($"/api/v1/branches/{branch.Id}"))!.IsActive);
    }
}
