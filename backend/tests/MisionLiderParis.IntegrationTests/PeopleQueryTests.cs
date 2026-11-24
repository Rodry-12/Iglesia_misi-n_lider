using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    private async Task<HttpClient> PersonViewerAsync(params (Guid Branch, string Permission)[] grants)
    {
        await using var scope=factory.Services.CreateAsyncScope();
        var db=scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        var permissionIds=await db.Permissions.Where(p=>grants.Select(g=>g.Permission).Contains(p.Code)).ToDictionaryAsync(p=>p.Code,p=>p.Id);
        var email=$"viewer-{Guid.NewGuid():N}@example.invalid";
        var user=new ApplicationUser {Email=email,UserName=email,DisplayName="Person viewer",EmailConfirmed=true,
            AccessGrants=grants.GroupBy(g=>g.Branch).Select(g=>new UserAccessGrant {RoleId=TestCatalog.OperatorRoleId,BranchId=g.Key,
                Permissions=g.Select(x=>new UserGrantPermission {PermissionId=permissionIds[x.Permission]}).ToList()}).ToList()};
        Assert.True((await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(user,Password)).Succeeded);
        var client=factory.CreateClient(new WebApplicationFactoryClientOptions {BaseAddress=new Uri("https://localhost"),AllowAutoRedirect=false});
        await CsrfAsync(client);
        await ExpectAsync(await client.PostAsJsonAsync("/api/v1/auth/login",new {email,password=Password}),HttpStatusCode.OK);
        return client;
    }

    [PostgresFact]
    public async Task PeopleQueriesExposeOnlyPersonViewBranchesWithoutBranchViewPermission()
    {
        var root=await AccountAsync(); using var global=root.Client;
        var a=await BranchAsync(global); var b=await BranchAsync(global); var c=await BranchAsync(global);
        var own=await PersonAsync(global,a.Id); var other=await PersonAsync(global,b.Id);
        using var viewer=await PersonViewerAsync((a.Id,"PERSON_VIEW"),(b.Id,"PROCESS_VIEW"));
        await ExpectAsync(await viewer.GetAsync($"/api/v1/branches/{a.Id}"),HttpStatusCode.Forbidden);
        using var response=await viewer.GetAsync("/api/v1/people");
        Assert.True(response.Headers.CacheControl?.NoStore);
        var page=(await response.Content.ReadFromJsonAsync<PeoplePage>())!;
        Assert.Equal(new[]{a.Id},page.Branches.Select(x=>x.Id));
        Assert.Equal(a.Name,page.Items.Single().BranchName);
        var detail=(await viewer.GetFromJsonAsync<PersonDto>($"/api/v1/people/{own.Id}"))!;
        Assert.Equal(a.Name,detail.BranchName); Assert.True(detail.HasDocuments);
        Assert.NotNull(detail.CreatedAt); Assert.NotNull(detail.UpdatedAt);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/people?branchId={b.Id}"),HttpStatusCode.Forbidden);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/people/{other.Id}"),HttpStatusCode.NotFound);
        await ExpectAsync(await viewer.GetAsync($"/api/v1/people/{Guid.NewGuid()}"),HttpStatusCode.NotFound);
        using var multi=await PersonViewerAsync((a.Id,"PERSON_VIEW"),(b.Id,"PERSON_VIEW"));
        var multiple=(await multi.GetFromJsonAsync<PeoplePage>("/api/v1/people"))!;
        Assert.Equal(2,multiple.TotalCount); Assert.Equal(2,multiple.Branches.Count);
        Assert.DoesNotContain(multiple.Branches,x=>x.Id==c.Id);
        var filtered=(await multi.GetFromJsonAsync<PeoplePage>($"/api/v1/people?branchId={b.Id}"))!;
        Assert.Equal(other.Id,filtered.Items.Single().Id);
        Assert.Equal(2,filtered.Branches.Count); // Options are not restricted by current filter/page.
    }

    [PostgresFact]
    public async Task PeopleSearchPaginationAndActivityUseExistingServerContract()
    {
        var root=await AccountAsync(); using var global=root.Client; var branch=await BranchAsync(global);
        var first=await PersonAsync(global,branch.Id); var second=await PersonAsync(global,branch.Id);
        var name="Nombre"+Guid.NewGuid().ToString("N"); var surname="Apellido"+Guid.NewGuid().ToString("N");
        await ExpectAsync(await WriteAsync(global,$"/api/v1/people/{first.Id}",new PersonRequest(name,surname,null,null,new DateOnly(1990,1,1)),true),HttpStatusCode.OK);
        using var viewer=await PersonViewerAsync((branch.Id,"PERSON_VIEW"));
        foreach(var search in new[]{name,surname,first.Documents.Single().DocumentNumber})
        {
            var result=(await viewer.GetFromJsonAsync<PeoplePage>($"/api/v1/people?search={Uri.EscapeDataString(search.ToLowerInvariant())}"))!;
            Assert.Equal(first.Id,result.Items.Single().Id);
        }
        var page1=(await viewer.GetFromJsonAsync<PeoplePage>("/api/v1/people?page=1&pageSize=1"))!;
        var page2=(await viewer.GetFromJsonAsync<PeoplePage>("/api/v1/people?page=2&pageSize=1"))!;
        Assert.Equal(2,page1.TotalCount); Assert.Equal(2,page2.PageNumber);
        Assert.NotEqual(page1.Items.Single().Id,page2.Items.Single().Id);
        await ExpectAsync(await WriteAsync(global,$"/api/v1/people/{second.Id}/active",new ActiveRequest(false),true),HttpStatusCode.NoContent);
        var inactive=(await viewer.GetFromJsonAsync<PeoplePage>("/api/v1/people?isActive=false"))!;
        Assert.Equal(second.Id,inactive.Items.Single().Id);
        Assert.Equal(new DateOnly(1990,1,1),(await viewer.GetFromJsonAsync<PersonDto>($"/api/v1/people/{first.Id}"))!.BirthDate);
    }

    [PostgresFact]
    public async Task LegacyMissingAndExpiredDocumentsRemainDistinctWithoutCreatingData()
    {
        var root=await AccountAsync();using var global=root.Client;var branch=await BranchAsync(global);
        var missing=await PersonAsync(global,branch.Id);var expired=await PersonAsync(global,branch.Id);
        await using(var admin=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")))
        {
            await admin.OpenAsync();
            await using var command=new NpgsqlCommand("DELETE FROM iglesia.persona_documento WHERE persona_id=@missing; UPDATE iglesia.persona_documento SET vigente=false,fecha_finalizacion=now() WHERE persona_id=@expired",admin);
            command.Parameters.AddWithValue("missing",missing.Id);command.Parameters.AddWithValue("expired",expired.Id);
            await command.ExecuteNonQueryAsync();
        }
        using var viewer=await PersonViewerAsync((branch.Id,"PERSON_VIEW"));
        var page=(await viewer.GetFromJsonAsync<PeoplePage>("/api/v1/people"))!;
        Assert.False(page.Items.Single(p=>p.Id==missing.Id).HasDocuments);
        Assert.True(page.Items.Single(p=>p.Id==expired.Id).HasDocuments);
        Assert.All(page.Items,p=>Assert.Empty(p.Documents));
        var detail=(await viewer.GetFromJsonAsync<PersonDto>($"/api/v1/people/{expired.Id}"))!;
        Assert.False(detail.Documents.Single().IsCurrent);
        Assert.Empty((await viewer.GetFromJsonAsync<PersonDto>($"/api/v1/people/{missing.Id}"))!.Documents);
    }
}
