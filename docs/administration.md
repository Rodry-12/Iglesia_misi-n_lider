# Base de administración por sedes

HU-008 (2026-11-07): `/gestion/formacion/asignar` permite asignación bajo PROCESS_ASSIGN efectivo sin exigir acceso independiente a Personas/Catálogo. Participante/responsable activos, documentados, diferentes y misma sede; categoría/proceso activo. Sede derivada, estado/fechas del backend,201 confirmado, comprobante y detalle GET con PROCESS_VIEW. Sin historial, corrección documental, cambio de responsable, finalización ni SQL nuevo. Ver `docs/process-assignments.md` y `specs/014-process-assignment/validation.md`; aceptación remota pendiente.

HU-007 (2026-11-07): `/gestion/formacion` gestiona el catálogo global de categorías/procesos con las API existentes. CATEGORY_VIEW y PROCESS_VIEW habilitan sus consultas de forma independiente. CATEGORY_CREATE/UPDATE y PROCESS_CREATE/UPDATE requieren alcance global; una concesión de sede no habilita escritura del catálogo. Guard específico global, fichas, formularios, estado, filtros/paginación y confirmaciones; sin asignar personas ni agregar permisos/esquema. Ver `docs/process-catalog.md` y evidencia aislada en `specs/013-process-catalog/validation.md`.

HU-004 (2026-11-07): listado y ficha de personas incorporan Activar/Desactivar según PERSON_DEACTIVATE efectivo en la sede, además de PERSON_VIEW para consultar. Se reutiliza PUT `/api/v1/people/{id}/active` (204), con confirmación de baja y recarga posterior. Reactivación exige identificación vigente y sede activa; baja conserva restricciones de procesos/cuentas globales y revocación de sesiones existente, con rollback ante fallo. Sin permisos, tablas ni rutas nuevas. Ver `docs/person-state.md` y `specs/012-person-state/validation.md`.

HU-003 (2026-11-07): `/gestion/miembros/:id/editar` reutiliza GET/PUT de personas. Exige PERSON_VIEW para precarga y PERSON_UPDATE efectivo en la sede; el permiso de actualizar no concede lectura. Identificación, sede y estado son de solo lectura. Control de versión mediante expectedUpdatedAt, errores/concurrencia y cancelación confirmada; sin endpoints ni columnas nuevas. `can(permission, null)` representa un recurso sin sede y exige alcance global explícito; omitir sede conserva su uso genérico para navegación. Ver `docs/person-editing.md` y evidencia aislada en `specs/011-person-editing/validation.md`.

HU-002 (2026-11-07): `/gestion/miembros/registrar` implementa alta con PERSON_CREATE, documento obligatorio y sede autorizada, sin requerir BRANCH_VIEW. Cuentas solo CREATE tienen entrada desde el resumen; listado/ficha siguen requiriendo PERSON_VIEW. Confirmación de borrador y éxito, integración con HU-001 y validación real navegador/API/PostgreSQL aislados. Supabase permanece pendiente. Ver `docs/person-registration.md`.

HU-001 (2026-11-07): Miembros incorpora consulta real de personas, búsqueda/filtros/paginación y ficha de solo lectura según `specs/009-person-query/`. Tabla reducida a persona, documento, sede, estado y detalle. Los demás módulos continúan preparatorios. Validación en entorno aislado; aceptación Supabase pendiente de despliegue coordinado del contexto firmado. No requiere BRANCH_VIEW para consultar nombres/opciones de sede autorizados por PERSON_VIEW.

Actualización etapa 2.1 (2026-11-06): `/acceso` autentica con Identity real, AuthStore restaura la cookie y el resumen `/gestion` muestra usuario/concesiones del servidor. Se retoman unitarias Angular y E2E. Los módulos siguen preparatorios. La tabla histórica siguiente queda sustituida para navegación por PERSON_VIEW (Miembros), PROCESS_VIEW (Formación), BRANCH_VIEW (Sedes) y USER_VIEW (Usuarios); Finanzas continúa diferida sin código API. Ver [autenticación](angular-authentication.md).

## Estado

La spec 003 prepara la estructura solicitada. Finanzas, Miembros, Formación, Sedes y Usuarios tienen entradas y rutas diferidas; muestran «Próximamente». No se han implementado operaciones de negocio, persistencia, saldos, miembros o cuentas reales.

La guía visual `/diseno` permite inspeccionar el stack, alternar tema y validar una sede de ejemplo. Sus datos se mantienen en memoria y se borran al abandonar la vista. No crea sedes.

## Rutas y acceso

| Ruta                 | Capacidad requerida    |
| -------------------- | ---------------------- |
| `/gestion`           | Sesión autenticada     |
| `/gestion/finanzas`  | `finanzas:leer`        |
| `/gestion/miembros`  | `miembros:leer`        |
| `/gestion/formacion` | `formacion:leer`       |
| `/gestion/sedes`     | `sedes:leer`           |
| `/gestion/usuarios`  | `usuarios:administrar` |

`AUTH_PRINCIPAL` es un token de inyección de `Signal<Principal | null>`. Su valor por defecto es nulo. No existen usuarios de prueba, credenciales, inicio de sesión simulado, sesión en localStorage ni selector de roles en la aplicación.

`sessionGuard` impide cargar gestión sin sesión y devuelve `/acceso`. `moduleGuard` comprueba cada ruta hija, deniega metadatos incompletos y devuelve `/sin-acceso` cuando falta capacidad. La navegación visible utiliza la misma función de permisos.

## Roles y ámbitos

`Principal.roles` contiene identificadores que proporcionará el servidor. No se inventa una matriz institucional de administrador, pastor o tesorero. La política del backend convertirá roles en capacidades con `scope` de tipo `sites` (lista explícita) o `all-sites`.

`AccessContext.can(permission, siteId)` verifica pertenencia a la sede. Sin `siteId` solo determina si existe alguna sede habilitada para mostrar la entrada del módulo. No autoriza leer una colección completa de todas las sedes.

Cuando existan tablas y consultas reales, el contrato de datos debe exigir el ámbito: consultar y modificar únicamente sedes permitidas, validar nuevamente en la API y mantener auditoría. La UI no deberá descargar datos de sedes ajenas para filtrarlos posteriormente.

Los [guards de Angular](https://angular.dev/guide/routing/route-guards) no sustituyen la autorización de servidor. El contrato local no valida tokens ni establece identidad real.

## Integración siguiente

1. Definir proveedor de identidad, backend, roles institucionales y matriz de capacidades.
2. Implementar un servicio que restaure y valide sesión y provea su señal de solo lectura mediante `AUTH_PRINCIPAL`.
3. Resolver cierre de sesión, caducidad, revocación y errores de API antes de habilitar operaciones.
4. Especificar CRUD por funcionalidad: datos, validación, ámbito por sede, auditoría y permisos de lectura/escritura.

No habilitar usuarios asignando un principal fijo en `app.config.ts`: las pruebas inyectan sesiones controladas únicamente en sus providers de test.
