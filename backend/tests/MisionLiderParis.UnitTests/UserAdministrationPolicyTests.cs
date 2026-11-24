using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.UnitTests;

public sealed class UserAdministrationPolicyTests
{
    private static readonly Guid BranchA = Guid.NewGuid();
    private static readonly Guid BranchB = Guid.NewGuid();
    private static ResolvedGrant Grant(string role, Guid? branch, params string[] permissions) =>
        new(Guid.NewGuid(), role, branch, permissions.ToHashSet(StringComparer.Ordinal));

    [Theory]
    [InlineData(PermissionCodes.UserView)]
    [InlineData(PermissionCodes.UserUpdate)]
    [InlineData(PermissionCodes.UserCreate)]
    [InlineData(PermissionCodes.UserAssignRole)]
    [InlineData(PermissionCodes.UserChangeStatus)]
    public void CustomAccessAuthorizesOnlyItsExplicitOperationAndBranch(string permission)
    {
        var actor = new AccessScope(Guid.NewGuid(), [
            Grant(RoleCodes.Operator, BranchA, permission),
            Grant(RoleCodes.Operator, BranchB, "PERSON_VIEW")]);
        var permitted = UserAdministrationPolicy.ForOperation(actor, permission);
        Assert.NotNull(permitted);
        Assert.True(permitted.Can(permission, BranchA));
        Assert.False(permitted.Can(permission, BranchB));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor,
            permission == PermissionCodes.UserView ? PermissionCodes.UserUpdate : PermissionCodes.UserView));
    }

    [Theory]
    [InlineData(PermissionCodes.UserCreate)]
    [InlineData(PermissionCodes.UserAssignRole)]
    [InlineData(PermissionCodes.UserChangeStatus)]
    public void CustomAccessCannotDelegatePermissionsItDoesNotHave(string permission)
    {
        var actor = new AccessScope(Guid.NewGuid(), [Grant(RoleCodes.Operator, BranchA, permission)]);
        Assert.NotNull(UserAdministrationPolicy.ForOperation(actor, permission));
        Assert.False(actor.CanManageGrant(Grant(RoleCodes.Operator, BranchA, "PERSON_CREATE")));
        Assert.False(actor.CanManageGrant(Grant(RoleCodes.BranchAdmin, BranchA)));
        Assert.False(actor.CanManageGrant(Grant(RoleCodes.Operator, BranchB)));
    }

    [Fact]
    public void UserViewDoesNotAuthorizeCreatingUpdatingOrRevokingAccounts()
    {
        var actor = new AccessScope(Guid.NewGuid(), [Grant(RoleCodes.BranchAdmin, BranchA, PermissionCodes.UserView)]);
        Assert.NotNull(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserView));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserCreate));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserUpdate));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserChangeStatus));
    }

    [Fact]
    public void UserCreateDoesNotAuthorizeReplacingExistingRoles()
    {
        var actor = new AccessScope(Guid.NewGuid(), [Grant(RoleCodes.BranchAdmin, BranchA, PermissionCodes.UserCreate)]);
        Assert.NotNull(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserCreate));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserAssignRole));
    }

    [Fact]
    public void PermissionForOneBranchDoesNotAuthorizeManagingAnotherBranch()
    {
        var actor = new AccessScope(Guid.NewGuid(), [
            Grant(RoleCodes.BranchAdmin, BranchA, PermissionCodes.UserCreate),
            Grant(RoleCodes.BranchAdmin, BranchB, PermissionCodes.UserView)]);
        var permitted = UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserCreate)!;
        Assert.True(permitted.Can(PermissionCodes.UserCreate, BranchA));
        Assert.False(permitted.Can(PermissionCodes.UserCreate, BranchB));
        Assert.DoesNotContain(permitted.Grants, g => g.BranchId == BranchB);
    }

    [Fact]
    public void OperatorCanDelegateOnlyItsPermissionsToOperatorsInItsOwnBranch()
    {
        var actor = new AccessScope(Guid.NewGuid(), [Grant(RoleCodes.Operator, BranchA, PermissionCodes.UserCreate)]);
        Assert.NotNull(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserCreate));
        Assert.True(actor.CanManageGrant(Grant(RoleCodes.Operator, BranchA, PermissionCodes.UserCreate)));
        Assert.False(actor.CanManageGrant(Grant(RoleCodes.Operator, BranchA, PermissionCodes.UserUpdate)));
    }

    [Fact]
    public void SuperAdministratorStillRejectsAnUnknownOperation()
    {
        var actor = new AccessScope(Guid.NewGuid(), [Grant(RoleCodes.SuperAdmin, null)]);
        Assert.NotNull(UserAdministrationPolicy.ForOperation(actor, PermissionCodes.UserAssignRole));
        Assert.Null(UserAdministrationPolicy.ForOperation(actor, "TYPO_PERMISSION"));
    }
}
