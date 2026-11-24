using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Access;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class ReportService(MinistryDbContext db, MinistryAuthorization authorization) : IReportService
{
    public async Task<SummaryDto> SummaryAsync(Guid actor, Guid? branchId, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "REPORT_VIEW", branchId, ct, global: branchId is null);
        return await BuildSummaryAsync(branchId, ct);
    }

    private async Task<SummaryDto> BuildSummaryAsync(Guid? branchId, CancellationToken ct)
    {
        if (branchId is { } branch && !await db.Branches.AnyAsync(b => b.Id == branch, ct)) throw ApiException.NotFound();
        var people = db.People.AsNoTracking(); var assignments = db.Assignments.AsNoTracking();
        if (branchId is { } id)
        {
            people = people.Where(p => p.Memberships.Any(m => m.BranchId == id && m.EndedAt == null));
            assignments = assignments.Where(a => a.BranchId == id);
        }
        var states = await db.States.AsNoTracking().OrderBy(s => s.Code).Select(s => s.Code).ToArrayAsync(ct);
        var counts = await assignments.GroupBy(a => a.State.Code)
            .Select(group => new StateCount(group.Key, group.Count(), group.Select(a => a.PersonId).Distinct().Count())).ToListAsync(ct);
        return new(branchId, await db.Branches.CountAsync(b => branchId == null || b.Id == branchId, ct),
            await people.CountAsync(p => p.IsActive, ct), await people.CountAsync(ct),
            await db.Processes.CountAsync(p => p.IsActive && p.Category.IsActive, ct), await assignments.CountAsync(ct),
            states.Select(code => counts.SingleOrDefault(c => c.StateCode == code) ?? new StateCount(code, 0, 0)).ToArray());
    }

    public async Task<Page<ResponsibleCount>> ResponsiblePeopleAsync(Guid actor, Guid branchId, ListQuery query, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "REPORT_VIEW", branchId, ct);
        if (!await db.Branches.AnyAsync(b => b.Id == branchId, ct)) throw ApiException.NotFound();
        var groups = db.Assignments.AsNoTracking().Where(a => a.BranchId == branchId).GroupBy(a => a.ResponsiblePersonId)
            .Select(group => new { ResponsiblePersonId = group.Key, Assignments = group.Count(),
                DistinctPeople = group.Select(a => a.PersonId).Distinct().Count() });
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        return new(await groups.OrderBy(g => g.ResponsiblePersonId).Skip(offset).Take(page.PageSize)
                .Select(g => new ResponsibleCount(g.ResponsiblePersonId, g.Assignments, g.DistinctPeople)).ToListAsync(ct),
            page.PageNumber, page.PageSize, await groups.CountAsync(ct));
    }

    public async Task<Page<CategoryCount>> CategoriesAsync(Guid actor, ListQuery query, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "REPORT_VIEW", null, ct);
        var categories = db.Categories.AsNoTracking();
        if (query.IsActive is { } active) categories = categories.Where(c => c.IsActive == active);
        if (MinistryAuthorization.Search(query.Search) is { } search) categories = categories.Where(c => c.Name.Contains(search));
        var data = categories.Select(c => new { CategoryId = c.Id, c.Name, Processes = db.Processes.Count(p => p.CategoryId == c.Id),
            ActiveProcesses = db.Processes.Count(p => p.CategoryId == c.Id && p.IsActive && c.IsActive) });
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        return new(await data.OrderBy(c => c.Name).ThenBy(c => c.CategoryId).Skip(offset).Take(page.PageSize)
                .Select(c => new CategoryCount(c.CategoryId, c.Name, c.Processes, c.ActiveProcesses)).ToListAsync(ct),
            page.PageNumber, page.PageSize, await categories.CountAsync(ct));
    }

    public async Task<string> ExportSummaryAsync(Guid actor, Guid branchId, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "REPORT_EXPORT", branchId, ct);
        var summary = await BuildSummaryAsync(branchId, ct);
        var csv = new StringBuilder("metric,value,distinct_people\r\n");
        csv.Append("active_people,").Append(summary.ActivePeople.ToString(CultureInfo.InvariantCulture)).Append(",\r\n");
        csv.Append("total_people,").Append(summary.TotalPeople.ToString(CultureInfo.InvariantCulture)).Append(",\r\n");
        foreach (var count in summary.AssignmentsByState)
            csv.Append(Cell(count.StateCode)).Append(',').Append(count.Assignments.ToString(CultureInfo.InvariantCulture)).Append(',')
                .Append(count.DistinctPeople.ToString(CultureInfo.InvariantCulture)).Append("\r\n");
        return csv.ToString();
    }

    private static string Cell(string value)
    {
        if (value.Length > 0 && "=+-@\t\r\n".Contains(value[0])) value = "'" + value;
        return "\"" + value.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
    }
}
