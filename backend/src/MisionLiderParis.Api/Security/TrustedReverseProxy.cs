using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace MisionLiderParis.Api.Security;

public static class TrustedReverseProxy
{
    public static IServiceCollection AddTrustedReverseProxy(this IServiceCollection services, IConfiguration configuration)
    {
        if (!configuration.GetValue<bool>("ReverseProxy:Enabled")) return services;
        var entries = configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [];
        var limit = configuration.GetValue("ReverseProxy:ForwardLimit", 1);
        if (entries.Length == 0 || limit is < 1 or > 3)
            throw new InvalidOperationException("Reverse proxy requires explicit trusted IP addresses and a forward limit between 1 and 3.");
        var addresses = new List<IPAddress>();
        foreach (var entry in entries)
        {
            if (!IPAddress.TryParse(entry, out var address) || address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any))
                throw new InvalidOperationException("Reverse proxy addresses must be explicit valid IP addresses.");
            addresses.Add(address);
        }
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = limit;
            options.RequireHeaderSymmetry = true;
            options.KnownProxies.Clear();
            options.KnownIPNetworks.Clear();
            foreach (var address in addresses) options.KnownProxies.Add(address);
        });
        return services;
    }
}
