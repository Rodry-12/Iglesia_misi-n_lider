# Desarrollo y publicación

La aplicación ejecutable es `frontend/`. El paquete raíz ofrece comandos de coordinación; el frontend no depende de él como paquete npm. El backend está reservado sin implementación. Consultar `frontend/package.json` y su lockfile para las versiones fijadas.

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

El servidor escucha en `http://localhost:4200`. VS Code utiliza el perfil `Angular: Chrome`; se retiró el perfil del sitio HTML en 8080. Si se cambian dependencias mientras el servidor está abierto y Vite informa una caché obsoleta, reiniciar `npm start`.

Las pruebas unitarias permanecen diferidas por instrucción del usuario. No crearlas, modificarlas ni ejecutarlas hasta retomarlas; los archivos históricos pueden necesitar ajustes al markup PrimeNG. No usar el formato global si reescribe archivos de pruebas.

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

`/diseno` es un catálogo sin persistencia; `/acceso` es una entrada futura. La sesión predeterminada es nula y `/gestion` requiere proveedor de identidad. No crear accesos simulados para habilitar gestión. Consultar [administración](administration.md).

## Build y hosting

`npm run build` genera `frontend/dist/iglesia-web/browser/`, incluidos recursos y avisos de licencia. El único archivo activo de configuración es `firebase.json`, que publica esa salida y reescribe rutas a `index.html`. El antiguo archivo alternativo fue retirado; el hosting ya no apunta a la raíz del repositorio.

Publicar o crear infraestructura requiere una solicitud explícita. Con Firebase CLI y acceso configurados, un entorno local de hosting puede iniciarse con:

```powershell
firebase emulators:start --only hosting --project iglesia-mision
```

No se realizó despliegue ni se verificó acceso al proyecto. El 404 de Angular es una vista de navegación cliente: la reescritura SPA no garantiza estado HTTP 404 para URLs desconocidas. SEO, metadatos por página, contenido vigente y comprobación institucional del QR forman parte del cierre de lanzamiento.
