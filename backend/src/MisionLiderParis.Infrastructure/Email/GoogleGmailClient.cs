using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class GmailTokens(string accessToken, string? refreshToken, int expiresIn)
{
    public string AccessToken { get; } = accessToken;
    public string? RefreshToken { get; } = refreshToken;
    public int ExpiresIn { get; } = expiresIn;
}
public sealed class GmailAuthorizationRevokedException : Exception;
public sealed class GoogleGmailClient(HttpClient client, IOptions<GoogleGmailOptions> options)
{
    public Task<GmailTokens> ExchangeAsync(string code, GmailPendingAuthorization flow, CancellationToken ct) => TokenAsync(new() {
        ["grant_type"] = "authorization_code", ["code"] = code, ["code_verifier"] = flow.Verifier,
        ["redirect_uri"] = flow.RedirectUri
    }, true, ct);
    public Task<GmailTokens> RefreshAsync(string refreshToken, CancellationToken ct) => TokenAsync(new() {
        ["grant_type"] = "refresh_token", ["refresh_token"] = refreshToken
    }, false, ct);
    private async Task<GmailTokens> TokenAsync(Dictionary<string,string> fields, bool initial, CancellationToken ct)
    {
        fields["client_id"] = options.Value.ClientId; fields["client_secret"] = options.Value.ClientSecret;
        if (string.IsNullOrWhiteSpace(fields["client_id"]) || string.IsNullOrWhiteSpace(fields["client_secret"])) throw AccountEmailComposer.Unavailable();
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token") {Content = new FormUrlEncodedContent(fields)};
        using var response = await client.SendAsync(request, ct);
        JsonDocument json;
        try {json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);}
        catch (JsonException) {throw AccountEmailComposer.Unavailable();}
        using (json)
        {
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object) throw AccountEmailComposer.Unavailable();
            string? Text(string name) => root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
            if (!response.IsSuccessStatusCode)
            {
                if (Text("error") == "invalid_grant") throw new GmailAuthorizationRevokedException();
                throw AccountEmailComposer.Unavailable();
            }
            var scope = Text("scope");
            if ((initial || scope is not null) && (scope?.Split(' ', StringSplitOptions.RemoveEmptyEntries) is not {Length: 1} scopes || scopes[0] != GoogleGmailOptions.Scope))
                throw new ApiException(503, "gmail_scope_invalid", "Google no concedió exclusivamente el permiso de envío requerido.");
            var access = Text("access_token"); var refresh = Text("refresh_token");
            if (string.IsNullOrWhiteSpace(access) || Text("token_type")?.Equals("Bearer", StringComparison.OrdinalIgnoreCase) != true ||
                !root.TryGetProperty("expires_in", out var expiry) || expiry.ValueKind != JsonValueKind.Number || !expiry.TryGetInt32(out var seconds) || seconds is < 1 or > 86400 ||
                (initial && string.IsNullOrWhiteSpace(refresh))) throw AccountEmailComposer.Unavailable();
            return new(access, refresh, seconds);
        }
    }
    public async Task SendAsync(string raw, string accessToken, CancellationToken ct)
    {
        // Explicit mailbox, not 'me': a token for a different Google account cannot send from it.
        using var request = new HttpRequestMessage(HttpMethod.Post,
            "https://gmail.googleapis.com/gmail/v1/users/" + Uri.EscapeDataString(GoogleGmailOptions.Sender) + "/messages/send");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Content = JsonContent.Create(new {raw});
        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized) throw new GmailAuthorizationRevokedException();
        if (!response.IsSuccessStatusCode) throw AccountEmailComposer.Unavailable();
    }
}
