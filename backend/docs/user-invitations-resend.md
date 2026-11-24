# HU-012: usuarios e invitaciones con Resend

2026-11-08. Resend sustituye Gmail OAuth por autorización expresa del usuario. No requiere credenciales de Google ni reemplaza ASP.NET Core Identity. SMTP sigue disponible sin fallback automático; EmailJS conserva exclusivamente el contacto público.

## Configuración pendiente para correo real

1. Revocar la clave expuesta en el chat y crear una nueva con permiso de envío limitado al dominio necesario. No copiarla al repositorio ni al chat.
2. Verificar un dominio propio en Resend y escoger su remitente. No utilizar `@gmail.com` como From; el Gmail institucional puede ser ReplyTo. No se ha verificado ningún dominio ni envío real en este trabajo.
3. Configurar mediante User Secrets para pruebas de desarrollo o gestor de secretos del hosting:

| Clave | Valor |
|---|---|
| Email:Provider | Resend (Smtp conserva compatibilidad) |
| Resend:ApiKey | Nueva clave privada de envío |
| Email:From | Dirección simple del dominio autorizado, sin nombre de presentación |
| Email:ReplyTo | Dirección institucional opcional |
| Email:InvitationUrl | URL HTTPS pública terminada en /activar-cuenta |
| Email:RecoveryUrl | URL HTTPS pública terminada en /restablecer-contrasena |
| Email:ConfirmationUrl | URL HTTPS pública terminada en /confirmar-correo |
| Email:InvitationMinutes | 1440 por defecto; rango5–10080 |

En variables de entorno, sustituir `:` por `__`. No incluir query, fragmento ni credenciales en callbacks. En producción se rechaza localhost. Mantener el key ring/certificado de Data Protection persistente, protegido y compartido entre instancias según la configuración existente. No se modificaron secretos existentes.

Resend usa POST https://api.resend.com/emails, Bearer, HTML y texto plano e Idempotency-Key. No hay redirección ni reintento automático. Configuración ausente/error del proveedor produce entrega no confirmada; la cuenta ya creada se conserva. Accepted significa aceptación de solicitud, no entrega. Desactivar seguimiento de enlaces para los mensajes de autenticación en la configuración del dominio.

Referencias oficiales: [envío](https://resend.com/docs/api-reference/emails/send-email), [dominios](https://resend.com/docs/dashboard/domains/introduction), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Contratos

- GET /api/v1/users y /{id}; PUT /{id}, /{id}/grants, /{id}/active y POST /{id}/revoke-sessions se reutilizan.
- GET /api/v1/users/administration-options?operation=USER_CREATE|USER_VIEW|USER_ASSIGN_ROLE y people-options?search=documento&operation=USER_CREATE|USER_UPDATE: opciones acotadas por permiso, sin PERSON_VIEW automático.
- POST /api/v1/users/invitations: email, displayName, personId opcional y grants con permissionIds explícitos para OPERATOR. Devuelve201 con user y deliveryStatus; nunca contraseña ni token.
- POST /api/v1/users conserva respuesta UserDto pero ahora también crea sin contraseña y genera invitación; el campo Password antiguo no se aplica. Los clientes anteriores deben pasar al flujo de activación. La API ya no permite fijar contraseñas ajenas.
- POST /api/v1/users/{id}/invitation: reenvío autorizado,202 con deliveryStatus, al menos60 segundos entre intentos por cuenta. No crea otra cuenta; invalida invitaciones anteriores.
- POST /api/v1/auth/activate-invitation: email, token y newPassword;204 al activar,400 inválido/consumido/bloqueado/revocado. Contraseña y confirmación del correo se guardan atómicamente bajo bloqueo de fila.
- Confirmación, recuperación y restablecimiento existentes mantienen sus contratos y usan el proveedor elegido. No activan cuentas invitadas passwordless por esos otros propósitos.
- Enlaces nuevos llevan email/token en fragmento, retirado de la URL al abrir Angular. No se guardan en localStorage ni se exponen en respuestas administrativas. Desactivar o revocar rota el stamp; reactivar no restaura enlaces anteriores.

Validación y límites: specs/018-user-invitations/validation.md. No se aplicó ningún SQL remoto ni se ejecutaron migraciones, bootstrap o090. Aceptación productiva pendiente de la seguridad coordinada y una prueba manual de envío expresamente autorizada.
