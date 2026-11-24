using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MisionLiderParis.Infrastructure.Identity;

// Offline model/migration generation. This factory never opens a connection.
public sealed class AuthDbContextFactory : IDesignTimeDbContextFactory<AuthDbContext>
{
    public AuthDbContext CreateDbContext(string[] args) => new(
        new DbContextOptionsBuilder<AuthDbContext>().UseNpgsql(options =>
            options.MigrationsHistoryTable("__ef_migrations_history", "auth_app")).Options);
}
