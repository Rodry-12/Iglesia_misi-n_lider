using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Infrastructure.Access;

public sealed class AccessService(AuthDbContext database, IMinistryDirectory directory, ActorContext actor,
    AccountAccessValidator accountAccess) : IAccessService
{
    public async Task<AccessScope> GetAsync(Guid userId, CancellationToken cancellationToken)
    {
        using var timing = MisionLiderParis.Infrastructure.Diagnostics.PerformanceDiagnostics.Measure(MisionLiderParis.Infrastructure.Diagnostics.PerformancePhase.AccessResolution);
        actor.SetUser(userId);
        var user = await database.Users.AsNoTracking().Include(x => x.AccessGrants).ThenInclude(g => g.Permissions)
            .SingleOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null || !user.IsActive || user.LockoutEnd > DateTimeOffset.UtcNow)
            throw ApiException.Forbidden();
        var references = user.AccessGrants.Select(x => new GrantReference(x.RoleId, x.BranchId,
            x.Permissions.Select(p => p.PermissionId).ToArray())).ToArray();
        var resolved = await directory.ResolveAsync(references, cancellationToken);
        await accountAccess.ValidateAsync(user.PersonId, resolved, cancellationToken);
        return new AccessScope(userId, resolved);
    }
}
