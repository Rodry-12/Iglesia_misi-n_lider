namespace MisionLiderParis.Application.Health;

public interface IDatabaseConnectivityProbe
{
    Task<bool> CheckAsync(CancellationToken cancellationToken);
}
