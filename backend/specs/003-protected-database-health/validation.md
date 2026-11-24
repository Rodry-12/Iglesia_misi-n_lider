# Validación — 003 protected-database-health

2026-11-24. Implementación local y verificación HTTP/TCP, sin cambios remotos ni SQL de escritura.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | WebApplicationFactory | Token válido/inválido/ausente/malformado/sin configurar y aislamiento de recursos ministeriales cubiertos. |
| AC-002 | HTTP simulado + Npgsql/TCP loopback | Contratos exactos200/503, ausencia de datos internos, deadline5s, conexión rechazada y handshake limitado3s correctos; SELECT1 real pendiente por base aislada no disponible. |
| AC-003 | HTTP + regresiones existentes | CORS deshabilitado para origen desconocido y Angular autorizado, no-store,6/min sin cola, cookies/CSRF y autorización anónima existentes. |
| AC-004 | Restore/build/workflow/guía | Compilación local correcta; evidencia final a continuación. |

Inspección previa: Program.cs, Identity/cookies, CSRF, rate limiter, ApiExceptionHandler,
ReadinessCheck, registro EF/Npgsql y RuntimeDatabaseSafety, pruebas y workflow backend.
SELECT1 no necesita actor ministerial ni tablas; se conserva identidad runtime que
el validador existente comprueba antes de arrancar. MLP_HEALTH_TOKEN procede solo
del entorno y no crea principal Identity. Metadata exclusiva de la ruta evita el
guard genérico de DB no configurada para responder401/503 sin afectar otras rutas.

Restore: `dotnet restore MisionLiderParis.slnx --locked-mode` correcto. Intentos
restringidos salieron sin diagnóstico; repetición fuera del sandbox correcta.
Build Release `--no-restore --property:BaseOutputPath=.../artifacts/database-monitor-build/bin/`
correcto,0 errores y0 advertencias; salida separada para no sobrescribir API local.
Primer build corrigió extensión CORS de endpoint mínimo (metadata DisableCors) y
using de RateLimiting, sin cambios de dependencias.

Primera suite detectó que cancelación de OpenAsync no interrumpía un handshake
PostgreSQL atascado antes del timeout15s. Corregido cap de apertura3s derivado de
DatabaseOptions existente, sin otro secreto/datasource, conservando host/pooler/TLS
y límites de pool. Npgsql puede usar otro pool por la cadena derivada; documentado.
Test TCP real demuestra límite inferior a5s; handler tiene deadline total5s y
CommandTimeout2s. No se usan tareas de conexión abandonadas en segundo plano.

Pruebas completas iniciales:114 unitarias correctas; integración50 correctas,
105 omitidas y1 fallo previo de OpenAPI. La configuración de Development intenta
cargar PFX privado con contraseña no disponible; al aislar temporalmente ese PFX
aparece un fallo adicional previo de JsonSchemaExporter/DateTimeOffset. Los cambios
temporales del harness se retiraron: no se cambia producción ni OpenAPI para ocultarlo.
Ese único test se excluye de la repetición final y no se afirma suite completa verde.

Las105 omitidas incluyen pruebas PostgreSQL/browser existentes y el nuevo SELECT1
real, porque MLP_TEST_DATABASE no está configurada. Puertos de clusters históricos
aislados consultados con pg_isready sin respuesta; no se arrancaron ni modificaron.
No se ejecutaron migrations/bootstrap ni SQL en Supabase. No hubo correos reales.

Guía: backend/docs/protected-database-health.md; workflow local cada12h, sin checkout
ni permisos de repositorio, secretos por entorno y cliente Python estándar HTTPS
sin redirecciones; no imprime headers ni cuerpo de error. No activado remotamente.

Repetición final: `dotnet test MisionLiderParis.slnx --no-build --no-restore -c Release
--property:BaseOutputPath=.../artifacts/database-monitor-build/bin/
--filter FullyQualifiedName!~DevelopmentOpenApiDescribesImplementedRoutesAndRequestContracts`
terminó correctamente:114 unitarias y50 integración correctas (164),105 omitidas.
TRX en backend/artifacts/database-monitor-test-results/verified. Prettier validó y
normalizó YAML del workflow; no se instalaron paquetes para ello. La comprobación
YAML no acredita ejecución real de Actions. Aceptación SQL real y remota pendiente.
