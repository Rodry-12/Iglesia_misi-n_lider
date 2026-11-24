using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MisionLiderParis.Api.Controllers;

[ApiController, Route("api/v1/auth/csrf")]
public sealed class CsrfController : ControllerBase
{
    [HttpGet, AllowAnonymous]
    public ActionResult<object> Get([FromServices] IAntiforgery antiforgery) =>
        new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken, headerName = "X-XSRF-TOKEN" };
}
