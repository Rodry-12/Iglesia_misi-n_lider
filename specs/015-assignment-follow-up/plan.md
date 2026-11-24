# Plan — 015 assignment-follow-up

## Diseño

Ruta /gestion/formacion/asignaciones bajo PROCESS_VIEW; reutilizar AssignmentStore y detalle /asignaciones/:id. GET listado/detalle existentes, sin nuevos endpoints. AssignmentDto añade nombres, documento vigente, categoría/descripción y nombre de estado. AssignmentQuery añade Search/CategoryId/IncludeFilters; AssignmentPage conserva cuatro campos previos y añade Filters opcional.

Proyección SQL con subconsultas correlacionadas para personas/documentos, evitando que un INNER JOIN elimine asignaciones históricas cuya persona ya no es visible. Metadatos por ámbito de PROCESS_VIEW, no por permisos independientes ni solo primera página. No modificar RLS ni conexiones.

PrimeNG Table/Select/InputText/Paginator/Message/Button, PageHeading, catalog.scss y tokens; Signals/OnPush, control flow moderno, Reactive Forms. Tabla completa escritorio y tarjetas con información restante en móvil, etiquetas accesibles, regiones de estado, enlaces reales. Sin imágenes, mockups, dependencias ni tokens nuevos. Carga/vacío/error/reintento, pérdida de sesión y navegación URL; UUID solo en detalle técnico plegable.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Unitarias específicas de assignment*.spec.ts; integración nueva AssignmentQueryTests y regresiones de catálogo/aislamiento/asignación. E2E controlados HU-009/HU-008/autenticación; dos recorridos reales con fixture existente y MLP_RUN_ASSIGNMENT_FOLLOW_UP_BROWSER=1 para omitir historias ajenas. Compilación Angular/.NET y checks. Sin suite completa durante cada cambio.

La HU autoriza explícitamente pruebas. MLP_SKIP_VISUAL_ARTIFACTS=1 desactiva imágenes/trazas en regresión controlada; el recorrido real ya las deshabilita.

## Riesgos y decisiones

Sin documento vigente visible se presenta ausencia, sin inventarlo. Fechas de inicio nulas no se sustituyen por asignación. Filtros de catálogo/responsable incluyen únicamente valores de asignaciones visibles, también inactivos; sedes son las autorizadas. Opciones no son snapshot y páginas/conteos pueden variar por concurrencia. Volumen futuro de opciones puede requerir paginación. Sin aceptación remota.

FR-004: PrimeNG Table/Select/Button/Dialog, Lucide Search/X/Eye/Pencil, TablePagination y tokens existentes. Filtros responsive3columnas/1movil; buscador y placeholders concretos, clear por control sin boton global. Detalle de consulta con AssignmentStore privado, espera GET, output closed, foco restaurado desde listado; gestion de estado/responsable queda en ruta existente con permisos efectivos por sede. Sin documentos tecnicos/UUID en modal. Backend normaliza busqueda persona/documento con translate/upper existente, conservando correlacion RLS. Verificar navegacion, debounce, filtros, estados vacios/error y permisos con HTTP controlado sin POST remoto.

Ajuste visual FR-004 por captura del usuario: anular solo en form.follow-up-filters el max-width48rem heredado de catalog.scss. Panel alineado con resultados a100%; escritorio12columnas con busqueda6/sede3/estado3 y categoria/proceso/responsable4 cada uno; tablet2columnas y movil1. Separar texto del icono del buscador y reservar anchuras de columnas/documento sin salto, manteniendo scroll interno.

FR-005: FilterOptionsAsync consulta Categories/Processes activos en vez de derivarlos de visible; catalogo global ya existente sin asignaciones no se vincula a una sede. Personas desde Memberships con EndedAt null, Person/Branch activos, proyeccion id/nombre distinta y BranchIds(PROCESS_VIEW) para no globales; no se excluyen participantes. Mantener filtros de filas/correlacion RLS/permisos. Frontend options.processId exige categoryId y coincidencia, readonly/placeholder sin categoria y limpia processId de URL incoherente. Sin endpoint/schema/politica nuevos ni escrituras.


### Ajuste por participante 2026-11-22
Endpoint aditivo GET process-assignments/participants con proyección RLS, filtro compartido y paginación por persona. Table con cuatro columnas, scroll y paginador 10/20/50; Dialog muestra tarjetas de procesos con estado, responsable y fechas. Edición puntual con Select, Reactive Forms, ConfirmDialog y Toast global; acciones al pie junto a Volver, estados finales bloqueados. Tokens existentes, responsive sin desborde del documento, nombres accesibles y foco restaurado. El modal usa Store independiente y no invalida el listado al consultar/cerrar; una escritura confirmada sí refresca los datos.

Refinamiento del editor: composición flex con zona de contenido desplazable y pie fijo, resumen en dl, selector de operación con aria-pressed, Select con ayuda asociada y vista previa aria-live. Borradores independientes conservados al alternar; directorio de responsables cargado solo en esa opción, sin reintentos automáticos. Tokens existentes, acciones apiladas en móvil, sin cambios de reglas de servidor.
# Optimización medida 2026-11-23

FR-007/AC-007: AssignmentStore conserva opciones 60 segundos y omite reconstruirlas al paginar/filtrar en ese intervalo. Invalida en clear/cambio de sesión y actualiza al forzar tras escritura. Sin cambios visuales, PrimeNG/tokens según docs/design-system.md; conserva estados, accesibilidad y responsive. Evidencia del coste: cinco comandos adicionales y mediana 2551,1 frente a 1987,2 ms con pool Identity en servicios reales; no afirmar latencia HTTP. Ver backend/docs/performance-and-local-development.md.

