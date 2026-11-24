using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Email;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Api.Controllers;

[ApiController,Route("api/v1/integrations/google"),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class GoogleGmailController(IAccessService access, ActorContext actor, AuthDbContext identity,
    GmailOAuthState states, GoogleGmailClient google, GmailAccessTokens tokens, IAntiforgery antiforgery) : ControllerBase
{
    private const string Cookie="__Host-mlp-gmail-oauth";
    private static CookieOptions CorrelationCookie() => new() {HttpOnly=true,Secure=true,SameSite=SameSiteMode.Lax,Path="/",IsEssential=true,MaxAge=TimeSpan.FromMinutes(5)};
    private async Task RequireAdministratorAsync(CancellationToken ct)
    {
        if (!Request.IsHttps || actor.UserId is not {} id || !(await access.GetAsync(id,ct)).IsGlobalAdministrator) throw ApiException.Forbidden();
    }

    [HttpGet,EnableRateLimiting("authentication")]
    public async Task<ContentResult> Setup(CancellationToken ct)
    {
        await RequireAdministratorAsync(ct);states.ValidateConfiguration();
        Response.Headers.ContentSecurityPolicy="default-src 'none'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'";
        var csrf=antiforgery.GetAndStoreTokens(HttpContext);
        return Content("<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>Autorizar Gmail</title><h1>Autorizar correo institucional</h1>"+
            "<p>Autoriza exclusivamente el envío desde "+GoogleGmailOptions.Sender+".</p>"+
            "<form method=\"post\" action=\"/api/v1/integrations/google/authorize\"><input type=\"hidden\" name=\""+
            HtmlEncoder.Default.Encode(csrf.FormFieldName)+"\" value=\""+HtmlEncoder.Default.Encode(csrf.RequestToken!)+
            "\"><button type=\"submit\">Continuar a Google</button></form></html>","text/html; charset=utf-8");
    }

    [HttpPost("authorize"),EnableRateLimiting("authentication")]
    public async Task<IActionResult> AuthorizeGmail(CancellationToken ct)
    {
        await RequireAdministratorAsync(ct);
        var flow=states.Begin(actor.UserId!.Value,actor.SessionStamp??"");
        Response.Cookies.Append(Cookie,flow.Correlation,CorrelationCookie());
        return Redirect(flow.Url);
    }

    [HttpGet("callback"),AllowAnonymous,EnableRateLimiting("authentication")]
    public async Task<IActionResult> Callback([FromQuery] string? state,[FromQuery] string? code,[FromQuery] string? error,CancellationToken ct)
    {
        if(!Request.IsHttps)throw GmailOAuthState.InvalidState();
        // All correlation, one-time-use, expiry and administrator checks precede the token request.
        var flow=states.Consume(state,Request.Cookies[Cookie]);
        Response.Cookies.Delete(Cookie,CorrelationCookie());
        await ValidateInitiatorAsync(flow,ct);
        if(!string.IsNullOrEmpty(error) || string.IsNullOrWhiteSpace(code) || code.Length>4096)throw GmailOAuthState.InvalidState();
        try {
            var result=await google.ExchangeAsync(code,flow,ct);
            await ValidateInitiatorAsync(flow,ct);
            await tokens.SaveAuthorizationAsync(result,ct);
        }
        catch(GmailAuthorizationRevokedException) {throw GmailOAuthState.InvalidState();}
        Response.StatusCode=303;Response.Headers.Location="/api/v1/integrations/google/complete";
        return new EmptyResult();
    }

    private async Task ValidateInitiatorAsync(GmailPendingAuthorization flow,CancellationToken ct)
    {
        var user=await identity.Users.AsNoTracking().SingleOrDefaultAsync(u=>u.Id==flow.Administrator,ct);
        if(user is null || !user.IsActive || !user.EmailConfirmed || user.TwoFactorEnabled || user.LockoutEnd>DateTimeOffset.UtcNow ||
            user.SecurityStamp!=flow.Stamp)throw ApiException.Forbidden();
        // A validated server-side flow + browser correlation proves the initiating session even
        // when the existing SameSite=Strict Identity cookie is absent on Google's navigation.
        actor.BindAuthenticatedSession(user.Id,flow.Stamp);
        if(!(await access.GetAsync(user.Id,ct)).IsGlobalAdministrator)throw ApiException.Forbidden();
    }

    [HttpGet("complete"),AllowAnonymous]
    public ContentResult Complete() => Content("Finalizó el retorno de Google. La configuración del remitente y la entrega deben comprobarse con una prueba manual autorizada.","text/plain; charset=utf-8");
}
