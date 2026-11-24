using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;

namespace MisionLiderParis.Api.Controllers;

[ApiController, Route("api/v1")]
public sealed class AuthorizationCatalogController(IAccessService access, IMinistryDirectory directory) : ControllerBase
{
    [HttpGet("roles")]
    public async Task<IReadOnlyList<RoleDto>> Roles(CancellationToken ct)
    { await RequireGlobalAsync(ct); return await directory.GetRolesAsync(ct); }
    [HttpGet("permissions")]
    public async Task<IReadOnlyList<PermissionDto>> Permissions(CancellationToken ct)
    { await RequireGlobalAsync(ct); return await directory.GetPermissionsAsync(ct); }
    private async Task RequireGlobalAsync(CancellationToken ct)
    {
        var scope = await access.GetAsync(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), ct);
        if (!scope.IsGlobalAdministrator) throw ApiException.Forbidden();
    }
}
