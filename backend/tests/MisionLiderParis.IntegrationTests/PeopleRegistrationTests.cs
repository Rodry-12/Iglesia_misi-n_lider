using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;
public sealed partial class PostgresMinistryTests
{
    private static CreatePersonRequest Registration(Guid branch, string? document = null, string? name = null) => new(
        new PersonRequest(name ?? "Ángela María", "Prueba de registro", "+57 001234", "registration@example.invalid",new DateOnly(1990,1,1)),
        branch,new DocumentRequest(" cc ", document ?? "000"+Guid.NewGuid().ToString("N"),"CO"));

    [PostgresFact]
    public async Task RegistrationOptionsUseCreatePermissionAndActiveBranchesWithoutViewPermissions()
    {
        var root=await AccountAsync();using var global=root.Client;
        var a=await BranchAsync(global);var b=await BranchAsync(global);var c=await BranchAsync(global);
        using var creator=await PersonViewerAsync((a.Id,"PERSON_CREATE"),(b.Id,"PERSON_VIEW"));
        var options=(await creator.GetFromJsonAsync<PersonRegistrationOptions>("/api/v1/people/registration-options"))!;
        Assert.Equal(a.Id,options.Branches.Single().Id);Assert.Contains("CO",options.Countries);
        await ExpectAsync(await creator.GetAsync($"/api/v1/branches/{a.Id}"),HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(creator,"/api/v1/people",Registration(b.Id)),HttpStatusCode.Forbidden);
        using var viewer=await PersonViewerAsync((b.Id,"PERSON_VIEW"));
        await ExpectAsync(await viewer.GetAsync("/api/v1/people/registration-options"),HttpStatusCode.Forbidden);
        await ExpectAsync(await WriteAsync(viewer,"/api/v1/people",Registration(b.Id)),HttpStatusCode.Forbidden);
        using var multi=await PersonViewerAsync((a.Id,"PERSON_CREATE"),(b.Id,"PERSON_CREATE"));
        var multiple=(await multi.GetFromJsonAsync<PersonRegistrationOptions>("/api/v1/people/registration-options"))!;
        Assert.Equal(2,multiple.Branches.Count);Assert.DoesNotContain(multiple.Branches,x=>x.Id==c.Id);
        await ExpectAsync(await WriteAsync(global,$"/api/v1/branches/{c.Id}/active",new ActiveRequest(false),true),HttpStatusCode.NoContent);
        var all=(await global.GetFromJsonAsync<PersonRegistrationOptions>("/api/v1/people/registration-options"))!;
        Assert.DoesNotContain(all.Branches,x=>x.Id==c.Id);
    }

    [PostgresFact]
    public async Task RegistrationCreatesCompleteActivePersonAndNoIdentityAccount()
    {
        var root=await AccountAsync();using var global=root.Client;var branch=await BranchAsync(global);
        using var creator=await PersonViewerAsync((branch.Id,"PERSON_CREATE"));
        var request=Registration(branch.Id);
        var response=await WriteAsync(creator,"/api/v1/people",request);
        await ExpectAsync(response,HttpStatusCode.Created);
        var person=(await response.Content.ReadFromJsonAsync<PersonDto>())!;
        Assert.NotEqual(Guid.Empty,person.Id);Assert.True(person.IsActive);Assert.True(person.HasDocuments);
        Assert.Equal(branch.Name,person.BranchName);Assert.NotNull(person.CreatedAt);Assert.NotNull(person.UpdatedAt);
        Assert.True(person.Documents.Single().IsCurrent);Assert.Equal("CC",person.Documents.Single().DocumentType);
        Assert.Equal(request.Document.DocumentNumber.ToUpperInvariant(),person.Documents.Single().DocumentNumber);
        var detail=(await global.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(request.Person.Phone,detail.Phone);Assert.Equal(request.Person.Email,detail.Email);Assert.Equal(request.Person.BirthDate,detail.BirthDate);
        await ExpectAsync(await creator.GetAsync($"/api/v1/people/{person.Id}"),HttpStatusCode.Forbidden);
        await using var scope=factory.Services.CreateAsyncScope();
        Assert.False(await scope.ServiceProvider.GetRequiredService<AuthDbContext>().Users.AnyAsync(u=>u.PersonId==person.Id));
        var page=(await global.GetFromJsonAsync<PeoplePage>($"/api/v1/people?search={person.Documents.Single().DocumentNumber}"))!;
        Assert.Equal(person.Id,page.Items.Single().Id);
    }

    [PostgresFact]
    public async Task InvalidRegistrationDoesNotPersistAnyPerson()
    {
        var root=await AccountAsync();using var client=root.Client;var branch=await BranchAsync(client);
        var valid=Registration(branch.Id);
        var requests=new object[]{
            valid with {Document=null!},valid with {Document=valid.Document with {DocumentNumber=" "}},
            valid with {Document=valid.Document with {IssuingCountry="X"}},valid with {Person=valid.Person with {FirstNames=" "}},
            valid with {Person=valid.Person with {Email="invalid"}},valid with {Person=valid.Person with {Phone=new string('1',31)}},
            valid with {Person=valid.Person with {BirthDate=DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1)}} };
        foreach(var request in requests) await ExpectAsync(await WriteAsync(client,"/api/v1/people",request),HttpStatusCode.BadRequest);
        var page=(await client.GetFromJsonAsync<PeoplePage>($"/api/v1/people?branchId={branch.Id}"))!;Assert.Empty(page.Items);
    }

    [PostgresFact]
    public async Task ForeignDuplicateRollsBackLateFailureAndMatchesVisibleDuplicateResponse()
    {
        var root=await AccountAsync();using var global=root.Client;var a=await BranchAsync(global);var b=await BranchAsync(global);
        var existing=await CreateAsync<PersonDto>(global,"/api/v1/people",Registration(a.Id));
        using var creator=await PersonViewerAsync((b.Id,"PERSON_CREATE"));
        var name="Rollback"+Guid.NewGuid().ToString("N");
        var request=Registration(b.Id,existing.Documents.Single().DocumentNumber,name);
        var own=await WriteAsync(global,"/api/v1/people",request);var foreign=await WriteAsync(creator,"/api/v1/people",request);
        await ExpectAsync(own,HttpStatusCode.Conflict);await ExpectAsync(foreign,HttpStatusCode.Conflict);
        var ownError=await own.Content.ReadFromJsonAsync<JsonElement>();var foreignError=await foreign.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(ownError.GetProperty("code").GetString(),foreignError.GetProperty("code").GetString());
        Assert.Equal(ownError.GetProperty("title").GetString(),foreignError.GetProperty("title").GetString());
        Assert.DoesNotContain(existing.Id.ToString(),await foreign.Content.ReadAsStringAsync());
        Assert.DoesNotContain(a.Name,await foreign.Content.ReadAsStringAsync());
        await using var admin=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));await admin.OpenAsync();
        await using var query=new NpgsqlCommand("SELECT count(*) FROM iglesia.persona WHERE nombres=@name",admin);query.Parameters.AddWithValue("name",name);
        Assert.Equal(0L,await query.ExecuteScalarAsync()); // Foreign row is hidden by RLS, so UNIQUE fails after persona/membership inserts.
    }

    [PostgresFact]
    public async Task ConcurrentRegistrationsInDifferentBranchesCreateExactlyOneCompletePerson()
    {
        var root=await AccountAsync();using var global=root.Client;var a=await BranchAsync(global);var b=await BranchAsync(global);
        using var first=await PersonViewerAsync((a.Id,"PERSON_CREATE"));using var second=await PersonViewerAsync((b.Id,"PERSON_CREATE"));
        var document="000"+Guid.NewGuid().ToString("N");
        var responses=await Task.WhenAll(WriteAsync(first,"/api/v1/people",Registration(a.Id,document)),WriteAsync(second,"/api/v1/people",Registration(b.Id,document)));
        Assert.Single(responses,r=>r.StatusCode==HttpStatusCode.Created);Assert.Single(responses,r=>r.StatusCode==HttpStatusCode.Conflict);
        await using var admin=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));await admin.OpenAsync();
        await using var query=new NpgsqlCommand("SELECT count(*) FROM iglesia.persona_documento d JOIN iglesia.persona p ON p.id=d.persona_id JOIN iglesia.persona_sede s ON s.persona_id=p.id AND s.fecha_fin IS NULL WHERE d.numero_documento=@number",admin);
        query.Parameters.AddWithValue("number",document.ToUpperInvariant());Assert.Equal(1L,await query.ExecuteScalarAsync());
        foreach(var response in responses) response.Dispose();
    }
}
