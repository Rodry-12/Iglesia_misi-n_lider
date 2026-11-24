using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class SmtpAccountEmailSender(IOptions<EmailOptions> options, AccountEmailComposer composer) : IAccountEmailSender
{
    public Task SendInvitationAsync(string email, string token, CancellationToken ct) => SendAsync(email, token, "invitation", ct);
    public Task SendRecoveryAsync(string email, string encodedToken, CancellationToken ct) =>
        SendAsync(email, encodedToken, "recovery", ct);

    public Task SendConfirmationAsync(string email, string encodedToken, CancellationToken ct) =>
        SendAsync(email, encodedToken, "confirmation", ct);

    private async Task SendAsync(string email, string encodedToken, string kind,
        CancellationToken ct)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Host))
            throw new ApiException(503, "email_unavailable", "El servicio de correo no está configurado.");
        var content = composer.Compose(email, encodedToken, kind);
        using var message = new MailMessage(content.From, content.To) {Subject = content.Subject};
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(content.Text, System.Text.Encoding.UTF8, "text/plain"));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(content.Html, System.Text.Encoding.UTF8, "text/html"));
        if (content.ReplyTo is {} replyTo) message.ReplyToList.Add(replyTo);
        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = true, UseDefaultCredentials = false,
            Credentials = new NetworkCredential(settings.Username, settings.Password), Timeout = 15000
        };
        await client.SendMailAsync(message, ct);
    }
}
