# Validación — Gmail API

## Autorización real y preparación del primer envío — 2026-11-09

Consentimiento manual completado en navegador normal y retorno a /complete confirmado por el usuario. ProtectedGmailCredentialStore recupera el Refresh Token cifrado, coincidente con ClientId, sin marca de revocación ni texto plano en disco. Preparación real mediante GmailAccessTokens con caché nueva: renovación HTTP 200 y Access Token validado por GoogleGmailClient; cero solicitudes messages.send. Provider GmailApi y remitente institucional comprobados. GmailApiAccountEmailSender incorpora diagnóstico fijo sin enlaces/tokens Identity mediante su pipeline MIME existente; sin endpoint ni cambio de interfaz Identity. Ejecutor local `.local/supabase-key-review/GmailDiagnostic.cs` limita a un intento durable y recoge únicamente metadatos de aceptación/identificador, sin registrar destinatario, tokens o contenido. Build correcto y 23 GmailEmailTests aprobados con simuladores. Publicación OAuth no consultable desde el entorno; no se presume Testing/Production. Destinatario, autorización de un envío real y confirmación de recepción pendientes. Sin conexión ni modificaciones a Supabase en esta preparación.

Fecha de trabajo: 2026-11-08. Evidencia automatizada, sin autorización Google ni envío real.

| Comprobación | Resultado |
| --- | --- |
| Restore de solución `--force-evaluate --disable-parallel` | Correcto; MimeKit y locks resueltos desde NuGet oficial |
| Build Release `--no-restore` | Correcto; cero advertencias y errores |
| Unitarias Release `--no-build --no-restore` | 90 aprobadas, cero fallos y omitidas; incluye 20 casos Gmail y regresiones Resend/SMTP |
| Integración focalizada OAuth, Identity e invitaciones | 18 aprobadas, cero fallos; una fixture de navegador omitida al no solicitar el navegador real |
| `npm run spec:check`, `npm run deps:check`, `npm run skills:check`, `npm run format:check` | Correctos; formato comprueba frontend y no acredita formato C# |

Comandos:

```powershell
dotnet restore backend/MisionLiderParis.slnx --force-evaluate --disable-parallel
dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore
dotnet test backend/tests/MisionLiderParis.UnitTests --configuration Release --no-build --no-restore --logger 'trx;LogFileName=gmail-unit.trx' --results-directory backend/artifacts/gmail-api
dotnet test backend/tests/MisionLiderParis.IntegrationTests --configuration Release --no-build --no-restore --filter 'FullyQualifiedName~GmailOAuth|FullyQualifiedName~PostgresIdentityTests|FullyQualifiedName~Invitation' --logger 'trx;LogFileName=gmail-integration.trx' --results-directory backend/artifacts/gmail-api
```

Integración ejecutada exclusivamente en la base preaprovisionada `mlp_user_validation_tests` de loopback, puerto 57693, con identidades de pruebas separadas y `MLP_TEST_PREPROVISIONED=1`. PostgreSQL existente, sin instalación ni migraciones. Google sustituido por handler HTTP; credenciales sintéticas y almacenamiento en memoria. Unitarias verifican además cifrado real Data Protection y ACL de un archivo temporal privado, eliminado al finalizar.

Cinco escenarios HTTP Gmail: éxito sin cookie Identity y rechazo de replay; acceso anónimo/sede/CSRF; correlación inválida y rechazo de Google; revocación antes del intercambio; revocación durante intercambio impide persistir tokens. Unitarias cubren scope único, PKCE, caducidad, consumo concurrente, renovación/rotación concurrente, invalid_grant, MIME para tres plantillas, 401/403/429/500 sin reintento/fallback, cifrado/ACL y selección de los tres proveedores.

La última ejecución comprueba el formulario HTML real (token CSRF oculto, POST de formulario sin encabezado CSRF) y que CSP permite la navegación al autorizador fijo de Google. PostgreSQL aislado detenido al terminar; ningún servidor operativo iniciado. TRX locales en `backend/artifacts/gmail-api/`.

AC-001–AC-005 verificados en código con simuladores. Esto no acredita autorización de Google, Gmail institucional seleccionado, entrega real ni despliegue. No se inicia API operativa, no se modifican secretos/conexiones, Supabase, migraciones, bootstrap ni 090.

Pendientes manuales y limitaciones de producción en `docs/gmail-api.md`. El puerto 7243 está confirmado en launchSettings, sin afirmar que esté escuchando actualmente. Producción con réplicas requiere coordinación distribuida antes de activar esta implementación de una instancia.
