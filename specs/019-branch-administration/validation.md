# Validación — 019 branch-administration

## Avisos globales — 2026-11-21

Los mensajes de error de Sedes y sus diálogos usan ToastFeedback/Notifications, sin banners ni duplicados con el store. Los ocho recorridos branch-dialogs.spec.ts pasaron en desktop y móvil (16 comprobaciones) dentro de la regresión transversal; unitarias Angular de Sedes también aprobadas. Sin escritura real. Evidencia agregada y límites en specs/018-user-invitations/validation.md, sección Toast transversal.

## Cierre de filtros automáticos — 2026-11-21 (AC-007)

- Texto busca tras300ms de pausa; Estado aplica inmediatamente, ambos en página1.
  Sin botón Buscar; Enter disponible. URL sincronizada sin realimentar eventos de
  formulario; navegación/destrucción cancelan timers. Store cancela lecturas previas.
- Select recibe nombre accesible desde label Estado mediante ariaLabelledBy. El
  fallo anterior agotaba45s esperando combobox Estado: una instancia antigua servía
  la plantilla previa. Diagnóstico interceptado confirmó labelledBy:null; tras
  reiniciar Angular entrega branch-active-label y texto Estado.
- 6/6 recorridos Chrome aprobados en escritorio/móvil con API interceptada:
  escritura rápida genera una consulta, estado agrega una, borrar texto otra;
  página1, filtros en URL, recarga, paginación, carga/error/reintento/vacío y una
  sola sesión al navegar. Sin escritura ni acceso a datos reales en esos recorridos.
- Build aprobado501,86kB, advertencia inicial existente500kB; no se subió presupuesto.
  Cambios no requieren migraciones ni modificaciones remotas.
- spec:check,design:check y formato focalizado aprobados. Angular actualizado activo
  en4200. La API estaba detenida: lanzador local detectó fallo al persistir ACL de la
  carpeta privada de logs. Helper local conserva reglas usuario/SYSTEM mediante
  Directory/File.SetAccessControl y valida ACL después; no escribe owner/auditoría.
  API reiniciada en7243 y verificador real readonly devuelve ready200,Identity,
  HMAC,RLS en11 tablas,TLS y ausencia de escrituras;ningún correo enviado.

## Búsqueda de sedes sin tildes — 2026-11-11 (AC-006)

- Solicitud posterior autoriza corrección funcional limitada a búsqueda de sedes;
  el rediseño visual previo no se amplía a otros módulos. No cambia Angular/store.
- BranchSearchTests:2/2 fallaron antes (paris no encontraba París;pena unica no
  encontraba Peña Ünica). Evidencia en backend/artifacts/branch-search-before/*.trx.
- Se mapea translate(text,text,text) nativa como DbFunction built-in; no crea función
  SQL ni requiere unaccent/GRANT/extensión/DDL. BranchService aplica el mismo mapeo
  de vocales acentuadas,diéresis,ñ,ç y marcas combinadas0300–036F al término y los
  campos nombre/código, seguido de upper y Contains literal. Filtro antes de
  count/skip/take en PostgreSQL; texto almacenado,orden y control de acceso intactos.
- 6/6 integraciones aprobadas en loopback57693/mlp_user_validation_tests,modo
  preaprovisionado,identidades runtime/Identity/operador separadas. Sin migraciones.
  Incluyen2 nuevas de búsqueda y4 regresiones de CRUD,denegación a usuarios no
  globales,lecturas agrupadas y administradores. Evidencia:branch-search-after/*.trx.
- Verifica paris/PARÍS/Unicode descompuesto,mayúsculas,trim,conteo2 con pageSize1,
  nombre guardado sin cambios,código acentuado,ñ/n,ü/u,estado,ámbito y %/_ literales.
- Clúster aislado detenido; API Release compilada con0 errores/advertencias. No se
  modifican Supabase,roles,datos,índices,políticas ni claves. Reinicio local de API
  mediante lanzador seguro existente completado:ready200,Identity accesible,firma
  aceptada,RLS en11 tablas,TLS válido,sin actor no expone personas. Sin escrituras.
- No se afirma una optimización de índices: búsqueda parcial normalizada requiere
  medir planes/volumen antes de proponer índices; no añade peticiones de red.

## Rediseño exclusivamente visual del listado — 2026-11-11 (AC-005)

Ajuste posterior del paginador: flechas Lucide anterior/siguiente en controles44px,
número actual resaltado con primary/on-primary y nombre «Página» para lectores de
pantalla. Conserva eventos, disabled y conteo. Cuatro recorridos focalizados de
presentación y búsqueda/paginación aprobados en escritorio/móvil, con API interceptada.

- Fuente: documento «Rediseño UX/UI — Administración de Sedes» y referencia adjunta.
  Se reutiliza SitesPage, sin modificar BranchesStore ni lógica/handlers/guards/API.
- HTML del bloque list: «Nueva sede» con icono y ruta crear, solo global; filtros
  compactos con labels/placeholder y Buscar explícito; cuatro columnas conservadas,
  estados Activa/Inactiva con texto/punto, acciones iconográficas con aria-label/title,
  conteo de registros y anterior/página/siguiente con disabled existentes.
- sites-list.scss delimitado al listado, añadido a styleUrls junto al catalog.scss
  original intacto. No cambia navbar/sidebar ni vistas create/edit/detail. Tokens
  semánticos claros/oscuros, superficies, bordes y sombras compartidas. Detectado
  enlace primario con texto del mismo color que fondo por estilo global; corregido
  solo en branch-create con color-on-primary. Sin cambios globales.
- Reutilizados Table, Select, InputText, Button y Message PrimeNG; cuatro iconos
  Lucide individuales. Sin bibliotecas nuevas, tooltip adicional ni HTTP de UI.
- Responsive: filtros apilados móvil, cuadrícula escritorio; acción principal de
  ancho disponible móvil. Tabla dentro de región enfocable con overflow local y
  ayuda móvil. Capturas revisadas1440px/390px claro y oscuro,820px tablet.
- `MLP_SKIP_VISUAL_ARTIFACTS=1; node node_modules/@playwright/test/cli.js test
  e2e/branches-list-visual.spec.ts e2e/management-layout.spec.ts --grep
  'sedes:|búsqueda y paginación'`:11 aprobados,1 duplicado tablet omitido.
  Pruebas interceptan toda /api/v1 y rechazan métodos distintos de GET. Comprueban
  roles SUPER_ADMIN/BRANCH_ADMIN/OPERATOR, rutas, objetivos44px, colores cambiantes,
  carga/error/reintento/vacío, búsqueda explícita, paginación y session no repetida.
- Capturas de datos sintéticos en frontend/test-results/branches-list-*.png, sin
  datos reales. Selector del enlace en branches-real.spec.ts actualizado a Nueva
  sede; no ejecutado ese recorrido porque incluye escrituras.
- Build producción aprobado. Advertencia inicial501,46kB/500kB ya existente;
  presupuesto no elevado. Sin advertencias de tamaño de estilos del componente.
  design:check, spec:check y formato focalizado aprobados al cierre.
- No ejecutadas unitarias ni integraciones backend en este cambio visual. Sin
  Supabase,SQL,migraciones,correos,despliegue ni escrituras reales. AC-004 sigue
  pendiente. Usuario realizará revisión estética y pruebas funcionales personales.

Fecha: 2026-11-09, America/Bogota. **Implementación verificada en PostgreSQL aislado; HU-013 parcialmente validada hasta aceptación operativa autorizada.** No se escribieron datos en Supabase, no se ejecutaron migraciones ni scripts 001–102, y no se publicaron cambios en Cloudflare.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | Unitarias + API/Identity/PostgreSQL real aislado | Aprobado: rechazo de escrituras a roles de sede incluso con permiso explícito, creación, validaciones, código duplicado, conservación UUID, edición, estado y administradores paginados. |
| AC-002 | Integración transaccional y concurrente | Aprobado: vínculos, procesos abiertos sin vínculos vigentes, concesiones de cuentas incluso desactivadas; versiones obsoletas/sin versión; dos ediciones simultáneas con un ganador; invitación/reemplazo que esperan una baja rechazan y conservan el estado previo; baja que espera una concesión ya confirmada rechaza. RLS y aislamiento entre dos sedes conservados. |
| AC-003 | Angular con HTTP simulado y navegador HTTPS real aislado | 37 unitarias Angular y fixture con dos recorridos Playwright reales (escritorio/móvil), sin interceptar API: login global, listado, registro, edición, confirmación/cancelación, baja/reactivación y búsqueda insensible a mayúsculas. |
| AC-004 | Aceptación real Supabase | Pendiente. No hay autorización de escritura de prueba sobre sedes reales. No se presenta la fixture aislada como aceptación productiva. |

## Comprobaciones ejecutadas

- `dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore`: aprobado, 0 errores y advertencias.
- Unitarias .NET, filtro `FullyQualifiedName~BranchAuthorizationTests|FullyQualifiedName~UserAdministrationPolicyTests|FullyQualifiedName~AccessScopeTests`: **27 aprobadas**, sin omitidas.
- Integración HTTP/PostgreSQL: **12 casos distintos aprobados**, más **1 fixture** que ejecuta **2 E2E reales**. TRX en backend/artifacts/branch-administration: hu013-integration-final.trx (10), hu013-browser.trx (ediciones concurrentes aprobadas y primera fixture fallida), hu013-browser-final.trx (proceso abierto y fixture corregida aprobados). No sumar las ejecuciones repetidas.
- `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/sites/branches.spec.ts' --include='**/core/auth/access-context.spec.ts' --include='**/users/users.spec.ts'` desde frontend: **37 aprobadas**. Incluye formularios, confirmación/cancelación, contratos, errores 400/401/403/404/409/503, duplicados pendientes, cambio de identidad y navegación existente.
- Fixture `BranchBrowserCrudUsesRealHttpsAndIsolatedPostgresWithoutExternalMail`, mediante `MLP_RUN_PEOPLE_BROWSER=1`, `MLP_TEST_PREPROVISIONED=1` y las tres conexiones de pruebas separadas: Kestrel real + Angular dev proxy con validación de CA + Playwright escritorio/móvil. Certificado efímero con clave privada en memoria, Data Protection protegido, sin imágenes, vídeo ni trazas. El correo externo está sustituido en el host de pruebas y no se crean invitaciones.
- `npm run build`: aprobado, paquete inicial 493.31 kB. design:check y Prettier de archivos afectados aprobados; spec:check final tras completar trazabilidad. No se ejecutaron suites completas.

## Entorno y correcciones verificadas

PostgreSQL 17 ya existente, únicamente 127.0.0.1:57693, base preaprovisionada `mlp_user_validation_tests`, roles runtime/Identity separados. Sin instalación, reconstrucción ni migración. Los ajustes de logging de parámetros se fijaron solo al arrancar este proceso aislado. El clúster se detiene al terminar la validación.

El primer bloqueo FOR UPDATE impedía completar la FK de concesiones en la conexión Identity separada: dos regresiones fallaron por espera. Se sustituyó por FOR NO KEY UPDATE, compatible con KEY SHARE de la FK; regresiones y carreras en ambos sentidos aprobaron. Los locks se toman en orden de UUID y se conservan hasta después del commit Identity, liberándose antes del envío de correo. Las escrituras no ministeriales conservan sus propias transacciones existentes.

La primera fixture de navegador falló porque Playwright limpiaba el directorio que contenía su CA pública y key ring de pruebas. Se separó el subdirectorio de resultados; la repetición aprobó sin desactivar la validación TLS del proxy. Solo se conservan diagnósticos locales sin contraseña.

## Contratos y límites

`BranchDto.updatedAt` y `BranchRequest.expectedUpdatedAt` reutilizan `iglesia.sede.fecha_actualizacion`, normalizada a microsegundos. PUT de perfil y PUT de estado requieren una versión consultada: 400 si falta y 409 si cambió. Estado utiliza BranchActiveRequest; los ActiveRequest de otros módulos no cambian. Código único de hasta20; nombre150, dirección250 y teléfono30. No se añade municipio ni unicidad por nombre.

GET `/api/v1/branches/{id}/administrators?page=1&pageSize=25` es una consulta nueva exclusivamente global sobre las concesiones existentes, no otro mecanismo de asignación. Las asociaciones se administran mediante HU-012. Los cambios de autorización se aplican en backend; RLS sigue siendo el aislamiento existente por sede y no se ha endurecido remotamente a global-only.

Se conservan las fechas existentes, sin introducir un historial de auditoría. No se ejecutaron comandos de sede contra Supabase: queda pendiente aceptación manual con datos y autorización específicos. Los bloqueos coordinan escritores de aplicación, no DML administrativo externo al procedimiento.

## Actividad HTTP compartida — 2026-11-21

Interceptor único registrado antes de autenticación: cuenta suscripciones a `/api/v1/`, incluida la preparación CSRF; `finalize` libera en éxito, error y cancelación. `SKIP_HTTP_ACTIVITY` permite excluir consultas de fondo; URLs externas no participan. No consulta sesión ni añade reintentos. El indicador no bloqueante se monta una vez en gestión; el mismo componente permite bloqueo regional explícito. Signals, OnPush, ProgressSpinner PrimeNG, tokens y umbral de aparición150ms sin retardar peticiones. Se reutiliza la regla global existente de movimiento reducido (animation:none), sin CSS sobre clases privadas.

Verificación:9 unitarias aprobadas (concurrencia,CSRF,error,cancelación,reintento del consumidor,timers/destrucción/inert);4 recorridos loading desktop/mobile aprobados y12 regresiones auth aprobadas, todos con API interceptada. La comprobación visual confirmó región y navegación separadas,temas,movimiento reducido y ausencia de desbordamiento móvil. No acredita operaciones E2E contra Supabase ni escrituras. `npm run build`, `npm run spec:check` y `npm run design:check` correctos. Build advierte503,15kB frente a500kB; no se eleva presupuesto. Revisión estética final del usuario pendiente.

## Corrección solicitada: overlay de pantalla completa — 2026-11-21

Sustituye la decisión anterior de indicador flotante/regional: el usuario exige pantalla completa y centro del viewport. Único montaje en App (blocking/fullscreen),sin montaje en AdminLayout ni SitesPage. Interceptor y conteo sin cambios. Fixed inset0,z-loading1200,fondo translúcido,contenido inert y scroll bloqueado; se libera cuando finaliza la última solicitud. Retirados Cargando sedes y Cargando administradores; se conservan errores,reintentos y estados de negocio.

Verificación final:9 unitarias y18 recorridos de navegador aprobados (4 loading,12 auth,2 carga/error/reintento de Sedes),con API interceptada y sin escrituras reales. Se comprueban límites exactos del viewport,centrado,un solo indicador,inert,concurrencia,liberación de scroll y movimiento reducido en escritorio/móvil. Build correcto; advertencia inicial521,70kB/500kB al cargar el componente PrimeNG desde App. No se sube presupuesto. Supabase/backend intactos. La evidencia anterior corresponde a la presentación sustituida.

## HU-013: tres modales y Toast compartido — 2026-11-21

Implementados BranchCreateDialog,BranchDetailDialog yBranchEditDialog standalone/OnPush con p-dialog;cada uno tiene BranchesStore propio. BranchFormFields/createBranchForm centralizan controles yvalidación;BranchDraft comparte únicamente política de borrador,cierre ydatos de formulario. SitesPage conserva listado/filtros/paginación ycoordina apertura,resultados yfoco. Los enlaces conservan href paraacceso directo/nueva pestaña;click normal abre sin abandonar listado. Las rutas existentes usan los mismos modales. Se reutiliza registrationDraftGuard también desde listado/detalle para proteger edición abierta;sin cambios enmoduleGuard,permisos oreglas backend.

Edición conserva UUID yexpectedUpdatedAt;409 mantiene formulario,ofrece recarga confirmada yToast de advertencia. Guardado duplicado se rechaza;éxito solo tras201/200/204. Cancelar/Escape preguntan por borrador,sin doble confirmación. Reapertura reconstruye formulario ystore;foco vuelve al disparador tras refresco. Consulta mantiene administradores paginados únicamente para global yconfirmación de activación/desactivación.

Notifications es el único bus (subclase de MessageService,alias raíz useExisting). Único p-toast enApp,superior derecha debajo navbar,adaptable móvil,tokens institucionales/tema oscuro,cierre manual,duración5s/7s,máximo1 mensaje ydeduplicación1500ms. Sedes emite desde store trasresultados confirmados yfallos;Usuarios reutiliza el bus ensus escrituras yadvierte entrega no confirmada. Formularios conservan errores específicos inline. No hay interceptor genérico que duplique Toast niavisos pornavegar.

Verificación final:
-30 unitarias aprobadas:15 Sedes,13 Usuarios,2 Notifications. HTTP simulado;doble envío,versión409,confirmación,roles,bus compartido,severidades,deduplicación yentrega no confirmada.
-26 recorridos distintos de navegador aprobados (escritorio/móvil):12 modales,4 overlay,8 filtros/roles/carga-error y2 autenticación. API totalmente interceptada;sin escrituras reales. Los casos inicialmente fallidos de foco ydoble descarte se corrigieron yrepitieron. Prueba de filtros sincronizada con fin de carga,antes esperaba solo inicio de petición. Capturas deshabilitadas;sin imágenes generadas.
-Build ychecks de diseño/trazabilidad correctos. Advertencia de paquete inicial~584kB frente500kB;no se aumenta presupuesto. PrimeNG Toast global incrementa carga inicial;optimización pendiente.

Archivos:frontend/src/app/features/sites/{branch-create-dialog.ts,branch-detail-dialog.ts,branch-edit-dialog.ts,branch-form-fields.ts,branch-draft.ts,branch-dialog.scss,sites-page.ts,sites-page.html,branches.store.ts,branches.spec.ts};frontend/src/app/core/notifications/{notifications.ts,notifications.spec.ts};frontend/src/app/{app.ts,app.html,app.config.ts};frontend/src/app/core/theme/primeng-preset.ts;frontend/src/styles/tokens.css;frontend/src/app/features/administration/admin.routes.ts;frontend/src/app/features/users/{users.store.ts,users.spec.ts};frontend/e2e/{branch-dialogs.spec.ts,branches-list-visual.spec.ts,loading.spec.ts,branches-real.spec.ts};specs/019-branch-administration/{spec.md,plan.md,tasks.md,traceability.json,validation.md}.

Límites:branches-real.spec.ts adaptado al nuevo recorrido,no ejecutado;sin crear/editar sedes reales,sinenvíos,SQL,backend niSupabase. Aceptación operativa AC-004 yrevisión estética manual del propietario pendientes. Infraestructura disponible paraPersonas/Procesos yotros módulos;no se han reescrito masivamente esos flujos.

## Corrección de consulta de Sedes — 2026-11-21

La instrucción posterior del usuario sustituye la presentación inicial del detalle: Ver es exclusivamente lectura,con un único botón Cerrar. Sin Editar,Desactivar,Reactivar,enlaces aUsuarios ni texto explicativo de administración. El p-dialog no se muestra hasta que finalicen detalle yadministradores autorizados;el overlay global informa mientras tanto. Ante error del detalle no se abre un modal vacío;se conserva Toast yretorno al listado. Edición también espera su precarga.

Administradores:lista compacta con inicial,nombre,correo yestado,contador discreto,sin enlaces ni controles Anteriores/Página/Siguientes. Hasta25 registros no se muestra ningún control adicional. Si existen más,se ofrece Ver más yse anexan páginas del endpoint existente,sin ocultar datos ni descargar todas las páginas automáticamente. Activación/desactivación se conserva exclusivamente en edición,con permiso global,confirmación yversión existente;éxito cierra/refresca.

Verificado:17 unitarias focalizadas de Sedes y20 recorridos distintos desktop/mobile (16 modales y4 overlay) aprobados,HTTP interceptado. Incluye apertura trasambas respuestas,detalle readonly,ausencia de gestión/paginador,roles,móvil,foco,estado enedición yconflicto409. La prueba de409 detectó un efecto de precarga que dependía indebidamente de errores;se separó yse verificó conservación del borrador tras actualizar la vista. Build correcto con advertencia inicial583,72kB/500kB. Sin escrituras reales,backend,SQL,imágenes niSupabase. branches-real.spec.ts adaptado pero no ejecutado. Se mantienen pendientes revisión estética del usuario yaceptación operativa autorizada.

### Espera de búsqueda solicitada — 2026-11-21

Texto en buscadores Sedes yUsuarios:3000ms sin nuevos caracteres antes de consultar;cada pulsación reinicia el plazo. Sedes conserva estado inmediato yUsuarios conserva selección de sede/estado350ms. Navegación cancela texto pendiente ydestrucción limpia suscripción. Sin modificar HTTP,permisos oSupabase. Build correcto;advertencia inicial583,72kB previa. Verificación focalizada de filtros mediante navegador interceptado.

2026-11-21: listado Sedes adopta TablePagination compartido con contador inferior, tamaños 10/20/50 (10 inicial), pageSize en URL y petición, y scroll interno. La consulta auxiliar de administradores conserva su mecanismo existente. Evidencia transversal en specs/009-person-query/validation.md; sin escrituras Supabase.
