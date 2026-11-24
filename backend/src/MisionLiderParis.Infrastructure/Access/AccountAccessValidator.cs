using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.Infrastructure.Access;

// Callers resolve current grants and authorize the actor separately. Only the recipient's
// effective grants determine whether its optional person link is coherent.
public sealed class AccountAccessValidator(IMinistryDirectory directory)
{
    public Task ValidateAsync(Guid? personId, IReadOnlyList<ResolvedGrant> recipientGrants, CancellationToken ct)
    {
        if (recipientGrants.Count == 0) throw ApiException.Forbidden();
        if (personId is not { } id) return Task.CompletedTask;

        var recipient = new AccessScope(Guid.Empty, recipientGrants);
        var branches = recipientGrants.Where(g => g.BranchId.HasValue)
            .Select(g => g.BranchId!.Value).ToHashSet();
        return directory.ValidatePersonAsync(id, branches, recipient.IsGlobalAdministrator, ct);
    }
}
