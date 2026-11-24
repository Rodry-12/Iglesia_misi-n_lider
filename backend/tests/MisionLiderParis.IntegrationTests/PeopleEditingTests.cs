using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MisionLiderParis.Application.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    private static PersonRequest Edit(PersonDto person, string name = "Ángela actualizada") =>
        new(name, "De la Cruz", "+57 000999", "updated@example.invalid", new DateOnly(1988, 2, 29), person.UpdatedAt);

    [PostgresFact]
    public async Task EditingPersistsOnlyPersonalFieldsAndPreservesIdentityDocumentsMembershipAndAccounts()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client);
        var created = await CreateAsync<PersonDto>(client, "/api/v1/people", Registration(branch.Id));
        var before = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        using var editor = await PersonViewerAsync((branch.Id, "PERSON_UPDATE"));
        // UPDATE does not grant VIEW. A command still returns only its authorized target.
        await ExpectAsync(await editor.GetAsync($"/api/v1/people/{before.Id}"), HttpStatusCode.Forbidden);
        var response = await WriteAsync(editor, $"/api/v1/people/{before.Id}", Edit(before), true);
        await ExpectAsync(response, HttpStatusCode.OK);
        var after = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{before.Id}"))!;
        Assert.Equal(before.Id, after.Id); Assert.Equal(before.BranchId, after.BranchId);
        Assert.Equal(before.IsActive, after.IsActive); Assert.Equal(before.CreatedAt, after.CreatedAt);
        Assert.Equal(before.Documents, after.Documents); Assert.True(after.UpdatedAt > before.UpdatedAt);
        Assert.Equal("Ángela actualizada", after.FirstNames); Assert.Equal("De la Cruz", after.LastNames);
        Assert.Equal("+57 000999", after.Phone); Assert.Equal("updated@example.invalid", after.Email);
        Assert.Equal(new DateOnly(1988, 2, 29), after.BirthDate);
        // Round-trip a microsecond-precise database timestamp; clearing optional fields is a full PUT.
        var cleared = Edit(after) with { Phone = null, Email = null, BirthDate = null };
        await ExpectAsync(await WriteAsync(editor, $"/api/v1/people/{before.Id}", cleared, true), HttpStatusCode.OK);
        var final = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{before.Id}"))!;
        Assert.Null(final.Phone); Assert.Null(final.Email); Assert.Null(final.BirthDate);
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));
        await admin.OpenAsync();
        await using var query = new NpgsqlCommand("SELECT (SELECT count(*) FROM iglesia.persona_sede WHERE persona_id=@id), (SELECT count(*) FROM iglesia.persona_documento WHERE persona_id=@id), (SELECT count(*) FROM auth_app.users WHERE person_id=@id)", admin);
        query.Parameters.AddWithValue("id", before.Id);
        await using var reader = await query.ExecuteReaderAsync(); await reader.ReadAsync();
        Assert.Equal(1L, reader.GetInt64(0)); Assert.Equal(1L, reader.GetInt64(1)); Assert.Equal(0L, reader.GetInt64(2));
    }

    [PostgresFact]
    public async Task EditingRejectsAnonymousViewOnlyForeignBranchAndInvalidInputsWithoutChangingData()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var a = await BranchAsync(client); var b = await BranchAsync(client);
        var created = await CreateAsync<PersonDto>(client, "/api/v1/people", Registration(a.Id));
        var person = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        using var anonymous = factory.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        await ExpectAsync(await WriteAsync(anonymous, $"/api/v1/people/{person.Id}", Edit(person), true), HttpStatusCode.Unauthorized);
        using var viewer = await PersonViewerAsync((a.Id, "PERSON_VIEW"));
        await ExpectAsync(await WriteAsync(viewer, $"/api/v1/people/{person.Id}", Edit(person), true), HttpStatusCode.Forbidden);
        using var other = await PersonViewerAsync((b.Id, "PERSON_UPDATE"));
        await ExpectAsync(await WriteAsync(other, $"/api/v1/people/{person.Id}", Edit(person), true), HttpStatusCode.NotFound);
        var invalid = new[] { Edit(person) with { FirstNames = " " }, Edit(person) with { LastNames = "" },
            Edit(person) with { Email = "bad" }, Edit(person) with { Phone = new string('x', 31) },
            Edit(person) with { BirthDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1) } };
        foreach (var request in invalid)
            await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}", request, true), HttpStatusCode.BadRequest);
        var after = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(person, after with { Documents = person.Documents });
    }

    [PostgresFact]
    public async Task TwoEditorsUsingSamePersistedVersionCannotSilentlyOverwriteEachOther()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client);
        var created = await CreateAsync<PersonDto>(client, "/api/v1/people", Registration(branch.Id));
        var person = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        using var first = await PersonViewerAsync((branch.Id, "PERSON_UPDATE"));
        using var second = await PersonViewerAsync((branch.Id, "PERSON_UPDATE"));
        var responses = await Task.WhenAll(
            WriteAsync(first, $"/api/v1/people/{person.Id}", Edit(person, "Primera edición"), true),
            WriteAsync(second, $"/api/v1/people/{person.Id}", Edit(person, "Segunda edición"), true));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        var conflict = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        var error = await conflict.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("concurrent_update", error.GetProperty("code").GetString());
        var persisted = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        var winner = await responses.Single(r => r.StatusCode == HttpStatusCode.OK).Content.ReadFromJsonAsync<PersonDto>();
        Assert.Equal(winner!.FirstNames, persisted.FirstNames);
        // Stale retry is rejected too, not only simultaneous writes.
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}", Edit(person), true), HttpStatusCode.Conflict);
        foreach (var response in responses) response.Dispose();
    }

    [PostgresFact]
    public async Task EditingIgnoresForgedStateBranchDocumentsAndTechnicalFieldsAndPreservesLegacyMissingDocument()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client); var other = await BranchAsync(client);
        var created = await CreateAsync<PersonDto>(client, "/api/v1/people", Registration(branch.Id));
        var person = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{created.Id}"))!;
        var forged = new { firstNames = "Actualizada", lastNames = "Prueba", phone = (string?)null, email = (string?)null,
            birthDate = (string?)null, expectedUpdatedAt = person.UpdatedAt, id = Guid.NewGuid(), branchId = other.Id,
            isActive = false, createdAt = "2000-01-01T00:00:00Z", updatedAt = "2000-01-01T00:00:00Z",
            documents = Array.Empty<object>() };
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}", forged, true), HttpStatusCode.OK);
        var after = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Equal(person.BranchId, after.BranchId); Assert.True(after.IsActive);
        Assert.Equal(person.CreatedAt, after.CreatedAt); Assert.Equal(person.Documents, after.Documents);
        // Model a legacy document-less row exclusively in the guarded isolated fixture database.
        await using var admin = new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));
        await admin.OpenAsync();
        await using var remove = new NpgsqlCommand("DELETE FROM iglesia.persona_documento WHERE persona_id=@id", admin);
        remove.Parameters.AddWithValue("id", person.Id); await remove.ExecuteNonQueryAsync();
        await ExpectAsync(await WriteAsync(client, $"/api/v1/people/{person.Id}", Edit(after), true), HttpStatusCode.OK);
        var legacy = (await client.GetFromJsonAsync<PersonDto>($"/api/v1/people/{person.Id}"))!;
        Assert.Empty(legacy.Documents); Assert.Equal(person.Id, legacy.Id);
    }
}
