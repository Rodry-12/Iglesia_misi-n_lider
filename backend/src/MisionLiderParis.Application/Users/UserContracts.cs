using System.ComponentModel.DataAnnotations;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;

namespace MisionLiderParis.Application.Users;

public sealed record CreateUserRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, StringLength(128, MinimumLength = 12)] string Password,
    [Required, StringLength(150, MinimumLength = 1)] string DisplayName,
    Guid? PersonId,
    [Required, MinLength(1), MaxLength(20)] GrantReference[] Grants);

public sealed record UpdateUserRequest(
    [Required, StringLength(150, MinimumLength = 1)] string DisplayName, Guid? PersonId);
public sealed record ReplaceGrantsRequest(
    [Required, MinLength(1), MaxLength(20)] GrantReference[] Grants);
public sealed record SetUserActiveRequest(bool IsActive);
public sealed record InviteUserRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, StringLength(150, MinimumLength = 1)] string DisplayName,
    Guid? PersonId, [Required, MinLength(1), MaxLength(20)] GrantReference[] Grants);
public sealed record InvitationResult(UserDto User, string DeliveryStatus);
public sealed record UserAdministrationOptions(IReadOnlyList<RoleDto> Roles, IReadOnlyList<PermissionDto> Permissions,
    IReadOnlyList<UserBranchOption> Branches);
public sealed record UserBranchOption(Guid Id, string Name);
public sealed record UserPersonOption(Guid Id, string Name, string DocumentType, string DocumentNumber, Guid? BranchId, string? BranchName);
public sealed record UserDto(Guid Id, string Email, string DisplayName, bool IsActive,
    bool EmailConfirmed, Guid? PersonId, IReadOnlyList<GrantReference> Grants,
    bool HasPassword = true, DateTimeOffset? LockoutEnd = null, string? PersonName = null);
public sealed record UserQuery(int Page = 1, int PageSize = 25, string? Search = null,
    Guid? BranchId = null, bool? IsActive = null);

public interface IUserAdministration
{
    Task<UserAdministrationOptions> OptionsAsync(Guid actorId, string operation, CancellationToken ct);
    Task<Page<UserPersonOption>> PeopleOptionsAsync(Guid actorId, int page, string? search, CancellationToken ct, string operation = "USER_CREATE");
    Task<InvitationResult> InviteAsync(Guid actorId, InviteUserRequest request, CancellationToken ct);
    Task<string> ResendInvitationAsync(Guid actorId, Guid id, CancellationToken ct);
    Task<Page<UserDto>> ListAsync(Guid actorId, UserQuery query, CancellationToken cancellationToken);
    Task<UserDto> GetAsync(Guid actorId, Guid id, CancellationToken cancellationToken);
    Task<UserDto> UpdateAsync(Guid actorId, Guid id, UpdateUserRequest request, CancellationToken cancellationToken);
    Task ReplaceGrantsAsync(Guid actorId, Guid id, ReplaceGrantsRequest request, CancellationToken cancellationToken);
    Task SetActiveAsync(Guid actorId, Guid id, bool active, CancellationToken cancellationToken);
    Task RevokeAsync(Guid actorId, Guid id, CancellationToken cancellationToken);
}
