# Monitor protegido de conectividad PostgreSQL

`GET https://DOMINIO_API/api/v1/health/database`

El endpoint ejecuta `SELECT 1` con Npgsql usando **Database:ConnectionString** ya
configurada. Reutiliza identidad ministerial runtime, Session pooler, TLS y ajustes de pool;
no añade conexiones administrativas ni configuración alternativa de base de datos.
RuntimeDatabaseValidator existente rechaza roles privilegiados en el arranque.
No consulta tablas de miembros, Identity ni políticas RLS y no escribe datos.

## Configuración

Definir **MLP_HEALTH_TOKEN** en las variables de entorno del proceso de la API.
Formato: **32 bytes aleatorios criptográficos, codificados como64 caracteres
hexadecimales** (256 bits). Solo se lee esa variable de entorno; no se configura en
appsettings.json ni en Angular. Ausencia, valor vacío o formato inválido deshabilita
el acceso:401 para cualquier credencial. Reiniciar el proceso al rotar el token.

Para generar el valor en una consola privada PowerShell, sin imprimirlo:

```powershell
$taskHealthBytes = New-Object byte[] 32
$taskHealthRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $taskHealthRandom.GetBytes($taskHealthBytes) } finally { $taskHealthRandom.Dispose() }
$env:MLP_HEALTH_TOKEN = ([BitConverter]::ToString($taskHealthBytes)).Replace('-', '').ToLowerInvariant()
[Array]::Clear($taskHealthBytes, 0, $taskHealthBytes.Length)
```

Guardar ese mismo valor en los gestores privados del servidor y de GitHub, sin
pegarlo en chat, comandos versionados o logs. La API captura la credencial al
resolver el servicio singleton; el monitor no emite cookies ni crea un principal
Identity. Un token del monitor no autoriza ninguna operación ministerial.

## Contrato y límites

- Bearer válido + PostgreSQL disponible:200 `{"status":"healthy"}`.
- Bearer válido + conexión fallida/consulta fallida/timeout/configuración DB ausente:
  503 `{"status":"unavailable"}`.
- Token ausente/incorrecto/no configurado:401 sin cuerpo ni consulta PostgreSQL.
- `Cache-Control: no-store`, CORS deshabilitado incluso para Angular autorizado.
- Apertura limitada a3 segundos (o al límite existente si es menor), CommandTimeout2
  segundos; plazo cooperativo5 segundos para apertura y consulta,
  enlazado a la cancelación del cliente. Incluye espera de pool. Limpieza/cancelación
  del driver y transporte pueden añadir latencia; no es una garantía de tiempo real.
  Solo se deriva el timeout de la cadena existente: Npgsql puede usar un pool distinto
  para esa cadena derivada, conservando sus límites; no se registra otro datasource
  ni otra configuración de credenciales. Esto evita dejar conexiones en segundo plano
  para devolver un timeout aparente mientras el driver sigue negociando.
- Rate limit compartido del monitor:6 peticiones/minuto/instancia, sin cola; después
  429. También aplica el limitador global existente. El cron solo necesita2 al día.
- HTTPS del pipeline existente; HTTP se redirige sin procesar credenciales en el
  handler. El cliente debe llamar directamente a HTTPS y no seguir redirecciones.

La excepción a la política de sesión se limita a este GET, que valida su propia
credencial. El guard de configuración DB se omite solo para su metadata de ruta
para poder responder401/503 con el contrato del monitor; CSRF no cambia.
Los health checks existentes `/health/live` y `/health/ready` conservan su conducta.
No se registran Authorization, tokens ni mensajes de excepciones del driver.
Si hay proxy/APM externo, mantener también allí deshabilitado el registro de
Authorization. No activar HTTP verbose para comprobar el secreto.

Si la base no está disponible durante el arranque, RuntimeDatabaseValidator puede
impedir que arranque la API. GitHub detectará fallo HTTP/conexión; no puede obtener
503 de un proceso que no está ejecutándose. Este endpoint comprueba conectividad,
no reemplaza readiness de esquemas ni aceptación de permisos/RLS.

## Prueba local

Usar la API HTTPS y las conexiones runtime ya configuradas. Establecer la variable
en el mismo proceso que inicia la API; nunca usar PostgreSQL local para la app.
Con un token generado en la consola privada anterior:

```powershell
Invoke-RestMethod -Uri 'https://localhost:7243/api/v1/health/database' `
  -Headers @{ Authorization = 'Bearer ' + $env:MLP_HEALTH_TOKEN } -TimeoutSec 10
```

No desactivar validación TLS ni agregar `-SkipCertificateCheck`. La prueba sin
encabezado debe devolver401. No cortar Supabase para probar el fallo: las pruebas
automatizadas simulan la indisponibilidad/timeout y usan solo loopback aislado para
la sonda Npgsql. El test SELECT1 real solo corre si MLP_TEST_DATABASE apunta a
loopback y a una base existente con sufijo `_tests`; no ejecuta DDL ni migraciones.

## GitHub Actions

Ejemplo listo en `.github/workflows/database-health.yml`:

1. En Settings > Secrets and variables > Actions, crear el **secret**
   `MLP_HEALTH_TOKEN` con el mismo token del servidor.
2. Crear la **variable** `MLP_HEALTH_URL` con
   `https://DOMINIO_API/api/v1/health/database`.
3. Revisar y publicar el workflow en la rama predeterminada; también permite
   `workflow_dispatch` para comprobación manual.

Cron `17 */12 * * *`:00:17 y12:17 UTC (19:17 y07:17 en Colombia). Timeout cliente10s,
job2min; HTTPS con validación TLS y redirecciones bloqueadas. No checkout, permisos
de repositorio ni dependencias Python externas; solo pasa el secreto por entorno.
El workflow no imprime URL, Bearer, cuerpo de error ni excepciones y falla si no
recibe exactamente el estado healthy con200. Revisar las notificaciones de Actions
del repositorio para recibir avisos de ejecuciones fallidas.

GitHub programa sobre la rama predeterminada; puede retrasar ejecuciones y desactiva
cron en repositorios públicos tras60 días sin actividad. Véase la
[documentación de schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
y la [configuración de secretos](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

No se ha habilitado un workflow remoto ni configurado secretos por esta entrega.
La supervisión detecta interrupciones; **no garantiza evitar suspensión de Supabase
Free** ni intenta eludir límites del proveedor.
