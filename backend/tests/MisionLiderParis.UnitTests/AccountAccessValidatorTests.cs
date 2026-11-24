using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Access;

namespace MisionLiderParis.UnitTests;

public sealed class AccountAccessValidatorTests
{
    private static ResolvedGrant Grant(string role, Guid? branch) => new(Guid.NewGuid(), role, branch, new HashSet<string>());

    [Theory]
    [InlineData(RoleCodes.Operator)]
    [InlineData(RoleCodes.BranchAdmin)]
    public async Task LinkedBranchAccountUsesItsOwnBranches(string role)
    {
        var directory = new RecordingDirectory(); var person = Guid.NewGuid(); var branch = Guid.NewGuid();
        using var cancellation = new CancellationTokenSource();
        await new AccountAccessValidator(directory).ValidateAsync(person, [Grant(role, branch)], cancellation.Token);
        Assert.Equal(person, directory.PersonId);
        Assert.Equal(new[] { branch }, directory.BranchIds);
        Assert.False(directory.Global);
        Assert.Equal(cancellation.Token, directory.Token);
    }

    [Fact]
    public async Task MultiBranchAccountPassesAllRecipientBranchesWithoutDuplicates()
    {
        var directory = new RecordingDirectory(); var a = Guid.NewGuid(); var b = Guid.NewGuid();
        await new AccountAccessValidator(directory).ValidateAsync(Guid.NewGuid(),
            [Grant(RoleCodes.Operator, a), Grant(RoleCodes.BranchAdmin, b), Grant(RoleCodes.Operator, b)], default);
        Assert.True(directory.BranchIds!.SetEquals([a, b]));
        Assert.False(directory.Global);
    }

    [Fact]
    public async Task OnlyValidSuperAdministratorGrantMakesTheRecipientGlobal()
    {
        var directory = new RecordingDirectory();
        await new AccountAccessValidator(directory).ValidateAsync(Guid.NewGuid(), [Grant(RoleCodes.SuperAdmin, null)], default);
        Assert.True(directory.Global);
        Assert.Empty(directory.BranchIds!);

        await new AccountAccessValidator(directory).ValidateAsync(Guid.NewGuid(), [Grant(RoleCodes.SuperAdmin, Guid.NewGuid())], default);
        Assert.False(directory.Global);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AdministrativeAccountsDoNotRequireAPerson(bool global)
    {
        var directory = new RecordingDirectory();
        await new AccountAccessValidator(directory).ValidateAsync(null,
            [Grant(global ? RoleCodes.SuperAdmin : RoleCodes.Operator, global ? null : Guid.NewGuid())], default);
        Assert.Null(directory.PersonId);
        Assert.Equal(0, directory.Calls);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task AccountWithoutEffectiveGrantsIsRejectedEvenWithoutAPerson(bool linked)
    {
        var directory = new RecordingDirectory();
        var error = await Assert.ThrowsAsync<ApiException>(() => new AccountAccessValidator(directory)
            .ValidateAsync(linked ? Guid.NewGuid() : null, [], default));
        Assert.Equal(403, error.StatusCode);
        Assert.Equal(0, directory.Calls);
    }

    [Fact]
    public async Task InvalidOrInactivePersonFailureIsPreservedForGlobalAndBranchAccounts()
    {
        foreach (var grant in new[] { Grant(RoleCodes.SuperAdmin, null), Grant(RoleCodes.Operator, Guid.NewGuid()) })
        {
            var directory = new RecordingDirectory { Failure = ApiException.NotFound() };
            var error = await Assert.ThrowsAsync<ApiException>(() => new AccountAccessValidator(directory)
                .ValidateAsync(Guid.NewGuid(), [grant], default));
            Assert.Same(directory.Failure, error);
        }
    }

    private sealed class RecordingDirectory : IMinistryDirectory
    {
        public Guid? PersonId { get; private set; }
        public IReadOnlySet<Guid>? BranchIds { get; private set; }
        public bool Global { get; private set; }
        public CancellationToken Token { get; private set; }
        public int Calls { get; private set; }
        public Exception? Failure { get; init; }
        public Task ValidatePersonAsync(Guid personId, IReadOnlySet<Guid> branchIds, bool global, CancellationToken ct)
        {
            Calls++; PersonId = personId; BranchIds = branchIds; Global = global; Token = ct;
            return Failure is null ? Task.CompletedTask : Task.FromException(Failure);
        }
        public Task<IReadOnlyList<ResolvedGrant>> ResolveAsync(IReadOnlyList<GrantReference> grants, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken ct) => throw new NotSupportedException();
        public Task<Guid> GetSuperAdministratorRoleIdAsync(CancellationToken ct) => throw new NotSupportedException();
    }
}
