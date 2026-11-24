using Microsoft.AspNetCore.Identity;

namespace MisionLiderParis.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public Guid? PersonId { get; set; }
    public List<UserAccessGrant> AccessGrants { get; set; } = [];
}

public sealed class UserAccessGrant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public Guid? BranchId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public List<UserGrantPermission> Permissions { get; set; } = [];
}

public sealed class UserGrantPermission
{
    public Guid AccessGrantId { get; set; }
    public Guid PermissionId { get; set; }
    public UserAccessGrant AccessGrant { get; set; } = null!;
}
