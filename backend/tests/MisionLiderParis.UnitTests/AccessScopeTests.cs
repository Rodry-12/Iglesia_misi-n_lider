using MisionLiderParis.Domain.Access;
using MisionLiderParis.Application.Common;

namespace MisionLiderParis.UnitTests;

public sealed class AccessScopeTests
{
    private static readonly Guid BranchA = Guid.NewGuid();
    private static readonly Guid BranchB = Guid.NewGuid();
    private static ResolvedGrant Grant(string role, Guid? branch, params string[] permissions) =>
        new(Guid.NewGuid(), role, branch, permissions.ToHashSet(StringComparer.Ordinal));
    private static AccessScope Scope(params ResolvedGrant[] grants) => new(Guid.NewGuid(), grants);

    [Fact]
    public void SuperAdministratorHasGlobalScope() =>
        Assert.True(Scope(Grant(RoleCodes.SuperAdmin, null)).Can("people.read", BranchB));

    [Fact]
    public void BranchDisplayNameCannotChangeAuthorization()
    {
        var grant = Grant(RoleCodes.Operator, BranchA, "PERSON_VIEW") with { BranchName = "Todas las sedes" };
        var scope = Scope(grant);
        Assert.False(scope.IsGlobalAdministrator);
        Assert.True(scope.Can("PERSON_VIEW", BranchA));
        Assert.False(scope.Can("PERSON_VIEW", BranchB));
        Assert.False(scope.Can("PERSON_UPDATE", BranchA));
    }

    [Fact]
    public void BranchAdministratorCannotReadAnotherBranch() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA, "people.read")).Can("people.read", BranchB));

    [Fact]
    public void BranchPermissionCannotAuthorizeAnUnscopedCollection() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA, "people.read")).Can("people.read", null));

    [Fact]
    public void OperatorWithoutAnExplicitPermissionIsDenied() =>
        Assert.False(Scope(Grant(RoleCodes.Operator, BranchA)).Can("people.read", BranchA));

    [Fact]
    public void OperatorWithPermissionCanReadOnlyItsOwnBranch()
    {
        var scope = Scope(Grant(RoleCodes.Operator, BranchA, "people.read"));
        Assert.True(scope.Can("people.read", BranchA));
        Assert.False(scope.Can("people.read", BranchB));
    }

    [Fact]
    public void BranchAdministratorCannotGrantGlobalAccess() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA)).CanManageGrant(Grant(RoleCodes.SuperAdmin, null)));

    [Fact]
    public void BranchAdministratorCannotCreateAnotherBranchAdministrator() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA)).CanManageGrant(Grant(RoleCodes.BranchAdmin, BranchA)));

    [Fact]
    public void BranchAdministratorCannotGrantPermissionsItDoesNotHave() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA, "people.read"))
            .CanManageGrant(Grant(RoleCodes.Operator, BranchA, "people.write")));

    [Fact]
    public void BranchAdministratorCanGrantAnOperatorItsOwnPermissions() =>
        Assert.True(Scope(Grant(RoleCodes.BranchAdmin, BranchA, "people.read"))
            .CanManageGrant(Grant(RoleCodes.Operator, BranchA, "people.read")));

    [Fact]
    public void BranchAdministratorCannotCreateAnOperatorInAnotherBranch() =>
        Assert.False(Scope(Grant(RoleCodes.BranchAdmin, BranchA)).CanManageGrant(Grant(RoleCodes.Operator, BranchB)));

    [Fact]
    public void InvalidGlobalRoleAssignedToABranchDoesNotBecomeGlobal() =>
        Assert.False(Scope(Grant(RoleCodes.SuperAdmin, BranchA)).IsGlobalAdministrator);

    [Fact]
    public void GlobalAdministratorCannotAssignAnUnrecognizedRole() =>
        Assert.False(Scope(Grant(RoleCodes.SuperAdmin, null)).CanManageGrant(Grant("UNKNOWN", BranchA)));

    [Theory]
    [InlineData(0, 25)]
    [InlineData(1, 101)]
    [InlineData(100001, 25)]
    [InlineData(1, 0)]
    public void UnboundedOrInvalidPaginationIsRejected(int page, int size) =>
        Assert.Throws<ApiException>(() => new PageRequest(page, size).Offset);
}
