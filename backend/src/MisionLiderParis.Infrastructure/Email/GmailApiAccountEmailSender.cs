using Microsoft.AspNetCore.WebUtilities;
using MimeKit;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class GmailApiAccountEmailSender(GoogleGmailClient google, GmailAccessTokens tokens, AccountEmailComposer composer) : IAccountEmailSender
{
    public Task SendInvitationAsync(string email,string token,CancellationToken ct) => SendAsync(email,token,"invitation",ct);
    public Task SendRecoveryAsync(string email,string token,CancellationToken ct) => SendAsync(email,token,"recovery",ct);
    public Task SendConfirmationAsync(string email,string token,CancellationToken ct) => SendAsync(email,token,"confirmation",ct);
    // Operator-only diagnostic; not exposed by an HTTP endpoint or Identity contract.
    public Task SendDiagnosticAsync(string email,CancellationToken ct)
    {
        if(email.Contains('\r')||email.Contains('\n')||!System.Net.Mail.MailAddress.TryCreate(email,out var address)||address.Address!=email)
            throw AccountEmailComposer.Unavailable();
        return SendContentAsync(new(GoogleGmailOptions.Sender,email,
            "Misión Líder París — Prueba de envío Gmail API",
            "Este es un correo de prueba enviado desde el sistema Misión Líder París mediante Gmail API. Su finalidad es verificar el funcionamiento del servicio de correo institucional. No requiere ninguna acción.",
            "<p>Este es un correo de prueba enviado desde el sistema Misión Líder París mediante Gmail API. Su finalidad es verificar el funcionamiento del servicio de correo institucional. No requiere ninguna acción.</p>",null),ct);
    }
    private Task SendAsync(string email,string token,string kind,CancellationToken ct) =>
        SendContentAsync(composer.Compose(email,token,kind,GoogleGmailOptions.Sender),ct);
    private async Task SendContentAsync(AccountEmailMessage content,CancellationToken ct)
    {
        using var mime=new MimeMessage();
        mime.From.Add(new MailboxAddress("Iglesia Misión Líder París",GoogleGmailOptions.Sender));
        mime.To.Add(MailboxAddress.Parse(content.To)); mime.Subject=content.Subject;
        if(content.ReplyTo is {} replyTo)mime.ReplyTo.Add(MailboxAddress.Parse(replyTo));
        mime.Body=new BodyBuilder {TextBody=content.Text,HtmlBody=content.Html}.ToMessageBody();
        using var buffer=new MemoryStream(); await mime.WriteToAsync(buffer,ct);
        var access=await tokens.GetAsync(ct);
        try {await google.SendAsync(WebEncoders.Base64UrlEncode(buffer.ToArray()),access,ct);}
        catch(GmailAuthorizationRevokedException)
        {await tokens.RevokeLocalAsync(ct);throw GmailAccessTokens.ReauthorizationRequired();}
        // Never automatically retry messages: an uncertain send may already have been accepted.
    }
}
