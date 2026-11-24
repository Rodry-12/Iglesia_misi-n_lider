# Autenticación Angular — etapa 2.1

Angular usa la API ASP.NET Core Identity existente, sin registro público, sesiones ficticias ni integración directa con Supabase Auth. Implementación y evidencia: `specs/008-angular-authentication/`.

## Contrato y permisos

El store obtiene `GET /api/v1/auth/session` al cargar, sin bloquear el sitio público; los guards esperan la respuesta antes de abrir gestión. El login solicita CSRF anónimo, envía `POST /api/v1/auth/login`, renueva CSRF y consulta de nuevo la sesión canónica. Logout llama al servidor y solo confirma cierre después de respuesta exitosa o 401; un fallo conserva el estado para reintentar. La API revoca globalmente las cookies de la cuenta al cerrar sesión.

Cookies reales: `__Host-mlp-session` y `__Host-mlp-antiforgery`, ambas Secure/HttpOnly/SameSite Strict. El token del JSON CSRF se guarda solo en memoria y se envía como `X-XSRF-TOKEN` en escrituras relativas a `/api/v1/`; no se añade a EmailJS ni URLs externas. No se reintentan escrituras automáticamente. Se descartan respuestas de sesión anteriores a un cambio de identidad.

Navegación: PERSON_VIEW → Miembros; PROCESS_VIEW → Formación; BRANCH_VIEW → Sedes; USER_VIEW → Usuarios. Estos permisos habilitan las entradas preparatorias, no CRUD ni administración total. Finanzas sigue diferida sin inventar un código API. Se mantienen los ámbitos de sede; el resumen muestra las concesiones completas del servidor y UUID de sedes porque SessionDto no devuelve sus nombres. Los guards no autorizan datos del backend.

401 operativo retira la sesión y vuelve a `/acceso`; 403 de un recurso conserva identidad y se presenta como denegación de esa operación, sin redirigir globalmente ni descartar respuestas autorizadas de otras peticiones. Los guards siguen enviando a `/sin-acceso` al intentar una ruta sin permiso. Si `/auth/session` devuelve 403, no se conservan concesiones que ya no han podido verificarse. Los fallos de servicio, CSRF y límite de intentos tienen mensajes distintos de credenciales incorrectas.

## Arranque local general

Usar una base ya preparada y una cuenta confirmada de pruebas; el arranque no aplica migraciones ni crea usuarios. API y Angular deben usar HTTPS. Desde la raíz, en una consola para la API, configurar secretos del entorno local y un certificado vigente:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Testing'
$env:Database__ConnectionString = '<conexion runtime a loopback y base _tests existente>'
$env:Database__RequireVerifiedTls = 'false' # Solo PostgreSQL aislado de loopback
$env:Security__AllowedOrigins__0 = 'https://localhost:4200'
$env:Kestrel__Certificates__Default__Path = '<ruta local al PFX vigente>'
$env:Kestrel__Certificates__Default__Password = '<secreto local del PFX>'
dotnet restore backend/MisionLiderParis.slnx --locked-mode
dotnet build backend/MisionLiderParis.slnx --no-restore -c Release
dotnet run --no-launch-profile --no-build -c Release --project backend/src/MisionLiderParis.Api --urls https://localhost:7243
```

Las asignaciones con placeholders describen la configuración requerida; no son credenciales. Inyectar secretos mediante el mecanismo local autorizado, sin escribirlos en Git ni pegarlos en argumentos de procesos.

En otra consola, confiar explícitamente en el certificado público/CA del backend para Node:

```powershell
$env:NODE_EXTRA_CA_CERTS = '<ruta local al PEM publico del certificado o CA de la API>'
$env:MLP_API_PROXY_TARGET = 'https://localhost:7243'
npm start
```

Abrir `https://localhost:4200/acceso`. Angular genera su certificado de desarrollo; el navegador debe confiar en él o aceptar exclusivamente la excepción local. El proxy conserva `secure:true` y nunca desactiva validación del certificado backend. El certificado/CA debe estar vigente y contener localhost como SAN. No usar Testing ni TLS PostgreSQL deshabilitado en Supabase/producción. En hosting real, configurar el reverse proxy HTTPS `/api/v1` hacia la API; Firebase estático por sí solo no conecta el backend.

## Comandos exactos de esta instancia Windows

El entorno conserva `backend/.local/activation.credential` protegido con DPAPI y PostgreSQL local en 127.0.0.1:55432. El runner local ignorado valida que esa conexión sea loopback y termine en `_tests`, utiliza la cuenta existente, exporta un certificado público local para Node y arranca sin migraciones. No imprime credenciales ni modifica la credencial retenida. Desde la raíz, dos consolas:

```powershell
# Consola API: utiliza PostgreSQL y cuenta de prueba existentes
powershell -NoProfile -ExecutionPolicy Bypass -File backend/.local/angular-auth-local.ps1 -Mode Api

# Consola Angular: confía en el certificado público local del backend
powershell -NoProfile -ExecutionPolicy Bypass -File backend/.local/angular-auth-local.ps1 -Mode Frontend
```

La excepción de ejecución PowerShell solo afecta al proceso. Este helper y sus certificados son artefactos privados locales, no parte de una instalación nueva. Si falta la credencial DPAPI o la base preparada, usar la configuración general anterior; no pedir ni usar credenciales de producción para E2E. El certificado de prueba anterior había caducado y se generó otro local válido durante 30 días; tras su vencimiento hay que renovarlo antes de arrancar.

## Pruebas

```powershell
npm --prefix frontend test -- --watch=false
npm run test:e2e -- auth.spec.ts
npm run test:e2e -- public-site.spec.ts

# E2E real con la credencial local ya retenida, sin interceptar API
powershell -NoProfile -ExecutionPolicy Bypass -File backend/.local/angular-auth-local.ps1 -Mode E2E
```

Para otra cuenta local, suministrar `MLP_REAL_AUTH=1`, `MLP_REAL_AUTH_EMAIL` y `MLP_REAL_AUTH_PASSWORD` solo al entorno del proceso y ejecutar `npm --prefix frontend run test:e2e -- auth-real.spec.ts`. Por defecto ese archivo se omite explícitamente. Sus trazas y capturas automáticas de fallos están deshabilitadas para no registrar credenciales; solo genera capturas del acceso vacío y de la sesión, y evidencia JSON sin secretos. Los E2E normales aceptan el certificado frontend de desarrollo; esto no desactiva TLS en el proxy.

Los casos con API interceptada comprueban flujos y errores; no acreditan un login real. Los resultados reales se registran por separado. No se envían correos en pruebas. No se desarrollaron recuperación de contraseña en UI, CRUD administrativo ni despliegue productivo.
