using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Infrastructure.Users;

public sealed class InvitationTokenOptions : DataProtectionTokenProviderOptions;
public sealed class InvitationTokenProvider<TUser>(IDataProtectionProvider protection, IOptions<InvitationTokenOptions> options,
    ILogger<DataProtectorTokenProvider<TUser>> logger) : DataProtectorTokenProvider<TUser>(protection, options, logger) where TUser : class;

// No schema additions: Identity's existing user_tokens holds only the last attempt timestamp.
public sealed class AccountInvitations(AuthDbContext database, UserManager<ApplicationUser> manager, IAccountEmailSender sender,
    ILogger<AccountInvitations> logger) : IInvitationActivation
{
    public const string Provider = "Invitation";
    public const string Purpose = "MLP.ActivateAccount.v1";
    private const string AttemptName = "InvitationLastAttempt";
    public async Task<string> SendAsync(Guid id, CancellationToken ct)
    {
        string email; string token;
        await using (var transaction = await database.Database.BeginTransactionAsync(ct))
        {
            await LockAsync(id, ct);
            var user = await database.Users.SingleAsync(u => u.Id == id, ct);
            await database.Entry(user).ReloadAsync(ct);
            if (!Pending(user)) throw Invalid();
            var last = await manager.GetAuthenticationTokenAsync(user, "MLP", AttemptName);
            var now = DateTimeOffset.UtcNow;
            if (long.TryParse(last, out var seconds) && now.ToUnixTimeSeconds() - seconds < 60)
                throw new ApiException(429, "invitation_throttled", "Espera antes de volver a solicitar la invitación.");
            Check(await manager.UpdateSecurityStampAsync(user)); // New invitation revokes all earlier invitation links.
            Check(await manager.SetAuthenticationTokenAsync(user, "MLP", AttemptName, now.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)));
            email = user.Email!;
            token = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(await manager.GenerateUserTokenAsync(user, Provider, Purpose)));
            await transaction.CommitAsync(ct);
        }
        try { await sender.SendInvitationAsync(email, token, ct); return "accepted"; }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogWarning("Invitation delivery unconfirmed; type {ExceptionType}", exception.GetType().Name);
            return "unconfirmed";
        }
    }

    public async Task ActivateAsync(ActivateInvitationRequest request, CancellationToken ct)
    {
        var user = await manager.FindByEmailAsync(request.Email.Trim()) ?? throw Invalid();
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        await LockAsync(user.Id, ct); await database.Entry(user).ReloadAsync(ct);
        if (!Pending(user)) throw Invalid();
        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token)); }
        catch (FormatException) { throw Invalid(); }
        if (!await manager.VerifyUserTokenAsync(user, Provider, Purpose, token)) throw Invalid();
        // Public activation proves email ownership only. It never impersonates an administrator
        // to read ministry data. Current grants/person/branch eligibility remain checked at login
        // and by signed RLS; grant/status/person revocations rotate the security stamp.
        Check(await manager.AddPasswordAsync(user, request.NewPassword));
        user.EmailConfirmed = true;
        Check(await manager.UpdateSecurityStampAsync(user));
        await transaction.CommitAsync(ct);
    }
    private Task<int> LockAsync(Guid id, CancellationToken ct) =>
        database.Database.ExecuteSqlInterpolatedAsync($"SELECT id FROM auth_app.users WHERE id={id} FOR UPDATE", ct);
    private static bool Pending(ApplicationUser user) => user.IsActive && !user.EmailConfirmed && user.PasswordHash is null &&
        !user.TwoFactorEnabled && !(user.LockoutEnd > DateTimeOffset.UtcNow);
    private static ApiException Invalid() => new(400, "invalid_invitation", "La invitación no es válida o la cuenta no puede activarse.");
    private static void Check(IdentityResult result)
    { if (!result.Succeeded) throw ApiException.Invalid("No se pudo completar la operación. Revisa la contraseña y los datos."); }
}
