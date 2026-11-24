using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MisionLiderParis.Infrastructure.Identity;

// IdentityUserContext deliberately excludes Identity roles. Functional roles live in iglesia.
public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options)
    : IdentityUserContext<ApplicationUser, Guid>(options)
{
    public DbSet<UserAccessGrant> AccessGrants => Set<UserAccessGrant>();
    public DbSet<UserGrantPermission> GrantPermissions => Set<UserGrantPermission>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.HasDefaultSchema("auth_app");
        builder.Entity<ApplicationUser>(user =>
        {
            user.ToTable("users", "auth_app");
            user.Property(x => x.Id).HasColumnName("id");
            user.Property(x => x.UserName).HasColumnName("user_name");
            user.Property(x => x.NormalizedUserName).HasColumnName("normalized_user_name");
            user.Property(x => x.Email).HasColumnName("email");
            user.Property(x => x.NormalizedEmail).HasColumnName("normalized_email");
            user.Property(x => x.EmailConfirmed).HasColumnName("email_confirmed");
            user.Property(x => x.PasswordHash).HasColumnName("password_hash");
            user.Property(x => x.SecurityStamp).HasColumnName("security_stamp");
            user.Property(x => x.ConcurrencyStamp).HasColumnName("concurrency_stamp");
            user.Property(x => x.PhoneNumber).HasColumnName("phone_number");
            user.Property(x => x.PhoneNumberConfirmed).HasColumnName("phone_number_confirmed");
            user.Property(x => x.TwoFactorEnabled).HasColumnName("two_factor_enabled");
            user.Property(x => x.LockoutEnd).HasColumnName("lockout_end");
            user.Property(x => x.LockoutEnabled).HasColumnName("lockout_enabled");
            user.Property(x => x.AccessFailedCount).HasColumnName("access_failed_count");
            user.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(150).IsRequired();
            user.Property(x => x.IsActive).HasColumnName("is_active");
            user.Property(x => x.PersonId).HasColumnName("person_id");
            user.HasIndex(x => x.NormalizedEmail).IsUnique();
            user.HasIndex(x => x.PersonId).IsUnique();
        });
        builder.Entity<IdentityUserClaim<Guid>>(claim =>
        {
            claim.ToTable("user_claims", "auth_app");
            claim.Property(x => x.Id).HasColumnName("id");
            claim.Property(x => x.UserId).HasColumnName("user_id");
            claim.Property(x => x.ClaimType).HasColumnName("claim_type");
            claim.Property(x => x.ClaimValue).HasColumnName("claim_value");
        });
        builder.Entity<IdentityUserLogin<Guid>>(login =>
        {
            login.ToTable("user_logins", "auth_app");
            login.Property(x => x.UserId).HasColumnName("user_id");
            login.Property(x => x.LoginProvider).HasColumnName("login_provider");
            login.Property(x => x.ProviderKey).HasColumnName("provider_key");
            login.Property(x => x.ProviderDisplayName).HasColumnName("provider_display_name");
        });
        builder.Entity<IdentityUserToken<Guid>>(token =>
        {
            token.ToTable("user_tokens", "auth_app");
            token.Property(x => x.UserId).HasColumnName("user_id");
            token.Property(x => x.LoginProvider).HasColumnName("login_provider");
            token.Property(x => x.Name).HasColumnName("name");
            token.Property(x => x.Value).HasColumnName("value");
        });
        builder.Entity<UserAccessGrant>(grant =>
        {
            grant.ToTable("user_access_grants", "auth_app");
            grant.HasKey(x => x.Id);
            grant.Property(x => x.Id).HasColumnName("id");
            grant.Property(x => x.UserId).HasColumnName("user_id");
            grant.Property(x => x.RoleId).HasColumnName("role_id");
            grant.Property(x => x.BranchId).HasColumnName("branch_id");
            grant.HasOne(x => x.User).WithMany(x => x.AccessGrants).HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            grant.HasIndex(x => new { x.UserId, x.RoleId, x.BranchId }).IsUnique()
                .HasFilter("branch_id IS NOT NULL");
            grant.HasIndex(x => new { x.UserId, x.RoleId }).IsUnique()
                .HasFilter("branch_id IS NULL");
            // Cross-context FKs are installed by reviewed script 004; do not import ministry entities into migrations.
        });
        builder.Entity<UserGrantPermission>(permission =>
        {
            permission.ToTable("user_grant_permissions", "auth_app");
            permission.HasKey(x => new { x.AccessGrantId, x.PermissionId });
            permission.Property(x => x.AccessGrantId).HasColumnName("access_grant_id");
            permission.Property(x => x.PermissionId).HasColumnName("permission_id");
            permission.HasOne(x => x.AccessGrant).WithMany(x => x.Permissions)
                .HasForeignKey(x => x.AccessGrantId).OnDelete(DeleteBehavior.Cascade);
            permission.HasIndex(x => x.PermissionId);
            // The verified FK to iglesia.permiso is installed by reviewed script 004.
        });
    }
}
