# Revisión de integridad de la referencia

Fuente y hashes en [reference/README.md](reference/README.md). Los hallazgos se detectaron primero en el texto recibido y se contrastaron después con los metadatos y cuerpos de funciones reales en Supabase, mediante Session pooler y transacción READ ONLY. No se aplicaron correcciones en Supabase.

| Hallazgo | Consecuencia | Tratamiento preparado |
| --- | --- | --- |
| WITHDRAWN asigna fecha_finalizacion sin completar fecha_inicio; el CHECK exige inicio para cualquier finalización. | Retirar una asignación PENDING falla aunque sea una acción válida. | Conservar inicio nulo; finalización >= asignación, y >= inicio si existe. COMPLETED sí requiere inicio. |
| trg_validar_estado_fechas solo se dispara al actualizar estado_id. | Cambiar fechas directamente puede dejar un PENDING iniciado o un abierto finalizado sin validar su estado. | Proponer trigger sobre estado_id y las tres fechas; rechazar fechas incompatibles. |
| No existe un índice único para asignaciones abiertas; el trigger usa comprobación y advisory lock. | La garantía depende del aislamiento/snapshots y de las rutas de escritura. | Proponer índice único parcial (persona_id, proceso_id) WHERE fecha_finalizacion IS NULL, después de validar la equivalencia estado/fecha y todos los datos existentes. |
| validar_asignacion_proceso no verifica sede.activa. | La función real admite nuevas asignaciones en sedes desactivadas. | La API valida sede activa y bloquea la sede dentro de la transacción; la función desplegada no se modificó. |
| Desactivación de personas y cierre de persona_sede no revalidan asignaciones abiertas. | Un traslado o baja puede dejar participante/responsable fuera del ámbito. | La API rechaza baja/traslado mientras existan asignaciones abiertas como participante o responsable y usa bloqueos ordenados. Rechazo y traslado posterior verificados localmente. |
| No se implementan transiciones entre estados ni inmutabilidad de finales. | Se pueden reabrir completados/retiros y alterar la interpretación de duplicados. | Política propuesta: Pending→InProgress/Withdrawn; InProgress→Suspended/Completed/Withdrawn; Suspended→InProgress/Withdrawn. Finales sin reapertura. Reasignar crea otra asignación después de finalizar. |
| fecha_actualizacion tiene DEFAULT pero no actualización automática. | No indica la última modificación sin intervención de aplicación/trigger. | Fijarla en operaciones futuras; la propuesta de fechas la actualiza en cambios de estado/fechas. No se afirma resolver todos los timestamps. |
| Las consultas de ejemplo no tienen filtro de sede autorizado. | Copiarlas a endpoints facilitaría acceso horizontal y conteos globales no autorizados. | No usarlas como contratos de acceso. Todas las consultas reales deben filtrar en SQL desde el alcance autenticado. |
| BRANCH_ADMIN no recibe USER_ASSIGN_ROLE; el código previo usaba un único permiso configurable. | Se podían mezclar privilegios distintos o impedir todas las operaciones. | Permisos USER_VIEW, USER_CREATE, USER_UPDATE, USER_CHANGE_STATUS y USER_ASSIGN_ROLE separados por operación; sin permisos derivados por nombre de rol. |
| OPERATOR no tiene permisos por defecto y falta su asociación granular. | Un rol OPERATOR por sí solo no permite operar. | auth_app.user_grant_permissions por concesión de rol/sede; UUID y FK verificadas hacia el catálogo existente, sin duplicarlo. Scripts 002/004 y delegación comprobados localmente. |

## Propuesta incremental

[sql/proposals/003-assignment-integrity.sql](../sql/proposals/003-assignment-integrity.sql) es un cambio revisable aplicado únicamente en PostgreSQL local, no en Supabase. Exige reconocimiento explícito de revisión, valida tablas/constraint/catálogo/datos, toma bloqueos con timeout, valida el nuevo CHECK antes de sustituir el conflictivo, cambia el trigger y crea el índice único. Cualquier inconsistencia provoca error; no modifica, elimina ni inventa filas para hacer pasar la migración. La política de transiciones es una decisión de aplicación explícita, no un hecho del esquema Supabase original.

La aplicación verifica sede/personas/proceso/categoría activos y usa bloqueos ordenados para asignación, traslado y baja. El script 004 agrega FK verificadas y validadores de concesiones; el 005 incorpora RLS exclusivo del grupo runtime. Estos cambios se aplican únicamente en integración local con el baseline real de estructura, sin filas personales de Supabase. No se agregan historiales, seguimiento ni finanzas.

## Conexión real verificada

El intento inicial al host directo falló por falta de ruta IPv6. El usuario proporcionó después Session pooler; la conexión IPv4 con VerifyFull y certificado raíz público funcionó. Se inspeccionaron y compararon las once tablas, sus restricciones, índices, RLS y las tres funciones. Se verificaron los mapeos EF mediante consultas vacías de solo lectura.

La captura mostró RLS habilitado sin políticas y un usuario de inspección BYPASSRLS; este usuario no sirve para la API productiva. Se confirmaron los códigos de roles, permisos y estados, sin exportar registros personales. La contraseña de Supabase no se guardó en archivos del proyecto. Consultar [schema-review.md](schema-review.md) y [database-rollout.md](database-rollout.md) para evidencia y aplicación pendiente.

## Referencias técnicas

- [PostgreSQL: eventos y UPDATE OF en triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html).
- [PostgreSQL: restricciones CHECK y límites entre tablas](https://www.postgresql.org/docs/current/ddl-constraints.html).
- [PostgreSQL: índices únicos parciales](https://www.postgresql.org/docs/current/sql-createindex.html).
- [Supabase: conexión directa IPv6 y pooler de sesión IPv4](https://supabase.com/docs/guides/database/connecting-to-postgres).
