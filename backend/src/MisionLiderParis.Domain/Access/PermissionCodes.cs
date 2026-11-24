namespace MisionLiderParis.Domain.Access;

// Codes supplied by the reference SQL. Their active rows must still be verified in Supabase.
public static class PermissionCodes
{
    public const string UserView = "USER_VIEW";
    public const string UserCreate = "USER_CREATE";
    public const string UserUpdate = "USER_UPDATE";
    public const string UserChangeStatus = "USER_CHANGE_STATUS";
    public const string UserAssignRole = "USER_ASSIGN_ROLE";
}

public static class UserAdministrationPolicy
{
    public static AccessScope? ForOperation(AccessScope actor, string permission)
    {
        if (permission is not (PermissionCodes.UserView or PermissionCodes.UserCreate or
            PermissionCodes.UserUpdate or PermissionCodes.UserChangeStatus or PermissionCodes.UserAssignRole)) return null;
        if (actor.IsGlobalAdministrator) return actor;
        var grants = actor.Grants.Where(g => g.RoleCode is RoleCodes.BranchAdmin or RoleCodes.Operator &&
            g.RoleId != Guid.Empty && g.BranchId is not null && g.BranchId != Guid.Empty &&
            g.Permissions.Contains(permission)).ToArray();
        return grants.Length == 0 ? null : new AccessScope(actor.UserId, grants);
    }
}
