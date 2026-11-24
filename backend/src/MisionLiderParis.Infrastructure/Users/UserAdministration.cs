using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Access;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.Infrastructure.Users;

public sealed class UserAdministration(AuthDbContext database, UserManager<ApplicationUser> manager,
    IAccessService access, IMinistryDirectory directory, AccountAccessValidator accountAccess,
    MinistryDbContext ministry, AccountInvitations invitations) : IUserAdministration
{
    public async Task<UserAdministrationOptions> OptionsAsync(Guid actorId, string operation, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, operation, ct);
        var branches = ministry.Branches.AsNoTracking().Where(b => b.IsActive);
        if (!actor.IsGlobalAdministrator) branches = branches.Where(b => actor.Grants.Select(g => g.BranchId).Contains(b.Id));
        var roles = await directory.GetRolesAsync(ct);
        var permissions = await directory.GetPermissionsAsync(ct);
        return new(roles.Where(r => actor.IsGlobalAdministrator || r.Code == RoleCodes.Operator).ToArray(),
            permissions.Where(p => actor.IsGlobalAdministrator || actor.Grants.Any(g => g.Permissions.Contains(p.Code))).ToArray(),
            await branches.OrderBy(b => b.Name).Select(b => new UserBranchOption(b.Id, b.Name)).ToListAsync(ct));
    }

    public async Task<Page<UserPersonOption>> PeopleOptionsAsync(Guid actorId, int page, string? search, CancellationToken ct, string operation = "USER_CREATE")
    {
        if (operation is not (PermissionCodes.UserCreate or PermissionCodes.UserUpdate)) throw ApiException.Forbidden();
        var actor = await AuthorizeAsync(actorId, operation, ct);
        var paging = new PageRequest(page, 10); var offset = paging.Offset;
        if (string.IsNullOrWhiteSpace(search) || search.Trim().Length is < 3 or > 150)
            throw ApiException.Invalid("Busca por documento exacto de al menos tres caracteres.");
        var number = search.Trim();
        var people = ministry.People.AsNoTracking().Where(p => p.IsActive && p.Documents.Any(d => d.IsCurrent && d.EndedAt == null && d.DocumentNumber == number));
        if (!actor.IsGlobalAdministrator) people = people.Where(p => p.Memberships.Any(m => m.EndedAt == null && m.Branch.IsActive &&
            actor.Grants.Select(g => g.BranchId).Contains(m.BranchId)));
        // Exact document lookup is bounded; no cross-connection join or unbounded account download.
        var found = await people.OrderBy(p => p.LastNames).ThenBy(p => p.Id).Take(101).Select(p => new UserPersonOption(p.Id,
            p.FirstNames + " " + p.LastNames, p.Documents.Where(d => d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentType).First(),
            number, p.Memberships.Where(m => m.EndedAt == null && m.Branch.IsActive).Select(m => (Guid?)m.BranchId).FirstOrDefault(),
            p.Memberships.Where(m => m.EndedAt == null && m.Branch.IsActive).Select(m => m.Branch.Name).FirstOrDefault())).ToListAsync(ct);
        if (found.Count > 100) throw ApiException.Invalid("La identificación requiere una búsqueda más precisa.");
        var ids = found.Select(p => p.Id).ToArray();
        var linked = await database.Users.Where(u => u.PersonId != null && ids.Contains(u.PersonId.Value)).Select(u => u.PersonId).ToArrayAsync(ct);
        var eligible = found.Where(p => !linked.Contains(p.Id)).ToArray();
        return new(eligible.Skip(offset).Take(paging.PageSize).ToArray(), paging.PageNumber, paging.PageSize, eligible.Length);
    }

    public async Task<InvitationResult> InviteAsync(Guid actorId, InviteUserRequest request, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, PermissionCodes.UserCreate, ct);
        await using var branchTransaction = await ministry.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(ministry, request.Grants.Where(g => g is not null && g.BranchId.HasValue).Select(g => g.BranchId!.Value), ct);
        await ValidateGrantsAsync(actor, request.Grants, request.PersonId, ct);
        if (request.PersonId is {} person && !await ministry.Documents.AnyAsync(d => d.PersonId == person && d.IsCurrent && d.EndedAt == null, ct))
            throw ApiException.Invalid("La persona vinculada requiere documento vigente.");
        var user = new ApplicationUser {Id = Guid.NewGuid(), UserName = request.Email.Trim(), Email = request.Email.Trim(),
            DisplayName = request.DisplayName.Trim(), PersonId = request.PersonId, AccessGrants = request.Grants.Select(CreateGrant).ToList()};
        await using (var transaction = await database.Database.BeginTransactionAsync(ct))
        {
            Check(await manager.CreateAsync(user));
            await transaction.CommitAsync(ct);
        }
        await branchTransaction.CommitAsync(ct);
        var status = await invitations.SendAsync(user.Id, ct);
        return new(ToDto(user), status);
    }

    public async Task<string> ResendInvitationAsync(Guid actorId, Guid id, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, PermissionCodes.UserCreate, ct);
        var user = await FindManageableAsync(actor, id, ct);
        return await invitations.SendAsync(user.Id, ct);
    }
    private async Task<AccessScope> AuthorizeAsync(Guid actorId, string permission, CancellationToken ct)
    {
        var scope = await access.GetAsync(actorId, ct);
        return UserAdministrationPolicy.ForOperation(scope, permission) ?? throw ApiException.Forbidden();
    }

    private async Task<ApplicationUser> FindManageableAsync(AccessScope actor, Guid id, CancellationToken ct,
        bool requireDelegable = true)
    {
        var user = await database.Users.Include(x => x.AccessGrants).ThenInclude(g => g.Permissions)
            .SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw ApiException.NotFound();
        if (actor.IsGlobalAdministrator) return user;
        IReadOnlyList<ResolvedGrant> grants;
        try { grants = await directory.ResolveAsync(user.AccessGrants.Select(Reference).ToArray(), ct); }
        catch (ApiException exception) when (exception.StatusCode is 403 or 404) { throw ApiException.NotFound(); }
        if (grants.Count == 0 || grants.Any(g => requireDelegable ? !actor.CanManageGrant(g) :
            g.RoleCode != RoleCodes.Operator || g.BranchId is null ||
            !actor.Grants.Any(a => a.BranchId == g.BranchId))) throw ApiException.NotFound();
        return user;
    }

    public async Task<Page<UserDto>> ListAsync(Guid actorId, UserQuery query, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, PermissionCodes.UserView, ct);
        var paging = new PageRequest(query.Page, query.PageSize);
        var offset = paging.Offset;
        var users = database.Users.AsNoTracking();
        if (!actor.IsGlobalAdministrator)
        {
            var branches = actor.Grants.Where(g => g.RoleCode is RoleCodes.BranchAdmin or RoleCodes.Operator)
                .Select(g => g.BranchId!.Value).ToArray();
            var roles = await directory.GetRolesAsync(ct);
            var operatorIds = roles.Where(r => r.Code == RoleCodes.Operator).Select(r => r.Id).ToArray();
            users = users.Where(u => u.AccessGrants.Any() && u.AccessGrants.All(g =>
                g.BranchId != null && branches.Contains(g.BranchId.Value) && operatorIds.Contains(g.RoleId)));
        }
        if (query.BranchId is { } branch)
        {
            if (!actor.IsGlobalAdministrator && !actor.Can(PermissionCodes.UserView, branch))
                throw ApiException.Forbidden();
            users = users.Where(u => u.AccessGrants.Any(g => g.BranchId == branch));
        }
        if (query.IsActive is { } active) users = users.Where(u => u.IsActive == active);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            if (query.Search.Length > 150) throw ApiException.Invalid("La búsqueda es demasiado larga.");
            var search = query.Search.Trim().ToUpperInvariant();
            users = users.Where(u => u.NormalizedEmail!.Contains(search) || u.DisplayName.ToUpper().Contains(search));
        }
        var total = await users.CountAsync(ct);
        var items = await users.Include(u => u.AccessGrants).ThenInclude(g => g.Permissions)
            .OrderBy(u => u.NormalizedEmail).ThenBy(u => u.Id)
            .Skip(offset).Take(paging.PageSize).ToListAsync(ct);
        var personIds = items.Where(u => u.PersonId != null).Select(u => u.PersonId!.Value).ToArray();
        var names = await ministry.People.AsNoTracking().Where(p => personIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.FirstNames + " " + p.LastNames, ct);
        return new Page<UserDto>(items.Select(u => ToDto(u) with {PersonName = u.PersonId is {} person ? names.GetValueOrDefault(person) : null})
            .ToArray(), paging.PageNumber, paging.PageSize, total);
    }

    public async Task<UserDto> GetAsync(Guid actorId, Guid id, CancellationToken ct)
    {
        var user = await FindManageableAsync(await AuthorizeAsync(actorId, PermissionCodes.UserView, ct), id, ct, requireDelegable: false);
        return ToDto(user) with {PersonName = await ministry.People.AsNoTracking().Where(p => p.Id == user.PersonId)
            .Select(p => p.FirstNames + " " + p.LastNames).SingleOrDefaultAsync(ct)};
    }

    public async Task<UserDto> UpdateAsync(Guid actorId, Guid id, UpdateUserRequest request, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, PermissionCodes.UserUpdate, ct);
        var user = await FindManageableAsync(actor, id, ct);
        var recipientGrants = await directory.ResolveAsync(user.AccessGrants.Select(Reference).ToArray(), ct);
        await accountAccess.ValidateAsync(request.PersonId, recipientGrants, ct);
        var personChanged = user.PersonId != request.PersonId;
        if (personChanged && request.PersonId is {} linked && !await ministry.Documents.AnyAsync(d => d.PersonId == linked && d.IsCurrent && d.EndedAt == null, ct))
            throw ApiException.Invalid("La persona vinculada requiere documento vigente.");
        user.DisplayName = request.DisplayName.Trim();
        user.PersonId = request.PersonId;
        // Linking/unlinking changes the identity's ministry constraints; invalidate old cookies.
        Check(personChanged ? await manager.UpdateSecurityStampAsync(user) : await manager.UpdateAsync(user));
        return ToDto(user);
    }

    public async Task ReplaceGrantsAsync(Guid actorId, Guid id, ReplaceGrantsRequest request, CancellationToken ct)
    {
        var actor = await AuthorizeAsync(actorId, PermissionCodes.UserAssignRole, ct);
        var user = await FindManageableAsync(actor, id, ct);
        if (actorId == id) throw ApiException.Invalid("No se permite cambiar los propios accesos.");
        // Use the same sorted row locks as branch deactivation, held until Identity commits.
        // No ministry data is written by this transaction. No distributed commit is required.
        await using var branchTransaction = await ministry.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(ministry, request.Grants.Concat(user.AccessGrants.Select(Reference))
            .Where(g => g is not null && g.BranchId.HasValue).Select(g => g.BranchId!.Value), ct);
        await ValidateGrantsAsync(actor, request.Grants, user.PersonId, ct);
        if (await IsGlobalUserAsync(user, ct))
            throw ApiException.Invalid("Los cambios de acceso global requieren un procedimiento de mantenimiento revisado.");
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        database.AccessGrants.RemoveRange(user.AccessGrants);
        await database.SaveChangesAsync(ct);
        user.AccessGrants = request.Grants.Select(CreateGrant).ToList();
        // Keys are assigned in constructors; explicitly mark replacements Added before
        // Identity updates the graph, otherwise it treats new grants as existing rows.
        database.AccessGrants.AddRange(user.AccessGrants);
        Check(await manager.UpdateSecurityStampAsync(user));
        await database.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await branchTransaction.CommitAsync(ct);
    }

    public async Task SetActiveAsync(Guid actorId, Guid id, bool active, CancellationToken ct)
    {
        var user = await FindManageableAsync(await AuthorizeAsync(actorId, PermissionCodes.UserChangeStatus, ct), id, ct);
        if (!active && (actorId == id || await IsGlobalUserAsync(user, ct)))
            throw ApiException.Invalid("No se permite desactivar la propia cuenta ni una cuenta global por esta operación.");
        user.IsActive = active;
        Check(await manager.UpdateSecurityStampAsync(user));
    }

    public async Task RevokeAsync(Guid actorId, Guid id, CancellationToken ct)
    {
        var user = await FindManageableAsync(await AuthorizeAsync(actorId, PermissionCodes.UserChangeStatus, ct), id, ct);
        Check(await manager.UpdateSecurityStampAsync(user));
    }

    private async Task<bool> IsGlobalUserAsync(ApplicationUser user, CancellationToken ct) =>
        (await directory.ResolveAsync(user.AccessGrants.Select(Reference)
            .ToArray(), ct)).Any(g => g.RoleCode == RoleCodes.SuperAdmin && g.BranchId is null);

    private async Task ValidateGrantsAsync(AccessScope actor, IReadOnlyList<GrantReference> grants,
        Guid? personId, CancellationToken ct)
    {
        if (grants.Count is < 1 or > 20 || grants.Any(g => g is null) ||
            grants.Select(g => (g.RoleId, g.BranchId)).Distinct().Count() != grants.Count ||
            grants.Any(g => g is null || g.RoleId == Guid.Empty || g.BranchId == Guid.Empty))
            throw ApiException.Invalid("Los accesos deben ser válidos y no estar duplicados.");
        if (grants.Any(g => g.PermissionIds is { } ids &&
            (ids.Length > 128 || ids.Contains(Guid.Empty) || ids.Distinct().Count() != ids.Length)))
            throw ApiException.Invalid("Los permisos explícitos deben ser válidos y no estar duplicados.");
        var resolved = await directory.ResolveAsync(grants, ct);
        if (resolved.Count != grants.Count || resolved.Any(g =>
            !grants.Any(r => r.RoleId == g.RoleId && r.BranchId == g.BranchId) || !actor.CanManageGrant(g)))
            throw ApiException.Forbidden();
        if (resolved.Any(g => g.RoleCode != RoleCodes.Operator && grants.Any(r => r.RoleId == g.RoleId &&
            r.BranchId == g.BranchId && r.PermissionIds is { Length: > 0 })))
            throw ApiException.Invalid("Solo OPERATOR admite permisos explícitos por concesión.");
        await accountAccess.ValidateAsync(personId, resolved, ct);
    }

    public static UserDto ToDto(ApplicationUser user) => new(user.Id, user.Email!, user.DisplayName,
        user.IsActive, user.EmailConfirmed, user.PersonId,
        user.AccessGrants.Select(Reference).ToArray(), user.PasswordHash is not null, user.LockoutEnd);

    private static GrantReference Reference(UserAccessGrant grant) => new(grant.RoleId, grant.BranchId,
        grant.Permissions.Select(p => p.PermissionId).ToArray());
    private static UserAccessGrant CreateGrant(GrantReference reference) => new()
    {
        RoleId = reference.RoleId, BranchId = reference.BranchId,
        Permissions = (reference.PermissionIds ?? []).Select(id => new UserGrantPermission { PermissionId = id }).ToList()
    };

    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded)
            throw ApiException.Invalid("No fue posible guardar la cuenta. Comprueba los datos y la política de contraseña.");
    }
}
