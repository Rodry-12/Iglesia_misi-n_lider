using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MisionLiderParis.Application.Common;
using Npgsql;
using Microsoft.AspNetCore.Antiforgery;

namespace MisionLiderParis.Api.Errors;

public sealed class ApiExceptionHandler(IProblemDetailsService problems, ILogger<ApiExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, code, title) = exception switch
        {
            ApiException error => (error.StatusCode, error.Code, error.Message),
            AntiforgeryValidationException => (400, "invalid_csrf", "El token de seguridad no es válido. Vuelve a obtenerlo."),
            DbUpdateConcurrencyException => (409, "concurrent_update", "El recurso cambió; vuelve a consultarlo."),
            DbUpdateException { InnerException: PostgresException { SqlState: "23505" } } =>
                (409, "duplicate_resource", "Ya existe un recurso con esos datos."),
            DbUpdateException { InnerException: PostgresException { SqlState: "23503" or "23514" or "P0001" } } =>
                (409, "integrity_conflict", "La operación no cumple las reglas de integridad."),
            NpgsqlException => (503, "database_unavailable", "La base de datos no está disponible."),
            _ => (500, "internal_error", "No fue posible completar la solicitud.")
        };
        // Do not log exception messages: driver and mail errors can include connection/recipient details.
        if (status >= 500) logger.LogError("Request failure {Code}; type {ExceptionType}; trace {TraceId}",
            code, exception.GetType().Name, context.TraceIdentifier);
        context.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = status, Title = title, Type = $"urn:mision-lider-paris:problem:{code}",
                Extensions = { ["code"] = code, ["traceId"] = context.TraceIdentifier }
            }
        });
    }
}
