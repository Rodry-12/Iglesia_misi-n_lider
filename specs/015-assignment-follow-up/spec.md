# 015 — assignment-follow-up

Estado: Verificada en entorno aislado. HU-009 del usuario,2026-11-07. Solo lectura; aceptación remota pendiente.

## Problema y resultado esperado

Consultar asignaciones con persona/documento vigente, proceso/categoría, responsable actual, sede, estado y fechas; búsqueda/filtros/páginas en URL y detalle recargable.

## Alcance y exclusiones

Reutilizar AssignmentService/Store y detalle HU-008. Sin nuevos endpoints, escrituras funcionales, historial, cambios de estado/responsable, migraciones, bootstrap,090, imágenes ni modificaciones de Supabase.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: PROCESS_VIEW efectivo por sede, sin PERSON_VIEW/CATEGORY_VIEW;403 en sede explícita ajena y404 en recurso invisible. Conservar RLS firmado.
- FR-002: Ampliación aditiva de proyección y filtros; búsqueda/documento vigente y categoría, paginación de servidor, metadatos mínimos autorizados opcionales en el listado. Sin N+1 ni cargar todas las asignaciones en cliente.
- FR-003: Tabla escritorio y tarjetas móvil, filtros/URL, detalle existente enriquecido, fechas nulas explícitas, estados carga/vacío/error/reintento y limpieza de sesión/respuestas obsoletas.

## Aceptación

- AC-001: Consultas, proyección, filtros, paginación, solo lectura, autorización y datos ocultos pasan integración aislada; cantidad de consultas constante por página (CA-001–006,009–012,017–018).
- AC-002: UI mantiene URL/página, detalle, responsive, errores401/403/404 y limpieza de sesión sin escrituras (CA-007–009,013–018).
- AC-003: Recorridos reales escritorio/móvil vía API HTTPS/PostgreSQL aislado, builds y regresiones focalizadas pasan sin imágenes ni acceso remoto.

## Escenarios y dudas

Nombres/documentos son actuales y solo si RLS permite verlos: no usar lookups privilegiados para relaciones ocultas ni sustituir documentos anteriores. Asignación permanece visible con datos personales nulos cuando corresponde. Catálogo inactivo no oculta asignaciones previas. PROCESS_ASSIGN no concede lectura. Pruebas expresamente autorizadas por la HU.

- FR-004 (2026-11-22): reorganizar Seguimiento conforme al patron vigente: panel de filtros, busqueda tras2s, X condicional, estado/sede/categoria/proceso/responsable inmediatos, sin Limpiar ni carga local duplicada. Tabla unificada con scroll escritorio/movil, documento antes de persona, estados legibles, iconos Ver/Administrar segun permisos y paginacion10/20/50 al pie. Ojo abre modal solo lectura tras GET; cerrar no refresca listado, restaura foco. Mantener ruta de administracion para operaciones autorizadas, sin nuevas escrituras ni reglas.

- FR-005 (2026-11-22, sustituye opciones derivadas solo de asignaciones visibles): Categorias contiene todo el catalogo activo global; Procesos contiene procesos activos de categorias activas y el frontend solo ofrece los de la categoria seleccionada. Sin categoria el selector queda vacio/no editable y no envia proceso residual; al cambiar categoria limpia proceso/pagina. Responsable contiene personas activas con membresia vigente en sedes activas autorizadas por PROCESS_VIEW, aunque no tengan asignaciones o participen como alumnos en otras. Metadatos minimos id/nombre, RLS sin cambios y sin conceder PERSON_VIEW. Los listados historicos no se ocultan por esta modificacion de opciones.

Ajuste vigente del usuario 2026-11-22: Seguimiento SI incluye Limpiar filtros por tener varios controles. Boton al pie derecho del panel; limpia texto/selects y vuelve a pagina1 conservando tamaño de pagina. Sustituye la exclusion de ese boton en FR-004.


### FR-006 — Seguimiento por participante (2026-11-22)

Una fila por persona: Documento, Participante, Sede y Acciones. La API filtra asignaciones antes de agrupar/paginar personas únicas; criterios simultáneos deben coincidir en la misma asignación. Las sedes mostradas corresponden a las asignaciones coincidentes autorizadas. Ver procesos consulta todas las asignaciones autorizadas de esa persona en un modal, con paginación independiente y sin recargar al cerrar. Editar progreso selecciona un proceso y reutiliza cambios de estado/responsable, permisos efectivos, transiciones del servidor y confirmación. No modificar registros reales para validar UX.

Refinamiento solicitado: no mostrar botones «Reintentar consulta», «Reintentar estados» ni «Reintentar responsables» en Seguimiento. Errores mediante Toast global; una nueva acción de consulta del usuario permite recuperar datos. Sin reintentos automáticos.

El scroll del modal comienza debajo del nombre/documento del participante y se limita a los procesos. Título, datos del participante, paginación y Cerrar permanecen visibles fuera de la región desplazable, también en móvil.

Los procesos del participante se ordenan en servidor por SortOrder ascendente de categoría y después por SortOrder de proceso, antes de paginar. Empates se resuelven por nombre e identificador de catálogo y fecha/id de asignación. Se usa el orden configurado, sin fijar nombres en el código y sin ocultar asignaciones históricas.

El editor distingue resumen de proceso y operación. Muestra estado/responsable actuales, cambio elegido y vista previa; acciones específicas Guardar estado/Guardar responsable junto a Volver, siempre fuera del scroll. Cambiar operación conserva borradores sin escribir. Responsables se consultan bajo demanda y Guardar queda bloqueado durante la búsqueda. Se reutilizan confirmación, transiciones y precondición del responsable existentes; una operación por guardado.

FR-007 (2026-11-23): reutilizar únicamente opciones de filtros dentro del store de la sesión por 60 segundos. Las filas siempre conservan consulta/autorización habitual. Primera carga, caducidad, actualización forzada tras cambios y cambio de sesión renuevan/eliminan metadatos. Una respuesta sin filtros no borra los ya cargados. No hay caché compartida ni de permisos backend. AC-007: verificar includeFilters en primera carga, paginación, caducidad, actualización y cambio de identidad, conservando las opciones visibles.
