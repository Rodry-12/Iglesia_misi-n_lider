# Validación — 008 angular-authentication

## Avisos de autenticación exclusivamente en Toast — 2026-11-21

Error de acceso, sesión y operaciones de activación/recuperación usan el Toast global; sin banner auth-error ni access-error. El 403 de recurso queda en el consumidor y ya no genera un segundo error global. Las rutas guardadas y 401 mantienen sus restricciones. 12 recorridos auth.spec.ts desktop/mobile y las unitarias de autenticación/Toast pasaron en la regresión transversal documentada en specs/018-user-invitations/validation.md. Sin llamadas OAuth, envíos ni cambios remotos.

## Denegación por recurso sin expulsión global — 2026-11-21

Se reprodujo con una unitaria fallida que AuthStore.denyAccess, invocado por authInterceptor ante cualquier 403, navegaba a /sin-acceso aunque la sesión siguiera válida. Se retiró solo esa navegación; el error HTTP se propaga y los guards/401 mantienen su comportamiento. Usuarios muestra error de opciones con reintento y conserva listado autorizado. No se identificó la petición 403 concreta del navegador del propietario; el defecto y su corrección se comprobaron con respuestas controladas.

46 unitarias aprobadas (auth.store, access-guards, users, user-access) y 40 recorridos desktop/mobile aprobados (auth, user-dialogs, users). Caso explícito: /users devuelve 200, administration-options devuelve 403, tabla permanece visible y URL sigue en /gestion/usuarios. También se verifican rutas realmente denegadas y expiración 401. Build, diseño y trazabilidad aprobados; advertencia inicial 583,18 kB/500 kB. Sin cambios backend/Supabase, credenciales, envíos o imágenes.

## Navegación sin session redundante — 2026-11-10 (FR-007)

- Causa: canMatch/sessionGuard llamaba validateEntrySession y este refrescaba sesión
  en cada navegación, incluidos parámetros de filtros. El interceptor no consulta
  sesión antes de recursos: agrega cookie/CSRF y gestiona401/403.
- AuthStore ahora reutiliza sesión en memoria; carga inicial/pending deduplicado,
  recarga, comprobación canónica tras login y Actualizar sesión permanecen. Se retira
  handoff de cinco segundos. No cambia autorización backend ni persistencia web.
- Unitarias:22 store y6 guards aprobadas; access-context inicialmente tuvo1 timeout
  importando módulos en frío con compilaciones simultáneas. Repetida sola:11/11
  aprobadas, sin aumentar timeout;39 casos distintos correctos en total.
- Ejecución anterior:12 recorridos auth.spec.ts interceptados aprobados, con conteo
  de session al navegar/recargar. Se añade búsqueda/paginación de sedes con respuestas
  interceptadas:2/2 aprobados en escritorio/móvil. Una consulta inicial, ninguna
  adicional al buscar/paginar, una al recargar. Primer desktop agotó tiempo cargando
  página en frío; repetición aislada aprobada sin cambiar límites ni implementación.
- spec:check,design:check y formato focalizado aprobados.
- Build de la corrección frontend aprobado en la ejecución anterior; advertencia
  inicial501,46kB frente a500kB. No acredita latencias HTTP en Supabase.
- La captura del usuario muestra session4–5s y datos6–11s; se elimina la petición
  previa, sin afirmar que la consulta de datos ya tarda menos en producción.

## UX/UI de acceso — 2026-11-09

Fuente: solicitud adjunta de mejoramiento visual. Implementación solo en
frontend/src/app/features/access/access-page.html y access-page.scss; documentación
en esta spec. Ningún cambio de TypeScript, AuthStore, guards, endpoints, CSRF,
cookies, permisos, backend, Gmail, Supabase o rutas en este incremento visual.

- Recuperación deja de preceder al título y se agrupa con mostrar/ocultar contraseña.
  Se conserva PageHeading/identidad y logo oficial del encabezado, sin duplicarlo.
- Tarjeta centrada, ancho máximo34rem, padding adaptable con tokens; campos y acciones
  de al menos44px según token táctil, botón Entrar de ancho completo con indicador
  de carga, ayudas separadas y enlaces distribuidos con wrap. Sin alturas fijas,
  colores nuevos ni cambios globales; footer y navegación institucional intactos.
- Se conservan labels, autocomplete, aria-invalid/describedby, alert/status, errores,
  mostrar/ocultar y recuperación. Foco visible explícito en botones/enlaces.
- Unitarias: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/features/access/access-page.spec.ts'`
  desde frontend: **3/3 aprobadas**. Validación, doble envío, conservación ante fallo,
  limpieza de contraseña tras éxito y visibilidad accesible.
- Navegador: MLP_SKIP_VISUAL_ARTIFACTS=1;
  `node node_modules/@playwright/test/cli.js test e2e/auth.spec.ts --grep 'login, permisos|formulario valida'`:
  **4/4 aprobadas**, escritorio1440x1000/móvil390x844. API interceptada, sin cuentas
  reales, Supabase ni envíos; sin capturas/trazas. Comprueban navegación, teclado,
  ausencia de overflow horizontal y conservación del recorrido de autenticación.
- `npm run build`: correcto. Revisión estética manual y tablet pendientes;
  estos recorridos no acreditan auditoría completa de contraste o accesibilidad.

## Optimización del recorrido de entrada — 2026-11-09

El usuario informa **6,10s desde acceso hasta /gestion**, no duración del POST aislado.
Inspección: GET CSRF y GET sesión posteriores al login se esperaban secuencialmente;
al navegar, sessionGuard repetía GET sesión pese a la comprobación canónica recién hecha.

- AuthStore mantiene el GET sesión que prueba la cookie real, pero lo inicia en
  paralelo con la renovación CSRF. No autentica la UI hasta completar ambos.
- validateEntrySession consume una sola vez la verificación del login si tiene menos
  de cinco segundos y coincide con la versión de identidad; si no, consulta sesión
  normalmente. Refresh, nuevo login, logout y expiración invalidan el marcador.
- No se suprime el control backend ni se usa la respuesta POST como sesión confirmada.
  No se añaden credenciales/tokens a almacenamiento web, reintentos o cambios de cuenta.
- `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/core/auth/auth.store.spec.ts' --include='**/core/auth/access-guards.spec.ts' --include='**/features/access/access-page.spec.ts'`
  desde frontend: **30/30 aprobadas** (21 store,6 guards,3 formulario).
  Incluyen paralelismo, ambas respuestas obligatorias, entrega de un uso/caducidad,
  segunda entrada revocada y ausencia de entrega cuando falla CSRF.
- `MLP_SKIP_VISUAL_ARTIFACTS=1`, Playwright `test e2e/auth.spec.ts`:10/12 aprobadas;
  dos fallos por expectativa antigua del mensaje503 («conexión») frente al mensaje
  vigente de indisponibilidad. Se corrigió exclusivamente esa expectativa y se
  repitió con `--grep 'credenciales inválidas'`:2/2 aprobadas. Resultado final:
  **12 casos distintos aprobados**, escritorio/móvil, con API interceptada. Sin
  Supabase, credenciales reales, capturas, trazas ni correos; no es login real.
- `npm run build`: aprobado,493,71kB iniciales bajo presupuesto500kB.
- Se conserva la API que inició el usuario; no se recompila/reinicia backend ni se
  ejecutan pruebas SQL. El servidor Angular de desarrollo recoge los cambios.
- Pendiente repetir la medición manual tras recargar /acceso. No se afirma una nueva
  duración real ni que los6,10s pertenecieran exclusivamente a la API.

Los límites de30s del apartado anterior son protección ante timeout, no objetivo
de rendimiento. El cambio actual reduce trabajo secuencial y una consulta duplicada.

## Ajuste de espera remota — 2026-11-09

Diagnóstico de solo lectura en Supabase: conexiones ministerial/Identity correctas (2135/1482 ms totales), resolución real de permisos SUPER_ADMIN mediante IAccessService en 8912 ms, próxima al antiguo límite HTTP de 10 segundos sin incluir validación de contraseña ni consulta posterior de sesión. AuthStore usa ahora 30 segundos para login y consultas de sesión, sin reintentos automáticos; distingue timeout e indisponibilidad HTTP 503. Dieciocho pruebas focalizadas correctas, incluidas respuestas de login/sesión después de once segundos y cancelación al superar treinta segundos. Build, spec:check y design:check correctos. Sin cambios de cuentas, esquema ni datos. Confirmación manual del login desde Edge normal pendiente; no se acredita autorización Gmail.

Fecha: 2026-11-06, America/Bogota. Etapa 2.1 implementada y verificada localmente. No se modificó Supabase ni código/esquema del backend.

| Criterio | Verificación | Resultado |
| --- | --- | --- |
| AC-001 | HttpTestingController: csrf/login/session/logout, tokens, concurrencia, expiración, respuestas tardías, errores y URL externa | Correcto; auth.store.spec.ts contiene 16 casos. |
| AC-002 | Guards HTTP reales bajo TestBed, scopes, formulario y navegación existente | Correcto; tres guards nuevos, tres pruebas de formulario y diez pruebas de acceso por capacidades. |
| AC-003 | Playwright auth.spec.ts, Chrome 1440x1000 y 390x844, API interceptada | 12 correctos; no acreditan login real. |
| AC-004 | Playwright auth-real.spec.ts, cuenta existente, proxy TLS y API/PostgreSQL reales | Dos correctos; login 200, sesión 200, recarga 200, logout 204 y sesión posterior 401 en ambos tamaños. |
| AC-005 | Suite unitaria completa, E2E públicos, build y checks estáticos, revisión de capturas | 50 unitarias correctas; 10 E2E públicos correctos; build 472,33 kB iniciales sin advertencia de presupuesto; revisión visual móvil/escritorio. |

## Comandos y resultados

- `npm --prefix frontend test -- --watch=false`: **50 correctas en diez archivos**, cero fallidas. Ejecución final 17:24 America/Bogota; incluye las pruebas existentes retomadas.
- `npm run test:e2e -- auth.spec.ts`: 12 correctas.
- `npm run test:e2e`: **22 correctas, dos omitidas**. Las dos omitidas son los E2E reales opt-in sin credenciales en esa ejecución; no se cuentan como verificación real. Incluye diez escenarios públicos correctos y corrige la expectativa heredada de tres imágenes DOM en Galleria, que renderiza solo la activa.
- `powershell -NoProfile -ExecutionPolicy Bypass -File backend/.local/angular-auth-local.ps1 -Mode E2E`: **dos E2E reales correctos**, última ejecución 11,2 s, sin interceptar la API. Cuenta SUPER_ADMIN local ya existente y credencial DPAPI retenida, no usuario inventado por Angular.
- `npm run build`: correcto, 472,33 kB iniciales, transferencia estimada 119,15 kB; recursos y licencias correctos.
- `npm run design:check`, `npm run deps:check`, `npm run skills:check`, `npm run format:check`: correctos. Se formatearon solo archivos afectados; no cambiaron dependencias.
- `npm run spec:check`: verificación de estructura/trazabilidad, separada de los resultados de comportamiento.

## Evidencia real

Cadena comprobada: navegador https://localhost:4200 → proxy /api con secure:true → API https://localhost:7243 → PostgreSQL local 127.0.0.1:55432, base terminada en _tests y usuario runtime. Cookies __Host-mlp-session y __Host-mlp-antiforgery verificadas como HttpOnly/Secure/SameSite Strict. La cuenta conserva identidad tras recargar; después del logout la consulta de sesión y la ruta protegida ya no permiten acceso. Se comprobó ausencia de overflow con la lista real de permisos en móvil y escritorio.

Capturas locales ignoradas: frontend/artifacts/008-real-access-desktop.png, 008-real-access-mobile.png, 008-real-session-desktop.png y 008-real-session-mobile.png. Resumen JSON sin secretos: frontend/artifacts/008-real-auth-evidence.json. El test real deshabilita trazas/capturas automáticas de fallo y solo captura acceso vacío y sesión.

El primer intento real no llegó al login: el certificado local retenido había caducado y el proxy lo rechazó. Se generó un certificado local nuevo con SAN localhost, se exportó su parte pública para NODE_EXTRA_CA_CERTS y se reiniciaron API/Angular; se mantuvo secure:true. Después ambos E2E pasaron. No se modificaron contraseñas, catálogos ni la credencial DPAPI existente; la API no ejecutó migraciones.

Al terminar se cerraron los procesos de Angular/API de la revisión. PostgreSQL terminó con el grupo local; la orden adicional pg_ctl stop encontró que su PID ya no existía. Se conservan base, cuenta y artefactos privados para repetir los comandos documentados.

## Archivos afectados

- frontend/src/app/core/auth/: auth.models.ts, csrf.service.ts, auth.store.ts, auth.interceptor.ts, access-context.ts, access-guards.ts; auth.store.spec.ts, access-guards.spec.ts y access-context.spec.ts.
- frontend/src/app/app.config.ts y app.spec.ts.
- frontend/src/app/features/access/: access-page.ts, access-page.html, access-page.scss y access-page.spec.ts.
- frontend/src/app/features/administration/: overview-page.ts y admin.routes.ts; core/navigation/admin-navigation.ts; layout/admin-layout/: ts/html/scss.
- frontend/src/app/shared/forms/site-form.ts y site-form.spec.ts (aria-invalid explícito); features/design-system/design-system-page.spec.ts (estado vacío de PrimeNG); app.spec.ts (404 actual y formulario real).
- frontend/e2e/: auth.spec.ts, auth-real.spec.ts y public-site.spec.ts; frontend/angular.json, proxy.conf.cjs y playwright.config.ts; .vscode/launch.json; scripts/visual-public-review.mjs y review-public-behavior.mjs (HTTPS).
- AGENTS.md, README.md, frontend/README.md, backend/README.md, backend/docs/angular-api-contract.md; docs/angular-authentication.md, administration.md, architecture.md, development.md y design-system.md; los cinco archivos de esta spec.
- Helper privado backend/.local/angular-auth-local.ps1 y certificado local: ignorados por Git, sin secretos en fuentes. Comandos reproducibles en docs/angular-authentication.md.

## Límites y pendientes

Solo se verificó la cuenta SUPER_ADMIN local real. El acceso por sede y las denegaciones se cubren en unitarias/E2E interceptados y en la evidencia backend anterior; no se afirma una prueba real con cada rol. No se verificó SMTP ni recuperación de contraseña desde UI, no se desarrollaron CRUD ni se desplegó. Producción requiere activar Supabase por el proceso ya acordado y un reverse proxy HTTPS /api hacia la API; Firebase estático no aporta esa conexión. El certificado local nuevo dura 30 días y deberá renovarse al caducar. Los helpers DPAPI son específicos del entorno Windows conservado, no de una instalación nueva. Backend sin cambios de código: no se repitió su suite de 50/34, ya aprobada en la etapa anterior.
