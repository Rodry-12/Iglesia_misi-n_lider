using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.UnitTests;

public sealed class MinistryModelBoundaryTests
{
    [Fact]
    public void AllVerifiedTablesIncludingDocumentCatalogAreExcludedFromEfMigrations()
    {
        using var database = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql().Options);
        var entities = database.GetService<IDesignTimeModel>().Model.GetEntityTypes().ToArray();
        Assert.Equal(12, entities.Length);
        Assert.All(entities, entity =>
        {
            Assert.Equal("iglesia", entity.GetSchema());
            Assert.True(entity.IsTableExcludedFromMigrations());
            Assert.All(entity.GetForeignKeys(), key => Assert.Equal("iglesia", key.PrincipalEntityType.GetSchema()));
        });
        Assert.DoesNotContain("CREATE TABLE", database.Database.GenerateCreateScript(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DocumentCatalogUsesExistingCodeAndNameWithoutInventedId()
    {
        using var database = new MinistryDbContext(new DbContextOptionsBuilder<MinistryDbContext>().UseNpgsql().Options);
        var entity = database.Model.FindEntityType(typeof(MisionLiderParis.Domain.Ministry.DocumentType))!;
        Assert.Equal("tipo_documento", entity.GetTableName());
        Assert.Equal("Code", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        Assert.Equal(new[] { "Code", "Name" }, entity.GetProperties().Select(p => p.Name).Order().ToArray());
        var table = StoreObjectIdentifier.Table("tipo_documento", "iglesia");
        Assert.Equal("codigo", entity.FindProperty("Code")!.GetColumnName(table));
        Assert.Equal("nombre", entity.FindProperty("Name")!.GetColumnName(table));
    }
}
