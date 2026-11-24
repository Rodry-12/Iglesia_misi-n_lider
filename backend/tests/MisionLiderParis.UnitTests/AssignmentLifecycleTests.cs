using MisionLiderParis.Domain.Formation;

namespace MisionLiderParis.UnitTests;

public sealed class AssignmentLifecycleTests
{
    private static readonly DateTimeOffset Assigned = new(2026, 10, 23, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void PendingAssignmentCanBeWithdrawnWithoutInventingAStartDate()
    {
        Assert.True(AssignmentLifecycle.CanTransition(AssignmentStatus.Pending, AssignmentStatus.Withdrawn));
        Assert.True(AssignmentLifecycle.HasValidDates(AssignmentStatus.Withdrawn,
            new(Assigned, null, Assigned.AddHours(1))));
    }

    [Fact]
    public void WithdrawalBeforeAssignmentIsRejectedEvenWithoutAStartDate() =>
        Assert.False(AssignmentLifecycle.HasValidDates(AssignmentStatus.Withdrawn,
            new(Assigned, null, Assigned.AddMinutes(-1))));

    [Fact]
    public void CompletionRequiresAnActualStartDate() =>
        Assert.False(AssignmentLifecycle.HasValidDates(AssignmentStatus.Completed,
            new(Assigned, null, Assigned.AddHours(1))));

    [Fact]
    public void CompletedAssignmentCannotBeReopened() =>
        Assert.False(AssignmentLifecycle.CanTransition(AssignmentStatus.Completed, AssignmentStatus.InProgress));

    [Fact]
    public void WithdrawnAssignmentCannotBeReopened() =>
        Assert.False(AssignmentLifecycle.CanTransition(AssignmentStatus.Withdrawn, AssignmentStatus.Pending));

    [Fact]
    public void PendingAssignmentCannotBeCompletedWithoutStarting() =>
        Assert.False(AssignmentLifecycle.CanTransition(AssignmentStatus.Pending, AssignmentStatus.Completed));

    [Fact]
    public void SuspendedAssignmentCanResume() =>
        Assert.True(AssignmentLifecycle.CanTransition(AssignmentStatus.Suspended, AssignmentStatus.InProgress));

    [Fact]
    public void OpenAssignmentCannotHaveAFinishDate() =>
        Assert.False(AssignmentLifecycle.HasValidDates(AssignmentStatus.InProgress,
            new(Assigned, Assigned, Assigned.AddHours(1))));

    [Fact]
    public void FinishCannotPrecedeStart() =>
        Assert.False(AssignmentLifecycle.HasValidDates(AssignmentStatus.Completed,
            new(Assigned, Assigned.AddHours(2), Assigned.AddHours(1))));
}
