using Microsoft.EntityFrameworkCore;

namespace MisionLiderParis.Infrastructure.Ministry;

internal static class MinistryLocks
{
    public static async Task BranchesAsync(MinistryDbContext db, IEnumerable<Guid> ids, CancellationToken ct)
    {
        foreach (var id in ids.Distinct().Order())
            // Serialize branch state/grant decisions without blocking Identity's FK KEY SHARE
            // on its separate connection. Neither operation changes the branch primary key.
            await db.Branches.FromSqlInterpolated($"SELECT * FROM iglesia.sede WHERE id = {id} FOR NO KEY UPDATE").LoadAsync(ct);
    }
    public static async Task PeopleAsync(MinistryDbContext db, IEnumerable<Guid> ids, CancellationToken ct)
    {
        foreach (var id in ids.Distinct().Order())
            await db.People.FromSqlInterpolated($"SELECT * FROM iglesia.persona WHERE id = {id} FOR UPDATE").LoadAsync(ct);
    }
    public static async Task CategoryAsync(MinistryDbContext db, Guid id, CancellationToken ct) =>
        await db.Categories.FromSqlInterpolated($"SELECT * FROM iglesia.categoria_proceso WHERE id = {id} FOR UPDATE").LoadAsync(ct);
    public static async Task ProcessAsync(MinistryDbContext db, Guid id, CancellationToken ct) =>
        await db.Processes.FromSqlInterpolated($"SELECT * FROM iglesia.proceso WHERE id = {id} FOR UPDATE").LoadAsync(ct);
    public static async Task AssignmentAsync(MinistryDbContext db, Guid id, CancellationToken ct) =>
        await db.Assignments.FromSqlInterpolated($"SELECT * FROM iglesia.persona_proceso WHERE id = {id} FOR UPDATE").LoadAsync(ct);
}
