using System.Net.Http.Headers;
using System.Security.Cryptography;
using Microsoft.Extensions.Primitives;

namespace MisionLiderParis.Api.Health;

public sealed class HealthMonitorCredential
{
    private readonly byte[]? expected;

    // Exactly 32 random bytes encoded as 64 hexadecimal characters.
    public HealthMonitorCredential(string? token) => expected = Decode(token);

    public bool Accepts(StringValues authorization)
    {
        if (expected is null || authorization.Count != 1 ||
            !AuthenticationHeaderValue.TryParse(authorization[0], out var header) ||
            !string.Equals(header.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)) return false;
        var supplied = Decode(header.Parameter);
        if (supplied is null) return false;
        try { return CryptographicOperations.FixedTimeEquals(expected, supplied); }
        finally { CryptographicOperations.ZeroMemory(supplied); }
    }

    private static byte[]? Decode(string? value)
    {
        if (value is not { Length: 64 }) return null;
        try { return Convert.FromHexString(value); }
        catch (FormatException) { return null; }
    }
}
