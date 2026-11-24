namespace MisionLiderParis.Domain.Formation;

public enum AssignmentStatus { Pending, InProgress, Suspended, Completed, Withdrawn }

public readonly record struct AssignmentDates(DateTimeOffset AssignedAt, DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt);

// Proposed application policy. Integration must reconcile it with the verified database before enabling writes.
public static class AssignmentLifecycle
{
    public static bool CanTransition(AssignmentStatus from, AssignmentStatus to) => (from, to) switch
    {
        (AssignmentStatus.Pending, AssignmentStatus.InProgress or AssignmentStatus.Withdrawn) => true,
        (AssignmentStatus.InProgress, AssignmentStatus.Suspended or AssignmentStatus.Completed or AssignmentStatus.Withdrawn) => true,
        (AssignmentStatus.Suspended, AssignmentStatus.InProgress or AssignmentStatus.Withdrawn) => true,
        _ => false
    };

    public static bool HasValidDates(AssignmentStatus status, AssignmentDates dates)
    {
        if (dates.StartedAt < dates.AssignedAt || dates.FinishedAt < dates.AssignedAt ||
            (dates.StartedAt.HasValue && dates.FinishedAt < dates.StartedAt)) return false;
        return status switch
        {
            AssignmentStatus.Pending => dates.StartedAt is null && dates.FinishedAt is null,
            AssignmentStatus.InProgress or AssignmentStatus.Suspended => dates.StartedAt is not null && dates.FinishedAt is null,
            AssignmentStatus.Completed => dates.StartedAt is not null && dates.FinishedAt is not null,
            AssignmentStatus.Withdrawn => dates.FinishedAt is not null,
            _ => false
        };
    }
}
