namespace MisionLiderParis.Application.Common;

public sealed class ApiException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
    public static ApiException SchemaPending() => new(503, "ministry_schema_pending",
        "La integración ministerial requiere inspeccionar el esquema existente.");
    public static ApiException Forbidden() => new(403, "access_denied", "Acceso denegado.");
    public static ApiException NotFound() => new(404, "not_found", "Recurso no encontrado.");
    public static ApiException Invalid(string message) => new(400, "invalid_request", message);
}
