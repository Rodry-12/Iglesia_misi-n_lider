using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;

namespace MisionLiderParis.Api.Controllers;

public abstract class MinistryController : ControllerBase
{
    protected Guid Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id : throw new ApiException(401, "invalid_session", "La sesión no es válida.");
}

[ApiController, Route("api/v1/branches")]
public sealed class BranchesController(IBranchService branches, IReportService reports) : MinistryController
{
    [HttpGet]
    public Task<Page<BranchDto>> List([FromQuery] ListQuery query, CancellationToken ct) => branches.ListAsync(Actor, query, ct);
    [HttpGet("{id:guid}")]
    public Task<BranchDto> Get(Guid id, CancellationToken ct) => branches.GetAsync(Actor, id, ct);
    [HttpPost]
    public async Task<ActionResult<BranchDto>> Create(BranchRequest request, CancellationToken ct)
    { var branch = await branches.CreateAsync(Actor, request, ct); return CreatedAtAction(nameof(Get), new { id = branch.Id }, branch); }
    [HttpPut("{id:guid}")]
    public Task<BranchDto> Update(Guid id, BranchRequest request, CancellationToken ct) => branches.UpdateAsync(Actor, id, request, ct);
    [HttpPut("{id:guid}/active")]
    public async Task<IActionResult> Active(Guid id, BranchActiveRequest request, CancellationToken ct)
    { await branches.SetActiveAsync(Actor, id, request, ct); return NoContent(); }
    [HttpGet("{id:guid}/administrators")]
    public Task<Page<BranchAdministratorDto>> Administrators(Guid id, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25, CancellationToken ct = default) => branches.AdministratorsAsync(Actor, id, page, pageSize, ct);
    [HttpGet("{id:guid}/indicators")]
    public Task<SummaryDto> Indicators(Guid id, CancellationToken ct) => reports.SummaryAsync(Actor, id, ct);
    [HttpGet("{id:guid}/people-count")]
    public async Task<object> PeopleCount(Guid id, CancellationToken ct)
    { var summary = await reports.SummaryAsync(Actor, id, ct); return new { summary.BranchId, summary.TotalPeople, summary.ActivePeople }; }
}

[ApiController, Route("api/v1/people")]
[ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
public sealed class PeopleController(IPeopleService people, IAssignmentService assignments) : MinistryController
{
    [HttpGet("registration-options")]
    public Task<PersonRegistrationOptions> RegistrationOptions(CancellationToken ct) => people.RegistrationOptionsAsync(Actor, ct);
    [HttpGet]
    public Task<PeoplePage> List([FromQuery] PersonQuery query, CancellationToken ct) => people.ListAsync(Actor, query, ct);
    [HttpGet("{id:guid}")]
    public Task<PersonDto> Get(Guid id, CancellationToken ct) => people.GetAsync(Actor, id, ct);
    [HttpPost]
    public async Task<ActionResult<PersonDto>> Create(CreatePersonRequest request, CancellationToken ct)
    { var person = await people.CreateAsync(Actor, request, ct); return CreatedAtAction(nameof(Get), new { id = person.Id }, person); }
    [HttpPut("{id:guid}")]
    public Task<PersonDto> Update(Guid id, PersonRequest request, CancellationToken ct) => people.UpdateAsync(Actor, id, request, ct);
    [HttpPut("{id:guid}/active")]
    public async Task<IActionResult> Active(Guid id, ActiveRequest request, CancellationToken ct)
    { await people.SetActiveAsync(Actor, id, request.IsActive, ct); return NoContent(); }
    [HttpGet("{id:guid}/documents")]
    public async Task<IReadOnlyList<DocumentDto>> Documents(Guid id, CancellationToken ct) => (await people.GetAsync(Actor, id, ct)).Documents;
    [HttpPost("{id:guid}/documents")]
    public async Task<ActionResult<DocumentDto>> AddDocument(Guid id, DocumentRequest request, CancellationToken ct)
    { var document = await people.AddDocumentAsync(Actor, id, request, ct); return CreatedAtAction(nameof(Documents), new { id }, document); }
    [HttpGet("{id:guid}/branch")]
    public async Task<object> Branch(Guid id, CancellationToken ct) => new { branchId = (await people.GetAsync(Actor, id, ct)).BranchId };
    [HttpPost("{id:guid}/branches/{branchId:guid}")]
    public async Task<IActionResult> Link(Guid id, Guid branchId, CancellationToken ct)
    { await people.LinkAsync(Actor, id, branchId, ct); return NoContent(); }
    [HttpPost("{id:guid}/transfer")]
    public async Task<IActionResult> Transfer(Guid id, TransferPersonRequest request, CancellationToken ct)
    { await people.TransferAsync(Actor, id, request, ct); return NoContent(); }
    [HttpGet("{id:guid}/process-assignments")]
    public Task<AssignmentPage> Assignments(Guid id, [FromQuery] AssignmentQuery query, CancellationToken ct) =>
        assignments.ListAsync(Actor, query with { PersonId = id }, ct);
    [HttpGet("{id:guid}/responsible-assignments")]
    public Task<AssignmentPage> ResponsibleAssignments(Guid id, [FromQuery] AssignmentQuery query, CancellationToken ct) =>
        assignments.ListAsync(Actor, query with { ResponsiblePersonId = id }, ct);
}

[ApiController, Route("api/v1/process-categories")]
public sealed class ProcessCategoriesController(IProcessCatalogService catalog) : MinistryController
{
    [HttpGet]
    public Task<Page<CategoryDto>> List([FromQuery] ListQuery query, CancellationToken ct) => catalog.CategoriesAsync(Actor, query, ct);
    [HttpGet("{id:guid}")]
    public Task<CategoryDto> Get(Guid id, CancellationToken ct) => catalog.CategoryAsync(Actor, id, ct);
    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(CategoryRequest request, CancellationToken ct)
    { var category = await catalog.CreateCategoryAsync(Actor, request, ct); return CreatedAtAction(nameof(Get), new { id = category.Id }, category); }
    [HttpPut("{id:guid}")]
    public Task<CategoryDto> Update(Guid id, CategoryRequest request, CancellationToken ct) => catalog.UpdateCategoryAsync(Actor, id, request, ct);
    [HttpPut("{id:guid}/active")]
    public async Task<IActionResult> Active(Guid id, ActiveRequest request, CancellationToken ct)
    { await catalog.SetCategoryActiveAsync(Actor, id, request.IsActive, ct); return NoContent(); }
    [HttpGet("{id:guid}/processes")]
    public Task<Page<ProcessDto>> Processes(Guid id, [FromQuery] ProcessQuery query, CancellationToken ct) =>
        catalog.ProcessesAsync(Actor, query with { CategoryId = id }, ct);
}

[ApiController, Route("api/v1/processes")]
public sealed class ProcessesController(IProcessCatalogService catalog, IAssignmentService assignments) : MinistryController
{
    [HttpGet]
    public Task<Page<ProcessDto>> List([FromQuery] ProcessQuery query, CancellationToken ct) => catalog.ProcessesAsync(Actor, query, ct);
    [HttpGet("{id:guid}")]
    public Task<ProcessDto> Get(Guid id, CancellationToken ct) => catalog.ProcessAsync(Actor, id, ct);
    [HttpPost]
    public async Task<ActionResult<ProcessDto>> Create(ProcessRequest request, CancellationToken ct)
    { var process = await catalog.CreateProcessAsync(Actor, request, ct); return CreatedAtAction(nameof(Get), new { id = process.Id }, process); }
    [HttpPut("{id:guid}")]
    public Task<ProcessDto> Update(Guid id, ProcessRequest request, CancellationToken ct) => catalog.UpdateProcessAsync(Actor, id, request, ct);
    [HttpPut("{id:guid}/active")]
    public async Task<IActionResult> Active(Guid id, ActiveRequest request, CancellationToken ct)
    { await catalog.SetProcessActiveAsync(Actor, id, request.IsActive, ct); return NoContent(); }
    [HttpGet("{id:guid}/participants")]
    public Task<AssignmentPage> Participants(Guid id, [FromQuery] AssignmentQuery query, CancellationToken ct) =>
        assignments.ListAsync(Actor, query with { ProcessId = id }, ct);
}

[ApiController, Route("api/v1/process-assignments")]
[ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
public sealed class ProcessAssignmentsController(IAssignmentService assignments) : MinistryController
{
    [HttpGet("participants")]
    public Task<AssignmentParticipantPage> Participants([FromQuery] AssignmentQuery query, CancellationToken ct) =>
        assignments.ParticipantsAsync(Actor, query, ct);
    [HttpGet("selection-options")]
    public Task<AssignmentSelectionOptions> Options(CancellationToken ct) => assignments.OptionsAsync(Actor, ct);
    [HttpGet("people-options")]
    public Task<Page<AssignmentPersonOption>> PeopleOptions([FromQuery] AssignmentPeopleQuery query, CancellationToken ct) =>
        assignments.PeopleOptionsAsync(Actor, query, ct);
    [HttpGet]
    public Task<AssignmentPage> List([FromQuery] AssignmentQuery query, CancellationToken ct) => assignments.ListAsync(Actor, query, ct);
    [HttpGet("{id:guid}")]
    public Task<AssignmentDto> Get(Guid id, CancellationToken ct) => assignments.GetAsync(Actor, id, ct);
    [HttpGet("states")]
    public Task<IReadOnlyList<StateDto>> States([FromQuery] Guid? assignmentId, CancellationToken ct) => assignments.StatesAsync(Actor, ct, assignmentId);
    [HttpPost]
    public async Task<ActionResult<AssignmentDto>> Assign(AssignProcessRequest request, CancellationToken ct)
    { var assignment = await assignments.AssignAsync(Actor, request, ct); return CreatedAtAction(nameof(Get), new { id = assignment.Id }, assignment); }
    [HttpPut("{id:guid}/state")]
    public Task<AssignmentDto> ChangeState(Guid id, ChangeAssignmentStateRequest request, CancellationToken ct) =>
        assignments.ChangeStateAsync(Actor, id, request.StateCode, ct);
    [HttpPut("{id:guid}/responsible")]
    public Task<AssignmentDto> ChangeResponsible(Guid id, ChangeResponsibleRequest request, CancellationToken ct) =>
        assignments.ChangeResponsibleAsync(Actor, id, request.ResponsiblePersonId, ct, request.ExpectedResponsiblePersonId);

    [HttpGet("{id:guid}/responsible-options")]
    public Task<Page<AssignmentPersonOption>> ResponsibleOptions(Guid id, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, [FromQuery] string? search = null, CancellationToken ct = default) =>
        assignments.ResponsibleOptionsAsync(Actor, id, new PageRequest(page, pageSize), search, ct);
}

[ApiController, Route("api/v1/reports")]
public sealed class ReportsController(IReportService reports) : MinistryController
{
    [HttpGet("overview")]
    public Task<SummaryDto> Overview(CancellationToken ct) => reports.SummaryAsync(Actor, null, ct);
    [HttpGet("branches/{id:guid}/summary")]
    public Task<SummaryDto> Branch(Guid id, CancellationToken ct) => reports.SummaryAsync(Actor, id, ct);
    [HttpGet("branches/{id:guid}/participants-by-responsible")]
    public Task<Page<ResponsibleCount>> ResponsiblePeople(Guid id, [FromQuery] ListQuery query, CancellationToken ct) =>
        reports.ResponsiblePeopleAsync(Actor, id, query, ct);
    [HttpGet("process-categories")]
    public Task<Page<CategoryCount>> Categories([FromQuery] ListQuery query, CancellationToken ct) => reports.CategoriesAsync(Actor, query, ct);
    [HttpGet("branches/{id:guid}/summary.csv"), Produces("text/csv")]
    public async Task<IActionResult> Export(Guid id, CancellationToken ct) =>
        File(Encoding.UTF8.GetBytes(await reports.ExportSummaryAsync(Actor, id, ct)), "text/csv; charset=utf-8", "branch-summary.csv");
}
