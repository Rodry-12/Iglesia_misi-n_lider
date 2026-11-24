using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class GmailAccessTokens(IGmailCredentialStore store, IHttpClientFactory clients,
    IOptions<GoogleGmailOptions> options, TimeProvider clock)
{
    private readonly SemaphoreSlim gate = new(1,1);
    private string? accessToken;
    private DateTimeOffset expires;
    public async Task SaveAuthorizationAsync(GmailTokens tokens, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tokens.RefreshToken)) throw AccountEmailComposer.Unavailable();
        await gate.WaitAsync(ct);
        try
        {
            await store.SaveAsync(new GmailCredential {ClientId=options.Value.ClientId,RefreshToken=tokens.RefreshToken}, ct);
            accessToken = tokens.AccessToken; expires = clock.GetUtcNow().AddSeconds(Math.Max(0,tokens.ExpiresIn-60));
        }
        finally {gate.Release();}
    }
    public async Task<string> GetAsync(CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            if (accessToken is not null && expires > clock.GetUtcNow()) return accessToken;
            var credential = await store.LoadAsync(ct);
            if (credential is null && !string.IsNullOrWhiteSpace(options.Value.RefreshToken))
            {
                credential = new GmailCredential {ClientId=options.Value.ClientId,RefreshToken=options.Value.RefreshToken};
                await store.SaveAsync(credential, ct);
            }
            if (credential is null || credential.Revoked || credential.ClientId != options.Value.ClientId || string.IsNullOrWhiteSpace(credential.RefreshToken)) throw ReauthorizationRequired();
            var google = new GoogleGmailClient(clients.CreateClient("GoogleGmail"),options);
            GmailTokens tokens;
            try {tokens=await google.RefreshAsync(credential.RefreshToken,ct);}
            catch (GmailAuthorizationRevokedException)
            {
                credential.Revoked = true; credential.RefreshToken = ""; await store.SaveAsync(credential,ct);
                accessToken = null; throw ReauthorizationRequired();
            }
            if (!string.IsNullOrWhiteSpace(tokens.RefreshToken))
            {credential.RefreshToken=tokens.RefreshToken;await store.SaveAsync(credential,ct);}
            accessToken=tokens.AccessToken;expires=clock.GetUtcNow().AddSeconds(Math.Max(0,tokens.ExpiresIn-60));
            return accessToken;
        }
        finally {gate.Release();}
    }
    public async Task RevokeLocalAsync(CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try {accessToken=null;await store.SaveAsync(new GmailCredential {ClientId=options.Value.ClientId,Revoked=true},ct);}
        finally {gate.Release();}
    }
    public static ApiException ReauthorizationRequired() => new(503,"gmail_reauthorization_required","Es necesario volver a autorizar el correo institucional.");
}
