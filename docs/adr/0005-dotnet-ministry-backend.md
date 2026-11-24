# ADR 0005: incremento de backend .NET y especificaciones locales

Fecha: 2026-10-23. Estado: adoptada por solicitud explícita; implementación ministerial disponible, aplicación incremental a Supabase pendiente.

El usuario solicita analizar e implementar el prompt maestro de backend y crear sus especificaciones dentro de backend. Esta petición sustituye la reserva de backend vacío de ADR 0004, conservando su separación de carpetas y el hosting Angular. No modifica el stack frontend de ADR 0003 ni habilita autenticación en Angular.

## Decisión

Solución .NET 10/ASP.NET Core, EF Core 10, Npgsql/PostgreSQL e Identity en `backend/`, con Domain/Application/Infrastructure/Api. Especificaciones en `backend/specs/NNN-nombre/`; comandos SDD reconocen ese ámbito. La fase de activación del 2026-10-24 retoma explícitamente unitarias del backend e integración HTTP/PostgreSQL aislada. Angular sigue con unitarias diferidas.

Identity usa el esquema propio `auth_app`, sin roles de Identity, separado de `auth` de Supabase. La autorización funcional debe resolver roles/permisos/sedes de `iglesia`. Cookie HttpOnly/Secure/SameSite Strict con CSRF y CORS explícitos para integración del mismo sitio. No se agrega registro público, pagos, LMS ni historial.

## Restricción factual

El documento no incluye DDL. El repositorio no contiene SQL ni conexión a Supabase y el usuario indicó que no lo proporcionará. No se inventan columnas, permisos, FK, transiciones ni triggers. La integración ministerial permanece pendiente y deniega acceso; readiness falla. Los CRUD y reportes ministeriales no se consideran implementados por existir infraestructura de cuentas.

Actualización de la misma fecha: el usuario sí aportó una reconstrucción de referencia y credenciales. Se conserva el texto íntegro por hash, sin ejecutarlo. Exige comparar la base real ANTES de mapear sus entidades EF; el intento autorizado se bloqueó por conectividad IPv6 (NetworkUnreachable). Ya existen comparador READ ONLY, permisos USER_* separados y migración propia de concesiones explícitas OPERATOR. Las correcciones ministeriales son propuestas revisables y no aplicadas; no hay todavía verificación real ni nuevos mapeos ministeriales.

Continuación posterior: Session pooler con TLS VerifyFull permitió inspeccionar y comparar las once tablas reales ANTES de implementar mapeos. Se conservan metadatos y dump de estructura real por hash; las diferencias CHECK/predicados/funciones/RLS se revisan explícitamente. El impedimento IPv6 anterior es histórico. Se implementaron adaptador real, CRUD, asignaciones y reportes. El contexto ministerial excluye todas las tablas de migraciones.

Los scripts incrementales 001–005 crean auth_app, referencias verificadas, correcciones de integridad y RLS para un usuario runtime sin BYPASSRLS. Se aplican solo en PostgreSQL local aislado; no se ejecutaron en Supabase. Nunca EnsureCreated/EnsureDeleted ni migraciones automáticas en la API. Los tests persistentes usan exclusivamente base local dedicada con sufijo `_tests`, no producción.

## Consecuencias

README y AGENTS reconocen el incremento autorizado. `firebase.json` sigue publicando solo Angular. Sin cambios en rutas, UI o sesión frontend. La habilitación productiva requiere aplicar el paquete revisado con respaldo/preflight, crear LOGIN runtime y primer administrador, configurar SMTP y claves, y verificar operación real; este ADR no reemplaza esa verificación.

La activación local posterior verificó SQL 001–005 conservando filas y OID, restauración de respaldos previos/posteriores, bootstrap CLI y primer login Kestrel HTTPS con usuario runtime separado. La conexión de bootstrap se exige ahora en Database:MigrationConnectionString; runtime no puede ser propietario ni heredar privilegios que evadan RLS. Evidencia en backend/docs/activation-review.md; sin cambios en producción.
