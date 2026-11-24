# 003 — Base de administración de Misión Líder París

Estado: En curso.

## Actividad HTTP general — 2026-11-21

- FR-013/AC-010: un interceptor registra automáticamente peticiones de la API propia
  con contador Signals y finalize. Corrección solicitada: overlay único a pantalla
  completa, centrado, bloquea interacción durante peticiones. Éxito/error/cancelación/concurrencia
  limpian el estado; excepciones optativas mediante HttpContextToken. Sin tracking
  de EmailJS/external, logs de peticiones o nuevos estados de negocio.
- Presentación reutilizable PrimeNG ProgressSpinner: aparición tras150ms solo si
  sigue pendiente, tema claro/oscuro, movimiento reducido. Montaje único en App con
  fondo surface60%,aria-busy,inert,restauración de foco y bloqueo de scroll.
  Cubre navbar/sidebar y diálogos. Sin párrafos duplicados de carga en Sedes.

## Nombre de sede y jerarquía de permisos — 2026-11-09

- FR-012 / ampliación AC-009: sidebar «Panel de gestión», blanco y mayor tamaño,
  sin nombre institucional. Navbar muestra nombres de sedes de las concesiones
  efectivas: solo la primera sede en el orden de la sesión para BRANCH_ADMIN y
  OPERATOR; SUPER_ADMIN global muestra «Todas las sedes».
  Categorías en negrita y permisos como elementos separados. Sustituye el título
  institucional anterior. BranchName es metadato opcional de sesión, nunca una
  fuente de autorización. Sin consultas adicionales ni cambios SQL. PageHeading
  no incluye eyebrow ni repite el nombre institucional sobre los títulos.

## Corrección solicitada de presentación — 2026-11-09

- FR-011: No mostrar ningún logo en el layout administrativo; navbar compacto,
  sidebar ocultable/mostrable en todos los tamaños y opción logout centrada. Mostrar
  permisos con nombres españoles, sin Detalle de acceso, UUID o códigos de permisos
  y roles en el resumen. Conservar códigos/IDs, autorización y contratos internos.
- AC-009: Navegador verifica ocultar/reabrir sidebar y expansión del contenido en
  escritorio, móvil sin overflow, navbar compacto sticky y logout centrado. Resumen
  presenta etiquetas legibles sin UUID/códigos; Usuarios muestra esas mismas etiquetas
  manteniendo los IDs originales en solicitudes. Esto sustituye las decisiones
  anteriores de logo lateral y panel de códigos técnicos visibles.

## Ajuste vigente de navbar — 2026-11-09

- FR-010: Header administrativo sticky con z-index compartido, título «Misión Líder
  París · Gestión», tema y menú de cuenta. Sin logo ni Sitio público en el header.
  Cierre de sesión existente dentro de Menu PrimeNG; sidebar en verde institucional
  menos oscuro, scroll independiente solo si lo requiere su contenido. Sin tocar
  módulos, rutas, guards o autenticación.
- AC-008: Navegador verifica header visible al desplazar las cinco rutas de gestión,
  menú emergente operable por encima del contenido y Escape/foco, sin overflow
  horizontal en escritorio/móvil; regresiones de logout y permisos conservadas.

## Incremento vigente — UX/UI administrativo, 2026-11-09

El stack vigente es Angular21/PrimeNG21 (ADR0003); las referencias Material y módulos
preparatorios siguientes son históricas. Se autoriza mejorar solo layout administrativo
y resumen, conservando las rutas, sesión, permisos y formularios de negocio existentes.

- FR-008: Sidebar verde oscuro con marca y navegación autorizada; header con usuario,
  roles reales, tema, sitio público y logout. Móvil desplegable y operable con teclado.
- FR-009: Dashboard con rol, ámbito, permisos únicos y nombre de la sesión; accesos a
  módulos existentes y permisos técnicos agrupados en panel secundario. Sin estadísticas,
  nombres de sedes ni fechas inventadas; UUID de sede cuando no hay nombre disponible.
- AC-007: Presentación refleja concesiones múltiples sin duplicar el conteo; solo una
  concesión SUPER_ADMIN global se etiqueta global. Menú/tarjetas mantienen filtro actual,
  preservan entradas solo CREATE; tema y escritorio/móvil sin overflow. Sin nuevas
  solicitudes HTTP, cambios de autorización, backend ni pantallas públicas.

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
