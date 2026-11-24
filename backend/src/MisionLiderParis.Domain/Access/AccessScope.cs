namespace MisionLiderParis.Domain.Access;

public static class RoleCodes
{
    public const string SuperAdmin = "SUPER_ADMIN";
    public const string BranchAdmin = "BRANCH_ADMIN";
    public const string Operator = "OPERATOR";
}

// Permission strings must be read from iglesia.permiso, never inferred from role names.
public sealed record ResolvedGrant(Guid RoleId, string RoleCode, Guid? BranchId,
    IReadOnlySet<string> Permissions, string? BranchName = null);

public sealed record AccessScope(Guid UserId, IReadOnlyList<ResolvedGrant> Grants)
{
    public bool IsGlobalAdministrator => Grants.Any(g => IsValidGrant(g) &&
        g.RoleCode == RoleCodes.SuperAdmin && g.BranchId is null);

    public bool Can(string permission, Guid? branchId) =>
        !string.IsNullOrWhiteSpace(permission) && (IsGlobalAdministrator ||
        (branchId is not null && Grants.Any(g => IsValidGrant(g) && g.BranchId == branchId &&
            g.Permissions.Contains(permission))));

    public bool CanManageGrant(ResolvedGrant target) => IsValidGrant(target) && (IsGlobalAdministrator ||
        (target.BranchId is not null && target.RoleCode == RoleCodes.Operator &&
         Grants.Any(g => IsValidGrant(g) && g.RoleCode is RoleCodes.BranchAdmin or RoleCodes.Operator &&
             g.BranchId == target.BranchId && target.Permissions.IsSubsetOf(g.Permissions))));

    private static bool IsValidGrant(ResolvedGrant grant) => grant.RoleId != Guid.Empty &&
        (grant.RoleCode == RoleCodes.SuperAdmin ? grant.BranchId is null :
            (grant.RoleCode is RoleCodes.BranchAdmin or RoleCodes.Operator &&
             grant.BranchId is not null && grant.BranchId != Guid.Empty));
}
