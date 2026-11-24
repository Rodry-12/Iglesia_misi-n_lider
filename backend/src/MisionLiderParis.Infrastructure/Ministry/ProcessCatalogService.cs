using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Domain.Ministry;

namespace MisionLiderParis.Infrastructure.Ministry;

public sealed class ProcessCatalogService(MinistryDbContext db, MinistryAuthorization authorization,
    ActorTransactionContext actorTransaction) : IProcessCatalogService
{
    private static readonly Expression<Func<ProcessCategory, CategoryDto>> CategoryProjection = c =>
        new(c.Id, c.Name, c.Description, c.SortOrder, c.IsActive, c.CreatedAt, c.UpdatedAt);
    private static readonly Expression<Func<MinistryProcess, ProcessDto>> ProcessProjection = p =>
        new(p.Id, p.CategoryId, p.Name, p.Description, p.SortOrder, p.IsActive, p.CreatedAt, p.UpdatedAt,
            p.Category.Name, p.Category.IsActive);

    public async Task<Page<CategoryDto>> CategoriesAsync(Guid actor, ListQuery query, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "CATEGORY_VIEW", null, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var categories = db.Categories.AsNoTracking();
        if (query.IsActive is { } active) categories = categories.Where(c => c.IsActive == active);
        if (MinistryAuthorization.Search(query.Search) is { } search)
            categories = categories.Where(c =>
                MinistryDbContext.TranslateSearch(c.Name, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()));
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        var result = new Page<CategoryDto>(await categories.OrderBy(c => c.SortOrder).ThenBy(c => c.Id).Skip(offset).Take(page.PageSize)
            .Select(CategoryProjection).ToListAsync(ct), page.PageNumber, page.PageSize, await categories.CountAsync(ct));
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<CategoryDto> CategoryAsync(Guid actor, Guid id, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "CATEGORY_VIEW", null, ct);
        return await db.Categories.AsNoTracking().Where(c => c.Id == id).Select(CategoryProjection).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound();
    }

    public async Task<CategoryDto> CreateCategoryAsync(Guid actor, CategoryRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "CATEGORY_CREATE", null, ct, global: true);
        var category = new ProcessCategory { Name = request.Name.Trim(), Description = request.Description?.Trim(), SortOrder = request.SortOrder };
        db.Categories.Add(category); await db.SaveChangesAsync(ct);
        return await db.Categories.AsNoTracking().Where(c => c.Id == category.Id).Select(CategoryProjection).SingleAsync(ct);
    }

    public async Task<CategoryDto> UpdateCategoryAsync(Guid actor, Guid id, CategoryRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "CATEGORY_UPDATE", null, ct, global: true);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.CategoryAsync(db, id, ct);
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw ApiException.NotFound();
        category.Name = request.Name.Trim(); category.Description = request.Description?.Trim();
        category.SortOrder = request.SortOrder; category.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var result = await db.Categories.AsNoTracking().Where(c => c.Id == category.Id).Select(CategoryProjection).SingleAsync(ct);
        await transaction.CommitAsync(ct); return result;
    }

    public async Task SetCategoryActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "CATEGORY_UPDATE", null, ct, global: true);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.CategoryAsync(db, id, ct);
        var category = await db.Categories.SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw ApiException.NotFound();
        category.IsActive = active; category.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
    }

    public async Task<Page<ProcessDto>> ProcessesAsync(Guid actor, ProcessQuery query, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_VIEW", null, ct);
        await using var transaction = db.Database.CurrentTransaction is null
            ? await actorTransaction.BeginReadOnlyAsync(db, ct) : null;
        var processes = db.Processes.AsNoTracking();
        if (query.CategoryId is { } category) processes = processes.Where(p => p.CategoryId == category);
        if (query.IsActive is { } active) processes = processes.Where(p => p.IsActive == active && (!active || p.Category.IsActive));
        if (MinistryAuthorization.Search(query.Search) is { } search)
            processes = processes.Where(p =>
                MinistryDbContext.TranslateSearch(p.Name, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()) ||
                MinistryDbContext.TranslateSearch(p.Category.Name, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()
                    .Contains(MinistryDbContext.TranslateSearch(search, SearchNormalization.Characters, SearchNormalization.Replacements).ToUpper()));
        var page = new PageRequest(query.Page, query.PageSize); var offset = page.Offset;
        var result = new Page<ProcessDto>(await processes.OrderBy(p => p.SortOrder).ThenBy(p => p.Id).Skip(offset).Take(page.PageSize)
            .Select(ProcessProjection).ToListAsync(ct), page.PageNumber, page.PageSize, await processes.CountAsync(ct));
        if (transaction is not null) await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<ProcessDto> ProcessAsync(Guid actor, Guid id, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_VIEW", null, ct);
        return await db.Processes.AsNoTracking().Where(p => p.Id == id).Select(ProcessProjection).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound();
    }

    public async Task<ProcessDto> CreateProcessAsync(Guid actor, ProcessRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_CREATE", null, ct, global: true);
        MinistryAuthorization.Id(request.CategoryId);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.CategoryAsync(db, request.CategoryId, ct);
        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId && c.IsActive, ct)) throw ApiException.NotFound();
        var process = new MinistryProcess { CategoryId = request.CategoryId, Name = request.Name.Trim(),
            Description = request.Description?.Trim(), SortOrder = request.SortOrder };
        db.Processes.Add(process); await db.SaveChangesAsync(ct);
        var result = await db.Processes.AsNoTracking().Where(p => p.Id == process.Id).Select(ProcessProjection).SingleAsync(ct);
        await transaction.CommitAsync(ct); return result;
    }

    public async Task<ProcessDto> UpdateProcessAsync(Guid actor, Guid id, ProcessRequest request, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_UPDATE", null, ct, global: true);
        MinistryAuthorization.Id(request.CategoryId);
        var previousCategory = await db.Processes.AsNoTracking().Where(p => p.Id == id).Select(p => p.CategoryId)
            .SingleOrDefaultAsync(ct);
        if (previousCategory == Guid.Empty) throw ApiException.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        foreach (var categoryId in new[] { previousCategory, request.CategoryId }.Distinct().Order())
            await MinistryLocks.CategoryAsync(db, categoryId, ct);
        await MinistryLocks.ProcessAsync(db, id, ct);
        var process = await db.Processes.SingleAsync(p => p.Id == id, ct);
        if (process.CategoryId != previousCategory) throw MinistryAuthorization.Conflict("El proceso cambió; vuelve a consultarlo.");
        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId && c.IsActive, ct)) throw ApiException.NotFound();
        process.CategoryId = request.CategoryId; process.Name = request.Name.Trim();
        process.Description = request.Description?.Trim(); process.SortOrder = request.SortOrder; process.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        var result = await db.Processes.AsNoTracking().Where(p => p.Id == process.Id).Select(ProcessProjection).SingleAsync(ct);
        await transaction.CommitAsync(ct); return result;
    }

    public async Task SetProcessActiveAsync(Guid actor, Guid id, bool active, CancellationToken ct)
    {
        await authorization.RequireAsync(actor, "PROCESS_UPDATE", null, ct, global: true);
        var category = await db.Processes.AsNoTracking().Where(p => p.Id == id).Select(p => p.CategoryId).SingleOrDefaultAsync(ct);
        if (category == Guid.Empty) throw ApiException.NotFound();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await MinistryLocks.CategoryAsync(db, category, ct); await MinistryLocks.ProcessAsync(db, id, ct);
        var process = await db.Processes.SingleAsync(p => p.Id == id, ct);
        if (process.CategoryId != category) throw MinistryAuthorization.Conflict("El proceso cambió; vuelve a consultarlo.");
        if (active && !await db.Categories.AnyAsync(c => c.Id == category && c.IsActive, ct))
            throw MinistryAuthorization.Conflict("La categoría debe estar activa.");
        process.IsActive = active; process.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
    }
}
