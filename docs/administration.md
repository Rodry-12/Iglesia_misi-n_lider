# Base de administración por sedes

## Estado

La spec 003 prepara la estructura solicitada. Finanzas, Miembros, Formación, Sedes y Usuarios tienen entradas y rutas diferidas; muestran «Próximamente». No se han implementado operaciones de negocio, persistencia, saldos, miembros o cuentas reales.

La guía visual `/diseno` permite inspeccionar el stack, alternar tema y validar una sede de ejemplo. Sus datos se mantienen en memoria y se borran al abandonar la vista. No crea sedes.

## Rutas y acceso

| Ruta                 | Capacidad requerida    |
| -------------------- | ---------------------- |
| `/gestion`           | Sesión autenticada     |
| `/gestion/finanzas`  | `finanzas:leer`        |
| `/gestion/miembros`  | `miembros:leer`        |
| `/gestion/formacion` | `formacion:leer`       |
| `/gestion/sedes`     | `sedes:leer`           |
| `/gestion/usuarios`  | `usuarios:administrar` |

`AUTH_PRINCIPAL` es un token de inyección de `Signal<Principal | null>`. Su valor por defecto es nulo. No existen usuarios de prueba, credenciales, inicio de sesión simulado, sesión en localStorage ni selector de roles en la aplicación.

`sessionGuard` impide cargar gestión sin sesión y devuelve `/acceso`. `moduleGuard` comprueba cada ruta hija, deniega metadatos incompletos y devuelve `/sin-acceso` cuando falta capacidad. La navegación visible utiliza la misma función de permisos.

## Roles y ámbitos

`Principal.roles` contiene identificadores que proporcionará el servidor. No se inventa una matriz institucional de administrador, pastor o tesorero. La política del backend convertirá roles en capacidades con `scope` de tipo `sites` (lista explícita) o `all-sites`.

`AccessContext.can(permission, siteId)` verifica pertenencia a la sede. Sin `siteId` solo determina si existe alguna sede habilitada para mostrar la entrada del módulo. No autoriza leer una colección completa de todas las sedes.

Cuando existan tablas y consultas reales, el contrato de datos debe exigir el ámbito: consultar y modificar únicamente sedes permitidas, validar nuevamente en la API y mantener auditoría. La UI no deberá descargar datos de sedes ajenas para filtrarlos posteriormente.

Los [guards de Angular](https://angular.dev/guide/routing/route-guards) no sustituyen la autorización de servidor. El contrato local no valida tokens ni establece identidad real.

## Integración siguiente

1. Definir proveedor de identidad, backend, roles institucionales y matriz de capacidades.
2. Implementar un servicio que restaure y valide sesión y provea su señal de solo lectura mediante `AUTH_PRINCIPAL`.
3. Resolver cierre de sesión, caducidad, revocación y errores de API antes de habilitar operaciones.
4. Especificar CRUD por funcionalidad: datos, validación, ámbito por sede, auditoría y permisos de lectura/escritura.

No habilitar usuarios asignando un principal fijo en `app.config.ts`: las pruebas inyectan sesiones controladas únicamente en sus providers de test.
