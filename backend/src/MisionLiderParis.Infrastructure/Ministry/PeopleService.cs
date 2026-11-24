using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Domain.Ministry;
using MisionLiderParis.Infrastructure.Identity;
using Npgsql;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class PeopleService(MinistryDbContext db, AuthDbContext accounts,
    MinistryAuthorization authorization, ActorTransactionContext actorTransaction) : IPeopleService
{
    public async Task<PersonRegistrationOptions> RegistrationOptionsAsync(Guid actor, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PERSON_CREATE", null, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var branchIds = MinistryAuthorization.BranchIds(scope, "PERSON_CREATE");
        var branches = await db.Branches.AsNoTracking().Where(b => b.IsActive &&
            (scope.IsGlobalAdministrator || branchIds.Contains(b.Id))).OrderBy(b => b.Name).ThenBy(b => b.Id)
            .Select(b => new PersonBranchOption(b.Id, b.Name)).ToArrayAsync(ct);
        var allowed = branches.Select(b => b.Id).ToArray();
        var documents = db.Documents.AsNoTracking().Where(d => d.Person.Memberships.Any(m =>
            m.EndedAt == null && allowed.Contains(m.BranchId)));
        var countries = await documents.Select(d => d.IssuingCountry).Distinct().ToArrayAsync(ct);
        var types = await db.DocumentTypes.AsNoTracking().OrderBy(t => t.Name).ThenBy(t => t.Code)
            .Select(t => new DocumentTypeOption(t.Code, t.Name)).ToArrayAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return new(branches, countries.Prepend("CO").Select(x => x.Trim().ToUpperInvariant()).Distinct().Order().ToArray(),
            types);
    }
    private static readonly Expression<Func<Person, PersonDto>> Projection = p => new(p.Id, p.FirstNames, p.LastNames,
        p.Phone, p.Email, p.BirthDate, p.IsActive,
        p.Memberships.Where(m => m.EndedAt == null).Select(m => (Guid?)m.BranchId).FirstOrDefault(),
        p.Documents.Where(d => d.IsCurrent).OrderBy(d => d.Id)
            .Select(d => new DocumentDto(d.Id, d.DocumentType, d.DocumentNumber, d.IssuingCountry, d.IsCurrent, d.EndedAt)).ToArray(),
        p.Memberships.Where(m => m.EndedAt == null).Select(m => m.Branch.Name).FirstOrDefault(),
        p.Documents.Any(), p.CreatedAt, p.UpdatedAt);

    private IQueryable<Person> Scoped(AccessScope scope, string permission) => scope.IsGlobalAdministrator
        ? db.People : db.People.Where(p => p.Memberships.Any(m => m.EndedAt == null &&
            MinistryAuthorization.BranchIds(scope, permission).Contains(m.BranchId)));

    public async Task<PeoplePage> ListAsync(Guid actor, PersonQuery query, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PERSON_VIEW", query.BranchId, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var people = Scoped(scope, "PERSON_VIEW").AsNoTracking();
        if (query.BranchId is { } branch) people = people.Where(p => p.Memberships.Any(m => m.BranchId == branch && m.EndedAt == null));
        if (query.IsActive is { } active) people = people.Where(p => p.IsActive == active);
        if (MinistryAuthorization.Search(query.Search) is { } search)
        {
            var upper = search.ToUpperInvariant();
            people = people.Where(p => p.FirstNames.ToUpper().Contains(upper) || p.LastNames.ToUpper().Contains(upper) ||
                p.Documents.Any(d => d.DocumentNumber.ToUpper().Contains(upper)));
        }
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        var branches = db.Branches.AsNoTracking();
        if (!scope.IsGlobalAdministrator)
            branches = branches.Where(b => MinistryAuthorization.BranchIds(scope, "PERSON_VIEW").Contains(b.Id));
        var branchOptions = await branches.OrderBy(b => b.Name).ThenBy(b => b.Id)
            .Select(b => new PersonBranchOption(b.Id, b.Name)).ToArrayAsync(ct);
        var result = new PeoplePage(await people.OrderBy(p => p.LastNames).ThenBy(p => p.FirstNames).ThenBy(p => p.Id)
            .Skip(offset).Take(page.PageSize).Select(Projection).ToListAsync(ct), page.PageNumber, page.PageSize,
            await people.CountAsync(ct), branchOptions);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<PersonDto> GetAsync(Guid actor, Guid id, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PERSON_VIEW", null, ct);
        var result = await Scoped(scope, "PERSON_VIEW").AsNoTracking().Where(p => p.Id == id).Select(Projection).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound();
        var documents = await db.Documents.AsNoTracking().Where(d => d.PersonId == id).OrderByDescending(d => d.IsCurrent).ThenBy(d => d.CreatedAt)
            .Select(d => new DocumentDto(d.Id, d.DocumentType, d.DocumentNumber, d.IssuingCountry, d.IsCurrent, d.EndedAt)).ToListAsync(ct);
        return result with { Documents = documents };
    }

    public async Task<PersonDto> CreateAsync(Guid actor, CreatePersonRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PERSON_CREATE", request.BranchId, ct);
        MinistryAuthorization.Id(request.BranchId);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [request.BranchId], ct);
        var branch = await db.Branches.SingleOrDefaultAsync(b => b.Id == request.BranchId && b.IsActive, ct)
            ?? throw ApiException.NotFound();
        var person = new Person(); Apply(person, request.Person);
        var document = await NewDocumentAsync(person.Id, request.Document, ct);
        await actorTransaction.SetPersonInsertAsync(db,person.Id,request.BranchId,ct);
        db.People.Add(person); await db.SaveChangesAsync(ct);
        db.Memberships.Add(new PersonBranch { PersonId = person.Id, BranchId = request.BranchId }); await db.SaveChangesAsync(ct);
        db.Documents.Add(document); await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new(person.Id, person.FirstNames, person.LastNames, person.Phone, person.Email, person.BirthDate,
            person.IsActive, request.BranchId, [ToDto(document)], branch.Name, true, person.CreatedAt, person.UpdatedAt);
    }

    public async Task<PersonDto> UpdateAsync(Guid actor, Guid id, PersonRequest request, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var person = await LockVisibleAsync(actor, id, "PERSON_UPDATE", ct);
        // PostgreSQL stores microseconds; compare the version read back from the database,
        // never a locally generated/pre-insert timestamp. Optional for existing API clients.
        if (request.ExpectedUpdatedAt is { } expected && expected != person.UpdatedAt)
            throw new DbUpdateConcurrencyException();
        Apply(person, request); await db.SaveChangesAsync(ct);
        // PERSON_UPDATE need not imply PERSON_VIEW; project only the resource just authorized for this command.
        var result = await db.People.AsNoTracking().Where(p => p.Id == id).Select(Projection).SingleAsync(ct);
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task SetActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var person = await LockVisibleAsync(actor, id, "PERSON_DEACTIVATE", ct);
        if (active)
        {
            if (!await db.Documents.AnyAsync(d => d.PersonId == id && d.IsCurrent, ct))
                throw MinistryAuthorization.Conflict("Se requiere un documento vigente para activar la persona.");
            if (!await db.Memberships.AnyAsync(m => m.PersonId == id && m.EndedAt == null && m.Branch.IsActive, ct))
                throw MinistryAuthorization.Conflict("Se requiere una vinculación vigente con una sede activa para activar la persona.");
        }
        // PUT sets an absolute state. Repeating it must not rotate stamps or change the version again.
        if (person.IsActive == active) { await transaction.CommitAsync(ct); return; }
        if (!active)
        {
            await RequireNoOpenAssignmentsAsync(id, ct);
            var globalRoleIds = await db.Roles.AsNoTracking().Where(r => r.Code == RoleCodes.SuperAdmin && r.IsGlobal)
                .Select(r => r.Id).ToArrayAsync(ct);
            if (await accounts.Users.AnyAsync(u => u.PersonId == id && u.IsActive &&
                u.AccessGrants.Any(g => g.BranchId == null && globalRoleIds.Contains(g.RoleId)), ct))
                throw MinistryAuthorization.Conflict("Primero revisa la vinculación de las cuentas globales de esta persona.");
        }
        person.IsActive = active; AdvanceVersion(person);
        await db.SaveChangesAsync(ct); await RevokeLinkedSessionsAsync(id, ct); await transaction.CommitAsync(ct);
    }

    public async Task<DocumentDto> AddDocumentAsync(Guid actor, Guid id, DocumentRequest request, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockVisibleAsync(actor, id, "PERSON_UPDATE", ct);
        var current = await db.Documents.SingleOrDefaultAsync(d => d.PersonId == id && d.IsCurrent, ct);
        if (current is not null && !request.ReplaceCurrent)
            throw MinistryAuthorization.Conflict("La persona ya tiene documento vigente; indica el reemplazo explícitamente.");
        var document = await NewDocumentAsync(id, request, ct);
        if (current is not null)
        { current.IsCurrent = false; current.EndedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(ct); }
        db.Documents.Add(document); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return ToDto(document);
    }

    public async Task TransferAsync(Guid actor, Guid id, TransferPersonRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PERSON_TRANSFER", null, ct, global: true);
        MinistryAuthorization.Id(request.BranchId);
        var original = await db.Memberships.AsNoTracking().Where(m => m.PersonId == id && m.EndedAt == null)
            .Select(m => (Guid?)m.BranchId).SingleOrDefaultAsync(ct) ?? throw ApiException.NotFound();
        if (original == request.BranchId) throw ApiException.Invalid("La persona ya pertenece a esa sede.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [original, request.BranchId], ct); await MinistryLocks.PeopleAsync(db, [id], ct);
        if (!await db.People.AnyAsync(p => p.Id == id && p.IsActive, ct) ||
            !await db.Branches.AnyAsync(b => b.Id == request.BranchId && b.IsActive, ct)) throw ApiException.NotFound();
        var current = await db.Memberships.SingleOrDefaultAsync(m => m.PersonId == id && m.EndedAt == null, ct);
        if (current is null || current.BranchId != original) throw MinistryAuthorization.Conflict("La vinculación cambió; vuelve a consultar.");
        await RequireNoOpenAssignmentsAsync(id, ct);
        var now = DateTimeOffset.UtcNow;
        current.EndedAt = now; current.DepartureReason = request.Reason.Trim(); await db.SaveChangesAsync(ct);
        db.Memberships.Add(new PersonBranch { PersonId = id, BranchId = request.BranchId, StartedAt = now });
        await db.SaveChangesAsync(ct); await RevokeLinkedSessionsAsync(id, ct); await transaction.CommitAsync(ct);
    }

    public async Task LinkAsync(Guid actor, Guid id, Guid branchId, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PERSON_TRANSFER", null, ct, global: true);
        MinistryAuthorization.Id(branchId);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [branchId], ct); await MinistryLocks.PeopleAsync(db, [id], ct);
        if (!await db.People.AnyAsync(p => p.Id == id && p.IsActive, ct) ||
            !await db.Branches.AnyAsync(b => b.Id == branchId && b.IsActive, ct)) throw ApiException.NotFound();
        if (await db.Memberships.AnyAsync(m => m.PersonId == id && m.EndedAt == null, ct))
            throw MinistryAuthorization.Conflict("La persona ya está vinculada; utiliza la operación de traslado.");
        await RequireNoOpenAssignmentsAsync(id, ct);
        if (!await db.Documents.AnyAsync(d => d.PersonId == id && d.IsCurrent, ct))
            throw MinistryAuthorization.Conflict("Se requiere un documento vigente para vincular la persona.");
        db.Memberships.Add(new PersonBranch { PersonId = id, BranchId = branchId });
        await db.SaveChangesAsync(ct); await RevokeLinkedSessionsAsync(id, ct); await transaction.CommitAsync(ct);
    }

    private async Task<Person> LockVisibleAsync(Guid actor, Guid id, string permission, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, permission, null, ct);
        var snapshot = await Scoped(scope, permission).AsNoTracking().Where(p => p.Id == id)
            .Select(p => new { BranchId = p.Memberships.Where(m => m.EndedAt == null).Select(m => (Guid?)m.BranchId).FirstOrDefault() })
            .SingleOrDefaultAsync(ct) ?? throw ApiException.NotFound();
        if (snapshot.BranchId is { } branch) await MinistryLocks.BranchesAsync(db, [branch], ct);
        await MinistryLocks.PeopleAsync(db, [id], ct);
        return await Scoped(scope, permission).SingleOrDefaultAsync(p => p.Id == id, ct) ?? throw ApiException.NotFound();
    }

    private async Task<PersonDocument> NewDocumentAsync(Guid personId, DocumentRequest request, CancellationToken ct)
    {
        var type = request.DocumentType.Trim().ToUpperInvariant(); var number = request.DocumentNumber.Trim().ToUpperInvariant();
        var country = request.IssuingCountry.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(type) || string.IsNullOrWhiteSpace(number) || country.Length != 2)
            throw ApiException.Invalid("El documento completo es obligatorio.");
        if (await db.Documents.AnyAsync(d => d.IssuingCountry == country && d.DocumentType.ToUpper() == type &&
            d.DocumentNumber.ToUpper() == number, ct))
            throw new ApiException(409, "duplicate_resource", "Ya existe un recurso con esos datos.");
        return new PersonDocument { PersonId = personId, DocumentType = type, DocumentNumber = number, IssuingCountry = country };
    }

    private async Task RequireNoOpenAssignmentsAsync(Guid id, CancellationToken ct)
    {
        if (await db.Assignments.AnyAsync(a => (a.PersonId == id || a.ResponsiblePersonId == id) && !a.State.IsFinal, ct))
            throw MinistryAuthorization.Conflict("Primero finaliza o reasigna los procesos abiertos de la persona o a su cargo.");
    }

    private async Task<int> RevokeLinkedSessionsAsync(Guid id, CancellationToken ct)
    {
        try { return await db.Database.ExecuteSqlInterpolatedAsync($"SELECT auth_app.revoke_person_sessions({id})", ct); }
        // The existing SECURITY DEFINER helper can deny a branch actor for a linked global account,
        // including an inactive account. Preserve that denial and let the caller's transaction roll back.
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.InsufficientPrivilege)
        { throw ApiException.Forbidden(); }
    }

    private static void Apply(Person person, PersonRequest request)
    {
        if (request.BirthDate > DateOnly.FromDateTime(DateTime.UtcNow)) throw ApiException.Invalid("La fecha de nacimiento no puede ser futura.");
        person.FirstNames = request.FirstNames.Trim(); person.LastNames = request.LastNames.Trim();
        person.Phone = request.Phone?.Trim(); person.Email = request.Email?.Trim(); person.BirthDate = request.BirthDate;
        AdvanceVersion(person);
    }
    private static void AdvanceVersion(Person person)
    {
        var now = DateTimeOffset.UtcNow;
        person.UpdatedAt = new DateTimeOffset(Math.Max(now.UtcTicks / 10 * 10,
            person.UpdatedAt.UtcTicks / 10 * 10 + 10), TimeSpan.Zero);
    }
    private static DocumentDto ToDto(PersonDocument document) => new(document.Id, document.DocumentType,
        document.DocumentNumber, document.IssuingCountry, document.IsCurrent, document.EndedAt);
}
