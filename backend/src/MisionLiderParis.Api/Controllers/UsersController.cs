using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Users;
using Microsoft.AspNetCore.RateLimiting;

namespace MisionLiderParis.Api.Controllers;

[ApiController, Route("api/v1/users"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class UsersController(IUserAdministration users, IAccessService access) : ControllerBase
{
    private Guid ActorId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    [HttpGet("administration-options")]
    public Task<UserAdministrationOptions> Options([FromQuery] string operation = "USER_CREATE", CancellationToken ct = default) =>
        users.OptionsAsync(ActorId, operation, ct);
    [HttpGet("people-options")]
    public Task<Page<UserPersonOption>> PeopleOptions([FromQuery] string? search, [FromQuery] int page = 1,
        [FromQuery] string operation = "USER_CREATE", CancellationToken ct = default) =>
        users.PeopleOptionsAsync(ActorId, page, search, ct, operation);
    [HttpPost("invitations"), EnableRateLimiting("authentication")]
    public async Task<ActionResult<InvitationResult>> Invite(InviteUserRequest request, CancellationToken ct)
    {
        var result = await users.InviteAsync(ActorId, request, ct);
        return CreatedAtAction(nameof(Get), new {id = result.User.Id}, result);
    }
    [HttpPost("{id:guid}/invitation"), EnableRateLimiting("authentication")]
    public async Task<IActionResult> ResendInvitation(Guid id, CancellationToken ct) =>
        Accepted(new {deliveryStatus = await users.ResendInvitationAsync(ActorId, id, ct)});

    [HttpGet]
    public Task<Page<UserDto>> List([FromQuery] UserQuery query, CancellationToken ct) => users.ListAsync(ActorId, query, ct);
    [HttpGet("{id:guid}")]
    public Task<UserDto> Get(Guid id, CancellationToken ct) => users.GetAsync(ActorId, id, ct);
    [HttpPost, EnableRateLimiting("authentication")]
    public async Task<ActionResult<UserDto>> Create(InviteUserRequest request, CancellationToken ct)
    {
        // Legacy route now also creates a passwordless invitation; supplied passwords are never applied.
        var user = (await users.InviteAsync(ActorId, request, ct)).User;
        return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
    }
    [HttpPut("{id:guid}")]
    public Task<UserDto> Update(Guid id, UpdateUserRequest request, CancellationToken ct) => users.UpdateAsync(ActorId, id, request, ct);
    [HttpPut("{id:guid}/grants")]
    public async Task<IActionResult> Grants(Guid id, ReplaceGrantsRequest request, CancellationToken ct)
    { await users.ReplaceGrantsAsync(ActorId, id, request, ct); return NoContent(); }
    [HttpPut("{id:guid}/active")]
    public async Task<IActionResult> Active(Guid id, SetUserActiveRequest request, CancellationToken ct)
    { await users.SetActiveAsync(ActorId, id, request.IsActive, ct); return NoContent(); }
    [HttpPost("{id:guid}/revoke-sessions")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    { await users.RevokeAsync(ActorId, id, ct); return NoContent(); }
    [HttpGet("me/permissions")]
    public Task<MisionLiderParis.Domain.Access.AccessScope> Permissions(CancellationToken ct) => access.GetAsync(ActorId, ct);
}
