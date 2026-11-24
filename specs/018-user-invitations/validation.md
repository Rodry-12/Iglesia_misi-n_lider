# Validación — 018 user-invitations

## Toast transversal en toda la aplicación — 2026-11-21

Convertidos los 42 bloques p-message restantes en ToastFeedback declarativo, con mensaje/severidad, Signals, OnPush y plantilla vacía. Se conservan los textos, condiciones, ayudas por campo, confirmaciones y botones de reintento. Cobertura de UI: Usuarios, Sedes, Personas (registro/edición/estado), Formación (catálogo, asignación, estado/responsable/seguimiento), Acceso, Activación/Recuperación y Contacto público. Alertas de consulta de Personas, error de acceso y resultado de contacto también pasan al Toast raíz. Sin banners de operación ni importaciones primeng/message en código de aplicación.

Notifications normaliza espacios y deduplica el mismo texto entre consumidores/severidades. El interceptor ya no crea un error global adicional por 403 de recurso: propaga la respuesta al consumidor, mantiene 401/guards y no modifica permisos. Se retiran banners de administración/Usuarios y estilos obsoletos. design:check rechaza nuevos p-message en producción. Las explicaciones de formulario, estados de carga/conteos y validaciones junto a campos conservan su propósito; las notificaciones/resúmenes se presentan en Toast.

Verificación: 230 unitarias Angular aprobadas; tras el último ajuste del interceptor, 26 unitarias focalizadas de autenticación/Notifications/ToastFeedback también aprobadas. 88 recorridos distintos desktop/mobile aprobados entre la regresión de 86 casos y dos casos de Contacto público con EmailJS interceptado. En la regresión inicial, 85/86 pasaron: el alta desktop falló porque la prueba forzaba doble clic con el desplegable de documento abierto; se corrigió para cerrarlo y usar clic real, y se repitió correctamente en desktop/mobile. Una prueba unitaria de feedback antigua se adaptó para verificar el Toast en vez del texto inline. Los recorridos de sesión expirada comprueban un solo alert de Toast, sin duplicado de acceso.

Build final aprobado, inicial 583,02 kB frente al presupuesto existente de 500 kB (advertencia, sin ampliar límite). design:check, spec:check y formato afectados aprobados. Sin imágenes, llamadas reales de correo, cuentas ni cambios en Supabase. No se realizaron escrituras backend ni pruebas de aceptación de producción.

Archivos principales: shared/ui/toast-feedback.{ts,spec.ts}, core/notifications/notifications.ts, core/auth/{auth.interceptor.ts,auth.store.ts}, layout/admin-layout, plantillas/componentes afectados de members/training/sites/users/access y public/contact, pruebas de persona/Toast y e2e, scripts/check-design-system.mjs y docs/design-system.md. Se reutiliza Notifications/Toast existentes; no se añade proveedor, endpoint, almacenamiento de secretos ni dependencia.

## Listado autorizado frente a error auxiliar 403 — 2026-11-21

Corregida redirección global indebida desde AuthStore.denyAccess. Listado 200 permanece visible cuando falla administration-options con 403; el error de opciones tiene presentación y reintento propios. Reproducción unitaria inicial fallida y verificación final: 46 unitarias y 40 recorridos controlados aprobados, incluyendo Usuarios personalizado, guards y sesión. Build/checks aprobados. El fallo concreto de la sesión real requiere repetirlo en el navegador del propietario; no se afirmó observar sus peticiones privadas. Véase specs/008-angular-authentication/validation.md.

## Carga real de la corrección de permisos — 2026-11-21

Se confirmó que la API en 7243 ejecutaba Release con Domain.dll del 2026-11-09, anterior a los cambios de autorización del 2026-11-21. Se verificó la identidad del proceso local, se detuvo únicamente esa API, se compiló Release (cero advertencias/errores) y se inició mediante Start-VerifiedApi.ps1 -LocalInvitations. El helper reportó success=true, readyHttp=200, identityReadSucceeded=true, signedContextAcceptedByPostgres=true, rlsEnabledOnElevenTables=true y contextClearedAfterRollback=true; anónimos de sesión/Gmail 401, TLS válido, databaseWritten=false, userSecretsWritten=false, emailSent=false. Angular no se reinició. No se ejecutaron migraciones, bootstrap ni escrituras remotas. El listado de la sesión concreta del propietario queda pendiente de repetir en su navegador autenticado; no se afirma aceptación funcional de esa cuenta.

## Guardar junto a Cerrar — 2026-11-21

Edición de usuario: Guardar cambios pasa al footer de Dialog junto a Cerrar, solo para Datos de cuenta y Accesos y permisos. Submit externo vinculado por form/id al formulario existente; conserva validación, permisos, confirmación, bloqueo durante envío y borradores. Seguridad y consulta no incluyen Guardar. Invitación conserva su botón y comportamiento. Archivos: user-account-form.{ts,html}, user-edit-dialog.ts, user-dialog.scss y e2e/user-dialogs.spec.ts.

Build, design:check, spec:check y formato aprobados. 26 recorridos desktop/mobile aprobados con HTTP interceptado: botones alineados, asociación nativa al formulario, sin botón duplicado interior, guardado de perfil/concesiones, errores/borradores y ausencia en Seguridad. Sin imágenes ni operaciones reales; advertencia previa de bundle inicial 583,26 kB/500 kB conservada.

## Limpieza condicional y pie del sidebar — 2026-11-21

La × de limpiar solo aparece con valor seleccionado en todos los showClear existentes: filtro de sede de Usuarios y Personas, cinco filtros dinámicos de Seguimiento y fechas de nacimiento en registro/edición. Se utilizan bindings públicos PrimeNG al valor del control, sin CSS sobre elementos internos. Nota «Acceso según tu cuenta y tus sedes» al pie del sidebar mediante flex y margen automático; ocultación y navegación móvil conservadas.

Build Angular, design:check, spec:check y formato afectados aprobados. 15 recorridos de navegador aprobados y uno omitido por ser el caso de tablet duplicado en el proyecto móvil. Incluye selección→× visible→limpieza→× ausente, filtrado del backend interceptado, posición del pie en escritorio, menú y responsive. Archivos de pruebas: frontend/e2e/users-list.spec.ts y management-layout.spec.ts. Sin imágenes, envíos, escrituras ni conexiones reales a Supabase. Fechas y filtros de otros módulos comprobados por compilación; no se declara recorrido interactivo de todos ellos. Se conserva advertencia inicial de bundle 583,26 kB/500 kB.

## AC-007 — Permisos efectivos de Acceso personalizado — 2026-11-21

Reproducción: dos unitarias backend nuevas fallaron al autorizar USER_VIEW y USER_UPDATE de OPERATOR; la política devolvía null. Corrección ampliada por instrucción del usuario a las cinco capacidades USER_*. UserAdministrationPolicy filtra concesiones por permiso y sede válida; AccessScope permite delegar únicamente a OPERATOR en la misma sede y con permisos contenidos en una concesión autorizada del actor. ListAsync incorpora sus sedes. Se mantienen protecciones de cuentas superiores/propia, validación persona/sede y stamps; Angular aplica el mismo límite de permisos destinatarios.

Revisión transversal: PeopleService, AssignmentService, ProcessCatalogService, BranchService, ReportService, MinistryAuthorization y rutas Angular. Las acciones ministeriales por sede usan permiso efectivo. Crear/modificar sedes y catálogos globales, traslado de personas y consulta de reportes globales conservan restricciones globales explícitas; no se interpretan como fallos de OPERATOR ni se eliminan. El formulario marca esos siete permisos de mutación como «Solo SuperAdministrador», impide añadirlos al perfil personalizado y permite retirar valores anteriores. No se conceden automáticamente permisos de consulta al marcar una mutación.

Resultados: 36 unitarias .NET focalizadas (UserAdministrationPolicyTests, AccessScopeTests, BranchAuthorizationTests), 18 Angular (users.spec.ts, user-access.spec.ts) y 26 recorridos desktop/mobile (user-dialogs.spec.ts, users.spec.ts) aprobados. Navegador con HTTP interceptado, sin correos ni cuentas reales. Dos escenarios nuevos CustomUserAccessTests compilan pero se omitieron expresamente sin MLP_TEST_DATABASE: no había una conexión aislada preaprovisionada preparada para esta ejecución. Quedan pendientes HTTP/Identity/PostgreSQL reales de esa corrección y comprobación de la sesión del propietario tras reiniciar la API; no se reinició su proceso de pruebas ni se aplicó nada en Supabase.

Build backend mediante test y build Angular aprobados; Angular conserva advertencia inicial de 583,26 kB/500 kB. Checks de diseño y formato afectados aprobados. Cambios: Domain/Access/{PermissionCodes.cs,AccessScope.cs}, Infrastructure/Users/UserAdministration.cs, pruebas unitarias de política y CustomUserAccessTests.cs, frontend users/{user-access.ts,user-access.spec.ts,user-account-form.ts,user-account-form.html}, e2e/user-dialogs.spec.ts, angular-api-contract.md y evidencia de esta spec. Sin cambios SQL, RLS, HMAC, roles, contratos HTTP ni secretos.

## Accesos por acciones y Toast único — 2026-11-21

AC-006: pestaña «Accesos y permisos»; OPERATOR se presenta como «Acceso personalizado», con casillas por módulo y etiquetas legibles. Se conserva roleId/branchId/permissionIds y la autorización existente. Cuenta propia/global conserva su protección con explicación visible. Varias concesiones muestran aviso de permisos acumulativos. Eliminado el banner inline de store.notice en Usuarios; Notifications mantiene el Toast global y los errores siguen visibles.

Resultado: 17 unitarias y 22 recorridos desktop/mobile aprobados. Incluyen marcar/desmarcar permisos conservando payload, accesos propios protegidos y éxito únicamente en Toast. HTTP interceptado; ningún alta, correo ni cambio real en Supabase. `users-real.spec.ts` adaptado a los selectores nuevos pero no ejecutado. Build, design:check, spec:check y formato afectados aprobados. Advertencia de bundle inicial 583,26 kB/500 kB pendiente, sin ampliar presupuesto.

## Ajuste de claridad del modal — 2026-11-21

AC-006: Datos de cuenta, Roles y sedes y Seguridad son secciones independientes, con selección explícita y `aria-pressed`. La asociación opcional explica su relación con Miembros y despliega la búsqueda por documento solo a petición. Enter busca sin guardar; cambiar el documento cancela la consulta pendiente y elimina resultados obsoletos. El estado vacío requiere una respuesta y el paginador solo aparece con varias páginas.

La acción visible «Cerrar sesiones y anular enlaces» conserva el endpoint y permisos existentes. Explica que una cuenta activa con contraseña puede volver a entrar; «Desactivar cuenta» se presenta por separado para impedir nuevos accesos. No cambian las reglas de autorización.

Verificación ejecutada: 17 unitarias (`users.spec.ts`, `user-access.spec.ts`) y 20 recorridos Playwright (`user-dialogs.spec.ts`, `users.spec.ts`), todos aprobados. Navegador desktop y móvil con HTTP interceptado; sin imágenes, correo ni escrituras reales. Build aprobado, advertencia previa de bundle inicial 583,72 kB frente a 500 kB. `design:check`, `spec:check` y Prettier de archivos afectados aprobados. No acredita aceptación operativa sobre cuentas reales.

## Estado vigente — 2026-11-09, America/Bogota

### Preparación local posterior — Angular → API → Supabase real

- Angular ya estaba iniciado en **https://localhost:4200** con HTTPS y el proxy existente `/api` → **https://localhost:7243**, `secure: true`. Se reutilizó el servidor; no se publicó Cloudflare.
- La API local se reinició mediante `.local/supabase-key-review/Start-VerifiedApi.ps1 -LocalInvitations`. El switch aplica `Email__InvitationUrl=https://localhost:4200/activar-cuenta` exclusivamente al proceso, en entorno `Testing`, admitido explícitamente por AccountEmailComposer para callbacks loopback. Sin ese entorno, Production rechaza el enlace local. Se mantuvieron TLS VerifyFull, las conexiones runtime separadas, HMAC y el key ring persistente protegido por certificado; no se cambiaron User Secrets ni la URL pública guardada. No se seleccionó un proveedor simulado: GmailApi continúa configurado.
- La comprobación de arranque real volvió a aprobar Identity, contexto firmado, limpieza tras rollback, RLS de las once tablas y cero personas visibles sin actor. Evidencia: `.local/supabase-key-review/{api-status,runtime-verification}.json`. Ninguna migración, bootstrap, escritura ministerial o modificación de permisos.
- Edge real, sin interceptar ni simular respuestas: ambas rutas administrativas redirigen al acceso cuando son anónimas. Tras el login personal del usuario, GET sesión devuelve **200**, rol **SUPER_ADMIN**, alcance global; `/gestion/usuarios` muestra «Usuarios», con listado y administration-options **200**; `/gestion/usuarios/invitar` muestra «Invitar usuario», con administration-options **200** y sin campos de contraseña administrativa. Se abrieron las páginas, no se ejecutaron sus comandos de modificación. Evidencia: `.local/gmail-browser/hu012-local-status.json`.
- `/activar-cuenta` muestra el formulario; sin token mantiene deshabilitado el envío. En documentos nuevos, parámetros sintéticos tanto en fragmento como en query habilitan el formulario y son retirados de la dirección con replaceUrl. Evidencia independiente: `.local/gmail-browser/activation-link-status.json`. El primer probe había cambiado solo el fragmento del documento ya abierto (sin recrear el componente); ese resultado no describe la apertura inicial de un enlace recibido y fue sustituido por la comprobación con documentos nuevos. No se presentó ningún token real ni se intentó una activación válida.
- GET CSRF **200** tanto directo como por proxy; cabecera **X-XSRF-TOKEN**. Cookie `__Host-mlp-antiforgery`: Secure, HttpOnly, SameSite=Strict, Path=/. Sesión anónima **401**; acceso CORS desde `https://localhost:4200` a la API **200**. POST de activación sin CSRF y con cuerpo vacío rechaza **400 invalid_csrf**, antes de activar cuentas. El formulario conserva el contrato **POST /api/v1/auth/activate-invitation**; unitarias verifican cuerpo email/token/newPassword y éxito únicamente tras 204, con HTTP simulado.
- Pruebas focalizadas: **15/15** de users.spec.ts + account-action.spec.ts; **5/5** de access-guards.spec.ts (guards/interceptor). Son **20 unitarias**, separadas de la navegación HTTPS real anterior. Sin suite completa ni pruebas de integración destructivas. No se generaron imágenes, trazas ni registros de credenciales.
- **Preparados para una invitación real controlada desde localhost.** Sigue pendiente autorización explícita para crear/invitar una cuenta de prueba, recibir el mensaje, activar y validar login/logout del destinatario. La URL local solo funciona en el equipo que ejecuta Angular; no debe usarse desde otro dispositivo. Cero cuentas creadas, cero invitaciones enviadas y cero cambios en Cloudflare durante esta preparación.

**PARCIALMENTE VALIDADA.** Las ejecuciones del 2026-11-08 son evidencia histórica y no sustituyen la aceptación real de HU-012. La revisión de publicación que sigue no ejecutó SQL; la preparación local posterior sí utilizó las comprobaciones existentes de solo lectura al arrancar la API. No se modificó Supabase, no se crearon usuarios y no se enviaron invitaciones ni correos.

### Publicación y conectividad comprobadas

- GET https://misionliderparis.pages.dev/activar-cuenta devuelve HTTP 200, text/html. Edge sin sesión muestra **«404 / Página no encontrada»**: es la respuesta de fallback SPA, no la pantalla de activación.
- Inspección recursiva de los 43 JavaScript publicados, sin archivos pendientes: no contienen activar-cuenta, activate-invitation ni /api/v1/auth. El formulario público conserva api.emailjs.com y /api/v1.0/email/send, que pertenecen a EmailJS y no a nuestra API Identity.
- GET https://misionliderparis.pages.dev/api/v1/auth/csrf devuelve HTTP 200, text/html (la aplicación estática), no el contrato JSON CSRF. No hay conectividad operativa a la API de autenticación mediante esa ruta. No se intentó POST de activación.
- En el repositorio, app.routes.ts sí declara activar-cuenta; AccountActionStore usa POST /api/v1/auth/activate-invitation, precedido por CSRF desde el interceptor. La API es relativa al mismo origen; proxy.conf.cjs solo configura el servidor de desarrollo hacia https://localhost:7243 y no se despliega como proxy de Cloudflare Pages.
- Por tanto, falta publicar el frontend actual y conectar /api/v1 del origen público con una API HTTPS accesible y compatible con cookies/CSRF. No se ha establecido ni verificado un destino público de la API. El enlace de invitación configurado hacia Pages todavía no permite completar la activación.

### Correo, Identity y contexto firmado: evidencia real existente

- backend/.local/supabase-key-review/runtime-verification.json registra conexión de Identity correcta, roles runtime separados, RLS habilitado en las once tablas, cero personas visibles sin actor, contexto firmado aceptado por PostgreSQL, acceso global con RLS y limpieza tras rollback; readiness HTTP 200 y Gmail anónimo HTTP 401. Es evidencia de ejecución anterior, no una nueva verificación remota en esta revisión.
- backend/.local/supabase-key-review/first-gmail-send-result.json registra GmailApi, remitente institucional, credencial protegida recuperable, renovación OAuth HTTP 200 y **un** envío diagnóstico autorizado aceptado por Google con HTTP 200 e identificador. No acredita una invitación ni la recepción en el buzón; el archivo no registra confirmación del destinatario. No se repitió el envío.
- Resend y SMTP siguen disponibles. Los pendientes de Resend y de aprovisionamiento Identity/HMAC descritos en el cierre histórico inferior ya no son requisitos pendientes del proveedor operativo GmailApi. Publicación OAuth de Google Cloud no comprobada.

### Política BRANCH_ADMIN revisada sin cambios

UserAdministrationPolicy.ForOperation (Domain/Access/PermissionCodes.cs) exige BRANCH_ADMIN y el permiso de la operación en cada sede. UserAdministration y AccessScope.CanManageGrant limitan el destinatario a OPERATOR, sede autorizada y permisos subconjunto de los del administrador. No permite conceder SUPER_ADMIN ni BRANCH_ADMIN ni administrar sedes ajenas; edición exige también que todos los accesos actuales del destinatario sean delegables. Sede no autorizada explícita: 403; cuenta fuera de ámbito: 404. AccountAccessValidator conserva coherencia de persona/sede.

| Operación | Permiso efectivo requerido |
| --- | --- |
| Consultar/listar operadores visibles | USER_VIEW |
| Invitar/reenviar invitación | USER_CREATE |
| Editar perfil/persona | USER_UPDATE |
| Activar/desactivar cuenta; revocar sesiones | USER_CHANGE_STATUS |
| Sustituir concesiones de operadores | USER_ASSIGN_ROLE |

El SQL ministerial de referencia asigna al rol los cuatro primeros códigos, no USER_ASSIGN_ROLE. Esto documenta la configuración de referencia; no se reconsultaron ni se afirman las asignaciones efectivas actuales de cada usuario en Supabase. El nombre BRANCH_ADMIN por sí solo no garantiza ninguno de esos permisos.

Diferencia respecto a «exclusivamente su sede»: el modelo admite administradores con varias concesiones BRANCH_ADMIN y permite crear operadores en las sedes donde tengan USER_CREATE. No impone una sola sede por administrador o por cuenta destinataria. Para un administrador con una sola sede, la restricción propuesta ya se aplica. No se cambiaron estas reglas.

### Corrección y comprobaciones focalizadas

- users.store.ts: «Cuenta actualizada.» sustituye el aviso que afirmaba revocación en toda edición. UserAdministration.UpdateAsync solo rota SecurityStamp cuando cambia personId; modificar únicamente DisplayName no revoca sesiones. Se conserva el comportamiento del backend.
- users.spec.ts: dos casos nuevos de actualización (sin cambio y con nueva vinculación), comprobando contrato PUT, mensaje y recarga del detalle. **13/13 aprobadas**, con HTTP simulado.
- `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/users/users.spec.ts'` desde frontend: 13 aprobadas.
- `dotnet test backend/tests/MisionLiderParis.UnitTests --configuration Release --no-build --no-restore --filter 'FullyQualifiedName~UserAdministrationPolicyTests|FullyQualifiedName~AccessScopeTests'`: **21/21 aprobadas**; cubre aislamiento, delegación, permisos insuficientes y separación de permisos por operación. Sin conexión PostgreSQL.
- `npm run build`: aprobado (493.31 kB inicial). spec:check, design:check y Prettier de los dos archivos TypeScript modificados: aprobados. No se ejecutaron suites completas ni nuevas integraciones/E2E.
- Las 42 backend y 47 Angular previamente informadas son el resultado del pase anterior; no se vuelven a contar como ejecutadas en esta revisión. Las pruebas actuales se solapan con las anteriores.

### Pendiente para E2E desde el dominio público (despliegue diferido)

Para utilizar el dominio público será necesario publicar la versión actual con la pantalla de activación y habilitar el encaminamiento HTTPS público a la API conservando cookies y CSRF. El usuario difiere Cloudflare: esto no bloquea la invitación E2E local preparada arriba. En ambos casos se requiere autorización concreta para crear/invitar una cuenta de prueba y activar/login/logout con su destinatario. Un envío diagnóstico de Gmail aceptado no valida ese recorrido. Hasta completarlo HU-012 permanece parcialmente validada.

## Evidencia histórica — 2026-11-08

Fecha: 2026-11-08, America/Bogota. Estado: verificada en entorno aislado; aceptación externa pendiente. Resend sustituye Google OAuth por decisión expresa del usuario. Sin envío real ni cambios de Supabase.

| Criterio | Método                                       | Resultado y evidencia |
| -------- | -------------------------------------------- | --------------------- |
| AC-001 | PostgreSQL/API y regresiones de usuarios/ministerio | Aprobadas: permisos efectivos, roles delegables, persona/sede coherentes, unicidad, búsqueda exacta de documento, candidatos sin cuenta y campos inmutables; POST antiguo tampoco aplica contraseña administrativa. |
| AC-002 | UserInvitationTests | Aprobadas: cuenta passwordless, token de propósito específico, activación una sola vez/concurrente, expiración, reenvío60s, rechazo de bloqueo/desactivación/revocación/cuenta ajena, revocación de sesión; envío fallido conserva cuenta. |
| AC-003 | AccountEmailTests con HttpMessageHandler sintético | Aprobadas: remitente configurado, destinatario, HTML/texto UTF-8, fragmento codificado, protección de encabezados/callback, clave ausente, 401/403/429/500 sin fallback/reintento, idempotencia y omisión de reply_to no configurado. Ninguna llamada al proveedor real. |
| AC-004 | Angular, Playwright y Kestrel HTTPS/PostgreSQL aislados | 45 unitarias Angular,18 E2E controlados; fixture real con creación administrativa y activación/login/logout del destinatario en escritorio y móvil, sin respuestas API simuladas ni correo externo. |

## Ejecuciones

- `dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore`: aprobado, cero errores/advertencias.
- `dotnet test backend/tests/MisionLiderParis.UnitTests --configuration Release --no-build --logger trx --results-directory backend/artifacts/user-invitations`:70 aprobadas al cierre;69 en el primer pase antes del caso reply_to.
- Integración, mismo comando con proyecto backend/tests/MisionLiderParis.IntegrationTests: filtro `FullyQualifiedName~InvitationBrowserCreates|FullyQualifiedName~PostgresMinistryTests|FullyQualifiedName~PostgresIdentityTests|FullyQualifiedName~BranchIsolationTests|FullyQualifiedName~SignedActorTests|FullyQualifiedName~HttpSecurityTests`:89 aprobadas y un fallo de fixture TLS inicial. Después, filtro `FullyQualifiedName~InvitationBrowserCreates|FullyQualifiedName~UserAdministrationOptionsAndDocument`:2 aprobadas, incluida la fixture corregida y el nuevo caso de opciones. Resultado final combinado:91 casos distintos aprobados; no se suman los20 repetidos del primer pase dirigido.
- Fixture real: MLP_RUN_PEOPLE_BROWSER=1; `InvitationBrowserCreatesActivatesAndAuthenticatesThroughRealHttpsWithoutExternalMail`. Cuatro ejecuciones Playwright en dos recorridos completos: create+activate por escritorio/móvil. Certificado temporal, Data Protection protegido, cookies seguras, CSRF, Identity, actor firmado y PostgreSQL reales. Buzón inyectado en memoria solo en el host de pruebas; sin endpoint para extraer tokens ni ficheros de tokens.
- Desde frontend: `node node_modules/@angular/cli/bin/ng.js test --watch=false --include='**/users/*.spec.ts' --include='**/account-action.spec.ts' --include='**/core/auth/*.spec.ts'`:45 aprobadas. Incluye13 casos nuevos y32 regresiones de autenticación.
- MLP_SKIP_VISUAL_ARTIFACTS=1; `node node_modules/@playwright/test/cli.js test e2e/users.spec.ts e2e/auth.spec.ts`:18 aprobadas, escritorio y móvil;6 de HU-012 y12 de autenticación. No imágenes/trazas/vídeos.
- `npm run build`: aprobado al cierre, paquete inicial493.07 kB bajo presupuesto500 kB. `design:check` y `format:check` aprobados; `spec:check` al cierre tras completar trazabilidad.

TRX en backend/artifacts/user-invitations:21_15_22 (primeras20),21_20_50 (89 aprobadas/fixture fallida),21_24_42 (fixture fallida por selector),21_26_28 (2 aprobadas finales),21_28_28 (70 unitarias). browser-invitation-result.txt registra los recorridos reales. Las fechas de archivo y los resultados usan la zona del cliente.

## Correcciones durante la validación

El primer navegador falló por compatibilidad de clave temporal de Windows Schannel; se corrigió reimportando el certificado en memoria, sin PFX en archivos. El segundo llegó al selector MultiSelect pero el click apuntaba al input accesible oculto; se cambió por activación de teclado Space, y ambos recorridos completos aprobaron. Dos expectativas unitarias se actualizaron: Usuarios ya no muestra Próximamente y la confirmación asíncrona debe resolverse antes del HTTP. No quedaron fallos pendientes.

## Archivos

- Backend: Application/Auth/AuthContracts.cs; Application/Users/UserContracts.cs; Infrastructure/Configuration/BackendOptions.cs; Infrastructure/DependencyInjection.cs; Infrastructure/Users/{UserAdministration.cs,AccountInvitations.cs}; Infrastructure/Email/{AccountEmailMessage.cs,ResendAccountEmailSender.cs,SmtpAccountEmailSender.cs}; Api/{appsettings.json,Controllers/UsersController.cs,Controllers/AuthController.cs} (prefijos backend/src/MisionLiderParis.*).
- Angular: core/auth/access-context.ts; app.routes.ts; features/administration/{admin.routes.ts,overview-page.ts}; features/users/{users-page.ts,users-page.html,users.models.ts,users.store.ts}; features/access/{access-page.html,account-action-page.ts,account-action.store.ts} (prefijo frontend/src/app/).
- Pruebas: backend/tests/MisionLiderParis.UnitTests/AccountEmailTests.cs; backend/tests/MisionLiderParis.IntegrationTests/{UserInvitationTests.cs,InvitationBrowserFixtureTests.cs,PeopleBrowserFixtureTests.cs,PostgresIdentityTests.cs,PostgresMinistryTests.cs,UserAccountScopeTests.cs}; frontend/src/app/features/users/users.spec.ts; frontend/src/app/features/access/account-action.spec.ts; frontend/src/app/core/auth/access-context.spec.ts; frontend/e2e/{users.spec.ts,users-real.spec.ts}; frontend/playwright.people-real.config.ts.
- Configuración/documentación: backend/docs/user-invitations-resend.md y los cinco archivos de specs/018-user-invitations/.

## Límites

Solo loopback127.0.0.1:57693, base preaprovisionada mlp_user_validation_tests. No migraciones, bootstrap,090, scripts remotos ni producción. Servidor de pruebas detenido tras cada ejecución. La aplicación operativa sigue destinada a Supabase.

La clave compartida no se utilizó ni se guardó: requiere rotación. Faltan clave nueva, dominio/remitente autorizado, callbacks públicos HTTPS y prueba manual aprobada de envío. El Gmail institucional puede ser ReplyTo; no se supone autorización para usarlo como From de Resend. Conexión Identity/ministerio y contexto firmado deben desplegarse coordinadamente antes de aceptación remota.

Sin outbox/historial no se puede garantizar entrega; accepted y unconfirmed son estados de solicitud, no de bandeja de entrada. Las comprobaciones ministeriales de alta permanecen en su conexión separada; login y RLS vuelven a validar el alcance vigente. La activación pública no fabrica un actor administrativo para consultar ministerio. El endpoint POST /users conserva UserDto pero cambia deliberadamente a creación passwordless; clientes antiguos deben activar por invitación. No hay dependencia Google OAuth en esta implementación autorizada de Resend.

## Ajuste de listado de Usuarios — 2026-11-21 (AC-004)

Invitar usuario con icono ytexto de contraste explícito,alineado a la derecha dentro delpanel de filtros. Estado de cuenta:Todos/Activa/Inactiva (valores API vacio/true/false sin cambios);se conservan estados de bloqueo,correo pendiente yactivación pendiente en filas. Roles del listado usan accountRoleLabel únicamente parapresentación. Persona cambia Sin vínculo porSin persona asociada,con explicación en title;persona vinculada novisible se distingue,no seexponen UUID. Paginador visual equivalente aSedes:contador de registros,flechas44px ypaginaactual verde,con límites yparámetros existentes. Tabla/estados/filtros encards por tokens,scroll horizontal local,móvil/oscuro. Sin cambios de permisos ni flujos de invitación.

Archivos:frontend/src/app/features/users/users-page.ts,users-page.html,users-list.scss;frontend/e2e/users-list.spec.ts,users.spec.ts;specs/018-user-invitations/{spec.md,plan.md,tasks.md,validation.md,traceability.json}.

Verificación:13 unitarias existentes de Usuarios aprobadas;12 recorridos distintos desktop/mobile aprobados (6 del listado nuevo y6 regresiones invitación/denegación/activación). HTTP interceptado,sin cuentas/envíos reales. Se corrigió un selector ambiguo de regresión que encontraba tanto mensaje persistente comoToast;ahora comprueba el mensaje específico. Build,design/spec checks yformato registrados. Advertencia inicial583,72kB/500kB persiste,no se eleva presupuesto. Sin backend/Supabase/despliegue/imagenes. Revisión estética del usuario pendiente.

### Espera de búsqueda solicitada — 2026-11-21

Texto en buscadores Sedes yUsuarios:3000ms sin nuevos caracteres antes de consultar;cada pulsación reinicia el plazo. Sedes conserva estado inmediato yUsuarios conserva selección de sede/estado350ms. Navegación cancela texto pendiente ydestrucción limpia suscripción. Sin modificar HTTP,permisos oSupabase. Build correcto;advertencia inicial583,72kB previa. Verificación focalizada de filtros mediante navegador interceptado.

## Modales eiconos de Usuarios — cierre local 2026-11-21 (AC-006)

Listado:Ver yEditar con iconos accesibles,separados yconservando filtros,paginación ybúsqueda3s. Ver solo lectura;Editar aparece según USER_UPDATE,USER_ASSIGN_ROLE,USER_CHANGE_STATUS oreenvío elegible,sin ampliar ámbito. Tres componentes standalone independientes:UserViewDialog,UserEditDialog,UserInviteDialog. Cada uno tiene UsersStore propio yabre después decargar datos/opciones. UserAccountEditor extrae la lógica existente de formularios/confirmaciones;UserAccountForm comparte controles,valida yconserva errores. user-access centraliza exclusivamente política de presentación previamente existente;autorización real sigue enAPI. UserDialogBase limpia suscripciones ycoordina cierre/borradores.

Administrar usuario:Datos decuenta (nombre/persona;correo deacceso no editable porcontrato),Roles ysedes (IDs/códigos internos conservados,labels legibles),reenvío elegible ySeguridad. Protecciones de cuenta propia/global ydelegación BRANCH_ADMIN→OPERATOR de su sede se conservan. Cambio de sección ycierre respetan borradores;éxito actualiza listado yfoco vuelve al disparador. update/grants permiten omitir recarga innecesaria deldetalle al cerrar elmodal,con comportamiento previo por defecto paraotros consumidores. Invitación inicial con USER_CREATE sinUSER_VIEW no consulta listado;cerrar retorna aGestión. /usuarios/:id existente abreconsulta;/usuarios/:id/editar es adaptador Angular,sin endpoint HTTP nuevo. Guard de borrador existente se reutiliza enlista.

Revocación:API existente POST /api/v1/users/{id}/revoke-sessions llamaUpdateSecurityStampAsync. ActiveAccountCookieEvents valida elstamp encada petición;invitaciones usan validación Identity existente. Confirmación explica invalidación desesiones einvitaciones anteriores,sin borrar cuenta nicambiar contraseña;cuenta activa concontraseña puede volver aentrar. Cambios deacceso/estado siguen permisos yconfirmaciones previos. No ejecutado sobreusuarios reales.

Archivos:frontend/src/app/features/users/{users-page.ts,users-page.html,users-list.scss,users.store.ts,user-access.ts,user-access.spec.ts,user-account-editor.ts,user-account-form.ts,user-account-form.html,user-dialog-base.ts,user-dialog.scss,user-view-dialog.ts,user-edit-dialog.ts,user-invite-dialog.ts,users.spec.ts};frontend/src/app/features/administration/admin.routes.ts;frontend/e2e/{user-dialogs.spec.ts,users.spec.ts,users-list.spec.ts,users-real.spec.ts};specs/018-user-invitations/{spec.md,plan.md,tasks.md,traceability.json,validation.md}.

Pruebas finales:16 unitarias aprobadas (13 regresiones,3 política compartida) y24 recorridos distintos desktop/mobile aprobados (12 modales,6 listado,6 regresiones invitación/denegación/activación). Respuestas HTTP totalmente interceptadas. Los4 casos inicialmente fallidos porselectores de confirmación se identificaron portítulo yrepitieron correctamente;invitación repetida traslabels deroles también correcta. Incluye edición perfil,cambio deconcesiones,409conserva borrador,cierre/descartar,revocación cancelada/confirmada una vez,readonly,otra sede,cuenta soloCREATE,sinpasswordadministrativa,móvil yfoco. users-real.spec.ts actualizado peroNOejecutado;sin envíos oaltas reales.

Build correcto;advertencia inicial583,72kB/500kB previa,sin aumento dep resupuesto. Checks diseño,trazabilidad yformato registrados. Backend,Supabase,Identity,HMAC,RLS ycorreo intactos,sin imágenes. Revisión estética yaceptación operativa delpropietario pendientes.

## Pie del modal de invitación — 2026-11-21

Crear e invitar queda junto a Cancelar en el footer persistente de UserInviteDialog. El submit externo apunta al formulario existente mediante form/id; no duplica manejadores ni altera permisos. Se mantiene la confirmación explícita, validación, bloqueo durante envío y protección de borradores. Añadir otro acceso permanece en el contenido.

Evidencia: 18 unitarias de Usuarios/acceso y 28 casos Playwright de invitación/modales aprobados en escritorio y móvil, con HTTP interceptado. Se verifica un único botón, asociación al formulario, ambos botones visibles y alineados, cancelar sin POST y confirmar un único POST. Sin imágenes, cuentas ni envíos reales. Build correcto; advertencia previa 583,02 kB frente a 500 kB. design:check y spec:check aprobados.

2026-11-21: listado Usuarios adopta TablePagination compartido con contador inferior, tamaños 10/20/50 (10 inicial), pageSize en URL y petición, y scroll interno. Evidencia transversal en specs/009-person-query/validation.md; sin cambios de autorización ni operaciones reales.
