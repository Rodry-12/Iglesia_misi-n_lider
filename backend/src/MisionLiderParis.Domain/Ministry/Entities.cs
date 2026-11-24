namespace MisionLiderParis.Domain.Ministry;

public sealed class DocumentType
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
}

public abstract class Entity { public Guid Id { get; set; } = Guid.NewGuid(); }
public abstract class CreatedEntity : Entity { public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; }
public abstract class TrackedEntity : CreatedEntity { public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow; }

public sealed class Branch : TrackedEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Person : TrackedEntity
{
    public string FirstNames { get; set; } = "";
    public string LastNames { get; set; } = "";
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateOnly? BirthDate { get; set; }
    public bool IsActive { get; set; } = true;
    public List<PersonDocument> Documents { get; set; } = [];
    public List<PersonBranch> Memberships { get; set; } = [];
}

public sealed class PersonDocument : CreatedEntity
{
    public Guid PersonId { get; set; }
    public string DocumentType { get; set; } = "";
    public string DocumentNumber { get; set; } = "";
    public string IssuingCountry { get; set; } = "CO";
    public bool IsCurrent { get; set; } = true;
    public DateTimeOffset? EndedAt { get; set; }
    public Person Person { get; set; } = null!;
}

public sealed class PersonBranch : CreatedEntity
{
    public Guid PersonId { get; set; }
    public Guid BranchId { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }
    public string? DepartureReason { get; set; }
    public Person Person { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
}

public sealed class ProcessCategory : TrackedEntity
{
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class MinistryProcess : TrackedEntity
{
    public Guid CategoryId { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public ProcessCategory Category { get; set; } = null!;
}

public sealed class ProcessState : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsFinal { get; set; }
}

public sealed class ProcessAssignment : TrackedEntity
{
    public Guid PersonId { get; set; }
    public Guid ProcessId { get; set; }
    public Guid ResponsiblePersonId { get; set; }
    public Guid BranchId { get; set; }
    public Guid StateId { get; set; }
    public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public Person Person { get; set; } = null!;
    public Person ResponsiblePerson { get; set; } = null!;
    public MinistryProcess Process { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public ProcessState State { get; set; } = null!;
}

public sealed class FunctionalRole : TrackedEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsGlobal { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class FunctionalPermission : CreatedEntity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string Module { get; set; } = "";
    public bool IsActive { get; set; } = true;
}

public sealed class RolePermission
{
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public FunctionalRole Role { get; set; } = null!;
    public FunctionalPermission Permission { get; set; } = null!;
}
