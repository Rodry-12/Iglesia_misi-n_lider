# Configurar Gmail API

Proveedor opcional implementado y probado con simuladores. La configuración versionada conserva Resend. No se inició la API ni se enviaron correos reales en este incremento.

## Valores de servidor

| Clave .NET | Variable de entorno | Valor/uso |
| --- | --- | --- |
| `Email:Provider` | `Email__Provider` | `GmailApi` al activar explícitamente el proveedor |
| `GoogleGmail:ClientId` | `GoogleGmail__ClientId` | Cliente OAuth web |
| `GoogleGmail:ClientSecret` | `GoogleGmail__ClientSecret` | Secreto del cliente |
| `GoogleGmail:RedirectUri` | `GoogleGmail__RedirectUri` | `https://localhost:7243/api/v1/integrations/google/callback` |
| `GoogleGmail:TokenStorePath` | `GoogleGmail__TokenStorePath` | Opcional; por defecto `%LOCALAPPDATA%\MisionLiderParis\gmail\credential.bin` |
| `GoogleGmail:RefreshToken` | `GoogleGmail__RefreshToken` | Importación opcional desde gestor de secretos; innecesaria con callback |
| `Email:InvitationUrl` | `Email__InvitationUrl` | URL HTTPS de activación HU-012 existente |
| `Email:ConfirmationUrl` | `Email__ConfirmationUrl` | URL HTTPS de confirmación existente |
| `Email:RecoveryUrl` | `Email__RecoveryUrl` | URL HTTPS de recuperación existente |

El remitente Gmail es fijo: `iglesiamisionliderparis@gmail.com`, nombre Iglesia Misión Líder París. `Email:From` conserva su efecto en Resend/SMTP. `Email:ReplyTo` es opcional. No cambian las plantillas ni los tokens en fragmentos de URL.

Guardar Client ID/Secret mediante **Administrar secretos de usuario** del proyecto API en el IDE, o un gestor de secretos del host. User Secrets no cifra su archivo: restringir el perfil. No poner credenciales en comandos, historial, archivos versionados ni Angular. En Production utilizar el gestor del host o el lanzador seguro existente que inyecte configuración al proceso; no asumir carga automática de User Secrets.

El callback obtiene y guarda el refresh token cifrado, sin mostrarlo ni exigir copiarlo. La ruta debe estar bajo el perfil, fuera del repositorio y sin enlaces de redirección. Windows restringe carpeta y archivo al SID del proceso; Unix aplica 0700/0600. Proteger respaldos de archivo y key ring: perder sus claves requiere nueva autorización.

Reutilizar `Security:KeyRingPath`, `Security:KeyCertificatePath`, `Security:KeyCertificatePassword` (variables `Security__KeyRingPath`, `Security__KeyCertificatePath`, `Security__KeyCertificatePassword`). Production exige el key ring persistente y protegido por certificado existente. Proteger el PFX, su contraseña y las claves fuera del repositorio. No cambiar a Development para eludir requisitos. No se modifican conexiones ni secretos existentes.

## Pasos manuales

1. Habilitar Gmail API en el proyecto Google Cloud correcto. Configurar consentimiento y cliente OAuth de tipo **Aplicación web** con scope exclusivo `https://www.googleapis.com/auth/gmail.send`. Si está en Testing, añadir el Gmail institucional como usuario de prueba.
2. Registrar exactamente `https://localhost:7243/api/v1/integrations/google/callback` como URI de redirección autorizada. Cargar Client ID/Secret de forma segura.
3. Iniciar la API por el procedimiento operativo seguro existente, conservando conexiones y entorno aprobados. `Properties/launchSettings.json` confirma HTTPS 7243, pero su perfil usa Development: no usarlo para eludir requisitos Production. Comprobar certificado HTTPS y escucha real; no ejecutar migraciones ni bootstrap.
4. Autenticarse como SuperAdministrador global en el mismo navegador. Abrir `https://localhost:7243/api/v1/integrations/google`, pulsar **Continuar a Google** y elegir `iglesiamisionliderparis@gmail.com`. La página hace POST con CSRF; el endpoint POST no se inicia desde la barra de direcciones.
5. Google retorna al callback; este valida el flujo, guarda la credencial cifrada y redirige a `/api/v1/integrations/google/complete` sin código ni tokens en la URL final. Activar `Email:Provider=GmailApi` explícitamente y reiniciar para cargar configuración. Verificar un envío controlado solo cuando sea autorizado.

## Endpoints y seguridad

- `GET /api/v1/integrations/google`: confirmación técnica protegida.
- `POST /api/v1/integrations/google/authorize`: inicio global HTTPS con CSRF.
- `GET /api/v1/integrations/google/callback`: retorno público con correlación y validación del administrador iniciador.
- `GET /api/v1/integrations/google/complete`: mensaje genérico sin credenciales.

State aleatorio de un uso, PKCE S256, cinco minutos y cookie Secure/HttpOnly/Lax; Identity conserva Strict. Se verifican usuario activo, correo confirmado, bloqueo, security stamp y permiso global antes y después del intercambio. No se registran solicitudes Google, tokens ni cuerpos de errores. Configurar también proxies/APM de producción para no capturar query strings del callback ni cuerpos/cabeceras sensibles.

`login_hint` no demuestra la identidad de Google y gmail.send no permite consultar perfiles. El From y la ruta `users/{correo-institucional}/messages/send` fuerzan ese buzón; otro correo no se usa como remitente alternativo. La autorización real y aceptación del buzón siguen pendientes de comprobación manual.

Access token en memoria con margen de renovación de 60 segundos. Refresh token cifrado, rotación persistida; `invalid_grant` o envío 401 exige autorizar nuevamente. El registro revocado impide recuperar un token antiguo desde configuración. No hay revocación remota automática, reintento de mensajes ni fallback. 403/429/5xx devuelven indisponibilidad sin cuerpo del proveedor; HU-012 conserva su cuenta pendiente y reenvío explícito.

Estado OAuth y caché de **una instancia**. Reiniciar durante consentimiento exige comenzar nuevamente; un segundo inicio en el mismo navegador reemplaza su cookie. Varias réplicas requieren estado distribuido de un uso y coordinación de credenciales/renovación antes del despliegue; no compartir el archivo sin coordinación.

Pendientes de producción: dominio/HTTPS y redirect definitivo, credenciales, consentimiento/publicación/verificación que exija Google, cuotas, respaldo de claves y validación de entrega. Revisar las restricciones de expiración de tokens del modo Testing; no asumir autorización indefinida.

Referencias: [OAuth web](https://developers.google.com/identity/protocols/oauth2/web-server), [users.messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [MimeKit MIT](https://www.nuget.org/packages/MimeKit/4.18.2).
