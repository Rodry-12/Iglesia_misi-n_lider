# Contrato de integración Angular/API

Presentación de sedes (2026-11-09): cada concesión de login/session y alcance
efectivo incorpora `branchName` opcional/nullable. Se resuelve con las sedes activas
ya autorizadas, en la consulta existente; global devuelve null. Es solo texto de
presentación: la autorización conserva roleCode, branchId y permisos efectivos.
Clientes anteriores pueden ignorarlo; Angular admite respuestas previas sin él.

HU-010 (2026-11-07): la ficha reutiliza PUT `/api/v1/process-assignments/{id}/state`, `{stateCode}`,200 con DTO básico/fechas persistidas. GET `/api/v1/process-assignments/states?assignmentId={id}` devuelve destinos del catálogo permitidos por AssignmentLifecycle y requiere PROCESS_CHANGE_STATUS en el ámbito de esa asignación (404 fuera de ámbito); sin assignmentId conserva catálogo/PROCESS_VIEW. Detalle sigue requiriendo VIEW independiente. Confirmación manual de terminales, sin fechas enviadas ni reapertura. Evidencia: `../../specs/016-assignment-state/validation.md`.

HU-009 (2026-11-07): GET `/api/v1/process-assignments` y `/{id}` conservan PROCESS_VIEW. DTO añade nombres/documento vigente, categoría/descripción y nombre del estado; no exige PERSON_VIEW/CATEGORY_VIEW. Listado añade Search,CategoryId e IncludeFilters opcionales; este último devuelve Filters con sedes autorizadas y opciones derivadas de asignaciones visibles. Se conservan los cuatro campos previos de paginación. Sin nuevos endpoints ni escrituras; evidencia en `../../specs/015-assignment-follow-up/validation.md`.

HU-008 (2026-11-07): `/gestion/formacion/asignar` reutiliza POST `/api/v1/process-assignments` con `{personId, processId, responsiblePersonId, branchId}` y respuesta201. GET nuevos `/api/v1/process-assignments/selection-options` y `/people-options` requieren solo PROCESS_ASSIGN y ofrecen catálogo activo/estado inicial y selección mínima por ámbito. Documento vigente obligatorio para participante y responsable; sede derivada del participante. GET de asignación existente conserva PROCESS_VIEW, sin concederlo al asignar. Contratos, campos y límites en `../../docs/process-assignments.md`; evidencia en `../../specs/014-process-assignment/validation.md`. Sin cambios remotos.

La etapa 2.1 conecta Angular a csrf/login/session/logout mediante AuthStore y proxy HTTPS del mismo origen. `/gestion` muestra la sesión y concesiones reales; los módulos de negocio continúan como preparación sin CRUD. Comandos y evidencia en `../../docs/angular-authentication.md` y `../../specs/008-angular-authentication/`.

## Transporte y CSRF

Usar HTTPS y el mismo sitio para frontend/API. En desarrollo, API `https://localhost:7243`; Angular debe servir HTTPS o usar un proxy HTTPS del mismo origen. `http://localhost:4200` no es un origen permitido por defecto. Los despliegues entre sitios necesitan revisar SameSite antes de habilitarlos.

1. `GET /api/v1/auth/csrf`, con credenciales de cookies: devuelve `{ "token": "...", "headerName": "X-XSRF-TOKEN" }` y cookie HttpOnly antiforgery.
2. Enviar `X-XSRF-TOKEN` en todo POST/PUT/PATCH/DELETE, incluido login, recuperación y confirmación. Con origen distinto usar `withCredentials: true`; el origen debe estar autorizado exactamente.
3. `POST /api/v1/auth/login` con `{ "email": "...", "password": "..." }`. Cookie de sesión HttpOnly, Secure, SameSite Strict, duración por inactividad configurable; no se devuelve un bearer token.
4. Obtener de nuevo CSRF después de login y de cualquier cambio de identidad. `GET /api/v1/auth/session` devuelve `userId`, `displayName` y concesiones actuales (`roleId`, `roleCode`, `branchId`, `permissions`).
5. `POST /api/v1/auth/logout` revoca todas las sesiones de la cuenta. 401 exige volver al acceso; 403 indica denegación; 503 indica dependencia no disponible. No confundir 503 con credenciales incorrectas.

Los códigos de permiso ya se inspeccionaron en el catálogo real y el backend los resuelve por operación/sede. Angular usa PERSON_VIEW, PROCESS_VIEW, BRANCH_VIEW y USER_VIEW para navegación con su ámbito devuelto; USER_VIEW no concede escritura. El resumen muestra todos los permisos y UUID de sede recibidos, sin inventar nombres. No inyectar un principal constante ni deducir permisos de enlaces visibles. Cada recurso autoriza su sede desde persistencia en el servidor.

Se confirmaron USER_VIEW/CREATE/UPDATE/CHANGE_STATUS/ASSIGN_ROLE. El backend los exige por operación, sin convertir USER_VIEW en administración total. Para concesiones OPERATOR se admite `permissionIds` opcional por elemento de `grants`: lista UUID explícita, sin duplicados. Otros roles rechazan permisos directos. Al reemplazar accesos se revoca el security stamp. BRANCH_ADMIN tiene 16 permisos reales, sin USER_ASSIGN_ROLE: puede crear operadores con permisos delegables, pero no reemplazar sus concesiones existentes. Los catálogos no se duplican en Identity.

Actualización 2026-11-21: OPERATOR (Acceso personalizado) también puede ejecutar las cinco operaciones USER_* cuando posee el permiso explícito correspondiente. La autorización filtra las concesiones por operación antes de evaluar sedes. Consulta únicamente cuentas OPERATOR cuyas concesiones completas estén dentro de esas sedes; las mutaciones y nuevas concesiones exigen además permisos destinatarios contenidos en los del actor para la misma sede. No administra BRANCH_ADMIN/SUPER_ADMIN ni concede permisos superiores. Se mantienen las protecciones de cuenta propia y la revocación de sesiones. Crear/modificar sedes y catálogos globales, trasladar personas y reportes globales conservan sus requisitos de SuperAdministrador; un permiso en una sede no otorga alcance global.

## Endpoints implementados

| Método | Ruta relativa a `/api/v1` | Resultado |
| --- | --- | --- |
| GET | `/auth/csrf` | 200, token CSRF |
| POST | `/auth/login` | 200 sesión; 401 genérico; 429 límite |
| GET | `/auth/session` | 200 sesión; 401 sin sesión |
| POST | `/auth/logout` | 204 y revocación global |
| POST | `/auth/change-password` | 204, requiere contraseña actual y nueva |
| POST | `/auth/forgot-password` | 202 genérico, incluso cuenta inexistente |
| POST | `/auth/reset-password` | 204; recibe email, token y newPassword |
| POST | `/auth/resend-confirmation` | 202 genérico |
| POST | `/auth/confirm-email` | 204; recibe email y token |
| GET | `/users` | Página: items, pageNumber, pageSize, totalCount |
| GET/PUT | `/users/{id}` | Cuenta permitida; 404 fuera del ámbito |
| POST | `/users` | 201, cuenta creada administrativamente sin confirmar correo |
| PUT | `/users/{id}/active` | 204; `{ "isActive": true }` |
| PUT | `/users/{id}/grants` | 204; lista de referencias roleId/branchId |
| POST | `/users/{id}/revoke-sessions` | 204 |
| GET | `/users/me/permissions` | Alcance efectivo de la sesión |
| GET | `/roles`, `/permissions` | Catálogos reales, acceso global |

Estas rutas usan el adaptador ministerial real y se verifican sobre PostgreSQL local con el esquema inspeccionado. En Supabase todavía falta aplicar los scripts incrementales; no se considera habilitada la operación productiva. No hay registro público.

Los listados de usuarios aceptan `page`, `pageSize` (1..100), `search`, `branchId`, `isActive`. La creación recibe `email`, `password`, `displayName`, `personId` opcional y `grants: [{ roleId, branchId }]`. El administrador inicia luego `/auth/resend-confirmation`; crear cuenta no realiza envío externo dentro de una transacción.

Errores usan ProblemDetails. Los errores de aplicación incluyen `code` y `traceId`; 400 de validación incluye `errors`. No depender del texto traducido del error. OpenAPI JSON disponible en desarrollo en `/openapi/v1.json`.

## Endpoints ministeriales implementados

HU-007 (2026-11-07): CategoryDto añade createdAt/updatedAt y ProcessDto añade createdAt/updatedAt/categoryName/categoryIsActive, proyectados desde las tablas existentes. GET de categorías requiere CATEGORY_VIEW, GET de procesos PROCESS_VIEW, incluidos `/process-categories/{id}/processes`. POST categorías/procesos requiere CATEGORY_CREATE/PROCESS_CREATE global y devuelve201; PUT edición/estado requiere CATEGORY_UPDATE/PROCESS_UPDATE global y devuelve200/204. Rutas y entradas se conservan. No hay conteos agregados ni sede en el catálogo. Cambiar categoría está permitido con destino activo; baja no modifica asignaciones ni los estados individuales de procesos de una categoría. Disponibilidad isActive=true de procesos excluye categorías inactivas y AssignmentService vuelve a validarlo. Ver `docs/process-catalog.md` desde la raíz.

HU-004 (2026-11-07): PUT `/api/v1/people/{id}/active` conserva `ActiveRequest {isActive:boolean}`, PERSON_DEACTIVATE y 204 sin cuerpo. Desactivar bloquea asignaciones abiertas como participante/responsable y cuentas globales activas vinculadas. Reactivar exige documento vigente y vinculación vigente con sede activa/autorizada. Transiciones revocan sesiones vinculadas en la misma transacción; repetir el mismo estado válido no vuelve a revocar ni cambia fecha. La denegación SQL 42501 del helper de revocación se comunica como 403 con rollback (también protege cuentas globales inactivas frente a actores de sede). 409 conserva conflictos ministeriales. No cambia documento, sede, credenciales ni procesos. Angular consulta nuevamente tras 204 y conserva filtros; 401/403 mantienen los interceptores existentes. No hay token de estado esperado nuevo; se conserva PUT absoluto y bloqueos. Ver `docs/person-state.md` desde la raíz.

Rutas relativas a `/api/v1`. Todos requieren sesión y autorización de recurso; las escrituras también CSRF. Se usa desactivación, sin DELETE físico.

| Método | Ruta | Operación |
| --- | --- | --- |
| GET/POST | `/branches` | Listar/crear sedes; creación global |
| GET/PUT | `/branches/{id}` | Consulta por BRANCH_VIEW; actualización exclusivamente global, con expectedUpdatedAt |
| PUT | `/branches/{id}/active` | Estado exclusivamente global, con expectedUpdatedAt; rechaza baja con vínculos, procesos abiertos o concesiones existentes |
| GET | `/branches/{id}/administrators` | Solo global; asociaciones BRANCH_ADMIN existentes, paginadas con page/pageSize |
| GET | `/branches/{id}/indicators`, `/branches/{id}/people-count` | Indicadores/conteos autorizados |
| GET/POST | `/people` | Listado acotado/alta transaccional con documento y sede |
| GET/PUT | `/people/{id}` | Detalle/actualización autorizada |
| PUT | `/people/{id}/active` | Activar/desactivar; rechaza procesos abiertos a cargo o como participante |
| GET/POST | `/people/{id}/documents` | Documentos/reemplazo explícito |
| GET | `/people/{id}/branch` | Sede vigente |
| POST | `/people/{id}/branches/{branchId}` | Vincular persona sin sede vigente; global |
| POST | `/people/{id}/transfer` | Traslado global con motivo y sin procesos abiertos |
| GET | `/people/{id}/process-assignments`, `/people/{id}/responsible-assignments` | Asignaciones dentro del ámbito |
| GET/POST | `/process-categories`, `/processes` | Listados/creación; catálogo se escribe globalmente |
| GET/PUT | `/process-categories/{id}`, `/processes/{id}` | Detalle/actualización |
| PUT | `/process-categories/{id}/active`, `/processes/{id}/active` | Cambiar actividad |
| GET | `/process-categories/{id}/processes`, `/processes/{id}/participants` | Relaciones paginadas |
| GET/POST | `/process-assignments` | Consultar/asignar proceso |
| GET | `/process-assignments/{id}`, `/process-assignments/states` | Detalle/catálogo de estados |
| PUT | `/process-assignments/{id}/state` | Cambiar estado con fechas automáticas |
| PUT | `/process-assignments/{id}/responsible` | Responsable activo distinto de participante, misma sede |
| GET | `/reports/overview` | Resumen global exclusivo |
| GET | `/reports/branches/{id}/summary` | Resumen de sede |
| GET | `/reports/branches/{id}/participants-by-responsible` | Agrupación paginada con personas distintas |
| GET | `/reports/process-categories` | Conteos paginados por categoría |
| GET | `/reports/branches/{id}/summary.csv` | Exportación, requiere REPORT_EXPORT |

Listados ministeriales usan `page`, `pageSize` (máximo 100), `search` y `isActive` cuando corresponda. Personas agrega `branchId`; procesos `categoryId`; asignaciones `branchId`, `processId`, `personId`, `responsiblePersonId` y `stateCode`. Respuesta paginada: items/pageNumber/pageSize/totalCount.

Alta de persona: `{ person: { firstNames, lastNames, phone, email, birthDate }, branchId, document: { documentType, documentNumber, issuingCountry } }`. Documento: `replaceCurrent: true` para sustituir el vigente. Traslado: `{ branchId, reason }`. Asignación: `{ personId, processId, responsiblePersonId, branchId }`. Estado: `{ stateCode }`; responsable: `{ responsiblePersonId }`; actividad: `{ isActive }`. Esquemas completos de DTO en OpenAPI.

HU-003 (2026-11-07): PUT `/people/{id}` conserva PERSON_UPDATE y 200 PersonDto. Entrada personal `{firstNames,lastNames,phone,email,birthDate,expectedUpdatedAt?}`; el campo opcional conserva clientes previos. Angular siempre envía la cadena `updatedAt` exacta obtenida del GET y exige PERSON_VIEW y PERSON_UPDATE en la sede de la persona. Una versión obsoleta produce 409 `concurrent_update`, sin sobrescritura ni reintento automático. EF utiliza fecha_actualizacion como token en WHERE, sin columnas nuevas. La versión avanza al menos un microsegundo. Clientes que omitan versión no tienen protección contra formularios obsoletos. UUID, sede, estado, creación y documentos se conservan; el documento se muestra solo lectura. Heredados sin documento siguen consultables/editables sin regularización automática. Ver `docs/person-editing.md` desde la raíz.

HU-001 (2026-11-07): GET `/people` conserva items/pageNumber/pageSize/totalCount y añade `branches: [{ id, name }]`, todas las sedes del ámbito efectivo PERSON_VIEW (no solo las de la página/filtro). No requiere BRANCH_VIEW. Cada persona añade `branchName`, `hasDocuments`, `createdAt`, `updatedAt`; el detalle devuelve esas mismas propiedades y los documentos existentes. El listado solo incluye documentos vigentes; `hasDocuments` permite distinguir documentos anteriores de ausencia total. `branchId`/`branchName` pueden ser nulos si no hay vinculación vigente. Fechas técnicas ISO-8601 con offset; birthDate conserva YYYY-MM-DD. Las respuestas de Personas llevan Cache-Control no-store. No hay nuevos endpoints ni cambios de tablas. Angular solo muestra persona, documento, sede, estado y detalle en el listado; el resto se consulta en ficha.

HU-002 (2026-11-07): POST `/people` mantiene entrada y 201, completando también branchName/hasDocuments/createdAt/updatedAt en su respuesta. Duplicados visibles y ocultos comparten `409 duplicate_resource` sin información personal/sede. GET `/people/registration-options` requiere PERSON_CREATE y devuelve `{branches:[{id,name}],countries:string[],documentTypes:string[]}`: sedes activas del ámbito de creación y sugerencias editables, sin números de identificación. No requiere PERSON_VIEW ni BRANCH_VIEW. No es un catálogo cerrado ni cambia restricciones SQL. El alta conserva su transacción existente; ninguna cuenta Identity se crea automáticamente. Ver `docs/person-registration.md` desde la raíz del repositorio.

PENDING→IN_PROGRESS/WITHDRAWN; IN_PROGRESS→SUSPENDED/COMPLETED/WITHDRAWN; SUSPENDED→IN_PROGRESS/WITHDRAWN. Finales sin reapertura. Retirar sin iniciar conserva startedAt nulo y requiere la corrección incremental de integridad aplicada. Nunca se crean historiales de procesos o responsables.

HU-013 (2026-11-09): BranchDto incorpora `updatedAt`. POST `/branches` recibe `{code,name,address?,phone?}` y devuelve 201. PUT `/branches/{id}` recibe esos campos y `expectedUpdatedAt`; PUT `/branches/{id}/active` recibe `{isActive,expectedUpdatedAt}` y devuelve 204. En ambos PUT, la versión es obligatoria: 400 si falta y 409 si es obsoleta, sin reintento automático. Se reutiliza fecha_actualizacion, sin columnas nuevas. Código máximo20, nombre150, dirección250 y teléfono30; unicidad únicamente por código. GET `/branches/{id}/administrators` devuelve una página de `{userId,displayName,email,isActive}` y requiere alcance global; la asignación sigue realizándose mediante HU-012. Cualquier concesión conservada, incluso de una cuenta desactivada, bloquea la desactivación. Rutas Angular: `/gestion/sedes`, `/gestion/sedes/crear`, `/gestion/sedes/{id}` y `/gestion/sedes/{id}/editar`. Evidencia aislada y límites en `../../specs/019-branch-administration/validation.md`.

Conflictos de integridad/duplicados: 409; referencias fuera de ámbito: 404 o 403 según operación; dependencia ausente: 503. Los reportes separan asignaciones y personas distintas por estado; sumar personas de varios estados no equivale a un total global de participantes únicos.
