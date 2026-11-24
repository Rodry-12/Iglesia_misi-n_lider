using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace MisionLiderParis.Infrastructure.Database;

public sealed record ReferenceColumn(string Name, string Type, bool Nullable, string? Default);
public sealed record ReferenceConstraint(string Name, string Kind, string Definition);
public sealed record ReferenceTable(string Name, IReadOnlyList<ReferenceColumn> Columns,
    IReadOnlyList<ReferenceConstraint> Constraints);
public sealed record ReferenceIndex(string Name, string Table, bool Unique, string[] Columns, string? Predicate);
public sealed record ReferenceTrigger(string Name, string Table, string Definition, string FunctionName, string FunctionBody);

// A deliberately restricted reader for the supplied reconstruction, not a SQL execution engine.
// Hash pinning prevents silently interpreting a different SQL dialect with these limited parsing rules.
public sealed record MinistrySchemaReference(IReadOnlyList<ReferenceTable> Tables,
    IReadOnlyList<ReferenceIndex> Indexes, IReadOnlyList<ReferenceTrigger> Triggers)
{
    public const string Sha256 = "3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2";

    public static MinistrySchemaReference Read(byte[] bytes)
    {
        if (Convert.ToHexString(SHA256.HashData(bytes)) != Sha256)
            throw new InvalidOperationException("Reference SQL hash differs from the reviewed attachment. Review before updating the contract.");
        var sql = System.Text.Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
        var tables = Regex.Matches(sql, @"CREATE TABLE iglesia\.(\w+)\s*\(([\s\S]*?)\r?\n\);")
            .Select(match => ReadTable(match.Groups[1].Value, match.Groups[2].Value)).ToArray();
        var indexes = Regex.Matches(sql,
            @"CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+iglesia\.(\w+)\s*\(([^)]+)\)(?:\s+WHERE\s+([^;]+))?;")
            .Select(m => new ReferenceIndex(m.Groups[2].Value, m.Groups[3].Value, m.Groups[1].Success,
                m.Groups[4].Value.Split(',').Select(c => c.Trim()).ToArray(),
                m.Groups[5].Success ? m.Groups[5].Value.Trim() : null)).ToArray();
        var functions = Regex.Matches(sql,
            @"CREATE OR REPLACE FUNCTION iglesia\.(\w+)\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;")
            .ToDictionary(m => m.Groups[1].Value, m => m.Groups[2].Value, StringComparer.Ordinal);
        var triggers = Regex.Matches(sql,
            @"CREATE TRIGGER (\w+)[\s\S]*?ON iglesia\.(\w+)[\s\S]*?EXECUTE FUNCTION iglesia\.(\w+)\(\);")
            .Select(m => new ReferenceTrigger(m.Groups[1].Value, m.Groups[2].Value, m.Value,
                m.Groups[3].Value, functions[m.Groups[3].Value])).ToArray();
        if (tables.Length != 11 || triggers.Length != 3 || functions.Count != 3 || indexes.Length != 11)
            throw new InvalidOperationException("The reference reader did not account for every expected table, index and trigger.");
        return new(tables, indexes, triggers);
    }

    private static ReferenceTable ReadTable(string name, string body)
    {
        var columns = new List<ReferenceColumn>();
        var constraints = new List<ReferenceConstraint>();
        foreach (var entry in SplitDefinitions(body))
        {
            var constraint = Regex.Match(entry, @"^CONSTRAINT\s+(\w+)\s+([\s\S]+)$");
            if (constraint.Success)
            {
                var definition = constraint.Groups[2].Value.Trim();
                var kind = definition.StartsWith("PRIMARY KEY", StringComparison.Ordinal) ? "p" :
                    definition.StartsWith("UNIQUE", StringComparison.Ordinal) ? "u" :
                    definition.StartsWith("FOREIGN KEY", StringComparison.Ordinal) ? "f" :
                    definition.StartsWith("CHECK", StringComparison.Ordinal) ? "c" :
                    throw new InvalidOperationException("Unsupported reference constraint.");
                constraints.Add(new(constraint.Groups[1].Value, kind, definition));
                continue;
            }
            var column = Regex.Match(entry, @"^(\w+)\s+(UUID|VARCHAR\(\d+\)|CHAR\(\d+\)|BOOLEAN|TIMESTAMPTZ|DATE|TEXT|INTEGER)([\s\S]*)$");
            if (!column.Success) throw new InvalidOperationException("Unsupported reference column.");
            var columnName = column.Groups[1].Value;
            var remainder = column.Groups[3].Value;
            var defaultValue = Regex.Match(remainder, @"\bDEFAULT\s+('[^']*'|\w+\(\)|\w+)");
            columns.Add(new(columnName, CanonicalType(column.Groups[2].Value),
                !remainder.Contains("NOT NULL", StringComparison.Ordinal) && !remainder.Contains("PRIMARY KEY", StringComparison.Ordinal),
                defaultValue.Success ? defaultValue.Groups[1].Value : null));
            if (remainder.Contains("PRIMARY KEY", StringComparison.Ordinal))
                constraints.Add(new($"{name}_pkey", "p", $"PRIMARY KEY ({columnName})"));
            if (remainder.Contains("UNIQUE", StringComparison.Ordinal))
                constraints.Add(new($"{name}_{columnName}_key", "u", $"UNIQUE ({columnName})"));
            var foreign = Regex.Match(remainder, @"REFERENCES\s+(iglesia\.\w+)\((\w+)\)\s+ON DELETE\s+(RESTRICT|CASCADE)");
            if (foreign.Success)
                constraints.Add(new($"{name}_{columnName}_fkey", "f",
                    $"FOREIGN KEY ({columnName}) REFERENCES {foreign.Groups[1].Value}({foreign.Groups[2].Value}) ON DELETE {foreign.Groups[3].Value}"));
        }
        return new(name, columns, constraints);
    }

    private static IEnumerable<string> SplitDefinitions(string body)
    {
        var depth = 0;
        var quoted = false;
        var start = 0;
        for (var i = 0; i < body.Length; i++)
        {
            if (body[i] == '\'')
            {
                if (quoted && i + 1 < body.Length && body[i + 1] == '\'') { i++; continue; }
                quoted = !quoted;
            }
            if (quoted) continue;
            if (body[i] == '(') depth++;
            if (body[i] == ')') depth--;
            if (body[i] == ',' && depth == 0) { yield return body[start..i].Trim(); start = i + 1; }
        }
        if (quoted || depth != 0) throw new InvalidOperationException("Unbalanced reference table definition.");
        if (start < body.Length) yield return body[start..].Trim();
    }

    public static string CanonicalType(string type) => Regex.Replace(type.ToLowerInvariant(), @"\s+", " ")
        .Replace("character varying", "varchar", StringComparison.Ordinal)
        .Replace("timestamp with time zone", "timestamptz", StringComparison.Ordinal)
        .Replace("character", "char", StringComparison.Ordinal);

    // Literals keep their case and whitespace. Never normalize away a semantic string difference.
    public static string Tokens(string sql)
    {
        var tokens = Regex.Matches(sql,
            "'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|--[^\\r\\n]*|/\\*[\\s\\S]*?\\*/|[a-zA-Z_][\\w$]*|\\d+|::|<>|!=|<=|>=|\\S")
            .Select(m => m.Value).Where(t => !t.StartsWith("--", StringComparison.Ordinal) && !t.StartsWith("/*", StringComparison.Ordinal))
            .Select(t => t.StartsWith('\'') || t.StartsWith('"') ? t : t.ToLowerInvariant()).ToList();
        if (tokens.Count > 0 && tokens[^1] == ";") tokens.RemoveAt(tokens.Count - 1);
        return string.Join(" ", tokens);
    }
}
