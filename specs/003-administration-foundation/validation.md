# Validación 003 — Base de administración

## Corrección de primera sede y encabezados — 2026-11-09

- Se elimina eyebrow de PageHeading y su párrafo institucional repetido.
- Navbar usa solo la primera concesión con sede en el orden de la sesión para
  BRANCH_ADMIN/OPERATOR, incluso con varias sedes; no altera sus permisos.
  SUPER_ADMIN global conserva «Todas las sedes». Sustituye la presentación múltiple.
- 6/6 unitarias de overview aprobadas; Playwright management-layout verifica el
  título con dos sedes y ausencia de texto institucional, con API interceptada.
- Build correcto, advertencia inicial501,75kB frente a500kB; design:check y
  spec:check aprobados. Sin cambios de backend, Supabase ni autenticación.

## Sedes en navbar y lista de permisos — 2026-11-09 (FR-012 / AC-009)

- Sidebar «Panel de gestión», blanco24px; categorías700 y cada permiso en recuadro.
- ResolvedGrant incorpora branchName opcional desde las mismas sedes activas que
  ya valida MinistryDirectory: ningún viaje adicional ni cambio de autorización.
  Navbar inicialmente deduplicaba sedes; corrección superior usa la primera.
  Global muestra «Todas las sedes». Ante backend
  anterior usa «Sede autorizada», sin inventar nombres ni mostrar UUID.
- Angular:38/38 unitarias (overview, auth.store, access-context). .NET:17/17
  AccessScopeTests, incluyendo que manipular nombre no amplía permisos/ámbito.
- Playwright management-layout:5 aprobados,1 duplicado tablet omitido; API
  interceptada, móvil/escritorio, nombres múltiples, categorías700, bordes,
  sidebar alternable, sticky y menú. No es aceptación operativa contra Supabase.
- API Release compilada en backend/.local/ui-branch-build:0 errores/advertencias.
  Angular producción compilado:advertencia inicial502,09kB frente a500kB.
- No reiniciada la API existente ni modificado Supabase. Mostrar nombres con
  sesión real requiere API actualizada; pendiente comprobación operativa.

## Corrección vigente de presentación — 2026-11-09 (AC-009)

- Ninguna imagen/logo en AdminLayout. Header con padding8px, texto16px, avatar32px
  y controles táctiles mínimos44px; ThemeToggle compacto solo por input en este layout.
  Otras instancias conservan su texto visible. Sticky y tokens permanecen.
- Menú lateral alternable también en escritorio; al ocultar, la columna desaparece
  y main ocupa todo el ancho. Escritorio inicia abierto y móvil cerrado; no persiste
  estado en almacenamiento web. Navegar en escritorio conserva menú, móvil lo cierra;
  Escape devuelve foco al botón. MatchMedia solo determina presentación local.
- Etiqueta Cerrar sesión centrada en plantilla item pública de Menu PrimeNG; mantiene
  el comando AuthStore y navegación por teclado. Sin modificaciones de autenticación.
- Resumen sin «Detalle de acceso», UUID de usuario/sede, códigos de rol ni códigos
  de permisos. Ver mis permisos expande nombres españoles agrupados por módulo.
  Mantiene rol legible y ámbito genérico, sin inventar nombres de sedes.
- permission-labels.ts define24 etiquetas de presentación. UsersPage reutiliza
  etiquetas en multiselect y detalle; optionValue sigue siendo id. La prueba confirma
  «Consultar personas» en UI y permission-view en permissionIds del POST simulado.
  Los grants/guards y la API siguen utilizando sus identificadores originales.
- Unitarias de overview-page.spec.ts, users.spec.ts y access-context.spec.ts:
  **29/29 aprobadas**. Se reforzó después el caso existente de Usuarios para comprobar
  etiqueta vs payload y se repitieron sus13 casos; no se cuentan como13 adicionales.
- Navegador: MLP_SKIP_VISUAL_ARTIFACTS=1;
  `node node_modules/@playwright/test/cli.js test e2e/management-layout.spec.ts e2e/auth.spec.ts`:
  **17 aprobadas,1 omitida** (duplicación móvil de tablet). Comprueba ambas direcciones
  de toggle, main.x=0 con sidebar oculto, cero imágenes, ausencia de UUID/códigos,
  navbar<=80px desktop/<=128px móvil, sticky en cinco rutas y text-align:center en
  logout. Conserva regresiones de login/logout/expiración y tema claro/oscuro.
- API interceptada en navegador y unitarias; cero Supabase, usuarios reales o envíos.
  users-real.spec.ts actualiza solo tres selectores de etiquetas; no se ejecutó.
- Build correcto; persiste advertencia ya documentada502,04kB frente a500kB, sin
  aumentar presupuesto. No se rediseñan formularios ni sitio público.
- Nuevos archivos: frontend/src/app/shared/ui/permission-labels.ts. Modificados:
  layout/admin-layout/*; shared/ui/theme-toggle.ts; features/administration/overview-page.*;
  features/users/users-page.{ts,html},users.spec.ts; e2e/{auth,management-layout,users-real}.spec.ts.
  Prefijo Angular: frontend/src/app. Sin cambios backend/SQL/permisos internos.

## Ajuste vigente de navbar — 2026-11-09 (AC-008)

- Navbar sticky/top0, --ml-z-header30, título «Misión Líder París · Gestión», sin
  logo superior ni Sitio público. Cuenta con nombre, roles e iniciales derivadas;
  menú PrimeNG standalone, appendTo=body, Escape/foco gestionados por su API.
  Cerrar sesión invoca el AuthStore existente; no cambia autenticación ni permisos.
- Sidebar usa brand800, hover700 y seleccionado600/borde300, sustituyendo brand950.
  Se mantiene contraste mediante texto neutral0 y tokens compartidos. En escritorio
  permanece sticky con alto de viewport y scroll solo para su propio contenido si
  desborda. Main conserva scroll de página; no se añade un contenedor de scroll a main.
- Archivos funcionales: frontend/src/app/layout/admin-layout/admin-layout.{ts,html,scss}
  y account-menu.{ts,scss}. Ninguna pantalla interna, pública, guard o backend cambiado.
- Se actualizaron selectores de logout en auth.spec.ts, auth-real.spec.ts,
  people-registration-real.spec.ts y users-real.spec.ts para abrir primero Menú de
  cuenta. Los tres recorridos reales no se ejecutaron; no se usaron credenciales.
- Unitarias focalizadas de overview-page.spec.ts y access-context.spec.ts:
  **16/16 aprobadas**, incluida comprobación del header y delegación de logout.
- MLP_SKIP_VISUAL_ARTIFACTS=1;
  `node node_modules/@playwright/test/cli.js test e2e/management-layout.spec.ts e2e/auth.spec.ts`:
  **17 aprobadas,1 omitida** (duplicación móvil del caso tablet). Versión final con
  AccountMenu standalone directo. Sesiones/API interceptadas; no Supabase ni capturas,
  trazas, contraseñas reales o cambios ministeriales.
- Caso nuevo verifica /gestion, /gestion/sedes, /gestion/miembros, /gestion/formacion y
  /gestion/usuarios en escritorio/móvil. Agrega solo espacio vacío sintético en el DOM
  de prueba para provocar scroll; comprueba header y=0, sticky, ausencia de logo/enlace,
  overflow horizontal, menú visible, hit-test sin obstrucción y foco tras Escape.
  Las API de módulos se interceptan con error controlado cuando no tienen fixture:
  prueba layout persistente, no listado real ni aceptación funcional del módulo.
- `npm run build`: correcto con advertencia inicial **502,04kB / umbral500kB**.
  No se amplió el presupuesto. Se ensayó @defer, pero elevaba el inicial a508,16kB;
  se retiró y se conservó el componente standalone directo. No hay una mejora de
  rendimiento atribuida a ese ensayo. Queda optimización de presupuesto pendiente.
- `npm run design:check`: correcto. Formato focalizado y spec:check al cierre.
- Ajuste exclusivo de frontend; sin SQL, cambios de Supabase, bootstrap, OAuth,
  envíos o despliegue. Revisión estética final del propietario pendiente.

## Incremento vigente — Rediseño administrativo, 2026-11-09

Alcance exclusivamente visual de /gestion y su layout. No se proporcionó una imagen
de referencia accesible; se siguió el documento adjunto y docs/design-system.md.
Las referencias siguientes a Material y módulos preparatorios son históricas.

### Implementación (FR-008/009, AC-007)

- AdminLayout conserva filtro ADMIN_NAVIGATION/AccessContext y rutas. Sidebar con
  verde oscuro de tokens, logo oficial, iconos compartidos, resumen y módulos
  existentes. Header muestra usuario/roles de sesión, ThemeToggle, sitio público y logout.
- Móvil/tablet: menú desplegable en flujo que se cierra por navegación/Escape y devuelve
  foco al botón; sin fondo superpuesto ni alturas que recorten el contenido.
- OverviewPage: rol(es), acceso global solo con SUPER_ADMIN/branchId=null, número de
  sedes únicas, códigos de permisos distintos y nombre de la cuenta conectada. No hay
  fechas, métricas ministeriales ni nombres de sedes inventados. Los UUID quedan en detalle.
- Tarjetas de módulos usan las reglas previas. Se conservan entradas Registrar/Invitar
  para cuentas con CREATE sin VIEW. Finanzas y Reportes no se presentan como disponibles.
- Códigos por concesión/módulo en Panel PrimeNG, oculto hasta Ver permisos técnicos;
  conserva UUID y códigos de roles. No cambia cálculo de autorizaciones ni hace HTTP nuevo.
- Señales locales solo para presentación. ManagementIcon y accountRoleLabel son
  reutilización visual; no son otro store/política de seguridad.
- Backend, guard real, AuthStore, rutas, permisos, Supabase y pantallas públicas o de
  formularios sin cambios. access-context.spec.ts actualiza solo su mock a la interfaz
  validateEntrySession ya existente; auth.spec.ts abre el panel antes de revisar códigos.

### Verificación ejecutada

- Desde frontend: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/features/administration/overview-page.spec.ts' --include='**/core/auth/access-context.spec.ts' --include='**/core/auth/access-guards.spec.ts'`:
  **21/21 aprobadas**. Cuatro casos nuevos: concesiones múltiples/conteo único,
  global auténtico, sidebar restringido/Escape y solo CREATE/limpieza al retirar sesión.
- MLP_SKIP_VISUAL_ARTIFACTS=1;
  `node node_modules/@playwright/test/cli.js test e2e/management-layout.spec.ts e2e/auth.spec.ts`:
  **15 aprobadas y una omitida**. La omitida es la duplicación móvil de la variante
  tablet, que se ejecutó correctamente una sola vez a820x1080. Escritorio1440x1000,
  móvil390x844. Se verificaron permisos visibles, ausencia de módulos ajenos, panel
  sin nuevos requests, fondo claro/oscuro, foco/Escape, navegación y cero overflow
  horizontal. Incluye12 regresiones de autenticación.
- Todas las respuestas API de navegador fueron interceptadas; cero datos reales,
  escrituras remotas, correos, OAuth o consultas SQL. Sin capturas/trazas. No se
  presenta como aceptación real contra Supabase ni auditoría completa de accesibilidad.
- `npm run build`: aprobado,493,30kB iniciales, sin advertencias de presupuesto.
- `npm run design:check` y Prettier focalizado: aprobados.
- Revisión estética del propietario y otras dimensiones/zoom pendientes.

Archivos: frontend/src/app/layout/admin-layout/*;
frontend/src/app/features/administration/overview-page.{ts,html,scss,spec.ts};
frontend/src/app/shared/ui/{management-icon,account-labels}.ts;
frontend/src/app/core/auth/access-context.spec.ts;
frontend/e2e/{auth,management-layout}.spec.ts y esta especificación.

Nota posterior: la evidencia de controles/tema Material describe esa implementación histórica. ADR 0003 y spec 006 la sustituyen por PrimeNG; no reutilizar los resultados unitarios de Material como validación de los componentes actuales. Las pruebas específicas pendientes se adaptarán cuando el usuario retome las pruebas unitarias.

Fecha: 2026-10-19, America/Bogota. Estado: implementación realizada, validación final pendiente.

## Resultados comprobados

- Instalación completada y lockfile actualizado. Se conservó la dependencia local al workspace que ya existía al comenzar este incremento.
- `npm run build`: compilación de producción correcta; bundle inicial 290,85 kB, estimación de transferencia 80,65 kB, sin contar imágenes. La guía visual, layout de gestión y módulos aparecen como chunks diferidos.
- `npm test`, primera pasada: **19 de 20 pruebas correctas**. Pasaron regresión pública, formulario, tema, guía visual, denegación anónima, denegación por permiso, navegación filtrada y aislamiento por sede. La apertura autorizada inicial de Finanzas superó el límite de 5 s (carga inicial observada de aproximadamente 8,5 s).
- Se aumentó a 15 s el límite de la prueba parametrizada que carga en frío el layout y Lucide. Se añadieron dos casos: metadatos ausentes y ámbito vacío/all-sites. **La suite final de 22 pruebas no se ejecutó: la repetición solicitada fue rechazada por el usuario.** No se afirma que ese ajuste haya resuelto el timeout.
- `npm run deps:check`: seis dependencias UI contrastadas contra manifiesto, instalación, lockfile y archivo de licencia; Material/CDK/Tailwind/PostCSS MIT y Lucide ISC.
- `npm run skills:check` y `npm run format:check`: correctos.
- Revisión del CSS compilado: utilidades Tailwind y responsive presentes; tokens claro/oscuro presentes; `--mat-sys-primary` referencia `--ml-color-primary`.
- `node scripts/prepare-ui-notices.mjs`: ejecutado correctamente sobre el build. `browser/third-party-notices.txt` incluye las seis dependencias y sus versiones, además de los avisos extraídos por Angular. Este script quedó como hook `postbuild`; no se volvió a compilar después de añadir el hook.
- Enlaces locales de documentación y skills comprobados, sin referencias rotas.

## Cobertura de aceptación

| Criterio | Estado                           | Evidencia                                                                                                    |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AC-001   | Parcial                          | Build, dependencias y licencias correctos; suite final pendiente                                             |
| AC-002   | Verificado localmente            | Prueba de tema correcta y CSS compilado con puente Material/Tailwind                                         |
| AC-003   | Verificado localmente            | Tres pruebas de formulario y una de guía visual correctas                                                    |
| AC-004   | Parcial                          | Denegaciones y cuatro módulos autorizados correctos; Finanzas agotó el tiempo; metadatos nuevos sin ejecutar |
| AC-005   | Verificado para casos ejecutados | Navegación filtrada y sede-a/sede-b correctos; caso adicional de ámbito vacío pendiente                      |
| AC-006   | Verificado localmente            | Regresión pública, documentación, enlaces y skills correctos                                                 |

## Límites

No se inició servidor, navegador ni un nuevo despliegue. Las pruebas ejecutadas usan jsdom/TestBed; no constituyen una revisión visual o auditoría completa de accesibilidad.

No hay backend, autenticación real, asignación institucional de roles ni CRUD. Se consultó al usuario por esos datos; al no disponer de definición durante este incremento se conservó sesión nula y un contrato de capacidades. Los módulos muestran «Próximamente» y la guía no persiste datos.

La autorización por sede deberá aplicarse en la API; los guards del cliente solo controlan navegación. El build no demuestra seguridad de servidor ni validez de credenciales.

## Actividad HTTP compartida — 2026-11-21

Interceptor único registrado antes de autenticación: cuenta suscripciones a `/api/v1/`, incluida la preparación CSRF; `finalize` libera en éxito, error y cancelación. `SKIP_HTTP_ACTIVITY` permite excluir consultas de fondo; URLs externas no participan. No consulta sesión ni añade reintentos. El indicador no bloqueante se monta una vez en gestión; el mismo componente permite bloqueo regional explícito. Signals, OnPush, ProgressSpinner PrimeNG, tokens y umbral de aparición150ms sin retardar peticiones. Se reutiliza la regla global existente de movimiento reducido (animation:none), sin CSS sobre clases privadas.

Verificación:9 unitarias aprobadas (concurrencia,CSRF,error,cancelación,reintento del consumidor,timers/destrucción/inert);4 recorridos loading desktop/mobile aprobados y12 regresiones auth aprobadas, todos con API interceptada. La comprobación visual confirmó región y navegación separadas,temas,movimiento reducido y ausencia de desbordamiento móvil. No acredita operaciones E2E contra Supabase ni escrituras. `npm run build`, `npm run spec:check` y `npm run design:check` correctos. Build advierte503,15kB frente a500kB; no se eleva presupuesto. Revisión estética final del usuario pendiente.

## Corrección solicitada: overlay de pantalla completa — 2026-11-21

Sustituye la decisión anterior de indicador flotante/regional: el usuario exige pantalla completa y centro del viewport. Único montaje en App (blocking/fullscreen),sin montaje en AdminLayout ni SitesPage. Interceptor y conteo sin cambios. Fixed inset0,z-loading1200,fondo translúcido,contenido inert y scroll bloqueado; se libera cuando finaliza la última solicitud. Retirados Cargando sedes y Cargando administradores; se conservan errores,reintentos y estados de negocio.

Verificación final:9 unitarias y18 recorridos de navegador aprobados (4 loading,12 auth,2 carga/error/reintento de Sedes),con API interceptada y sin escrituras reales. Se comprueban límites exactos del viewport,centrado,un solo indicador,inert,concurrencia,liberación de scroll y movimiento reducido en escritorio/móvil. Build correcto; advertencia inicial521,70kB/500kB al cargar el componente PrimeNG desde App. No se sube presupuesto. Supabase/backend intactos. La evidencia anterior corresponde a la presentación sustituida.
