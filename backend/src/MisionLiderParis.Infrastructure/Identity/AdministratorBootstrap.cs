using System.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Identity;

public sealed class AdministratorBootstrap(AuthDbContext database, UserManager<ApplicationUser> users,
    IMinistryDirectory directory, IOptions<SecurityOptions> security)
{
    public async Task CreateFirstAsync(string email, string password, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            throw ApiException.Invalid("Bootstrap requires environment-provided email and password.");
        // Operator commands do not start the host, so ValidateOnStart alone would not validate these limits.
        if (password.Length < security.Value.PasswordLength)
            throw ApiException.Invalid("Bootstrap password does not meet the configured minimum length.");
        // Resolve the existing ministerial role before writing; never invent or seed its ID.
        var roleId = await directory.GetSuperAdministratorRoleIdAsync(ct);
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await database.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(709415327)", ct);
        if (await database.Users.AnyAsync(ct))
            throw ApiException.Invalid("Bootstrap is only available when there are no application accounts.");
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), Email = email.Trim(), UserName = email.Trim(),
            DisplayName = "Administrador inicial", EmailConfirmed = true,
            AccessGrants = [new UserAccessGrant { RoleId = roleId }]
        };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded) throw ApiException.Invalid("Bootstrap account failed validation.");
        await transaction.CommitAsync(ct);
    }
}
