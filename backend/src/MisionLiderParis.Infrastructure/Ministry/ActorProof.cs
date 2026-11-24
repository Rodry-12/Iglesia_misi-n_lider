using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class ActorProof(IOptions<ActorProofOptions> options)
{
    public static bool IsConfigured(ActorProofOptions settings)
    {
        if (!Regex.IsMatch(settings.KeyId,"\\A[A-Za-z0-9_-]{1,64}\\z")) return false;
        Span<byte> key=stackalloc byte[64];
        try { return Convert.TryFromBase64String(settings.SigningKeyBase64,key,out var length) && length>=32; }
        finally { CryptographicOperations.ZeroMemory(key); }
    }
    public string Sign(Guid actor, string stamp, string transaction, int backend, string database, string login,
        DateTimeOffset expires, Guid? person = null, Guid? branch = null)
    {
        var settings = options.Value;
        if (actor == Guid.Empty || !Regex.IsMatch(settings.KeyId, "\\A[A-Za-z0-9_-]{1,64}\\z") ||
            !Regex.IsMatch(stamp, "\\A[A-Za-z0-9_-]{1,256}\\z") ||
            database.Contains('|') || login.Contains('|') || person.HasValue != branch.HasValue)
            throw new InvalidOperationException("Invalid actor proof configuration or context.");
        byte[] key;
        try { key = Convert.FromBase64String(settings.SigningKeyBase64); }
        catch (FormatException) { throw new InvalidOperationException("Actor signing key is not configured correctly."); }
        try
        {
            if (key.Length is < 32 or > 64) throw new InvalidOperationException("Actor signing key requires 256 to 512 bits.");
            var payload = string.Join('|', "v1", settings.KeyId, actor.ToString(), stamp,
                expires.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), transaction,
                backend.ToString(CultureInfo.InvariantCulture), database, login, person?.ToString() ?? "", branch?.ToString() ?? "");
            var bytes = Encoding.UTF8.GetBytes(payload);
            return Convert.ToBase64String(bytes) + "." + Convert.ToBase64String(HMACSHA256.HashData(key, bytes));
        }
        finally { CryptographicOperations.ZeroMemory(key); }
    }
}
