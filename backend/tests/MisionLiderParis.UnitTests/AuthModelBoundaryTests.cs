using MisionLiderParis.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace MisionLiderParis.UnitTests;

public sealed class AuthModelBoundaryTests
{
    [Fact]
    public void AuthenticationModelCannotGenerateMinisterialTablesOrDuplicateIdentityRoles()
    {
        using var database = new AuthDbContextFactory().CreateDbContext([]);
        var entities = database.Model.GetEntityTypes().ToArray();
        Assert.NotEmpty(entities);
        Assert.All(entities, entity => Assert.Equal("auth_app", entity.GetSchema()));
        Assert.DoesNotContain(entities, entity => entity.ClrType.Name.Contains("IdentityRole", StringComparison.Ordinal));
        Assert.DoesNotContain(entities, entity => entity.ClrType.Name.Contains("IdentityUserRole", StringComparison.Ordinal));
        var directPermissions = Assert.Single(entities, entity => entity.ClrType == typeof(UserGrantPermission));
        Assert.Equal(2, directPermissions.FindPrimaryKey()!.Properties.Count);
        Assert.All(directPermissions.GetForeignKeys(), key => Assert.Equal("auth_app", key.PrincipalEntityType.GetSchema()));
    }
}
