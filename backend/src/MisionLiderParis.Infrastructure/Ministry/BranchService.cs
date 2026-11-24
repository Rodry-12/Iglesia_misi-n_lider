using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Infrastructure.Identity;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class BranchService(MinistryDbContext db, MinistryAuthorization authorization, AuthDbContext identity,
    ActorTransactionContext actorTransaction) : IBranchService
{
    private static readonly Expression<Func<Branch, BranchDto>> Projection = b => new(b.Id, b.Code, b.Name, b.Address, b.Phone, b.IsActive, b.UpdatedAt);

    public async Task<Page<BranchDto>> ListAsync(Guid actor, ListQuery query, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "BRANCH_VIEW", null, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var branches = db.Branches.AsNoTracking();
        if (!scope.IsGlobalAdministrator)
        { var ids = MinistryAuthorization.BranchIds(scope, "BRANCH_VIEW"); branches = branches.Where(b => ids.Contains(b.Id)); }
        if (query.IsActive is { } active) branches = branches.Where(b => b.IsActive == active);
        if (MinistryAuthorization.Search(query.Search) is { } search)
        {
            branches = branches.Where(b =>
                MinistryDbContext.TranslateSearch(b.Name, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()) ||
                MinistryDbContext.TranslateSearch(b.Code, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()));
        }
        var page = new PageRequest(query.Page, query.PageSize);
        var offset = page.Offset;
        var result = new Page<BranchDto>(await branches.OrderBy(b => b.Name).ThenBy(b => b.Id).Skip(offset).Take(page.PageSize)
            .Select(Projection).ToListAsync(ct), page.PageNumber, page.PageSize, await branches.CountAsync(ct));
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<BranchDto> GetAsync(Guid actor, Guid id, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "BRANCH_VIEW", id, ct);
        return await db.Branches.AsNoTracking().Where(b => b.Id == id).Select(Projection).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound();
    }

    public async Task<BranchDto> CreateAsync(Guid actor, BranchRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "BRANCH_CREATE", null, ct, global: true);
        var branch = new Branch(); Apply(branch, request);
        db.Branches.Add(branch);
        await db.SaveChangesAsync(ct);
        return Projection.Compile()(branch);
    }

    public async Task<BranchDto> UpdateAsync(Guid actor, Guid id, BranchRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "BRANCH_UPDATE", id, ct, global: true);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [id], ct);
        var branch = await db.Branches.SingleOrDefaultAsync(b => b.Id == id, ct) ?? throw ApiException.NotFound();
        RequireVersion(branch, request.ExpectedUpdatedAt);
        Apply(branch, request);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Projection.Compile()(branch);
    }

    public async Task SetActiveAsync(Guid actor, Guid id, BranchActiveRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "BRANCH_UPDATE", id, ct, global: true);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [id], ct);
        var branch = await db.Branches.SingleOrDefaultAsync(b => b.Id == id, ct) ?? throw ApiException.NotFound();
        RequireVersion(branch, request.ExpectedUpdatedAt);
        if (!request.IsActive && (await db.Memberships.AnyAsync(m => m.BranchId == id && m.EndedAt == null, ct) ||
            await db.Assignments.AnyAsync(a => a.BranchId == id && !a.State.IsFinal, ct)))
            throw MinistryAuthorization.Conflict("La sede mantiene personas vinculadas o asignaciones abiertas.");
        // Grants have no active/expiry flag. Even a disabled account retains its grant;
        // require explicit removal rather than leaving a latent association on an inactive branch.
        if (!request.IsActive && await identity.AccessGrants.AsNoTracking().AnyAsync(g => g.BranchId == id, ct))
            throw MinistryAuthorization.Conflict("La sede mantiene concesiones de usuarios. Retíralas mediante administración de usuarios antes de desactivarla.");
        branch.IsActive = request.IsActive; branch.UpdatedAt = NextVersion(branch.UpdatedAt);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private static void Apply(Branch branch, BranchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name) ||
            request.Code.Length > 20 || request.Name.Length > 150 || request.Address?.Length > 250 || request.Phone?.Length > 30)
            throw ApiException.Invalid("Revisa el código, nombre, dirección y teléfono de la sede.");
        branch.Code = request.Code.Trim().ToUpperInvariant(); branch.Name = request.Name.Trim();
        branch.Address = request.Address?.Trim(); branch.Phone = request.Phone?.Trim(); branch.UpdatedAt = NextVersion(branch.UpdatedAt);
    }

    private static void RequireVersion(Branch branch, DateTimeOffset? expected)
    {
        if (expected is null) throw ApiException.Invalid("Debes consultar la sede antes de modificarla.");
        if (branch.UpdatedAt != expected.Value)
            throw MinistryAuthorization.Conflict("La sede cambió. Recarga sus datos antes de guardar.");
    }

    // PostgreSQL timestamps have microsecond precision; round before returning the version.
    private static DateTimeOffset NextVersion(DateTimeOffset previous) =>
        new(Math.Max(DateTimeOffset.UtcNow.Ticks / 10 * 10, previous.UtcTicks + 10), TimeSpan.Zero);

    public async Task<Page<BranchAdministratorDto>> AdministratorsAsync(Guid actor, Guid id, int page, int pageSize, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "BRANCH_VIEW", id, ct, global: true);
        var paging = new PageRequest(page, pageSize); var offset = paging.Offset;
        Guid[] roles;
        // Both ministry reads share one signed, read-only scope. Finish it before
        // querying Identity through its separate connection; never dispose a caller's scope.
        await using (var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null)
        {
            if (!await db.Branches.AsNoTracking().AnyAsync(b => b.Id == id, ct)) throw ApiException.NotFound();
            roles = await db.Roles.AsNoTracking().Where(r => r.Code == RoleCodes.BranchAdmin).Select(r => r.Id).ToArrayAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
        }
        var users = identity.Users.AsNoTracking().Where(u => u.AccessGrants.Any(g => g.BranchId == id && roles.Contains(g.RoleId)));
        var total = await users.CountAsync(ct);
        return new(await users.OrderBy(u => u.NormalizedEmail).ThenBy(u => u.Id).Skip(offset).Take(paging.PageSize)
            .Select(u => new BranchAdministratorDto(u.Id, u.DisplayName, u.Email!, u.IsActive)).ToListAsync(ct),
            paging.PageNumber, paging.PageSize, total);
    }
}
