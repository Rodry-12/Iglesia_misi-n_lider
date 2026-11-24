using Microsoft.AspNetCore.Mvc.Filters;
using MisionLiderParis.Api.Controllers;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.Api.Security;

// Related permission and resource reads already support an enclosing signed transaction.
// Restrict the scope to materialized ministerial GETs; never wrap writes or external integrations.
public sealed class MinistryReadScopeFilter(MinistryDbContext database, ActorTransactionContext actorTransaction) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!HttpMethods.IsGet(context.HttpContext.Request.Method) ||
            context.Controller is not (BranchesController or PeopleController or ProcessCategoriesController or ProcessesController or ProcessAssignmentsController or UsersController) ||
            database.Database.CurrentTransaction is not null)
        { await next(); return; }

        var ct = context.HttpContext.RequestAborted;
        await using var transaction = await actorTransaction.BeginReadOnlyAsync(database, ct);
        var result = await next();
        if (result.Exception is null) await transaction.CommitAsync(ct);
        // Disposal rolls back on exceptions/cancellation; no context survives the action.
    }
}
