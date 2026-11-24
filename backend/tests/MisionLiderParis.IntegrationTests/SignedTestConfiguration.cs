using System.Security.Cryptography;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

internal static class SignedTestConfiguration
{
    internal static string KeyId { get; } = "isolated-" + Guid.NewGuid().ToString("N");
    internal static string SigningKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    private static readonly SemaphoreSlim Gate = new(1);
    private static bool installed;

    internal static async Task ProvisionKeyAsync(string runtime)
    {
        await Gate.WaitAsync();
        try
        {
            if (installed) return;
            var admin = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE"));
            var target = new NpgsqlConnectionStringBuilder(runtime);
            if (admin.Host is not ("127.0.0.1" or "localhost" or "::1") || admin.Database != target.Database ||
                admin.Port != target.Port || admin.Database?.EndsWith("_tests",StringComparison.Ordinal) != true)
                throw new InvalidOperationException("An explicit isolated test operator connection is required.");
            await using var connection = new NpgsqlConnection(admin.ConnectionString);
            await connection.OpenAsync();
            var material=Convert.FromBase64String(SigningKey);
            try { await MisionLiderParis.Infrastructure.Database.ActorKeyProvisioner.InsertAsync(connection,KeyId,material,CancellationToken.None); }
            finally { CryptographicOperations.ZeroMemory(material); }
            installed=true;
        }
        finally { Gate.Release(); }
    }
}
