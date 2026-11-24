using System.Net.Http.Json;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task BranchSearchIgnoresAccentsCaseAndUnicodeCompositionBeforePagination()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var marker = Guid.NewGuid().ToString("N")[..10];
        var name = "Misión Líder París " + marker;
        var first = await CreateAsync<BranchDto>(client, "/api/v1/branches",
            new BranchRequest("A" + marker, name, null, null));
        var second = await CreateAsync<BranchDto>(client, "/api/v1/branches",
            new BranchRequest("B" + marker, "Misio\u0301n Li\u0301der Pari\u0301s " + marker, null, null));
        foreach (var search in new[] { "paris ", "PARÍS ", "pari\u0301s ", "  mision lider paris " })
        {
            var page = (await client.GetFromJsonAsync<Page<BranchDto>>(
                "/api/v1/branches?pageSize=1&search=" + Uri.EscapeDataString(search + marker)))!;
            Assert.Equal(2, page.TotalCount);
            Assert.Single(page.Items);
            Assert.Contains(page.Items[0].Id, new[] { first.Id, second.Id });
        }
        var read = (await client.GetFromJsonAsync<BranchDto>($"/api/v1/branches/{first.Id}"))!;
        Assert.Equal(name, read.Name); // Search never rewrites the stored name.
    }

    [PostgresFact]
    public async Task BranchSearchPreservesScopeStateAndLiteralCharacters()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var marker = Guid.NewGuid().ToString("N")[..9];
        var own = await CreateAsync<BranchDto>(client, "/api/v1/branches",
            new BranchRequest("Á" + marker, "Peña Ünica %_ " + marker, null, null));
        var foreign = await CreateAsync<BranchDto>(client, "/api/v1/branches",
            new BranchRequest("B" + marker, "Peña Ünica %_ " + marker, null, null));
        var local = await AccountAsync(own.Id, root.UserId); using var viewer = local.Client;
        var query = "/api/v1/branches?search=" + Uri.EscapeDataString("pena unica %_ " + marker);
        var visible = (await viewer.GetFromJsonAsync<Page<BranchDto>>(query))!;
        Assert.Equal(own.Id, Assert.Single(visible.Items).Id);
        Assert.Equal(1, visible.TotalCount);
        var inactive = (await viewer.GetFromJsonAsync<Page<BranchDto>>(query + "&isActive=false"))!;
        Assert.Empty(inactive.Items);
        Assert.Equal(0, inactive.TotalCount);
        var code = (await viewer.GetFromJsonAsync<Page<BranchDto>>(
            "/api/v1/branches?search=a" + marker))!;
        Assert.Equal(own.Id, Assert.Single(code.Items).Id);
        var wildcard = (await client.GetFromJsonAsync<Page<BranchDto>>(
            "/api/v1/branches?search=" + Uri.EscapeDataString("%_not-present-" + marker)))!;
        Assert.Empty(wildcard.Items);
        Assert.NotEqual(own.Id, foreign.Id);
    }
}
