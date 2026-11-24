# Desarrollo y publicación

Arranque operativo actual contra Supabase y corrección de latencia de lecturas:
[rendimiento y ejecución local](../backend/docs/performance-and-local-development.md).
Incluye los dos lanzadores HTTPS existentes y sus diferencias con `npm start` y el
perfil Development de dotnet.

Angular se ejecuta desde `frontend/`. El paquete raíz ofrece comandos de coordinación; el frontend no depende de él como paquete npm. El nuevo backend .NET 10 vive en `backend/`, con [instrucciones propias](../backend/README.md) y evidencia de lo implementado y pendiente. Consultar `frontend/package.json` y su lockfile para las versiones fijadas de UI.

## Inicio y comprobaciones

```powershell
npm ci --prefix frontend
npm start
npm run assets:check
npm run design:check
npm run deps:check
npm run skills:check
npm run spec:check
npm run format:check
npm run build
```

El servidor escucha en `https://localhost:4200`. El proxy `/api` valida TLS hacia `https://localhost:7243`; configurar la CA pública backend en `NODE_EXTRA_CA_CERTS`. Ver [arranque de autenticación](angular-authentication.md). VS Code utiliza el perfil `Angular: Chrome`. Si Vite informa una caché obsoleta, reiniciar `npm start`.

La etapa 2.1 retoma explícitamente unitarias Angular y E2E. Ejecutar `npm --prefix frontend test -- --watch=false` y `npm run test:e2e`; el E2E real es opt-in con cuenta local y se registra separado de los casos interceptados. Usar formato solo sobre archivos afectados.

## Código, contenido y recursos

Las rutas públicas están en `features/public/public.routes.ts` y el layout compartido en `layout/public/`. Consultar [arquitectura pública](public-site-architecture.md). El contrato de UI está en [sistema de diseño](design-system.md): tokens comunes, PrimeNG y Tailwind.

El contenido reutilizado vive en `core/content/`. El footer consume los mismos datos de contacto que las otras páginas. Los recursos se editan directamente en `frontend/public/assets/`: son fuente, no copias generadas. Los hooks `prestart`, `prebuild` y `prewatch` verifican sus referencias y no borran ni copian assets. Mantener licencias junto a las fuentes y no cambiar QR o datos institucionales sin validación.

El sitio anterior solo está en [el archivo de referencia](reference/README.md). No se necesita para arrancar o compilar Angular. El comparador visual puede extraerlo a `frontend/artifacts/`, ignorado por Git; en Windows necesita PowerShell y en Unix `unzip`.

## Revisión de navegador

```powershell
npm run review:public
npm run review:behavior
```

Requieren Chrome instalado y Angular ejecutándose. El primero compara capturas con la referencia archivada, incluida la página 404. El segundo registra header en 0/80/81 px, anclas, horarios, responsive, 404 y un timeout de contacto con petición interceptada. Bloquean tráfico externo y no envían correos reales. Son revisiones de navegador separadas de las pruebas unitarias; guardar resultados y límites en la spec correspondiente.

## Correo y acceso

`CONTACT_GATEWAY` utiliza HttpClient y configuración pública de EmailJS heredada. El formulario valida al enviar, enfoca el primer inválido, bloquea duplicados mientras espera, conserva los datos ante fallo y reinicia tras confirmación. La petición tiene un timeout de 15 s y no se reintenta automáticamente. La entrega real y la configuración externa del proveedor no están verificadas.

`/diseno` es un catálogo sin persistencia; `/acceso` usa la API real y `/gestion` exige sesión verificada. No se guardan contraseñas ni tokens en localStorage. Consultar [administración](administration.md) y [autenticación](angular-authentication.md).

## Build y hosting

`npm run build` genera `frontend/dist/iglesia-web/browser/`, incluidos recursos y avisos de licencia. El único archivo activo de configuración es `firebase.json`, que publica esa salida y reescribe rutas a `index.html`. El antiguo archivo alternativo fue retirado; el hosting ya no apunta a la raíz del repositorio.

Publicar o crear infraestructura requiere una solicitud explícita. Con Firebase CLI y acceso configurados, un entorno local de hosting puede iniciarse con:

```powershell
firebase emulators:start --only hosting --project iglesia-mision
```

No se realizó despliegue ni se verificó acceso al proyecto. El 404 de Angular es una vista de navegación cliente: la reescritura SPA no garantiza estado HTTP 404 para URLs desconocidas. SEO, metadatos por página, contenido vigente y comprobación institucional del QR forman parte del cierre de lanzamiento.
