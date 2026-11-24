using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class ResendAccountEmailSender(HttpClient client, IOptions<ResendOptions> options, AccountEmailComposer composer) : IAccountEmailSender
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) {DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull};
    public Task SendInvitationAsync(string email, string token, CancellationToken ct) => SendAsync(email, token, "invitation", ct);
    public Task SendRecoveryAsync(string email, string token, CancellationToken ct) => SendAsync(email, token, "recovery", ct);
    public Task SendConfirmationAsync(string email, string token, CancellationToken ct) => SendAsync(email, token, "confirmation", ct);
    private async Task SendAsync(string email, string token, string kind, CancellationToken ct)
    {
        var message = composer.Compose(email, token, kind);
        if (string.IsNullOrWhiteSpace(options.Value.ApiKey)) throw AccountEmailComposer.Unavailable();
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ApiKey);
        request.Headers.Add("Idempotency-Key", "mlp-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(kind + "\n" + email + "\n" + token))));
        request.Content = JsonContent.Create(new {from = message.From, to = new[] {message.To}, subject = message.Subject,
            text = message.Text, html = message.Html, reply_to = message.ReplyTo}, options: Json);
        // Do not retry uncertain sends and never surface provider response bodies or credentials.
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw AccountEmailComposer.Unavailable();
    }
}
