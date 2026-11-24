# Plan — Gmail API

- Separar estado OAuth, cliente REST Google, coordinador de tokens, almacén cifrado y adaptador; reutilizar composer y contratos.
- Cookie de correlación Lax permite volver de Google; Identity conserva Strict. Validar security stamp, estado activo y privilegio global antes y después del intercambio.
- Página técnica de confirmación HTML de servidor con CSRF y CSP; no crear UI Angular ni alterar el sistema visual.
- Data Protection existente protege el archivo externo privado. Production exige key ring persistente con certificado. El secreto no se guarda en Supabase.
- No reintentar mensajes de resultado incierto, ni usar fallback. HTTP Google sin loggers ni redirecciones, errores sin cuerpo del proveedor.
- MimeKit 4.18.2 MIT serializa MIME; actualizar locks. NuGet.Config de backend selecciona el feed oficial para resolver el mapeo heredado del perfil que impedía restaurar esta dependencia; no modifica el perfil.
- Verificar unitarias (incluido cifrado/ACL), callback HTTP, Identity y HU-012 con PostgreSQL aislado y Google simulado. La solicitud actual autoriza expresamente estas pruebas.
- Antes de múltiples réplicas: estado distribuido de un uso, coordinación de renovación y almacenamiento compartido seguro. Antes de producción: autorización Google y envío controlado autorizados separadamente.
