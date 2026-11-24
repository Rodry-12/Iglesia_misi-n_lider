using System.ComponentModel.DataAnnotations;
using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.Application.Auth;

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(128)] string Password);
public sealed record ForgotPasswordRequest([Required, EmailAddress, MaxLength(254)] string Email);
public sealed record ResetPasswordRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(4096)] string Token,
    [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
public sealed record ChangePasswordRequest(
    [Required, MaxLength(128)] string CurrentPassword,
    [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
public sealed record ConfirmEmailRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(4096)] string Token);
public sealed record SessionDto(Guid UserId, string DisplayName, IReadOnlyList<ResolvedGrant> Grants);

public interface IAccountEmailSender
{
    Task SendInvitationAsync(string email, string encodedToken, CancellationToken cancellationToken);
    Task SendRecoveryAsync(string email, string encodedToken, CancellationToken cancellationToken);
    Task SendConfirmationAsync(string email, string encodedToken, CancellationToken cancellationToken);
}

public sealed record ActivateInvitationRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(4096)] string Token,
    [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
public interface IInvitationActivation
{
    Task ActivateAsync(ActivateInvitationRequest request, CancellationToken ct);
}
