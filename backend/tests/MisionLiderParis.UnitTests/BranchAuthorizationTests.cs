using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.UnitTests;

public sealed class BranchAuthorizationTests
{
    [Theory]
    [InlineData(RoleCodes.BranchAdmin, "create")]
    [InlineData(RoleCodes.BranchAdmin, "update")]
    [InlineData(RoleCodes.BranchAdmin, "active")]
    [InlineData(RoleCodes.Operator, "create")]
    [InlineData(RoleCodes.Operator, "update")]
    [InlineData(RoleCodes.Operator, "active")]
    public async Task StructuralWritesRejectBranchRolesEvenWithExplicitPermissions(string role, string operation)
    {
        var branch = Guid.NewGuid(); var actor = Guid.NewGuid();
        var grants = new[] { new ResolvedGrant(Guid.NewGuid(), role, branch,
            new HashSet<string> { "BRANCH_VIEW", "BRANCH_CREATE", "BRANCH_UPDATE" }) };
        await using var ministry = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().Options);
        await using var identity = new AuthDbContext(new DbContextOptionsBuilder<AuthDbContext>().Options);
        var transactionContext = new ActorTransactionContext(new ActorContext(),
            new ActorProof(Options.Create(new ActorProofOptions())), Options.Create(new DatabaseOptions()));
        var service = new BranchService(ministry, new MinistryAuthorization(new Access(new(actor, grants))), identity, transactionContext);
        var failure = await Assert.ThrowsAsync<ApiException>(async () =>
        {
            if (operation == "create") await service.CreateAsync(actor, new("TEST", "Sede", null, null), default);
            else if (operation == "update") await service.UpdateAsync(actor, branch, new("TEST", "Sede", null, null), default);
            else await service.SetActiveAsync(actor, branch, new(false, DateTimeOffset.UtcNow), default);
        });
        Assert.Equal(403, failure.StatusCode);
    }
    private sealed class Access(AccessScope scope) : IAccessService
    {
        public Task<AccessScope> GetAsync(Guid userId, CancellationToken ct) => Task.FromResult(scope);
    }
}
