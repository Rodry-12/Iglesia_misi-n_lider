using System.Text.Json;
using System.Text.RegularExpressions;

namespace MisionLiderParis.Infrastructure.Database;

public sealed record SchemaFinding(string Severity, string Path, string Message, string? Expected = null, string? Actual = null);
public sealed record SchemaComparisonReport(string ReferenceSha256, IReadOnlyList<SchemaFinding> Findings)
{
    public bool HasPendingReview => Findings.Count != 0;
    public string Notice => "This compares supplied catalog metadata. Only a live read-only inspection proves the current database structure; no EF mapping is enabled automatically.";
}

public static class SchemaComparison
{
    public static SchemaComparisonReport Compare(MinistrySchemaReference reference, JsonElement snapshot)
    {
        var findings = new List<SchemaFinding>();
        if (Text(snapshot, "schema") != "iglesia")
        {
            findings.Add(new("blocking", "schema", "Expected iglesia catalog metadata."));
            return new(MinistrySchemaReference.Sha256, findings);
        }
        var tables = Items(snapshot, "tables").ToDictionary(t => Text(t, "name"), StringComparer.Ordinal);
        var columns = Items(snapshot, "columns").ToLookup(c => Text(c, "table_name"), StringComparer.Ordinal);
        var constraints = Items(snapshot, "constraints").ToLookup(c => Text(c, "table"), StringComparer.Ordinal);
        foreach (var expected in reference.Tables)
        {
            var path = $"iglesia.{expected.Name}";
            if (!tables.TryGetValue(expected.Name, out var table))
            { findings.Add(new("blocking", path, "Required table is not visible.")); continue; }
            if (Flag(table, "rowSecurity") || Flag(table, "forceRowSecurity"))
                findings.Add(new("review", path + ".rls", "Review RLS with the API database role before integration; the reference declares no RLS policy."));
            var actualColumns = columns[expected.Name].ToDictionary(c => Text(c, "column_name"), StringComparer.Ordinal);
            foreach (var column in expected.Columns)
            {
                var columnPath = path + "." + column.Name;
                if (!actualColumns.TryGetValue(column.Name, out var actual))
                { findings.Add(new("blocking", columnPath, "Required column is not visible.")); continue; }
                var actualType = Text(actual, "data_type");
                if (actual.TryGetProperty("character_maximum_length", out var length) && length.ValueKind == JsonValueKind.Number)
                    actualType += $"({length.GetInt32()})";
                actualType = MinistrySchemaReference.CanonicalType(actualType);
                if (actualType != column.Type)
                    findings.Add(new("blocking", columnPath, "Column type differs.", column.Type, actualType));
                if ((Text(actual, "is_nullable") == "YES") != column.Nullable)
                    findings.Add(new("blocking", columnPath, "Nullability differs.", column.Nullable.ToString(), Text(actual, "is_nullable")));
                var actualDefault = Text(actual, "column_default");
                if (DefaultTokens(column.Default ?? "") != DefaultTokens(actualDefault))
                    findings.Add(new("review", columnPath + ".default", "Default expression requires review.", column.Default, actualDefault));
                if (Text(actual, "is_identity") == "YES" || Text(actual, "is_generated") is not ("" or "NEVER"))
                    findings.Add(new("review", columnPath, "Identity/generated behavior differs from the reference."));
            }
            foreach (var extra in actualColumns.Keys.Except(expected.Columns.Select(c => c.Name)))
                findings.Add(new("review", path + "." + extra, "Additional database column; review its effect on writes."));
            var actualConstraints = constraints[expected.Name].ToDictionary(c => Text(c, "name"), StringComparer.Ordinal);
            foreach (var constraint in expected.Constraints)
            {
                var constraintPath = path + "." + constraint.Name;
                if (!actualConstraints.TryGetValue(constraint.Name, out var actual))
                { findings.Add(new("blocking", constraintPath, "Expected named constraint is not visible; compare equivalent constraints manually.")); continue; }
                if (Text(actual, "kind") != constraint.Kind || !Flag(actual, "validated"))
                    findings.Add(new("blocking", constraintPath, "Constraint kind/validation differs."));
                if (MinistrySchemaReference.Tokens(constraint.Definition) != MinistrySchemaReference.Tokens(Text(actual, "definition")))
                    findings.Add(new("review", constraintPath, "Constraint text differs. PostgreSQL may rewrite casts/parentheses; no semantic equivalence is assumed.", constraint.Definition, Text(actual, "definition")));
            }
            foreach (var extra in actualConstraints.Keys.Except(expected.Constraints.Select(c => c.Name)))
            {
                // PostgreSQL 18 exposes NOT NULL as catalog constraints; column nullability is checked above.
                if (Text(actualConstraints[extra], "kind") != "n")
                    findings.Add(new("review", path + "." + extra, "Additional constraint may affect behavior."));
            }
        }
        foreach (var extra in tables.Keys.Except(reference.Tables.Select(t => t.Name)))
            findings.Add(new("review", "iglesia." + extra, "Additional table is outside the supplied reference."));
        CompareIndexes(reference, snapshot, findings);
        CompareTriggers(reference, snapshot, findings);
        foreach (var policy in Items(snapshot, "policies"))
            findings.Add(new("review", "iglesia." + Text(policy, "tablename") + ".policy." + Text(policy, "policyname"),
                "RLS policy requires explicit authorization review.", null, policy.GetRawText()));
        return new(MinistrySchemaReference.Sha256, findings);
    }

    private static void CompareIndexes(MinistrySchemaReference reference, JsonElement snapshot, List<SchemaFinding> findings)
    {
        var indexes = Items(snapshot, "indexesDetailed").ToDictionary(i => Text(i, "name"), StringComparer.Ordinal);
        foreach (var expected in reference.Indexes)
        {
            var path = $"iglesia.{expected.Table}.{expected.Name}";
            if (!indexes.TryGetValue(expected.Name, out var actual))
            { findings.Add(new("blocking", path, "Required index is not visible.")); continue; }
            var actualColumns = Items(actual, "columns").Select(c => c.GetString() ?? "").ToArray();
            if (Text(actual, "table") != expected.Table || Flag(actual, "unique") != expected.Unique ||
                !Flag(actual, "valid") || !Flag(actual, "ready") || !actualColumns.SequenceEqual(expected.Columns))
                findings.Add(new("blocking", path, "Index table, columns, uniqueness, or readiness differs."));
            if (MinistrySchemaReference.Tokens(expected.Predicate ?? "") != MinistrySchemaReference.Tokens(Text(actual, "predicate")))
                findings.Add(new("review", path + ".predicate", "Partial-index predicate requires review.", expected.Predicate, Text(actual, "predicate")));
        }
        var knownNames = reference.Indexes.Select(i => i.Name).ToHashSet(StringComparer.Ordinal);
        // PK/UNIQUE indexes are checked through their constraints. Other extra indexes need review.
        var constraintNames = Items(snapshot, "constraints").Where(c => Text(c, "kind") is "p" or "u")
            .Select(c => Text(c, "name")).ToHashSet(StringComparer.Ordinal);
        foreach (var name in indexes.Keys.Where(n => !knownNames.Contains(n) && !constraintNames.Contains(n)))
            findings.Add(new("review", "iglesia.index." + name, "Additional index may change uniqueness or write behavior."));
    }

    private static void CompareTriggers(MinistrySchemaReference reference, JsonElement snapshot, List<SchemaFinding> findings)
    {
        var triggers = Items(snapshot, "triggers").ToDictionary(t => (Text(t, "table"), Text(t, "name")));
        foreach (var expected in reference.Triggers)
        {
            var path = $"iglesia.{expected.Table}.{expected.Name}";
            if (!triggers.TryGetValue((expected.Table, expected.Name), out var actual))
            { findings.Add(new("blocking", path, "Required trigger is not visible.")); continue; }
            if (Text(actual, "enabled") != "O" || Text(actual, "functionSchema") != "iglesia" ||
                Text(actual, "functionName") != expected.FunctionName || Flag(actual, "securityDefiner"))
                findings.Add(new("blocking", path, "Trigger enablement, function binding or SECURITY DEFINER differs."));
            if (MinistrySchemaReference.Tokens(expected.Definition) != MinistrySchemaReference.Tokens(Text(actual, "definition")))
                findings.Add(new("review", path, "Trigger timing/events/columns require review.", expected.Definition, Text(actual, "definition")));
            if (MinistrySchemaReference.Tokens(expected.FunctionBody) != MinistrySchemaReference.Tokens(Text(actual, "functionBody")))
                findings.Add(new("review", path + ".function", "Trigger function body differs from the reference."));
            var config = Items(actual, "functionConfig").Select(c => c.GetString() ?? "").ToArray();
            if (!config.Contains("search_path=\"\"", StringComparer.Ordinal))
                findings.Add(new("review", path + ".search_path", "Verify the expected empty function search_path."));
        }
        foreach (var extra in triggers.Keys.Except(reference.Triggers.Select(t => (t.Table, t.Name))))
            findings.Add(new("review", $"iglesia.{extra.Item1}.{extra.Item2}", "Additional trigger may affect writes."));
    }

    private static string DefaultTokens(string value) => MinistrySchemaReference.Tokens(Regex.Replace(value,
        @"::(?:bpchar|character varying|text)\s*$", "", RegexOptions.IgnoreCase));
    private static IEnumerable<JsonElement> Items(JsonElement value, string key) =>
        value.TryGetProperty(key, out var child) && child.ValueKind == JsonValueKind.Array ? child.EnumerateArray() : [];
    private static string Text(JsonElement value, string key) =>
        value.TryGetProperty(key, out var child) && child.ValueKind != JsonValueKind.Null ? child.ToString() : "";
    private static bool Flag(JsonElement value, string key) =>
        value.TryGetProperty(key, out var child) && child.ValueKind == JsonValueKind.True;
}
