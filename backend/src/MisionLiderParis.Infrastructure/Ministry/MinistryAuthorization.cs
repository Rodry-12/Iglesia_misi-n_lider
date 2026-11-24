using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class MinistryAuthorization(IAccessService access)
{
    public async Task<AccessScope> RequireAsync(Guid actor, string permission, Guid? branchId, CancellationToken ct,
        bool global = false)
    {
        if (actor == Guid.Empty || branchId == Guid.Empty) throw ApiException.Forbidden();
        var scope = await access.GetAsync(actor, ct);
        if (global ? !scope.IsGlobalAdministrator : branchId.HasValue ? !scope.Can(permission, branchId) :
            !scope.IsGlobalAdministrator && !scope.Grants.Any(g => g.BranchId.HasValue && g.Permissions.Contains(permission)))
            throw ApiException.Forbidden();
        return scope;
    }

    public static Guid[] BranchIds(AccessScope scope, string permission) => scope.Grants
        .Where(g => g.BranchId.HasValue && g.Permissions.Contains(permission)).Select(g => g.BranchId!.Value).Distinct().ToArray();

    public static string? Search(string? search)
    {
        if (search?.Length > 150) throw ApiException.Invalid("La búsqueda no puede superar 150 caracteres.");
        return string.IsNullOrWhiteSpace(search) ? null : search.Trim();
    }

    public static void Id(Guid id)
    { if (id == Guid.Empty) throw ApiException.Invalid("El identificador no es válido."); }

    public static ApiException Conflict(string message) => new(409, "integrity_conflict", message);
}
