using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Api.Security;

public sealed class ActiveAccountCookieEvents(SignInManager<ApplicationUser> signInManager)
    : CookieAuthenticationEvents
{
    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        // Every request checks the stamp, rather than accepting a stale cookie for a validation interval.
        var user = await signInManager.ValidateSecurityStampAsync(context.Principal);
        if (user is null || !user.IsActive || user.LockoutEnd > DateTimeOffset.UtcNow ||
            (signInManager.Options.SignIn.RequireConfirmedEmail && !user.EmailConfirmed))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        }
    }

    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
