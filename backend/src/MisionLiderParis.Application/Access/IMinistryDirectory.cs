using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.Application.Access;

public sealed record GrantReference(Guid RoleId, Guid? BranchId,
    [System.ComponentModel.DataAnnotations.MaxLength(128)] Guid[]? PermissionIds = null);
public sealed record RoleDto(Guid Id, string Code);
public sealed record PermissionDto(Guid Id, string Code);

// This boundary cannot be implemented honestly until the existing schema is inspected.
// Implementations must resolve active branches and current role/permission data per request.
// OPERATOR gets only its explicitly requested active PermissionIds, not role defaults.
// Non-operator direct permissions, inactive/missing references, duplicate/malformed scopes must be rejected.
public interface IMinistryDirectory
{
    Task<IReadOnlyList<ResolvedGrant>> ResolveAsync(IReadOnlyList<GrantReference> grants,
        CancellationToken cancellationToken);
    Task ValidatePersonAsync(Guid personId, IReadOnlySet<Guid> branchIds, bool global,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken cancellationToken);
    Task<Guid> GetSuperAdministratorRoleIdAsync(CancellationToken cancellationToken);
}

public interface IAccessService
{
    Task<AccessScope> GetAsync(Guid userId, CancellationToken cancellationToken);
}
