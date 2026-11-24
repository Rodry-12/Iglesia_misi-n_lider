# 020 — production-deployment

Estado: Configuración en preparación; alojamiento, dominio y DNS a cargo del usuario.

## Problema y resultado esperado

Publicar Angular, API .NET10 y correo existentes conservando Supabase, cookie/CSRF, permisos personalizados, RLS y rendimiento. Trabajar por bloques, sin módulos nuevos.

## Alcance y exclusiones

Inventario, plantilla de variables/cadenas, Gmail institucional y proxy HTTPS configurable, artefactos locales y guía. El usuario aclara que se encarga de alojamiento/dominio/DNS; no pedir presupuesto ni elegir proveedor. Sin recursos remotos, migraciones/bootstrap ni envíos automáticos. Secretos por el gestor del host.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: Inventariar hosting, dominio, persistencia, Supabase, correo y seguridad; distinguir implementación, configuración local y aceptación remota.
- FR-002: Preparar artefactos Angular/API sin secretos, comandos reproducibles y limitaciones.
- FR-003: Proveer variables exactas del backend, dos conexiones, HMAC, Data Protection persistente, origen Angular y proxy HTTPS configurable por IP confiable. Apagado por defecto; no confiar en IP de cliente arbitraria. Una instancia inicialmente por OAuth/rate limit en memoria.
- FR-004: Configurar correo transaccional y contacto público por separado, URLs definitivas y prueba de entrega autorizada.
- FR-005: Presentar comandos/costes/riesgos/rollback, verificar respaldo vigente y obtener autorización antes de cambios remotos.
- FR-006: Configurar apiBaseUrl pública por ambiente Angular; aplicar la base HTTPS a todas las llamadas relativas de API, incluidas sesión y CSRF, sin enviar credenciales a servicios externos.
- FR-007: Leer MLP_API_BASE_URL desde el entorno de compilación o frontend/.env, con prioridad del entorno y fallback /api/v1, sin editar TypeScript ni incorporar otras variables al bundle.

## Aceptación

- AC-001: Informe identifica archivos/configuración actuales y bloqueos concretos con documentación primaria de proveedores/OAuth.
- AC-002: Build Angular y publish API locales producen artefactos separados; registrar verificación sin afirmar publicación remota.
- AC-003: Plantilla sin credenciales con claves consumidas por la API y guía por bloque. Pruebas demuestran que solo proxies configurados pueden fijar HTTPS/IP y rechazan confianza vacía/indiscriminada; modo desactivado conserva comportamiento.
- AC-004: Candidato remoto conserva login/CSRF/sesión al reiniciar, aislamiento por sede, correo/enlaces HTTPS y rollback comprobado.
- AC-005: Build de producción selecciona environment.production.ts; pruebas HTTP verifican destino configurable, parámetros, CSRF, cookies, 401 y aislamiento de EmailJS. Desarrollo conserva el proxy local.
- AC-006: npm run build incorpora MLP_API_BASE_URL en el JavaScript publicado; plantilla .env.example y validación de URL, precedencia del entorno y ausencia de cambios automáticos del código fuente. Cambiar la variable exige recompilar.

## Escenarios y dudas

El usuario confirma Gmail institucional y maneja dominio/alojamiento. Las URLs finales y rutas privadas se completan en el host por él; no se solicitan secretos en chat. Firebase actual aloja estáticos; su fallback no enruta API. Claves/token Gmail necesitan persistencia y no pueden depender de .local. Sin cambios visuales ni imágenes.
