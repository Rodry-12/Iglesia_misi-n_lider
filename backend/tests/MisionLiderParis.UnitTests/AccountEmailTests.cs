using System.Net;
using System.Text.Json;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Email;

namespace MisionLiderParis.UnitTests;
public sealed class AccountEmailTests
{
    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName {get;set;} = "Testing";
        public string ApplicationName {get;set;} = "MailTests";
        public string ContentRootPath {get;set;} = "";
        public IFileProvider ContentRootFileProvider {get;set;} = new NullFileProvider();
    }
    private sealed class CaptureHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public string? Body {get;private set;} public string? Key {get;private set;} public int Calls {get;private set;}
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; Assert.Equal("https://api.resend.com/emails", request.RequestUri!.ToString());
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            Key = request.Headers.GetValues("Idempotency-Key").Single(); Body = await request.Content!.ReadAsStringAsync(ct);
            return new(status) {Content = new StringContent("{\"id\":\"synthetic-message-id\"}")};
        }
    }
    private static EmailOptions Settings() => new() {From = "access@example.invalid", ReplyTo = "institution@example.invalid",
        InvitationUrl = "https://example.invalid/activar-cuenta", RecoveryUrl = "https://example.invalid/restablecer-contrasena", ConfirmationUrl = "https://example.invalid/confirmar-correo"};
    [Fact]
    public async Task ResendUsesConfiguredSenderEncodedFragmentHtmlAndTextWithoutLeakingTokenIntoIdempotencyKey()
    {
        using var handler = new CaptureHandler(HttpStatusCode.OK); using var client = new HttpClient(handler);
        var sender = new ResendAccountEmailSender(client, Options.Create(new ResendOptions {ApiKey = "synthetic-test-key"}), new(Options.Create(Settings()), new TestEnvironment()));
        await sender.SendInvitationAsync("recipient@example.invalid", "synthetic<token>&", default);
        using var body = JsonDocument.Parse(handler.Body!); var root = body.RootElement;
        Assert.Equal("access@example.invalid", root.GetProperty("from").GetString()); Assert.Equal("recipient@example.invalid", root.GetProperty("to")[0].GetString());
        Assert.Contains("#email=", root.GetProperty("text").GetString()); Assert.Contains("token=synthetic%3Ctoken%3E%26", root.GetProperty("text").GetString());
        Assert.Contains("&amp;token=", root.GetProperty("html").GetString()); Assert.DoesNotContain("synthetic<token>", root.GetProperty("html").GetString());
        var key = handler.Key; await sender.SendInvitationAsync("recipient@example.invalid", "synthetic<token>&", default);
        Assert.Equal(key, handler.Key); Assert.DoesNotContain("token", handler.Key!); Assert.Equal(2, handler.Calls);
    }
    [Theory]
    [InlineData(401)] [InlineData(403)] [InlineData(429)] [InlineData(500)]
    public async Task ResendProviderErrorsAreControlledWithoutRetryOrFallback(int status)
    {
        using var handler = new CaptureHandler((HttpStatusCode)status); using var client = new HttpClient(handler);
        var sender = new ResendAccountEmailSender(client, Options.Create(new ResendOptions {ApiKey = "synthetic-test-key"}), new(Options.Create(Settings()), new TestEnvironment()));
        var failure = await Assert.ThrowsAsync<ApiException>(() => sender.SendRecoveryAsync("recipient@example.invalid", "synthetic-token", default));
        Assert.Equal(503, failure.StatusCode); Assert.DoesNotContain("synthetic", failure.Message); Assert.Equal(1, handler.Calls);
    }
    [Fact]
    public async Task MissingCredentialsNeverCallProvider()
    {
        using var handler = new CaptureHandler(HttpStatusCode.OK); using var client = new HttpClient(handler);
        var sender = new ResendAccountEmailSender(client, Options.Create(new ResendOptions()), new(Options.Create(Settings()), new TestEnvironment()));
        await Assert.ThrowsAsync<ApiException>(() => sender.SendConfirmationAsync("recipient@example.invalid", "synthetic-token", default)); Assert.Equal(0, handler.Calls);
    }
    [Fact]
    public async Task ResendOmitsUnsetReplyToRatherThanSendingNull()
    {
        var settings = Settings(); settings.ReplyTo = "";
        using var handler = new CaptureHandler(HttpStatusCode.OK); using var client = new HttpClient(handler);
        var sender = new ResendAccountEmailSender(client, Options.Create(new ResendOptions {ApiKey = "synthetic-test-key"}), new(Options.Create(settings), new TestEnvironment()));
        await sender.SendConfirmationAsync("recipient@example.invalid", "synthetic-token", default);
        using var body = JsonDocument.Parse(handler.Body!); Assert.False(body.RootElement.TryGetProperty("reply_to", out _));
    }
    [Theory]
    [InlineData("recipient@example.invalid\r\nBcc: injected@example.invalid")]
    [InlineData("invalid address")]
    public void RejectHeaderInjectionAndInvalidRecipients(string email)
    {Assert.Throws<ApiException>(() => new AccountEmailComposer(Options.Create(Settings()), new TestEnvironment()).Compose(email, "synthetic-token", "invitation"));}
    [Theory]
    [InlineData("http://example.invalid/activate")]
    [InlineData("https://localhost/activate")]
    [InlineData("https://example.invalid/activate?untrusted=query")]
    public void RejectUnsafeCallbacksInProduction(string callback)
    {var settings = Settings(); settings.InvitationUrl = callback; Assert.Throws<ApiException>(() => new AccountEmailComposer(Options.Create(settings), new TestEnvironment {EnvironmentName = "Production"}).Compose("recipient@example.invalid", "synthetic-token", "invitation"));}
}
