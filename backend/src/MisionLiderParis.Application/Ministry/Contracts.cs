using System.ComponentModel.DataAnnotations;
using MisionLiderParis.Application.Common;

namespace MisionLiderParis.Application.Ministry;

public sealed record BranchRequest([Required, MaxLength(20)] string Code, [Required, MaxLength(150)] string Name,
    [MaxLength(250)] string? Address, [MaxLength(30)] string? Phone, DateTimeOffset? ExpectedUpdatedAt = null);
public sealed record BranchActiveRequest(bool IsActive, DateTimeOffset? ExpectedUpdatedAt = null);
public sealed record BranchAdministratorDto(Guid UserId, string DisplayName, string Email, bool IsActive);
public sealed record ActiveRequest(bool IsActive);
public sealed record BranchDto(Guid Id, string Code, string Name, string? Address, string? Phone, bool IsActive,
    DateTimeOffset UpdatedAt = default);
public sealed record ListQuery(int Page = 1, int PageSize = 25, string? Search = null, bool? IsActive = null);
public interface IBranchService
{
    Task<Page<BranchDto>> ListAsync(Guid actor, ListQuery query, CancellationToken ct);
    Task<BranchDto> GetAsync(Guid actor, Guid id, CancellationToken ct);
    Task<BranchDto> CreateAsync(Guid actor, BranchRequest request, CancellationToken ct);
    Task<BranchDto> UpdateAsync(Guid actor, Guid id, BranchRequest request, CancellationToken ct);
    Task SetActiveAsync(Guid actor, Guid id, BranchActiveRequest request, CancellationToken ct);
    Task<Page<BranchAdministratorDto>> AdministratorsAsync(Guid actor, Guid id, int page, int pageSize, CancellationToken ct);
}

public sealed record DocumentRequest([Required, MaxLength(30)] string DocumentType,
    [Required, MaxLength(50)] string DocumentNumber, [Required, RegularExpression("^[A-Z]{2}$")] string IssuingCountry = "CO",
    bool ReplaceCurrent = false);
public sealed record PersonRequest([Required, MaxLength(150)] string FirstNames, [Required, MaxLength(150)] string LastNames,
    [MaxLength(30)] string? Phone, [EmailAddress, MaxLength(255)] string? Email, DateOnly? BirthDate,
    DateTimeOffset? ExpectedUpdatedAt = null);
public sealed record CreatePersonRequest([Required] PersonRequest Person, Guid BranchId, [Required] DocumentRequest Document);
public sealed record TransferPersonRequest(Guid BranchId, [Required, MaxLength(1000)] string Reason);
public sealed record PersonQuery(int Page = 1, int PageSize = 25, string? Search = null, Guid? BranchId = null, bool? IsActive = null);
public sealed record DocumentDto(Guid Id, string DocumentType, string DocumentNumber, string IssuingCountry,
    bool IsCurrent, DateTimeOffset? EndedAt);
public sealed record PersonDto(Guid Id, string FirstNames, string LastNames, string? Phone, string? Email,
    DateOnly? BirthDate, bool IsActive, Guid? BranchId, IReadOnlyList<DocumentDto> Documents,
    string? BranchName = null, bool HasDocuments = false, DateTimeOffset? CreatedAt = null, DateTimeOffset? UpdatedAt = null);
public sealed record PersonBranchOption(Guid Id, string Name);
public sealed record DocumentTypeOption(string Code, string Name);
public sealed record PersonRegistrationOptions(IReadOnlyList<PersonBranchOption> Branches,
    IReadOnlyList<string> Countries, IReadOnlyList<DocumentTypeOption> DocumentTypes);
// Existing pagination fields are preserved; metadata is scoped by PERSON_VIEW, not BRANCH_VIEW.
public sealed record PeoplePage(IReadOnlyList<PersonDto> Items, int PageNumber, int PageSize, int TotalCount,
    IReadOnlyList<PersonBranchOption> Branches);
public interface IPeopleService
{
    Task<PersonRegistrationOptions> RegistrationOptionsAsync(Guid actor, CancellationToken ct);
    Task<PeoplePage> ListAsync(Guid actor, PersonQuery query, CancellationToken ct);
    Task<PersonDto> GetAsync(Guid actor, Guid id, CancellationToken ct);
    Task<PersonDto> CreateAsync(Guid actor, CreatePersonRequest request, CancellationToken ct);
    Task<PersonDto> UpdateAsync(Guid actor, Guid id, PersonRequest request, CancellationToken ct);
    Task SetActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct);
    Task<DocumentDto> AddDocumentAsync(Guid actor, Guid id, DocumentRequest request, CancellationToken ct);
    Task TransferAsync(Guid actor, Guid id, TransferPersonRequest request, CancellationToken ct);
    Task LinkAsync(Guid actor, Guid id, Guid branchId, CancellationToken ct);
}

public sealed record CategoryRequest([Required, MaxLength(150)] string Name, [MaxLength(4000)] string? Description,
    [Range(0, int.MaxValue)] int SortOrder = 0);
public sealed record ProcessRequest(Guid CategoryId, [Required, MaxLength(150)] string Name,
    [MaxLength(4000)] string? Description, [Range(0, int.MaxValue)] int SortOrder = 0);
public sealed record CategoryDto(Guid Id, string Name, string? Description, int SortOrder, bool IsActive,
    DateTimeOffset? CreatedAt = null, DateTimeOffset? UpdatedAt = null);
public sealed record ProcessDto(Guid Id, Guid CategoryId, string Name, string? Description, int SortOrder, bool IsActive,
    DateTimeOffset? CreatedAt = null, DateTimeOffset? UpdatedAt = null, string? CategoryName = null, bool? CategoryIsActive = null);
public sealed record ProcessQuery(int Page = 1, int PageSize = 25, string? Search = null, Guid? CategoryId = null, bool? IsActive = null);
public interface IProcessCatalogService
{
    Task<Page<CategoryDto>> CategoriesAsync(Guid actor, ListQuery query, CancellationToken ct);
    Task<CategoryDto> CategoryAsync(Guid actor, Guid id, CancellationToken ct);
    Task<CategoryDto> CreateCategoryAsync(Guid actor, CategoryRequest request, CancellationToken ct);
    Task<CategoryDto> UpdateCategoryAsync(Guid actor, Guid id, CategoryRequest request, CancellationToken ct);
    Task SetCategoryActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct);
    Task<Page<ProcessDto>> ProcessesAsync(Guid actor, ProcessQuery query, CancellationToken ct);
    Task<ProcessDto> ProcessAsync(Guid actor, Guid id, CancellationToken ct);
    Task<ProcessDto> CreateProcessAsync(Guid actor, ProcessRequest request, CancellationToken ct);
    Task<ProcessDto> UpdateProcessAsync(Guid actor, Guid id, ProcessRequest request, CancellationToken ct);
    Task SetProcessActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct);
}

public sealed record AssignProcessRequest(Guid PersonId, Guid ProcessId, Guid ResponsiblePersonId, Guid BranchId);
public sealed record ChangeAssignmentStateRequest([Required, MaxLength(30)] string StateCode);
public sealed record ChangeResponsibleRequest(Guid ResponsiblePersonId, Guid? ExpectedResponsiblePersonId = null);
public sealed record AssignmentQuery(int Page = 1, int PageSize = 25, Guid? BranchId = null, Guid? ProcessId = null,
    Guid? PersonId = null, Guid? ResponsiblePersonId = null, string? StateCode = null,
    string? Search = null, Guid? CategoryId = null, bool IncludeFilters = false, bool OrderByCategory = false);
public sealed record AssignmentDto(Guid Id, Guid PersonId, Guid ProcessId, Guid ResponsiblePersonId, Guid BranchId,
    string StateCode, DateTimeOffset AssignedAt, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt,
    string? PersonName = null, string? DocumentType = null, string? DocumentNumber = null,
    string? ProcessName = null, Guid? CategoryId = null, string? CategoryName = null,
    string? ProcessDescription = null, string? ResponsibleName = null, string? BranchName = null, string? StateName = null);
public sealed record AssignmentNamedOption(Guid Id, string Name);
public sealed record AssignmentProcessOption(Guid Id, string Name, Guid CategoryId);
public sealed record AssignmentFilterOptions(IReadOnlyList<AssignmentNamedOption> Branches,
    IReadOnlyList<AssignmentNamedOption> Categories, IReadOnlyList<AssignmentProcessOption> Processes,
    IReadOnlyList<AssignmentNamedOption> ResponsiblePeople, IReadOnlyList<StateDto> States);
public sealed record AssignmentPage(IReadOnlyList<AssignmentDto> Items, int PageNumber, int PageSize, int TotalCount,
    AssignmentFilterOptions? Filters = null);
public sealed record AssignmentParticipantDto(Guid PersonId, string? PersonName, string? DocumentType,
    string? DocumentNumber, IReadOnlyList<AssignmentNamedOption> Branches);
public sealed record AssignmentParticipantPage(IReadOnlyList<AssignmentParticipantDto> Items, int PageNumber,
    int PageSize, int TotalCount, AssignmentFilterOptions? Filters = null);
public sealed record StateDto(Guid Id, string Code, string Name, bool IsFinal);
public sealed record AssignmentPersonOption(Guid Id, string Name, Guid BranchId, string BranchName,
    string DocumentType, string DocumentNumber);
public sealed record AssignmentSelectionOptions(IReadOnlyList<CategoryDto> Categories,
    IReadOnlyList<ProcessDto> Processes, StateDto InitialState);
public sealed record AssignmentPeopleQuery(int Page = 1, int PageSize = 10, string? Search = null,
    Guid? BranchId = null, Guid? ExcludePersonId = null);
public interface IAssignmentService
{
    Task<AssignmentSelectionOptions> OptionsAsync(Guid actor, CancellationToken ct);
    Task<Page<AssignmentPersonOption>> PeopleOptionsAsync(Guid actor, AssignmentPeopleQuery query, CancellationToken ct);
    Task<Page<AssignmentPersonOption>> ResponsibleOptionsAsync(Guid actor, Guid id, PageRequest page, string? search, CancellationToken ct);
    Task<AssignmentPage> ListAsync(Guid actor, AssignmentQuery query, CancellationToken ct);
    Task<AssignmentParticipantPage> ParticipantsAsync(Guid actor, AssignmentQuery query, CancellationToken ct);
    Task<AssignmentDto> GetAsync(Guid actor, Guid id, CancellationToken ct);
    Task<AssignmentDto> AssignAsync(Guid actor, AssignProcessRequest request, CancellationToken ct);
    Task<AssignmentDto> ChangeStateAsync(Guid actor, Guid id, string stateCode, CancellationToken ct);
    Task<AssignmentDto> ChangeResponsibleAsync(Guid actor, Guid id, Guid responsibleId, CancellationToken ct, Guid? expectedResponsibleId = null);
    Task<IReadOnlyList<StateDto>> StatesAsync(Guid actor, CancellationToken ct, Guid? assignmentId = null);
}

public sealed record StateCount(string StateCode, int Assignments, int DistinctPeople);
public sealed record SummaryDto(Guid? BranchId, int Branches, int ActivePeople, int TotalPeople,
    int AvailableProcesses, int TotalAssignments, IReadOnlyList<StateCount> AssignmentsByState);
public sealed record ResponsibleCount(Guid ResponsiblePersonId, int Assignments, int DistinctPeople);
public sealed record CategoryCount(Guid CategoryId, string Name, int Processes, int ActiveProcesses);
public interface IReportService
{
    Task<SummaryDto> SummaryAsync(Guid actor, Guid? branchId, CancellationToken ct);
    Task<Page<ResponsibleCount>> ResponsiblePeopleAsync(Guid actor, Guid branchId, ListQuery query, CancellationToken ct);
    Task<Page<CategoryCount>> CategoriesAsync(Guid actor, ListQuery query, CancellationToken ct);
    Task<string> ExportSummaryAsync(Guid actor, Guid branchId, CancellationToken ct);
}
