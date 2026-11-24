using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed record AccountEmailMessage(string From, string To, string Subject, string Text, string Html, string? ReplyTo);
public sealed class AccountEmailComposer(IOptions<EmailOptions> options, IHostEnvironment environment)
{
    public AccountEmailMessage Compose(string email, string token, string kind, string? fixedSender = null)
    {
        var settings = options.Value;
        var callback = kind switch { "invitation" => settings.InvitationUrl, "recovery" => settings.RecoveryUrl, _ => settings.ConfirmationUrl };
        if (!Uri.TryCreate(callback, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.UserInfo.Length > 0 || uri.Fragment.Length > 0 || uri.Query.Length > 0 ||
            (!environment.IsDevelopment() && !environment.IsEnvironment("Testing") && uri.IsLoopback)) throw Unavailable();
        var from = Address(fixedSender ?? settings.From); var to = Address(email);
        var replyTo = string.IsNullOrWhiteSpace(settings.ReplyTo) ? null : Address(settings.ReplyTo);
        // Fragments never travel in HTTP requests or Referer headers. The client removes them after reading.
        var link = callback + "#email=" + Uri.EscapeDataString(to) + "&token=" + Uri.EscapeDataString(token);
        var subject = kind switch { "invitation" => "Invitación para acceder a Misión Líder París", "recovery" => "Restablecer contraseña", _ => "Confirmar correo" };
        var introduction = kind == "invitation" ? "Has sido invitado a utilizar el sistema de gestión de la Iglesia Misión Líder París. Activa tu cuenta y establece tu contraseña." : subject;
        var action = kind == "invitation" ? "Activar mi cuenta" : subject;
        return new(from, to, subject,
            $"Hola,\n\n{introduction}\n\n{action}: {link}\n\nEste enlace tiene una vigencia limitada. Si no reconoces esta solicitud, ignora este mensaje.\n\nIglesia Misión Líder París",
            $"<p>Hola,</p><p>{WebUtility.HtmlEncode(introduction)}</p><p><a href=\"{WebUtility.HtmlEncode(link)}\">{WebUtility.HtmlEncode(action)}</a></p><p>Este enlace tiene una vigencia limitada. Si no reconoces esta solicitud, ignora este mensaje.</p><p>Iglesia Misión Líder París</p>", replyTo);
    }
    private static string Address(string value)
    {
        if (value.Contains('\r') || value.Contains('\n') || !MailAddress.TryCreate(value, out var result) || result.Address != value)
            throw Unavailable();
        return result.Address;
    }
    public static ApiException Unavailable() => new(503, "email_unavailable", "El servicio de correo no está disponible.");
}
