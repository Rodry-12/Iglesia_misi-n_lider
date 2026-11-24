# Plan — 008 angular-authentication

Ajuste 403 por recurso (2026-11-21): conservar el interceptor y la propagación del error; retirar únicamente la navegación global de AuthStore.denyAccess. Mantener 401 y decisiones de guards. Mostrar error/reintento de opciones de Usuarios sin ocultar listado 200. Reproducir primero con HttpTestingController y verificar sesión, permisos y flujo de navegador con HTTP controlado.

## Navegación sin consultas redundantes — 2026-11-09

FR-007 actualizado: validateEntrySession delega en ensureSession y reintenta solo
el estado error. Eliminar marcador de un uso/cinco segundos; deduplicar la carga
inicial con pending existente. Login sigue verificando cookie y CSRF, sin cambios
backend ni caché de permisos en servidor. Probar navegación repetida, recarga,
401 de recurso,403, logout, fallos y carreras. Esta sección sustituye la estrategia
histórica de handoff descrita más abajo.

## UX/UI de acceso — 2026-11-09

FR-008, AC-002/005: limitar implementación al HTML/SCSS de AccessPage. Mantener PageHeading,
InputText y Button PrimeNG. Tarjeta centrada de ancho máximo34rem, padding adaptable,
acciones de contraseña flexibles, botón principal completo y bloque de ayuda separado.
Usar tokens de color, foco, espaciado y objetivos táctiles; sin alturas fijas, imágenes
nuevas ni duplicación del logo. Encabezado/footer compartidos conservan sus enlaces.
Verificar formulario y navegación/teclado/overflow en navegador escritorio/móvil con
API interceptada; revisión estética y tablet quedan manuales.

## Latencia de entrada — 2026-11-09

FR-007, AC-001/002: ejecutar GET CSRF autenticado y GET sesión en paralelo después
del POST, conservando validación de ambas respuestas. Transferir la verificación
canónica al primer guard mediante marcador privado de un uso, cinco segundos y versión
de identidad. Invalidarlo en refresh/login/logout/expiración. Verificar carreras,
rechazos, caducidad y segunda entrada; regresiones de navegador con API interceptada.
Sin cambios de API, cuentas, Supabase, TLS, permisos ni caché de autorización backend.

## Diseño

Core/auth: DTO SessionDto, CsrfService, interceptor limitado a /api/v1 y AuthStore Signals. Conectar AUTH_PRINCIPAL y guards asíncronos. Usar códigos de permisos reales, sin convertir USER_VIEW en permisos de escritura.

/acceso: InputText email/password y Button PrimeNG, Reactive Forms, OnPush y HTML/SCSS separados. Etiquetas, autocomplete, errores asociados, foco en primer inválido, aria-live y control de visibilidad de contraseña. Estados inicial/cargando/sin sesión/error/autenticado. Resumen con tarjetas/listas semánticas, UUID de sedes, actualización y logout; móvil desde 320px y escritorio sin overflow.

Proxy HTTPS secure:true; confianza explícita mediante CA pública local de Node. Cookies __Host-mlp-session y __Host-mlp-antiforgery; encabezado X-XSRF-TOKEN, almacenado solo en memoria y renovado tras cambio de identidad.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

HttpTestingController y RouterTestingHarness; Playwright escritorio/móvil con API interceptada. E2E real opt-in con credenciales solo en entorno y API/PostgreSQL locales existentes. No envíos de correo ni producción. Evidencia separada para mocks y login real.

El usuario retoma explícitamente unitarias Angular para esta etapa. No requiere cambiar dependencias ni backend.

## Riesgos y decisiones

La API devuelve UUID de sede sin nombres; mostrarlos fielmente. No inferir permiso financiero ni escritura desde USER_VIEW. Mantener certificados vigentes y CA explícita del proxy; el certificado frontend de desarrollo puede requerir confianza local. E2E reales opt-in y sin trazas de credenciales. No afirmar cobertura productiva o de todos los roles a partir de un SUPER_ADMIN local. Sin cambios en API, SQL ni despliegue; documentar que el hosting estático necesita proxy de API al activarse en producción.
