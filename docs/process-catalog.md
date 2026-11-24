# HU-007 — Catálogo de procesos ministeriales

Implementación: 2026-11-07. Trazabilidad y evidencia en `specs/013-process-catalog/`.

## Modelo y contratos comprobados

Fuentes: captura real previamente inspeccionada `backend/docs/reference/live-ministry-schema.json`, entidades, MinistryDbContext, ProcessCatalogService y MinistryControllers. No se volvió a inspeccionar Supabase.

| Entidad | Columnas existentes | Campos editables |
| --- | --- | --- |
| iglesia.categoria_proceso | id, nombre, descripcion, orden, activa, fecha_creacion, fecha_actualizacion | name, description, sortOrder |
| iglesia.proceso | id, categoria_id, nombre, descripcion, orden, activo, fecha_creacion, fecha_actualizacion | categoryId, name, description, sortOrder |

UUID, fechas y estado son de solo lectura en formularios. El estado usa su operación independiente. No hay sede, código, duración, objetivos ni sesiones en estas entidades. Descripción es text en PostgreSQL; el contrato HTTP la limita a 4000 caracteres, nombre a150 y orden entero0..2147483647.

| Método/ruta relativa a /api/v1 | Permiso y alcance | Respuesta |
| --- | --- | --- |
| GET /process-categories y /process-categories/{id} | CATEGORY_VIEW | 200, Page/CategoryDto |
| POST /process-categories | CATEGORY_CREATE global | 201 |
| PUT /process-categories/{id} y /{id}/active | CATEGORY_UPDATE global | 200 y204 |
| GET /processes y /processes/{id} | PROCESS_VIEW | 200, Page/ProcessDto |
| GET /process-categories/{id}/processes | PROCESS_VIEW | 200, página filtrada por categoría |
| POST /processes | PROCESS_CREATE global | 201 |
| PUT /processes/{id} y /{id}/active | PROCESS_UPDATE global | 200 y204 |

No hay nuevos endpoints. DTO de categorías/procesos añaden createdAt/updatedAt reales, sin romper campos anteriores. ProcessDto añade categoryName/categoryIsActive para mostrar su contexto sin exigir otra consulta CATEGORY_VIEW a quien solo puede ver procesos. Las respuestas de escritura proyectan datos persistidos, evitando timestamps de precisión previa a PostgreSQL y navegación Category no cargada.

El listado conserva page, pageSize, search e isActive; procesos acepta categoryId. La búsqueda conserva su comparación existente sensible a mayúsculas. UNIQUE literal: uq_categoria_proceso_nombre(nombre) y uq_proceso_categoria_nombre(categoria_id,nombre). Se permite igual nombre de proceso en categorías distintas. No se cambia esa semántica ni se inventa unicidad sin acentos/mayúsculas.

## Autorización e integridad

Ambas tablas son catálogos globales compartidos. Una concesión de lectura válida de sede permite consultar el catálogo global correspondiente; no concede escritura global. Administrar requiere el alcance global existente de la API y la UI comprueba el permiso efectivo global, sin inferir capacidades por el nombre del rol.

CATEGORY_VIEW y PROCESS_VIEW son independientes. El menú y contenedor Formación aceptan cualquiera; cada detalle requiere su permiso específico. Formularios requieren CREATE/UPDATE global mediante guard y componente. El backend valida independientemente todos los comandos; ni un código de escritura en una sede ni manipular URL amplían privilegios. No se agrega PROCESS_ASSIGN ni nuevas concesiones; la gestión del catálogo no asigna personas.

Crear/editar proceso exige categoría activa/existente. El backend permite cambiar de categoría incluso con asignaciones existentes: conserva proceso.id y las asignaciones siguen vinculadas a ese UUID. Se respeta esa regla, sin inventar restricciones.

Desactivar categoría/proceso está permitido aun con asignaciones abiertas: no las elimina ni cambia sus estados. Desactivar categoría conserva los flags individuales de sus procesos. Un proceso activo dentro de una categoría inactiva se muestra con esa advertencia, pero isActive=true de disponibilidad y AssignmentService lo excluyen/rechazan para nuevas asignaciones. Reactivar un proceso requiere categoría activa. No existe eliminación física ni historial en esta HU.

Respuestas conservadas: 400 inválido,401 sin sesión,403 sin permiso/globalidad,404 recurso/categoría no disponible y409 duplicado/conflicto. Interceptores existentes mantienen 401→acceso y403→sin-acceso. El formulario conserva borrador ante errores y no presenta éxito antes de confirmación.

## Interfaz y estado

Rutas `/gestion/formacion`, `/categorias/crear`, `/categorias/:id`, `/categorias/:id/editar` y sus equivalentes `/procesos/...` bajo Formación. Tarjetas de categorías y tabla compacta de procesos (nombre,categoría,estado,acciones). Descripción/orden/UUID/fechas se consultan en detalle. No se muestran conteos inventados: el endpoint actual no ofrece agregado de procesos por categoría; una página parcial no se trata como total.

Categorías y procesos tienen búsquedas, filtros y paginación independientes persistidos en URL. Seleccionar categoría restablece solo la página de procesos. Recarga y vuelta desde detalle/formulario conservan filtros. Opciones del formulario de proceso recuperan todas las páginas de categorías activas mediante el contrato existente, sin truncar a100. Cambios concurrentes del catálogo pueden afectar esa lista; el backend revalida al guardar.

Signals, OnPush, Reactive Forms y PrimeNG Button/InputText/Textarea/Select/Table/Paginator/Message/ConfirmDialog; tokens y SCSS compartidos. No se instalan dependencias ni se construye otro kit visual. Confirmación para desactivar y descartar borrador. Envíos únicos, invalidación/cancelación de consultas antiguas y limpieza por cambio de sesión/identidad en CatalogStore. No hay HTTP en presentación, datos simulados, localStorage ni secretos nuevos del producto.

## Archivos creados/modificados

- `backend/src/MisionLiderParis.Application/Ministry/Contracts.cs`: DTO aditivos.
- `backend/src/MisionLiderParis.Infrastructure/Ministry/ProcessCatalogService.cs`: proyecciones de campos reales/persistidos; CRUD y reglas conservados.
- `backend/tests/MisionLiderParis.IntegrationTests/ProcessCatalogTests.cs`: cinco escenarios HTTP/PostgreSQL nuevos.
- `backend/tests/MisionLiderParis.IntegrationTests/PeopleBrowserFixtureTests.cs`: cuenta global efímera aislada de catálogo, sin bootstrap, y resumen real.
- `frontend/src/app/features/training/catalog.models.ts`, `catalog.store.ts/spec.ts`, `catalog-actions.ts`, `catalog-form-page.ts/html/spec.ts`, `catalog-detail-page.ts/html`, `catalog.scss`, `training-page.ts/html`.
- `frontend/src/app/features/administration/admin.routes.ts` y `overview-page.ts`; `core/auth/access-context.ts`, `access-guards.ts/spec.ts`, `access-context.spec.ts`; `core/navigation/admin-navigation.ts` y `layout/admin-layout/admin-layout.ts`.
- `frontend/e2e/catalog.spec.ts` y `people-registration-real.spec.ts`.
- Este documento, `docs/administration.md`, `backend/docs/angular-api-contract.md` y `specs/013-process-catalog/`.

## Límites

El contrato de edición no tiene versión esperada. Se conservan bloqueos de filas y guardia de categoría durante movimientos; no se promete detectar formularios obsoletos ni se añaden columnas/migraciones. La unicidad depende de los índices existentes, comprobada también con creación concurrente.

No se desarrolla asignación individual: la disponibilidad de inactivos se verifica con pruebas HTTP/SQL aisladas de AssignmentService. La aceptación Supabase requiere el despliegue coordinado de seguridad pendiente; esta HU no ejecuta SQL remoto, migraciones, bootstrap,090 ni cambia contexto firmado. No se afirma aceptación remota o ejecución en CI. Resultados y comandos exactos en `specs/013-process-catalog/validation.md`.
