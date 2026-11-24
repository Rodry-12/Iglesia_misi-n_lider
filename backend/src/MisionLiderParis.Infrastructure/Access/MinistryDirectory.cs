using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.Infrastructure.Access;

public sealed class MinistryDirectory(MinistryDbContext database, ActorTransactionContext actorTransaction) : IMinistryDirectory
{
    public async Task<IReadOnlyList<ResolvedGrant>> ResolveAsync(IReadOnlyList<GrantReference> grants, CancellationToken ct)
    {
        if (grants.Count == 0) return [];
        if (grants.Count > 20 || grants.Any(g => g is null || g.RoleId == Guid.Empty || g.BranchId == Guid.Empty) ||
            grants.Select(g => (g.RoleId, g.BranchId)).Distinct().Count() != grants.Count) throw ApiException.Forbidden();
        var roleIds = grants.Select(g => g.RoleId).Distinct().ToArray();
        var branchIds = grants.Where(g => g.BranchId.HasValue).Select(g => g.BranchId!.Value).Distinct().ToArray();
        // These related lookups used to install/verify the signed actor once per query.
        // A single read-only scope retains fresh DB checks and transaction-local RLS.
        // Never commit/dispose a transaction owned by an enclosing administration operation.
        await using var transaction = database.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(database, ct) : null;
        var roles = await database.Roles.AsNoTracking().Where(r => roleIds.Contains(r.Id) && r.IsActive).ToDictionaryAsync(r => r.Id, ct);
        var branches = branchIds.Length == 0 ? new Dictionary<Guid, string>() : await database.Branches.AsNoTracking()
            .Where(b => branchIds.Contains(b.Id) && b.IsActive).ToDictionaryAsync(b => b.Id, b => b.Name, ct);
        var rolePermissions = await database.RolePermissions.AsNoTracking()
            .Where(r => roleIds.Contains(r.RoleId) && r.Permission.IsActive)
            .Select(r => new { r.RoleId, r.Permission.Code }).ToListAsync(ct);
        var explicitIds = grants.SelectMany(g => g.PermissionIds ?? []).Distinct().ToArray();
        var explicitPermissions = explicitIds.Length == 0 ? new Dictionary<Guid, string>() : await database.Permissions.AsNoTracking()
            .Where(p => explicitIds.Contains(p.Id) && p.IsActive).ToDictionaryAsync(p => p.Id, p => p.Code, ct);
        var result = new List<ResolvedGrant>();
        foreach (var grant in grants)
        {
            if (!roles.TryGetValue(grant.RoleId, out var role) || role.Code is not
                (RoleCodes.SuperAdmin or RoleCodes.BranchAdmin or RoleCodes.Operator)) throw ApiException.Forbidden();
            if ((role.Code == RoleCodes.SuperAdmin) != role.IsGlobal ||
                (role.IsGlobal ? grant.BranchId is not null : grant.BranchId is null || !branches.ContainsKey(grant.BranchId.Value)))
                throw ApiException.Forbidden();
            var ids = grant.PermissionIds ?? [];
            if (ids.Length > 128 || ids.Distinct().Count() != ids.Length || ids.Any(id => !explicitPermissions.ContainsKey(id)) ||
                (role.Code != RoleCodes.Operator && ids.Length != 0)) throw ApiException.Forbidden();
            var codes = role.Code == RoleCodes.Operator ? ids.Select(id => explicitPermissions[id]) :
                rolePermissions.Where(p => p.RoleId == role.Id).Select(p => p.Code);
            result.Add(new(role.Id, role.Code, grant.BranchId, codes.ToHashSet(StringComparer.Ordinal),
                grant.BranchId is { } branchId ? branches[branchId] : null));
        }
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    public async Task ValidatePersonAsync(Guid personId, IReadOnlySet<Guid> branchIds, bool global, CancellationToken ct)
    {
        if (!await database.People.AsNoTracking().AnyAsync(p => p.Id == personId && p.IsActive &&
            (global || p.Memberships.Any(m => m.EndedAt == null && branchIds.Contains(m.BranchId) && m.Branch.IsActive)), ct))
            throw ApiException.NotFound();
    }

    public async Task<IReadOnlyList<RoleDto>> GetRolesAsync(CancellationToken ct) =>
        await database.Roles.AsNoTracking().Where(r => r.IsActive).OrderBy(r => r.Code).Select(r => new RoleDto(r.Id, r.Code)).ToListAsync(ct);

    public async Task<IReadOnlyList<PermissionDto>> GetPermissionsAsync(CancellationToken ct) =>
        await database.Permissions.AsNoTracking().Where(p => p.IsActive).OrderBy(p => p.Code).Select(p => new PermissionDto(p.Id, p.Code)).ToListAsync(ct);

    public async Task<Guid> GetSuperAdministratorRoleIdAsync(CancellationToken ct) =>
        await database.Roles.AsNoTracking().Where(r => r.IsActive && r.IsGlobal && r.Code == RoleCodes.SuperAdmin)
            .Select(r => r.Id).SingleAsync(ct);
}
