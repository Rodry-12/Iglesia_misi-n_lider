using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task TwoBranchAccountsRemainIsolatedWithForgedHttpContextAndUnfilteredSql()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branchA = await BranchAsync(global); var branchB = await BranchAsync(global);
        var personA = await PersonAsync(global, branchA.Id); var personB = await PersonAsync(global, branchB.Id);
        var responsibleA = await PersonAsync(global, branchA.Id); var responsibleB = await PersonAsync(global, branchB.Id);
        var process = await ProcessAsync(global);
        var assignmentA = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments",
            new AssignProcessRequest(personA.Id, process.Id, responsibleA.Id, branchA.Id));
        var assignmentB = await CreateAsync<AssignmentDto>(global, "/api/v1/process-assignments",
            new AssignProcessRequest(personB.Id, process.Id, responsibleB.Id, branchB.Id));
        var accountA = await AccountAsync(branchA.Id, root.UserId); using var clientA = accountA.Client;
        var accountB = await AccountAsync(branchB.Id, root.UserId); using var clientB = accountB.Client;

        foreach (var (client, actor, ownBranch, otherBranch, ownPerson, otherPerson, ownAssignment, otherAssignment) in new[] {
            (clientA, accountA.UserId, branchA.Id, branchB.Id, personA.Id, personB.Id, assignmentA.Id, assignmentB.Id),
            (clientB, accountB.UserId, branchB.Id, branchA.Id, personB.Id, personA.Id, assignmentB.Id, assignmentA.Id) })
        {
            await ExpectAsync(await client.GetAsync($"/api/v1/branches/{ownBranch}"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/branches/{otherBranch}"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/people/{ownPerson}"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/people/{otherPerson}"), HttpStatusCode.NotFound);
            await ExpectAsync(await client.GetAsync($"/api/v1/people?branchId={ownBranch}"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/people?branchId={otherBranch}"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/process-assignments/{ownAssignment}"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/process-assignments/{otherAssignment}"), HttpStatusCode.NotFound);
            await ExpectAsync(await client.GetAsync($"/api/v1/process-assignments?branchId={ownBranch}"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/process-assignments?branchId={otherBranch}"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/processes/{process.Id}/participants?branchId={otherBranch}"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{ownBranch}/summary"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{otherBranch}/summary"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{ownBranch}/summary.csv"), HttpStatusCode.OK);
            await ExpectAsync(await client.GetAsync($"/api/v1/reports/branches/{otherBranch}/summary.csv"), HttpStatusCode.Forbidden);
            client.DefaultRequestHeaders.Add("X-Actor-Id", root.UserId.ToString());
            client.DefaultRequestHeaders.Add("mlp.actor_id", root.UserId.ToString());
            await ExpectAsync(await client.GetAsync($"/api/v1/people?branchId={otherBranch}&actorId={root.UserId}"), HttpStatusCode.Forbidden);
            await ExpectAsync(await client.GetAsync($"/api/v1/people/{otherPerson}?branchId={ownBranch}"), HttpStatusCode.NotFound);

            await using var scope = factory.Services.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(actor);
            var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
            var visible = await db.People.Select(person => person.Id).ToArrayAsync();
            Assert.Contains(ownPerson, visible);
            Assert.DoesNotContain(otherPerson, visible);
            var assignments = await db.Assignments.Select(assignment => assignment.Id).ToArrayAsync();
            Assert.Contains(ownAssignment, assignments);
            Assert.DoesNotContain(otherAssignment, assignments);
        }
        using var forged = factory.CreateClient(new WebApplicationFactoryClientOptions {
            BaseAddress=new Uri("https://localhost"), AllowAutoRedirect=false, HandleCookies=false });
        forged.DefaultRequestHeaders.Add("Cookie", "__Host-mlp-session=forged-invalid-cookie");
        forged.DefaultRequestHeaders.Add("X-Actor-Id", root.UserId.ToString());
        await ExpectAsync(await forged.GetAsync($"/api/v1/people?actorId={root.UserId}"), HttpStatusCode.Unauthorized);
        for (var iteration=0; iteration<8; iteration++)
        {
            var responses=await Task.WhenAll(clientA.GetAsync($"/api/v1/people/{personA.Id}"),
                clientB.GetAsync($"/api/v1/people/{personB.Id}"),clientA.GetAsync($"/api/v1/people/{personB.Id}"),
                clientB.GetAsync($"/api/v1/people/{personA.Id}"));
            Assert.Equal(new[] {HttpStatusCode.OK,HttpStatusCode.OK,HttpStatusCode.NotFound,HttpStatusCode.NotFound},responses.Select(r=>r.StatusCode));
            foreach(var response in responses) response.Dispose();
        }
    }

    [PostgresFact]
    public async Task OperatorWithoutPermissionsIsDeniedByHttpWhileRlsOnlyEnforcesBranchScope()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branch = await BranchAsync(global); var person = await PersonAsync(global, branch.Id);
        var restricted = await AccountAsync(branch.Id, root.UserId, operatorRole: true);
        using var client = restricted.Client;
        await ExpectAsync(await client.GetAsync($"/api/v1/people?branchId={branch.Id}"), HttpStatusCode.Forbidden);
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(restricted.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        Assert.True(await db.People.AnyAsync(candidate => candidate.Id == person.Id));
    }

    [PostgresFact]
    public async Task DirectRuntimeSqlCannotAuthenticateAnyUnsignedActor()
    {
        var root = await AccountAsync(); using var global = root.Client;
        var branchA = await BranchAsync(global); var branchB = await BranchAsync(global);
        var personA = await PersonAsync(global, branchA.Id); var personB = await PersonAsync(global, branchB.Id);
        var restricted = await AccountAsync(branchA.Id, root.UserId); using var restrictedClient = restricted.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        async Task Actor(Guid actor)
        {
            await using var set = new NpgsqlCommand("SELECT set_config('mlp.actor_id', @actor, true)", connection, transaction);
            set.Parameters.AddWithValue("actor", actor.ToString());
            await set.ExecuteScalarAsync();
        }
        async Task<long> Count(Guid person)
        {
            await using var query = new NpgsqlCommand("SELECT count(*) FROM iglesia.persona WHERE id=@id", connection, transaction);
            query.Parameters.AddWithValue("id", person);
            return (long)(await query.ExecuteScalarAsync())!;
        }
        await Actor(restricted.UserId);
        Assert.Equal(0, await Count(personA.Id)); Assert.Equal(0, await Count(personB.Id));
        await Actor(root.UserId);
        Assert.Equal(0, await Count(personB.Id));
        await transaction.RollbackAsync();
    }
}
