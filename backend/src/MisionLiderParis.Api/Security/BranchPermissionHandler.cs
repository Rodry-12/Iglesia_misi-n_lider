using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using MisionLiderParis.Application.Access;

namespace MisionLiderParis.Api.Security;

public sealed record BranchPermissionRequirement(string Permission) : IAuthorizationRequirement;

// Resource-based authorization: the branch must come from the loaded resource, not just a client DTO.
public sealed class BranchPermissionHandler(IAccessService access)
    : AuthorizationHandler<BranchPermissionRequirement, Guid>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        BranchPermissionRequirement requirement, Guid resourceBranchId)
    {
        if (resourceBranchId == Guid.Empty || !Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
            return;
        var scope = await access.GetAsync(id, CancellationToken.None);
        if (scope.Can(requirement.Permission, resourceBranchId)) context.Succeed(requirement);
    }
}
