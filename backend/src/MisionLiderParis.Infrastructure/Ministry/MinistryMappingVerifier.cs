using Microsoft.EntityFrameworkCore;

namespace MisionLiderParis.Infrastructure.Ministry;

public static class MinistryMappingVerifier
{
    public static async Task VerifyReadOnlyAsync(string connectionString, CancellationToken ct)
    {
        await using var database = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>()
            .UseNpgsql(connectionString).Options);
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        await database.Database.ExecuteSqlRawAsync("SET TRANSACTION READ ONLY", ct);
        // PostgreSQL resolves every mapped column/type without returning personal or business rows.
        await database.Branches.Where(_ => false).ToListAsync(ct);
        await database.People.Where(_ => false).ToListAsync(ct);
        await database.Documents.Where(_ => false).ToListAsync(ct);
        await database.Memberships.Where(_ => false).ToListAsync(ct);
        await database.Categories.Where(_ => false).ToListAsync(ct);
        await database.Processes.Where(_ => false).ToListAsync(ct);
        await database.States.Where(_ => false).ToListAsync(ct);
        await database.Assignments.Where(_ => false).ToListAsync(ct);
        await database.Roles.Where(_ => false).ToListAsync(ct);
        await database.Permissions.Where(_ => false).ToListAsync(ct);
        await database.RolePermissions.Where(_ => false).ToListAsync(ct);
        await transaction.RollbackAsync(ct);
    }
}
