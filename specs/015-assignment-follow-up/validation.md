# Validación — 015 assignment-follow-up

Fecha:2026-11-07. Verificada en entorno aislado; Supabase intacto. Sin imágenes.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | AssignmentQueryTests (3 nuevas), regresión asignación/catálogo/aislamiento | 15 integraciones aprobadas; corrección de traducción EF verificada |
| AC-002 | assignment-follow-up.spec.ts unitario (9) y regresión HU-008 (16); E2E HU-009 (8),HU-008 (8),auth (12) | 25 unitarias y28 E2E controlados aprobados |
| AC-003 | Fixture real focalizada, desktop/mobile; builds/checks | Fixture aprobada con2 recorridos reales; compilaciones/checks correctos |

Evidencia: backend/artifacts/assignment-follow-up/follow-up-final_net10.0_20261107164907.trx contiene15 integraciones correctas yfallo inicial de fixture por espera de navegación; no se repitieron las15 aprobadas. La fixture corregida pasó en follow-up-browser_net10.0_20261107165107.trx (1/1,37s), con dos recorridos reales de escritorio/móvil. Total16 casos .NET distintos aprobados entre ambas ejecuciones; los2 recorridos no se suman como2 integraciones adicionales. Resumen: browser-follow-up-result.txt. Sin omisiones en selección; no se ejecutó suite completa ni PostgresActivationTests.

El test real reutiliza creación HU-008 para preparar datos, luego comprueba solo lectura HU-009: búsqueda por documento, categoría/proceso, URL, responsable/nombres, fechas nulas, detalle, recarga, vuelta con filtros ylogout. Cuenta de sede ASSIGN/VIEW, sin PERSON_VIEW/CATEGORY_VIEW; TLS/cookies/CSRF reales y contexto firmado. Datos/certificados sintéticos; PFX eliminado y clúster detenido al terminar. Sin modificaciones de User Secrets ni Supabase. Se añadió espera explícita de llegada al detalle para no comprobar nombres todavía presentes en la lista anterior.

Comandos focalizados: desde frontend, `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/assignment*.spec.ts'`; con MLP_SKIP_VISUAL_ARTIFACTS=1, `node node_modules/@playwright/test/cli.js test assignment-follow-up.spec.ts assignment.spec.ts auth.spec.ts` (28/28,55s). `dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore` y `npm run build` correctos; Angular inicial492.14kB, sin elevar presupuesto.

Integraciones: usar las variables de prueba loopback ya documentadas en ../014-process-assignment/validation.md, MLP_TEST_PREPROVISIONED=1, MLP_RUN_PEOPLE_BROWSER=1 yMLP_RUN_ASSIGNMENT_FOLLOW_UP_BROWSER=1. Comando: `dotnet test backend/tests/MisionLiderParis.IntegrationTests --configuration Release --no-build --no-restore --filter 'FullyQualifiedName~Assignment|FullyQualifiedName~Catalog|FullyQualifiedName~TwoBranchAccounts|FullyQualifiedName~PeopleBrowserFixtureTests' --logger 'trx;LogFilePrefix=follow-up-final' --results-directory backend/artifacts/assignment-follow-up`. Clúster existente57693 solo para pruebas, arrancado explícitamente y detenido en finally. Sin SQL de migración/activación ni cuenta/credencial real.

Cobertura: VIEW en dos sedes sin PERSON_VIEW/CATEGORY_VIEW, proyección mínima, todos los filtros, paginación estable,403/404/401/400, solo documento vigente, filas históricas con persona oculta por RLS, datos personales nulos sin lookup privilegiado, ausencia de cambios y número de consultas constante para1/3 filas. Regresión de catálogo ahora comprueba datos actuales de la proyección al mover proceso, conservando referencias/fechas de asignación. Cambio de estado/responsable no forma parte de la UI.

Incidencia inicial: EF no traducía ordenar un DTO construido después de DISTINCT; se proyectan primero claves/nombres anónimos y luego el DTO. No se cambió semántica ni SQL. La consulta no implementa historial. El documento puede faltar en registros anteriores; no se sustituye por uno finalizado. Sin afirmar búsqueda insensible a acentos/mayúsculas. Las opciones se derivan de todas las asignaciones visibles, no de una página; no se descargan todas las asignaciones. No se realizó auditoría global ni se generaron imágenes.

Archivos: backend Contracts.cs, AssignmentService.cs, MinistryControllers.cs; pruebas AssignmentQueryTests.cs, ProcessCatalogTests.cs yPeopleBrowserFixtureTests.cs. Angular assignment.models.ts,assignment.store.ts,assignment-page.html,assignment-list-page.ts/html,assignment-list.scss,assignment-follow-up.spec.ts,training-page.html yadmin.routes.ts. E2E assignment-follow-up.spec.ts,assignment.spec.ts,people-registration-real.spec.ts yplaywright.config.ts. SDD015, nota de contrato API yactualización breve de docs/process-assignments.md. Inventario acotado a HU-009 y regresiones afectadas.

Límite: aceptación remota pendiente del despliegue coordinado de seguridad. No nuevo esquema, permisos, endpoints, historial ni fallback de actor. GETs conservan no-store y autorización; RLS firmado permanece intacto.

## Organizacion UX de Seguimiento - 2026-11-22

Panel de filtros responsive, texto tras2s y selects inmediatos con placeholders especificos y X condicional. Sin Limpiar filtros, sin boton Volver a formacion (peticion expresa) ni carga local duplicada. Tabla PrimeNG unificada escritorio/movil con scroll interno, documento antes de participante, proceso/categoria agrupados, estados legibles, ojo/administrar segun permiso y paginador10/20/50 al pie. Estados vacios se muestran dentro de tabla, errores operativos en Toast/reintento. Se conserva URL/pagina y proceso dependiente de categoria. Busqueda backend de participante/documento vigente con translate/upper normaliza tildes y mayusculas antes de contar/paginar, conservando correlacion RLS y autorizacion.

Nuevo AssignmentDetailDialog reutiliza AssignmentStore privado y GET existente: espera respuesta, muestra persona/documento/sede/proceso/categoria/responsable/fechas, sin UUID ni controles de escritura. Cerrar restaura foco y no consulta listado. Ojo usa href con intercepcion normal para modal; modificadores conservan ruta directa. Administrar sigue ruta previa con PROCESS_CHANGE_STATUS o PROCESS_CHANGE_RESPONSIBLE efectivo por sede; no se alteran sus validaciones ni estados. No se agregan escrituras ni endpoints.

Verificacion: 9/9 unitarias Angular de seguimiento correctas. 12 casos distintos de navegador desktop/mobile correctos con HTTP controlado: filtros/pagina/URL, modal/fechas/regreso sin GET extra, vacio/error/reintento,403/404/401, rechazo ASSIGN-only, debounce2s, ausencia de botones/carga retirados, documento primero, espera GET y permisos especificos de administrar. Primera pasada presento dos fallos de consulta modal durante desarrollo; se ajusto enlace del ojo y repeticion focalizada2/2 correcta, mas nuevos4/4. Build API/Angular y design:check/spec:check correctos; advertencia previa del bundle583,76/500kB. Sin imagenes, correos o cambios de datos; no son E2E autenticados con escritura real.

Consulta operativa adicional real mediante IAssignmentService, identidad global autorizada y contexto firmado en transaccion READ ONLY con ROLLBACK: followUpTotal=2 y busqueda de participante en minusculas/mayusculas/sin tildes correcta. Solo metadatos de conteo y booleanos, sin nombres/documentos ni secretos en salida. No se crearon/modificaron asignaciones. API reiniciada con configuracion existente; verificacion de disponibilidad/seguridad registrada por helper local.

### Refinamiento de distribucion por captura - 2026-11-22

Causa del panel estrecho: form.catalog-panel max-width48rem heredado. Se anula especificamente en form.follow-up-filters, sin afectar otros formularios. Panel/tabla alineados; busqueda ocupa media fila de escritorio, sede/estado un cuarto y resto tres columnas. Tablet dos columnas, movil una. Mayor separacion icono/texto, documento en una linea y minimos legibles para participante/proceso/responsable/sede; scroll interno conserva pagina sin desbordar.

Medicion de navegador con respuestas controladas, sin capturas: viewports390/820/1440/1620, ancho filtros=tabla358/771/1120/1300px respectivamente; buscador308/721/527/617px, sin solapamiento de icono ni overflow de pagina. Cuatro recorridos focalizados desktop/mobile correctos (busqueda/filtros/pagina/modal sin recarga). Build Angular/design:check/spec:check correctos, advertencia previa de bundle583,76/500kB. Sin cambios de backend, Supabase, permisos o datos.

## Opciones completas y dependencia categoria/proceso - 2026-11-22

Causa: FilterOptionsAsync construia categorias/procesos/responsables exclusivamente desde asignaciones visibles. Ahora devuelve todo el catalogo activo y personas activas con membresia vigente/sede activa dentro de PROCESS_VIEW autorizado, con id/nombre y RLS existentes. Ninguna exclusion por recibir otro proceso. Sigue prohibido ser participante y responsable de una misma asignacion; no se modifica asignacion, seguimiento historico ni autorizacion de escritura.

Frontend exige categoria para ofrecer procesos, limpia proceso al cambiarla y descarta processId residual sin categoria en URL. Pruebas: 10/10 unitarias Angular y 4/4 recorridos focalizados desktop/mobile correctos con HTTP controlado; categoria sin asignaciones presente, procesos de otras categorias ausentes, cambio limpia seleccion y Responsable ofrece persona que es participante. Integracion .NET focalizada compilada/adaptada para catalogo global y aislamiento de personas; 1 omitida al no disponer de MLP_TEST_DATABASE aislada. No se presenta como aprobada.

Consulta real mediante servicio en READ ONLY con contexto firmado y ROLLBACK:2 asignaciones,5 categorias activas/18 procesos activos en opciones,3 personas activas en Responsable,1 participante presente tambien en esas opciones. Verificacion de conjunto completo de personas activas globales correcta. Sin nombres/documentos/secretos en salida. Build API/Angular correctos; advertencia previa de bundle583,76/500kB. Sin cambios en Supabase, roles, RLS, HMAC ni datos.

### Restablecimiento conjunto de filtros - 2026-11-22
Se restaura Limpiar filtros por instruccion expresa del usuario, alineado a la derecha al pie del panel. Reutiliza reset(), limpia controles inmediatamente sin emitir eventos por campo y navega a pagina1 sin filtros, preservando pageSize; categoria/proceso quedan vacios y se conserva dependencia. Prueba focalizada de navegador desktop/mobile con HTTP controlado verifica vaciado incluso con texto pendiente de debounce; sin escrituras reales.

Ubicacion final por captura del usuario: Limpiar filtros se mueve fuera del formulario, a la derecha del encabezado, antes del panel; contenedor flex responsive con salto de linea en pantallas estrechas. Conserva reset inmediato de controles/pagina1/tamaño elegido y verificaciones anteriores del comportamiento.

## FR-006 — Una fila por participante y procesos en modal (2026-11-22)

Implementado GET `/api/v1/process-assignments/participants`: autorización PROCESS_VIEW y RLS firmada existentes, filtros compartidos con el listado previo, todos los criterios sobre una misma asignación antes de DISTINCT/persona y paginación. Proyección correlacionada conserva registros históricos aunque RLS oculte datos personales; sedes coincidentes autorizadas se obtienen en una consulta adicional por página, sin N+1. No se modificaron reglas de escritura, políticas, tablas ni permisos.

Tabla principal: Documento, Participante, Sede, Acciones. Ojo abre procesos autorizados de la persona en modal de consulta; lápiz abre el mismo espacio con edición puntual. Tarjetas muestran categoría, proceso, responsable, sede, estado y fechas; paginación propia cuando corresponde. Edición vuelve a consultar la asignación, usa transiciones del servidor y comandos existentes, confirmación explícita y control de responsable esperado. Guardar solo se habilita con selección válida; cancelar no escribe. Las escrituras confirmadas actualizan los datos; cerrar consulta no recarga el listado y restaura foco. Se mantiene búsqueda de 2 segundos, filtros dependientes y Limpiar filtros junto al encabezado.

Evidencia ejecutada:

- Build API Debug/Release correcto, sin errores/advertencias. 9/9 unitarias .NET de asignaciones correctas.
- 51/51 unitarias Angular focalizadas: seguimiento, Store, estados y responsable.
- 16/16 pruebas en Chrome real, escritorio y móvil, con HTTP controlado: tabla de cuatro columnas y participante único, dos procesos dentro de modal, filtros/paginación/URL, espera de consulta, cierre sin GET extra, permisos específicos, estados vacíos, 401/403/404, confirmación cancelada sin PUT y confirmada con exactamente un PUT controlado, Toast, sin errores pageerror en el flujo editado ni desborde del documento. Sin imágenes.
- Consulta real con IAssignmentService y contexto firmado en transacción READ ONLY/ROLLBACK: 2 asignaciones, 1 participante único; conteo DISTINCT correcto, páginas sin duplicados y detalle de persona/sedes coherente. Catálogos activos consultados entonces: 4 categorías, 17 procesos y 3 responsables activos. Solo conteos/booleanos en salida, sin secretos ni datos personales. Ninguna escritura remota.
- Integración .NET focalizada compilada y ampliada con agrupación, filtros simultáneos, páginas, 403 y persona oculta por RLS: 1 omitida porque no hay MLP_TEST_DATABASE aislada. No se presenta como aprobada. La comprobación real de solo lectura global no sustituye casos aislados de acceso por sede ni escritura real.
- Build Angular correcto; persiste advertencia previa de bundle inicial 583,76/500 kB. design:check y spec:check correctos. API y Angular actualizados en HTTPS local; helper seguro confirmó ready200, Identity/contexto firmado/RLS, sin escrituras ni envío de correo.

Refinamiento posterior solicitado: eliminados botones de reintento en listado y editor de Seguimiento. El error queda en Toast y se recupera mediante nueva consulta iniciada por el usuario, sin repetición automática. Prueba focalizada adicional en escritorio/móvil comprueba ausencia de Reintentar, ausencia de reintento automático, recuperación tras cambiar el filtro y edición con confirmación. No se ejecutaron cambios de progreso reales.

### Scroll bajo los datos del participante

El cuerpo del Dialog usa composición flex con overflow oculto mediante contentStyle público de PrimeNG. El bloque del participante no se contrae; únicamente process-list tiene desplazamiento vertical. Título, nombre/documento, paginación y Cerrar permanecen fuera de esa región. Altura máxima ajustada al viewport dinámico, sin selectores internos de PrimeNG. Región enfocable y desplazamiento por teclado.

Chrome escritorio y móvil: 2/2 pruebas focalizadas correctas con diez procesos controlados. Verificado overflow real, desplazamiento con End hasta el último proceso, posición fija de participante/Cerrar y ambos dentro del viewport. Sin escrituras remotas ni imágenes.

### Orden de categorías y procesos en el modal

La consulta del participante envía orderByCategory=true. El backend ordena antes de Skip/Take por orden de categoría, nombre/id para empates, orden de proceso y nombre/id; las asignaciones repetidas se desempatan por fecha/id. Usa SortOrder configurado, sin nombres ni prioridades fijas en Angular y sin ocultar historial. Los demás consumidores conservan la ordenación previa si no solicitan esta opción.

12/12 pruebas Angular focalizadas correctas, incluida la opción enviada en consultas paginadas de persona. Build API Release/Angular y checks de diseño/SDD correctos; advertencia previa de bundle sin cambio. Diagnóstico real de solo lectura, contexto firmado y rollback: 4 asignaciones visibles para 1 participante; orden completo y páginas de tamaño1 coinciden con el orden de categorías/procesos configurado. categoryProcessOrderAndPaginationPassed=true, databaseWritten=false. Sin cambios de datos, categorías, RLS o permisos.

### Editor de progreso: operación clara y vista previa

Separado resumen del proceso (categoría, nombre, sede, estado y responsable actuales) de la operación Actualizar estado/Cambiar responsable, con aria-pressed. Selects etiquetados, ayuda asociada y vista previa aria-live del valor actual al nuevo. Acción específica Guardar estado/Guardar responsable, deshabilitada sin elección válida o durante consulta; pie fuera del contenido desplazable, acciones junto a Volver y apiladas en móvil. Selecciones independientes conservadas al alternar operación; salir con borrador sigue exigiendo confirmación.

Responsables se consultan solo al abrir esa operación; alternar no repite GET ni borra borradores. La escritura reutiliza el comando existente con expectedResponsiblePersonId; no se modificaron permisos ni transiciones. Se mantiene confirmación explícita y aviso de irreversibilidad al seleccionar un estado final.

Selector de nuevo responsable unificado con Asignar: buscador dentro del desplegable con foco inmediato, lupa, nombre/apellidos/documento, máximo150 caracteres, X solo con texto y resultados con documento/sede. Búsqueda remota tras2s y selección/borradores preservados al cerrar/reabrir; sin filtrar solo la primera página local. Chrome escritorio/móvil:2/2 pruebas focalizadas correctas, incluyendo foco automático, búsquedas y limpieza con GET, selección y guardado con precondición mediante HTTP controlado. Build Angular correcto, sin escrituras remotas.

Corrección final del resaltado solicitada por el usuario: retiradas las reglas propias de fondo/texto. Se conserva el verde original del tema mediante p-button, variante outlined únicamente en la opción inactiva y aria-pressed mediante Pass Through público. Sustituye el ajuste anterior de CSS manual. Verificado con estilos computados al alternar en ambas direcciones:2/2 recorridos desktop/móvil correctos, con API controlada. Build, diseño y SDD correctos; sin cambios de datos reales.

Resumen compacto del editor: estado actual junto al título del proceso en la cabecera; sede y responsable en dos columnas debajo de un separador, apiladas en móvil. Se retira la celda vacía generada por responsable a ancho completo. Botones y colores originales conservados. Build Angular/checks correctos y2/2 recorridos de edición desktop/móvil aprobados con HTTP controlado, sin cambios remotos.

Chrome escritorio/móvil: 6/6 pruebas focalizadas correctas con HTTP controlado: scroll bajo participante, guardar estado con cancelación sin PUT y confirmación con un PUT, preview, carga de responsables bajo demanda (0 GET antes, 1 tras abrir), conservación de ambas selecciones, confirmación de descarte cancelada sin escritura y guardado de responsable con precondición exacta. Guardar visible en viewport móvil. Build Angular y design:check/spec:check correctos, con advertencia previa de bundle inicial. Sin imágenes ni escrituras en Supabase; no equivale a aceptación de cambios reales de progreso.
## Rendimiento 2026-11-23 — FR-007/AC-007

26 unitarias focalizadas de assignment.store y assignment-follow-up correctas. Nueva prueba controla reloj y comprueba includeFilters inicial=true, paginación=false sin perder opciones, caducidad=true, force=true y cambio de sesión=true. Evidencia de servicio remoto: omitir metadatos reduce 21 a16 comandos y mediana con pool de2551,1 a1987,2ms. No equivale a HTTP autenticado ni a P95. La captura del navegador con una sesión válida queda pendiente; ninguna escritura real ejecutada.

20 E2E controlados correctos (10 escritorio y10 móvil), sin capturas, vídeo ni trazas. Verifican filtros, paginación, detalle, edición, permisos y recuperación; las respuestas interceptadas no acreditan acceso autenticado remoto ni sus tiempos. Durante los casos que abandonan la ruta interceptada, el servidor automático de Playwright mostró errores de confianza del proxy local. Se relanza Angular con Start-Frontend.ps1/NODE_EXTRA_CA_CERTS después de las pruebas; no se desactiva secure del proxy.

Actualización: el usuario confirmó la consulta real después del relanzamiento confiable. HTTP API de Seguimiento2504,542ms/22comandos sin nuevas aperturas y4425,070ms/22comandos con2041,119ms en dos aperturas físicas. Personas/sedes respondieron200. No hay baseline HTTP equivalente anterior ni muestras suficientes paraP95. La comparación con/sin metadatos sigue siendo de servicio; no atribuir un porcentaje de mejora HTTP sin medirlo.

