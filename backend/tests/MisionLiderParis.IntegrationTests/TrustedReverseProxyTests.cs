using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MisionLiderParis.Api.Security;

namespace MisionLiderParis.IntegrationTests;

public sealed class TrustedReverseProxyTests
{
    private static IConfiguration Configuration(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(x => x.Key, x => (string?)x.Value)).Build();

    [Theory]
    [InlineData("10.0.0.2", true)]
    [InlineData("198.51.100.7", false)]
    public async Task OnlyExplicitProxyCanSetHttpsAndClientAddress(string remote, bool trusted)
    {
        var services = new ServiceCollection();
        services.AddOptions();
        services.AddTrustedReverseProxy(Configuration(("ReverseProxy:Enabled", "true"), ("ReverseProxy:KnownProxies:0", "10.0.0.2")));
        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>();
        var context = new DefaultHttpContext();
        context.Request.Scheme = "http";
        context.Connection.RemoteIpAddress = IPAddress.Parse(remote);
        context.Request.Headers["X-Forwarded-Proto"] = "https";
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.8";
        var middleware = new ForwardedHeadersMiddleware(_ => Task.CompletedTask, NullLoggerFactory.Instance, options);
        await middleware.Invoke(context);
        Assert.Equal(trusted ? "https" : "http", context.Request.Scheme);
        Assert.Equal(IPAddress.Parse(trusted ? "203.0.113.8" : remote), context.Connection.RemoteIpAddress);
    }

    [Theory]
    [InlineData("")]
    [InlineData("0.0.0.0")]
    [InlineData("::")]
    [InlineData("not-an-ip")]
    public void EnabledProxyRejectsMissingOrUnsafeTrust(string address)
    {
        Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddTrustedReverseProxy(
            Configuration(("ReverseProxy:Enabled", "true"), ("ReverseProxy:KnownProxies:0", address))));
    }

    [Fact]
    public void DisabledProxyDoesNotEnableForwarding()
    {
        var services = new ServiceCollection();
        services.AddOptions();
        services.AddTrustedReverseProxy(Configuration());
        using var provider = services.BuildServiceProvider();
        Assert.Equal(ForwardedHeaders.None, provider.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value.ForwardedHeaders);
    }
}
