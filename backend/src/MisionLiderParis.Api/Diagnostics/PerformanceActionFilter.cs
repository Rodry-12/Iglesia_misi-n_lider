using Microsoft.AspNetCore.Mvc.Filters;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.Api.Diagnostics;

public sealed class PerformanceActionFilter : IAsyncActionFilter, IAsyncResultFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    { using var timing = PerformanceDiagnostics.Measure(PerformancePhase.Action); await next(); }
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    { using var timing = PerformanceDiagnostics.Measure(PerformancePhase.Result); await next(); }
}
