using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

// The state is an opaque 256-bit handle. Proofs and administrator identity stay server-side.
public sealed class GmailPendingAuthorization(Guid administrator, string stamp, string verifier, string browserHash,
    string clientId, string redirectUri, DateTimeOffset expires)
{
    public Guid Administrator { get; } = administrator;
    public string Stamp { get; } = stamp;
    public string Verifier { get; } = verifier;
    public string BrowserHash { get; } = browserHash;
    public string ClientId { get; } = clientId;
    public string RedirectUri { get; } = redirectUri;
    public DateTimeOffset Expires { get; } = expires;
}
public sealed record GmailAuthorizationStart(string Url, string Correlation);
public sealed class GmailOAuthState(IOptions<GoogleGmailOptions> options, TimeProvider clock)
{
    private readonly ConcurrentDictionary<string, GmailPendingAuthorization> pending = new(StringComparer.Ordinal);
    public GmailAuthorizationStart Begin(Guid administrator, string stamp)
    {
        ValidateConfiguration();
        if (administrator == Guid.Empty || string.IsNullOrWhiteSpace(stamp)) throw ApiException.Forbidden();
        var now = clock.GetUtcNow();
        foreach (var item in pending.Where(p => p.Value.Expires <= now)) pending.TryRemove(item.Key, out _);
        if (pending.Count >= 128) throw new ApiException(429, "gmail_oauth_busy", "Hay demasiadas autorizaciones pendientes.");
        var state = Random(); var browser = Random(); var verifier = Random();
        var settings = options.Value;
        var flow = new GmailPendingAuthorization(administrator, stamp, verifier, Hash(browser), settings.ClientId, settings.RedirectUri, now.AddMinutes(5));
        if (!pending.TryAdd(state, flow)) throw InvalidState();
        return new(QueryHelpers.AddQueryString("https://accounts.google.com/o/oauth2/v2/auth", new Dictionary<string,string?> {
            ["client_id"] = settings.ClientId, ["redirect_uri"] = settings.RedirectUri, ["response_type"] = "code",
            ["scope"] = GoogleGmailOptions.Scope, ["access_type"] = "offline", ["prompt"] = "consent",
            ["include_granted_scopes"] = "false", ["login_hint"] = GoogleGmailOptions.Sender, ["state"] = state,
            ["code_challenge"] = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier))),
            ["code_challenge_method"] = "S256"
        }), browser);
    }
    public GmailPendingAuthorization Consume(string? state, string? browser)
    {
        if (state?.Length != 43 || browser?.Length != 43 || !pending.TryGetValue(state, out var flow) ||
            !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(flow.BrowserHash), Convert.FromHexString(Hash(browser)))) throw InvalidState();
        if (!pending.TryRemove(state, out var removed) || !ReferenceEquals(flow, removed) || flow.Expires <= clock.GetUtcNow() ||
            flow.ClientId != options.Value.ClientId || flow.RedirectUri != options.Value.RedirectUri) throw InvalidState();
        return flow;
    }
    public void ValidateConfiguration()
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.ClientId) || string.IsNullOrWhiteSpace(settings.ClientSecret) ||
            !Uri.TryCreate(settings.RedirectUri, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.AbsolutePath != GoogleGmailOptions.CallbackPath || uri.Query.Length > 0 || uri.Fragment.Length > 0 || uri.UserInfo.Length > 0)
            throw new ApiException(503, "gmail_not_configured", "La integración Gmail no está configurada.");
    }
    private static string Random() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static ApiException InvalidState() => new(400, "invalid_google_authorization", "La autorización no es válida o ha caducado. Iníciala de nuevo.");
}
