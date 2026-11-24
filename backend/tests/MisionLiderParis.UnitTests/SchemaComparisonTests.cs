using System.Text.Json;
using MisionLiderParis.Infrastructure.Database;

namespace MisionLiderParis.UnitTests;

public sealed class SchemaComparisonTests
{
    private static MinistrySchemaReference Reference() => MinistrySchemaReference.Read(
        File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "schema-reference.txt")));

    [Fact]
    public void ReferenceReaderAccountsForAllTablesIndexesAndTriggersWithoutExecutingSql()
    {
        var reference = Reference();
        Assert.Equal(11, reference.Tables.Count);
        Assert.Equal(11, reference.Indexes.Count);
        Assert.Equal(3, reference.Triggers.Count);
        var branch = reference.Tables.Single(t => t.Name == "sede");
        var code = branch.Columns.Single(c => c.Name == "codigo");
        Assert.Equal("varchar(20)", code.Type);
        Assert.False(code.Nullable);
        Assert.False(branch.Columns.Single(c => c.Name == "id").Nullable);
        Assert.Equal("gen_random_uuid()", branch.Columns.Single(c => c.Name == "id").Default);
        var links = reference.Tables.Single(t => t.Name == "rol_permiso");
        Assert.Contains(links.Constraints, c => c.Name == "pk_rol_permiso" && c.Kind == "p");
        Assert.Contains(links.Constraints, c => c.Name == "fk_rol_permiso_rol" && c.Kind == "f");
        Assert.Contains(reference.Triggers, t => t.Name == "trg_validar_estado_fechas" &&
            t.FunctionBody.Contains("WITHDRAWN", StringComparison.Ordinal));
    }

    [Fact]
    public void TamperedReferenceIsRejectedBeforeParsing() =>
        Assert.Throws<InvalidOperationException>(() => MinistrySchemaReference.Read("CREATE TABLE fake();"u8.ToArray()));

    [Fact]
    public void MissingCatalogCannotBeReportedAsCompatible()
    {
        using var document = JsonDocument.Parse("{}");
        var report = SchemaComparison.Compare(Reference(), document.RootElement);
        Assert.True(report.HasPendingReview);
        Assert.Contains(report.Findings, f => f.Severity == "blocking" && f.Path == "schema");
    }

    [Fact]
    public void EquivalentVarcharAndHarmlessTrailingTextCastProduceNoFinding()
    {
        var expected = new MinistrySchemaReference([
            new("sede", [new("codigo", "varchar(20)", false, "'CO'")], [])], [], []);
        using var document = JsonDocument.Parse("""
            {"schema":"iglesia","tables":[{"name":"sede"}],
             "columns":[{"table_name":"sede","column_name":"codigo","data_type":"character varying",
             "character_maximum_length":20,"is_nullable":"NO","column_default":"'CO'::text"}]}
            """);
        Assert.False(SchemaComparison.Compare(expected, document.RootElement).HasPendingReview);
    }

    [Fact]
    public void TextInsideADefaultLiteralIsNeverMistakenForACast()
    {
        var expected = new MinistrySchemaReference([
            new("sede", [new("codigo", "varchar(20)", false, "'CO'")], [])], [], []);
        using var document = JsonDocument.Parse("""
            {"schema":"iglesia","tables":[{"name":"sede"}],
             "columns":[{"table_name":"sede","column_name":"codigo","data_type":"character varying",
             "character_maximum_length":20,"is_nullable":"NO","column_default":"'CO::text'"}]}
            """);
        Assert.Contains(SchemaComparison.Compare(expected, document.RootElement).Findings,
            f => f.Path == "iglesia.sede.codigo.default" && f.Severity == "review");
    }

    [Fact]
    public void TypeAndNullabilityDifferencesAreBlocking()
    {
        using var document = JsonDocument.Parse("""
            {"schema":"iglesia","tables":[{"name":"sede","rowSecurity":false}],
             "columns":[{"table_name":"sede","column_name":"codigo","data_type":"text",
               "is_nullable":"YES","column_default":null}]}
            """);
        var report = SchemaComparison.Compare(Reference(), document.RootElement);
        Assert.Contains(report.Findings, f => f.Path == "iglesia.sede.codigo" && f.Message == "Column type differs.");
        Assert.Contains(report.Findings, f => f.Path == "iglesia.sede.codigo" && f.Message == "Nullability differs.");
        Assert.Contains(report.Findings, f => f.Path == "iglesia.persona" && f.Severity == "blocking");
    }

    [Fact]
    public void RlsAndAdditionalColumnsRequireReview()
    {
        using var document = JsonDocument.Parse("""
            {"schema":"iglesia","tables":[{"name":"sede","rowSecurity":true}],
             "columns":[{"table_name":"sede","column_name":"unexpected","data_type":"text","is_nullable":"YES"}]}
            """);
        var report = SchemaComparison.Compare(Reference(), document.RootElement);
        Assert.Contains(report.Findings, f => f.Path == "iglesia.sede.rls" && f.Severity == "review");
        Assert.Contains(report.Findings, f => f.Path == "iglesia.sede.unexpected" && f.Severity == "review");
    }

    [Fact]
    public void DisabledTriggerIsBlockingEvenWhenItsNameExists()
    {
        using var document = JsonDocument.Parse("""
            {"schema":"iglesia","triggers":[{"table":"persona_proceso","name":"trg_validar_estado_fechas",
              "enabled":"D","functionSchema":"iglesia","functionName":"validar_estado_fechas",
              "securityDefiner":false}]}
            """);
        var report = SchemaComparison.Compare(Reference(), document.RootElement);
        Assert.Contains(report.Findings, f => f.Path.EndsWith("trg_validar_estado_fechas", StringComparison.Ordinal) &&
            f.Severity == "blocking" && f.Message.Contains("enablement", StringComparison.Ordinal));
    }

    [Fact]
    public void NormalizationPreservesSemanticDifferencesInsideStringLiterals()
    {
        Assert.Equal(MinistrySchemaReference.Tokens("SELECT NOW() -- comment\n"), MinistrySchemaReference.Tokens("select now()"));
        Assert.NotEqual(MinistrySchemaReference.Tokens("codigo = 'PENDING'"), MinistrySchemaReference.Tokens("codigo = 'pending'"));
        Assert.NotEqual(MinistrySchemaReference.Tokens("nombre = 'A B'"), MinistrySchemaReference.Tokens("nombre = 'A  B'"));
        Assert.NotEqual(MinistrySchemaReference.Tokens("x := 1; y := 2;"), MinistrySchemaReference.Tokens("x := 1 y := 2;"));
        Assert.NotEqual(MinistrySchemaReference.Tokens("\"Field\""), MinistrySchemaReference.Tokens("\"field\""));
    }
}
