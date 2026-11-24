using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Database;

namespace MisionLiderParis.Api.Security;

public sealed class RuntimeDatabaseValidator(IWebHostEnvironment environment, IOptions<DatabaseOptions> options,
    IOptions<ActorProofOptions> proof) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        if (environment.IsEnvironment("Testing") || string.IsNullOrWhiteSpace(options.Value.ConnectionString)) return;
        await RuntimeDatabaseSafety.VerifyAsync(options.Value.ConnectionString, ct);
        await IdentityDatabaseSafety.VerifyAsync(options.Value.IdentityConnectionString, ct);
        _ = proof.Value;
    }
    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
