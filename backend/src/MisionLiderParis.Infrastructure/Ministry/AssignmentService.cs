using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Access;
using MisionLiderParis.Domain.Formation;
using MisionLiderParis.Domain.Ministry;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class AssignmentService(MinistryDbContext db, MinistryAuthorization authorization,
    ActorTransactionContext actorTransaction) : IAssignmentService
{
    // Selection contracts deliberately require ASSIGN, never independent directory/catalog read grants.
    public async Task<AssignmentSelectionOptions> OptionsAsync(Guid actor, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_ASSIGN", null, ct);
        var categories = await db.Categories.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Description, c.SortOrder, c.IsActive)).ToListAsync(ct);
        var processes = await db.Processes.AsNoTracking().Where(p => p.IsActive && p.Category.IsActive)
            .OrderBy(p => p.SortOrder).ThenBy(p => p.Name)
            .Select(p => new ProcessDto(p.Id, p.CategoryId, p.Name, p.Description, p.SortOrder, p.IsActive)).ToListAsync(ct);
        var initial = await db.States.AsNoTracking().Where(s => s.Code == "PENDING" && !s.IsFinal)
            .Select(s => new StateDto(s.Id, s.Code, s.Name, s.IsFinal)).SingleOrDefaultAsync(ct)
            ?? throw new ApiException(503, "state_catalog_unavailable", "El catálogo de estados no está disponible.");
        return new(categories, processes, initial);
    }

    public async Task<Page<AssignmentPersonOption>> PeopleOptionsAsync(Guid actor, AssignmentPeopleQuery query, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PROCESS_ASSIGN", query.BranchId, ct);
        var branches = MinistryAuthorization.BranchIds(scope, "PROCESS_ASSIGN");
        var people = db.Memberships.AsNoTracking().Where(m => m.EndedAt == null && m.Branch.IsActive && m.Person.IsActive &&
            m.Person.Documents.Any(d => d.IsCurrent && d.EndedAt == null));
        if (!scope.IsGlobalAdministrator) people = people.Where(m => branches.Contains(m.BranchId));
        if (query.BranchId is {} branch) people = people.Where(m => m.BranchId == branch);
        if (query.ExcludePersonId is {} exclude) people = people.Where(m => m.PersonId != exclude);
        return await PeoplePageAsync(people, new PageRequest(query.Page, query.PageSize), query.Search, ct);
    }

    public async Task<Page<AssignmentPersonOption>> ResponsibleOptionsAsync(Guid actor, Guid id, PageRequest page, string? search, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PROCESS_CHANGE_RESPONSIBLE", null, ct);
        var assignment = await Scoped(scope, "PROCESS_CHANGE_RESPONSIBLE").AsNoTracking().Include(a => a.State)
            .SingleOrDefaultAsync(a => a.Id == id, ct) ?? throw ApiException.NotFound();
        if (assignment.State.IsFinal) throw MinistryAuthorization.Conflict("No se modifica el responsable de una asignación finalizada.");
        var people = db.Memberships.AsNoTracking().Where(m => m.BranchId == assignment.BranchId &&
            m.EndedAt == null && m.Branch.IsActive && m.Person.IsActive &&
            m.PersonId != assignment.PersonId && m.PersonId != assignment.ResponsiblePersonId &&
            m.Person.Documents.Any(d => d.IsCurrent && d.EndedAt == null));
        return await PeoplePageAsync(people, page, search, ct);
    }

    private static async Task<Page<AssignmentPersonOption>> PeoplePageAsync(IQueryable<PersonBranch> people,
        PageRequest page, string? term, CancellationToken ct)
    {
        if (MinistryAuthorization.Search(term) is {} search)
            people = people.Where(m =>
                MinistryDbContext.TranslateSearch(m.Person.FirstNames + " " + m.Person.LastNames,
                    SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()) ||
                m.Person.Documents.Any(d => d.IsCurrent && d.EndedAt == null &&
                    MinistryDbContext.TranslateSearch(d.DocumentNumber, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                        .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper())));
        return new(await people.OrderBy(m => m.Person.LastNames).ThenBy(m => m.Person.FirstNames).ThenBy(m => m.PersonId)
            .Skip(page.Offset).Take(page.PageSize).Select(m => new AssignmentPersonOption(m.PersonId,
                m.Person.FirstNames + " " + m.Person.LastNames, m.BranchId, m.Branch.Name,
                m.Person.Documents.Where(d => d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentType).First(),
                m.Person.Documents.Where(d => d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentNumber).First()))
            .ToListAsync(ct), page.PageNumber, page.PageSize, await people.CountAsync(ct));
    }
    // Correlated projections keep the assignment even when a related person is hidden by RLS
    // (for example after a transfer). No privileged lookup and no query per returned row.
    private Expression<Func<ProcessAssignment, AssignmentDto>> Projection => a =>
        new(a.Id, a.PersonId, a.ProcessId, a.ResponsiblePersonId, a.BranchId, a.State.Code, a.AssignedAt, a.StartedAt, a.FinishedAt,
            db.People.Where(p => p.Id == a.PersonId).Select(p => p.FirstNames + " " + p.LastNames).FirstOrDefault(),
            db.Documents.Where(d => d.PersonId == a.PersonId && d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentType).FirstOrDefault(),
            db.Documents.Where(d => d.PersonId == a.PersonId && d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentNumber).FirstOrDefault(),
            a.Process.Name, a.Process.CategoryId, a.Process.Category.Name, a.Process.Description,
            db.People.Where(p => p.Id == a.ResponsiblePersonId).Select(p => p.FirstNames + " " + p.LastNames).FirstOrDefault(),
            a.Branch.Name, a.State.Name);
    private IQueryable<ProcessAssignment> Scoped(AccessScope scope, string permission) => scope.IsGlobalAdministrator
        ? db.Assignments : db.Assignments.Where(a => MinistryAuthorization.BranchIds(scope, permission).Contains(a.BranchId));

    public async Task<AssignmentPage> ListAsync(Guid actor, AssignmentQuery query, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PROCESS_VIEW", query.BranchId, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var visible = Scoped(scope, "PROCESS_VIEW").AsNoTracking();
        var assignments = FilterAssignments(visible, query);
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        var ordered = query.OrderByCategory
            ? assignments.OrderBy(a => a.Process.Category.SortOrder).ThenBy(a => a.Process.Category.Name).ThenBy(a => a.Process.CategoryId)
                .ThenBy(a => a.Process.SortOrder).ThenBy(a => a.Process.Name).ThenBy(a => a.ProcessId)
                .ThenByDescending(a => a.AssignedAt).ThenBy(a => a.Id)
            : assignments.OrderByDescending(a => a.AssignedAt).ThenBy(a => a.Id);
        var result = new AssignmentPage(await ordered.Skip(offset).Take(page.PageSize)
            .Select(Projection).ToListAsync(ct), page.PageNumber, page.PageSize, await assignments.CountAsync(ct),
            query.IncludeFilters ? await FilterOptionsAsync(scope, ct) : null);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    private IQueryable<ProcessAssignment> FilterAssignments(IQueryable<ProcessAssignment> visible, AssignmentQuery query)
    {
        var assignments = visible;
        if (query.BranchId is { } branch) assignments = assignments.Where(a => a.BranchId == branch);
        if (query.ProcessId is { } process) assignments = assignments.Where(a => a.ProcessId == process);
        if (query.PersonId is { } person) assignments = assignments.Where(a => a.PersonId == person);
        if (query.ResponsiblePersonId is { } responsible) assignments = assignments.Where(a => a.ResponsiblePersonId == responsible);
        if (query.CategoryId is { } category) assignments = assignments.Where(a => a.Process.CategoryId == category);
        if (MinistryAuthorization.Search(query.Search) is { } search)
            assignments = assignments.Where(a => db.People.Any(p => p.Id == a.PersonId &&
                MinistryDbContext.TranslateSearch(p.FirstNames + " " + p.LastNames, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper())) ||
                db.Documents.Any(d => d.PersonId == a.PersonId && d.IsCurrent && d.EndedAt == null &&
                    MinistryDbContext.TranslateSearch(d.DocumentNumber, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                        .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper())));
        if (query.StateCode is { } state)
        { Parse(state); assignments = assignments.Where(a => a.State.Code == state); }
        return assignments;
    }

    public async Task<AssignmentParticipantPage> ParticipantsAsync(Guid actor, AssignmentQuery query, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PROCESS_VIEW", query.BranchId, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var visible = Scoped(scope, "PROCESS_VIEW").AsNoTracking();
        // All selected criteria must match the same assignment, before grouping and pagination.
        var matching = FilterAssignments(visible, query);
        var people = matching.Select(a => a.PersonId).Distinct();
        var page = new PageRequest(query.Page, query.PageSize);
        var total = await people.CountAsync(ct);
        var rows = await people.Select(id => new {
            PersonId = id,
            PersonName = db.People.Where(p => p.Id == id).Select(p => p.FirstNames + " " + p.LastNames).FirstOrDefault(),
            DocumentType = db.Documents.Where(d => d.PersonId == id && d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentType).FirstOrDefault(),
            DocumentNumber = db.Documents.Where(d => d.PersonId == id && d.IsCurrent && d.EndedAt == null).Select(d => d.DocumentNumber).FirstOrDefault()
        }).OrderBy(p => p.PersonName).ThenBy(p => p.PersonId).Skip(page.Offset).Take(page.PageSize).ToListAsync(ct);
        var ids = rows.Select(p => p.PersonId).ToArray();
        // One batch, scoped to matching visible assignments. No privileged lookup or N+1.
        var branches = await matching.Where(a => ids.Contains(a.PersonId))
            .Select(a => new { a.PersonId, a.BranchId, a.Branch.Name }).Distinct().OrderBy(b => b.Name).ToListAsync(ct);
        var result = new AssignmentParticipantPage(rows.Select(p => new AssignmentParticipantDto(
            p.PersonId, p.PersonName, p.DocumentType, p.DocumentNumber,
            branches.Where(b => b.PersonId == p.PersonId).Select(b => new AssignmentNamedOption(b.BranchId, b.Name)).ToArray())).ToArray(),
            page.PageNumber, page.PageSize, total, query.IncludeFilters ? await FilterOptionsAsync(scope, ct) : null);
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    private async Task<AssignmentFilterOptions> FilterOptionsAsync(AccessScope scope, CancellationToken ct)
    {
        var branches = db.Branches.AsNoTracking();
        if (!scope.IsGlobalAdministrator) branches = branches.Where(b => MinistryAuthorization.BranchIds(scope, "PROCESS_VIEW").Contains(b.Id));
        var people = db.Memberships.AsNoTracking().Where(m => m.EndedAt == null && m.Branch.IsActive && m.Person.IsActive);
        if (!scope.IsGlobalAdministrator)
        {
            var branchIds = MinistryAuthorization.BranchIds(scope, "PROCESS_VIEW");
            people = people.Where(m => branchIds.Contains(m.BranchId));
        }
        return new(await branches.OrderBy(b => b.Name).Select(b => new AssignmentNamedOption(b.Id, b.Name)).ToListAsync(ct),
            await db.Categories.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.Name).ThenBy(c => c.Id)
                .Select(c => new AssignmentNamedOption(c.Id, c.Name)).ToListAsync(ct),
            await db.Processes.AsNoTracking().Where(p => p.IsActive && p.Category.IsActive).OrderBy(p => p.Name).ThenBy(p => p.Id)
                .Select(p => new AssignmentProcessOption(p.Id, p.Name, p.CategoryId)).ToListAsync(ct),
            await people.Select(m => new {Id = m.PersonId, Name = m.Person.FirstNames + " " + m.Person.LastNames})
                .Distinct().OrderBy(o => o.Name).Select(o => new AssignmentNamedOption(o.Id, o.Name)).ToListAsync(ct),
            await StateCatalogAsync(ct));
    }

    public async Task<AssignmentDto> GetAsync(Guid actor, Guid id, CancellationToken ct)
    {
        var scope = await authorization.RequireAsync(actor, "PROCESS_VIEW", null, ct);
        return await Scoped(scope, "PROCESS_VIEW").AsNoTracking().Where(a => a.Id == id).Select(Projection).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound();
    }

    public async Task<AssignmentDto> AssignAsync(Guid actor, AssignProcessRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_ASSIGN", request.BranchId, ct);
        MinistryAuthorization.Id(request.PersonId); MinistryAuthorization.Id(request.ResponsiblePersonId);
        MinistryAuthorization.Id(request.ProcessId); MinistryAuthorization.Id(request.BranchId);
        if (request.PersonId == request.ResponsiblePersonId) throw ApiException.Invalid("El participante y responsable deben ser diferentes.");
        var category = await db.Processes.AsNoTracking().Where(p => p.Id == request.ProcessId).Select(p => p.CategoryId).SingleOrDefaultAsync(ct);
        if (category == Guid.Empty) throw ApiException.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [request.BranchId], ct); await MinistryLocks.CategoryAsync(db, category, ct);
        await MinistryLocks.ProcessAsync(db, request.ProcessId, ct);
        await MinistryLocks.PeopleAsync(db, [request.PersonId, request.ResponsiblePersonId], ct);
        await ValidateAssignmentAsync(request.BranchId, request.ProcessId, category, request.PersonId, request.ResponsiblePersonId, ct);
        // Legacy people without identification remain valid directory records, but cannot receive new assignments.
        if (!await db.Documents.AnyAsync(d => d.PersonId == request.PersonId && d.IsCurrent && d.EndedAt == null, ct) ||
            !await db.Documents.AnyAsync(d => d.PersonId == request.ResponsiblePersonId && d.IsCurrent && d.EndedAt == null, ct))
            throw MinistryAuthorization.Conflict("Participante y responsable requieren documento vigente.");
        if (await db.Assignments.AnyAsync(a => a.PersonId == request.PersonId && a.ProcessId == request.ProcessId && !a.State.IsFinal, ct))
            throw MinistryAuthorization.Conflict("La persona ya tiene una asignación abierta de ese proceso.");
        var pending = await db.States.SingleOrDefaultAsync(s => s.Code == "PENDING" && !s.IsFinal, ct)
            ?? throw new ApiException(503, "state_catalog_unavailable", "El catálogo de estados no está disponible.");
        var assignment = new ProcessAssignment { PersonId = request.PersonId, ProcessId = request.ProcessId,
            ResponsiblePersonId = request.ResponsiblePersonId, BranchId = request.BranchId, StateId = pending.Id };
        db.Assignments.Add(assignment); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Dto(assignment, pending.Code);
    }

    public async Task<AssignmentDto> ChangeStateAsync(Guid actor, Guid id, string stateCode, CancellationToken ct)
    {
        var targetStatus = Parse(stateCode);
        var scope = await authorization.RequireAsync(actor, "PROCESS_CHANGE_STATUS", null, ct);
        var snapshot = await Scoped(scope, "PROCESS_CHANGE_STATUS").AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct)
            ?? throw ApiException.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [snapshot.BranchId], ct);
        await MinistryLocks.PeopleAsync(db, [snapshot.PersonId, snapshot.ResponsiblePersonId], ct);
        await MinistryLocks.AssignmentAsync(db, id, ct);
        var assignment = await Scoped(scope, "PROCESS_CHANGE_STATUS").Include(a => a.State).SingleOrDefaultAsync(a => a.Id == id, ct)
            ?? throw ApiException.NotFound();
        if (assignment.BranchId != snapshot.BranchId || assignment.PersonId != snapshot.PersonId ||
            assignment.ResponsiblePersonId != snapshot.ResponsiblePersonId)
            throw MinistryAuthorization.Conflict("La asignación cambió; vuelve a consultarla.");
        if (assignment.State.Code == stateCode) return Dto(assignment, stateCode);
        if (!AssignmentLifecycle.CanTransition(Parse(assignment.State.Code), targetStatus))
            throw MinistryAuthorization.Conflict("La transición de estado no está permitida.");
        var target = await db.States.SingleOrDefaultAsync(s => s.Code == stateCode, ct)
            ?? throw new ApiException(503, "state_catalog_unavailable", "El catálogo de estados no está disponible.");
        if (!target.IsFinal)
            await ValidatePeopleAsync(assignment.BranchId, assignment.PersonId, assignment.ResponsiblePersonId, ct);
        var now = DateTimeOffset.UtcNow;
        if (targetStatus is AssignmentStatus.InProgress or AssignmentStatus.Suspended) assignment.StartedAt ??= now;
        if (targetStatus is AssignmentStatus.Completed or AssignmentStatus.Withdrawn) assignment.FinishedAt = now;
        if (targetStatus == AssignmentStatus.Withdrawn && assignment.StartedAt is null)
        {
            var fixedCheck = await db.Database.SqlQueryRaw<bool>("""
                SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE
                    conrelid = 'iglesia.persona_proceso'::regclass AND conname = 'ck_persona_proceso_fechas_v2' AND convalidated) AS "Value"
                """).SingleAsync(ct);
            if (!fixedCheck) throw new ApiException(503, "assignment_integrity_migration_required",
                "La base requiere la corrección revisada de fechas antes de retirar una asignación sin inicio.");
        }
        if (!AssignmentLifecycle.HasValidDates(targetStatus, new(assignment.AssignedAt, assignment.StartedAt, assignment.FinishedAt)))
            throw MinistryAuthorization.Conflict("Las fechas no son consistentes con el estado.");
        assignment.StateId = target.Id; assignment.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        // Return dates actually persisted at PostgreSQL microsecond precision. The write
        // response stays minimal: CHANGE_STATUS does not grant the independent VIEW capability.
        var persisted = await db.Assignments.AsNoTracking().Include(a => a.State).SingleAsync(a => a.Id == id, ct);
        var result = Dto(persisted, persisted.State.Code);
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<AssignmentDto> ChangeResponsibleAsync(Guid actor, Guid id, Guid responsibleId, CancellationToken ct, Guid? expectedResponsibleId = null)
    {
        MinistryAuthorization.Id(responsibleId);
        var scope = await authorization.RequireAsync(actor, "PROCESS_CHANGE_RESPONSIBLE", null, ct);
        var snapshot = await Scoped(scope, "PROCESS_CHANGE_RESPONSIBLE").AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct)
            ?? throw ApiException.NotFound();
        if (responsibleId == snapshot.PersonId) throw ApiException.Invalid("El responsable no puede ser el participante.");
        var category = await db.Processes.AsNoTracking().Where(p => p.Id == snapshot.ProcessId).Select(p => p.CategoryId).SingleAsync(ct);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.BranchesAsync(db, [snapshot.BranchId], ct); await MinistryLocks.CategoryAsync(db, category, ct);
        await MinistryLocks.ProcessAsync(db, snapshot.ProcessId, ct);
        await MinistryLocks.PeopleAsync(db, [snapshot.PersonId, snapshot.ResponsiblePersonId, responsibleId], ct);
        await MinistryLocks.AssignmentAsync(db, id, ct);
        var assignment = await Scoped(scope, "PROCESS_CHANGE_RESPONSIBLE").Include(a => a.State).SingleOrDefaultAsync(a => a.Id == id, ct)
            ?? throw ApiException.NotFound();
        if (assignment.PersonId != snapshot.PersonId || assignment.ResponsiblePersonId != snapshot.ResponsiblePersonId ||
            assignment.BranchId != snapshot.BranchId || assignment.ProcessId != snapshot.ProcessId)
            throw MinistryAuthorization.Conflict("La asignación cambió; vuelve a consultarla.");
        if (assignment.State.IsFinal) throw MinistryAuthorization.Conflict("No se modifica el responsable de una asignación finalizada.");
        if (expectedResponsibleId is {} expected && assignment.ResponsiblePersonId != expected)
            throw MinistryAuthorization.Conflict("El responsable cambió; vuelve a consultar la asignación.");
        await ValidateAssignmentAsync(assignment.BranchId, assignment.ProcessId, category, assignment.PersonId, responsibleId, ct);
        if (!await db.Documents.AnyAsync(d => d.PersonId == responsibleId && d.IsCurrent && d.EndedAt == null, ct))
            throw MinistryAuthorization.Conflict("El responsable requiere documento vigente.");
        if (assignment.ResponsiblePersonId == responsibleId) return Dto(assignment, assignment.State.Code);
        assignment.ResponsiblePersonId = responsibleId; assignment.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var persisted = await db.Assignments.AsNoTracking().Include(a => a.State).SingleAsync(a => a.Id == id, ct);
        var result = Dto(persisted, persisted.State.Code);
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<IReadOnlyList<StateDto>> StatesAsync(Guid actor, CancellationToken ct, Guid? assignmentId = null)
    {
        if (assignmentId is {} id)
        {
            var scope = await authorization.RequireAsync(actor, "PROCESS_CHANGE_STATUS", null, ct);
            var code = await Scoped(scope, "PROCESS_CHANGE_STATUS").AsNoTracking().Where(a => a.Id == id)
                .Select(a => a.State.Code).SingleOrDefaultAsync(ct) ?? throw ApiException.NotFound();
            var current = Parse(code);
            return (await StateCatalogAsync(ct)).Where(s => AssignmentLifecycle.CanTransition(current, Parse(s.Code))).ToArray();
        }
        await authorization.RequireAsync(actor, "PROCESS_VIEW", null, ct);
        return await StateCatalogAsync(ct);
    }

    private async Task<IReadOnlyList<StateDto>> StateCatalogAsync(CancellationToken ct) =>
        await db.States.AsNoTracking().OrderBy(s => s.Code).Select(s => new StateDto(s.Id, s.Code, s.Name, s.IsFinal)).ToListAsync(ct);

    private async Task ValidateAssignmentAsync(Guid branch, Guid process, Guid category, Guid person, Guid responsible, CancellationToken ct)
    {
        if (!await db.Processes.AnyAsync(p => p.Id == process && p.CategoryId == category && p.IsActive && p.Category.IsActive, ct))
            throw MinistryAuthorization.Conflict("El proceso o su categoría cambiaron o están inactivos.");
        await ValidatePeopleAsync(branch, person, responsible, ct);
    }

    private async Task ValidatePeopleAsync(Guid branch, Guid person, Guid responsible, CancellationToken ct)
    {
        if (!await db.Branches.AnyAsync(b => b.Id == branch && b.IsActive, ct)) throw MinistryAuthorization.Conflict("La sede está inactiva.");
        if (!await db.People.AnyAsync(p => p.Id == person && p.IsActive && p.Memberships.Any(m => m.BranchId == branch && m.EndedAt == null), ct) ||
            !await db.People.AnyAsync(p => p.Id == responsible && p.IsActive && p.Memberships.Any(m => m.BranchId == branch && m.EndedAt == null), ct))
            throw MinistryAuthorization.Conflict("Participante y responsable deben estar activos y vinculados a la misma sede.");
    }

    private static AssignmentStatus Parse(string code) => code switch
    {
        "PENDING" => AssignmentStatus.Pending, "IN_PROGRESS" => AssignmentStatus.InProgress,
        "SUSPENDED" => AssignmentStatus.Suspended, "COMPLETED" => AssignmentStatus.Completed,
        "WITHDRAWN" => AssignmentStatus.Withdrawn, _ => throw ApiException.Invalid("Estado no permitido.")
    };
    private static AssignmentDto Dto(ProcessAssignment a, string state) =>
        new(a.Id, a.PersonId, a.ProcessId, a.ResponsiblePersonId, a.BranchId, state, a.AssignedAt, a.StartedAt, a.FinishedAt);
}
