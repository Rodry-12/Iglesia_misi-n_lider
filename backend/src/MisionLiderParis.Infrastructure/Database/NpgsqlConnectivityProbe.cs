using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Health;
using MisionLiderParis.Infrastructure.Configuration;
using Npgsql;

namespace MisionLiderParis.Infrastructure.Database;

public sealed class NpgsqlConnectivityProbe(IOptions<DatabaseOptions> options) : IDatabaseConnectivityProbe
{
    public async Task<bool> CheckAsync(CancellationToken cancellationToken)
    {
        // Same runtime identity, TLS, pooler and pool settings as ministry requests.
        // RuntimeDatabaseValidator already rejects privileged identities on startup.
        var connectionString = options.Value.ConnectionString;
        if (string.IsNullOrWhiteSpace(connectionString)) return false;
        // Cancellation alone does not bound every driver handshake phase. Only cap
        // the existing connection timeout; do not introduce another credential/config.
        var settings = new NpgsqlConnectionStringBuilder(connectionString);
        if (settings.Timeout is 0 or > 3) settings.Timeout = 3;
        await using var connection = new NpgsqlConnection(settings.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT 1", connection) { CommandTimeout = 2 };
        return await command.ExecuteScalarAsync(cancellationToken) is 1;
    }
}
