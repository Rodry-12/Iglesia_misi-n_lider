# 003 — Base de administración de Misión Líder París

Estado: En curso.

## Necesidad y decisión de biblioteca

El usuario pide orientar Angular a Finanzas, Miembros, Formación, Sedes y Usuarios, con componentes, utilidades responsive, SCSS, design tokens, Lucide, signals y Reactive Forms. Autoriza Angular Material como alternativa si PrimeNG no garantiza continuidad gratuita.

Se adopta Angular Material 21 bajo MIT: PrimeNG 21 conserva MIT, pero las versiones siguientes utilizan una licencia distinta con elegibilidad y renovación. Ver ADR 0002 y el registro de dependencias. No se presupone que la iglesia cumpla condiciones de una licencia comunitaria.

## Alcance

Instalar y conectar la biblioteca elegida, Tailwind CSS 4 y Lucide. Incorporar tokens claros/oscuros, componentes reutilizables, una guía visual verificable, layout administrativo, cinco rutas diferidas y contratos de autorización con ámbito por sede.

No incluye CRUD de negocio, contabilidad, datos reales, autenticación de producción, persistencia, proveedor de identidades ni asignación definitiva de roles. Los módulos muestran explícitamente su estado de preparación, sin simular registros o estadísticas. El formulario de la guía visual solo valida una vista previa.

## Requisitos

- FR-001: Fijar versiones compatibles con Angular 21, conservar licencias y registrar fuentes y límites de las decisiones.
- FR-002: Integrar Tailwind mediante PostCSS en CSS separado; mantener SCSS para Material y estilos específicos. Compartir tokens semánticos con temas claro/oscuro y Lucide importado por icono.
- FR-003: Proporcionar una guía visual `/diseno` con botones, tabla, Reactive Form tipado y validación observable sin escrituras remotas.
- FR-004: Crear layout de gestión y rutas `/gestion/{finanzas,miembros,formacion,sedes,usuarios}` con carga diferida y navegación filtrada por permisos.
- FR-005: Definir sesión inyectable de solo lectura, permisos y ámbitos por sede. Sin proveedor, denegar acceso. Un usuario sin permiso no puede abrir la URL directa. Metadatos incompletos se deniegan.
- FR-006: Registrar que roles definitivos y autorización de API están pendientes. No exponer un selector de roles o inicio de sesión ficticio que eluda los guards.
- FR-007: Mantener rutas públicas existentes y actualizar documentación, contexto y skills para el nuevo alcance administrativo.

## Aceptación

- AC-001: Instalación, build de producción y pruebas funcionan con el lockfile actualizado y las licencias directas comprobadas.
- AC-002: El CSS compilado contiene utilidades Tailwind y tokens, y el cambio de tema actualiza los tokens consumidos por Material y la interfaz.
- AC-003: El formulario de ejemplo rechaza datos vacíos y espacios, admite datos válidos, emite un resultado tipado y puede reiniciarse; no hay persistencia ni envío real.
- AC-004: Una sesión anónima es redirigida a acceso; una autenticada sin permisos a sin-acceso; una autorizada puede navegar a cada módulo habilitado.
- AC-005: Un permiso de una sede no concede acceso a otra, y los enlaces de navegación solo incluyen capacidades concedidas.
- AC-006: Continúan funcionando las rutas públicas originales; docs, skills y trazabilidad distinguen base implementada, módulos preparados y backend pendiente.

## Dudas pendientes

El usuario fue consultado por backend y roles. Mientras no se definan, se trabaja contra un contrato de capacidades, sin inventar una matriz institucional de roles. La sesión inicial es nula y los guards no equivalen a autorización de servidor.
