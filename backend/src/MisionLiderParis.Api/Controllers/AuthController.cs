using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.WebUtilities;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Api.Controllers;

[ApiController, Route("api/v1/auth")]
public sealed class AuthController(UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
    IAccessService access, IAccountEmailSender emailSender, ILogger<AuthController> logger, ActorContext actor,
    IInvitationActivation invitations) : ControllerBase
{
    private static readonly ApplicationUser DummyUser = new();
    private static readonly PasswordHasher<ApplicationUser> DummyHasher = new();
    private static readonly string DummyHash = DummyHasher.HashPassword(DummyUser, Guid.NewGuid().ToString());
    [HttpPost("activate-invitation"), AllowAnonymous, EnableRateLimiting("authentication")]
    public async Task<IActionResult> ActivateInvitation(ActivateInvitationRequest request, CancellationToken ct)
    { await invitations.ActivateAsync(request, ct); return NoContent(); }

    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("authentication")]
    [ProducesResponseType<SessionDto>(200), ProducesResponseType<ProblemDetails>(401)]
    public async Task<ActionResult<SessionDto>> Login(LoginRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive || user.TwoFactorEnabled)
        {
            DummyHasher.VerifyHashedPassword(DummyUser, DummyHash, request.Password);
            throw InvalidCredentials();
        }
        var result = await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded) throw InvalidCredentials();
        actor.BindAuthenticatedSession(user.Id,user.SecurityStamp ?? "");
        MisionLiderParis.Domain.Access.AccessScope scope;
        try { scope = await access.GetAsync(user.Id, ct); }
        catch (ApiException exception) when (exception.StatusCode is 403 or 404) { throw InvalidCredentials(); }
        await signIn.SignInAsync(user, isPersistent: false);
        return new SessionDto(user.Id, user.DisplayName, scope.Grants);
    }

    [HttpGet("session")]
    public async Task<SessionDto> Session(CancellationToken ct)
    {
        var user = await CurrentUserAsync();
        var scope = await access.GetAsync(user.Id, ct);
        return new SessionDto(user.Id, user.DisplayName, scope.Grants);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var user = await CurrentUserAsync();
        // Revoke all copies of the cookie, including cookies copied before logout.
        Check(await users.UpdateSecurityStampAsync(user));
        await signIn.SignOutAsync();
        return NoContent();
    }

    [HttpPost("change-password"), EnableRateLimiting("authentication")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await CurrentUserAsync();
        Check(await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword));
        await signIn.SignOutAsync();
        return NoContent();
    }

    [HttpPost("forgot-password"), AllowAnonymous, EnableRateLimiting("authentication")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is { IsActive: true, EmailConfirmed: true, PasswordHash: not null })
        {
            var token = Encode(await users.GeneratePasswordResetTokenAsync(user));
            try { await emailSender.SendRecoveryAsync(user.Email!, token, ct); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            { logger.LogWarning("Recovery delivery failed; type {ExceptionType}", exception.GetType().Name); }
        }
        return Accepted(new { message = "Si la cuenta cumple los requisitos, recibirá instrucciones." });
    }

    [HttpPost("reset-password"), AllowAnonymous, EnableRateLimiting("authentication")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive || !user.EmailConfirmed || user.PasswordHash is null) throw InvalidToken();
        var result = await users.ResetPasswordAsync(user, Decode(request.Token), request.NewPassword);
        if (!result.Succeeded) throw InvalidToken();
        await signIn.SignOutAsync();
        return NoContent();
    }

    [HttpPost("confirm-email"), AllowAnonymous, EnableRateLimiting("authentication")]
    public async Task<IActionResult> ConfirmEmail(ConfirmEmailRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null || !user.IsActive || user.PasswordHash is null) throw InvalidToken();
        if (!(await users.ConfirmEmailAsync(user, Decode(request.Token))).Succeeded) throw InvalidToken();
        return NoContent();
    }

    [HttpPost("resend-confirmation"), AllowAnonymous, EnableRateLimiting("authentication")]
    public async Task<IActionResult> ResendConfirmation(ForgotPasswordRequest request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is { IsActive: true, EmailConfirmed: false, PasswordHash: not null })
        {
            var token = Encode(await users.GenerateEmailConfirmationTokenAsync(user));
            try { await emailSender.SendConfirmationAsync(user.Email!, token, ct); }
            catch (Exception exception) when (exception is not OperationCanceledException)
            { logger.LogWarning("Confirmation delivery failed; type {ExceptionType}", exception.GetType().Name); }
        }
        return Accepted(new { message = "Si la cuenta cumple los requisitos, recibirá instrucciones." });
    }

    private async Task<ApplicationUser> CurrentUserAsync() =>
        await users.GetUserAsync(User) ?? throw InvalidCredentials();
    private static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
    private static string Decode(string token)
    {
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(token)); }
        catch (FormatException) { throw InvalidToken(); }
    }
    private static ApiException InvalidCredentials() => new(401, "invalid_credentials", "No fue posible iniciar sesión.");
    private static ApiException InvalidToken() => new(400, "invalid_token", "El enlace no es válido o ha vencido.");
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded) throw ApiException.Invalid("No fue posible completar el cambio de cuenta.");
    }
}
