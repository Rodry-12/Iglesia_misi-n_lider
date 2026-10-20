# 004 — public-site-architecture

Estado: En curso.

## Problema y resultado esperado

Organizar el sitio público como un área coherente con layout persistente, header y footer compartidos y páginas por funcionalidad. El usuario pospone expresamente el trabajo de autenticación y administración; solicita únicamente un botón de inicio de sesión en el header como entrada futura.

## Alcance y exclusiones

Agrupar las funcionalidades públicas, extraer secciones del inicio, centralizar navegación y marca, separar templates y estilos y delimitar los estilos institucionales. Mantener contenido y rutas existentes. Quedan fuera autenticación, backend, CRUD, correo real y completar la migración visual del HTML original.

## Requisitos

- FR-001: Usar un único PublicLayout para header, main y footer; las páginas no duplican su estructura.
- FR-002: Agrupar páginas y rutas públicas en features/public y diferir su carga. La raíz solo compone áreas.
- FR-003: Mostrar navegación institucional e Iniciar sesión hacia /acceso. No mostrar guía visual ni módulos internos en el menú público.
- FR-004: Mantener el menú móvil accesible, cerrarlo al navegar y permitir Escape con retorno de foco.
- FR-005: Componer el inicio con secciones tipadas y reutilizar la marca entre header/footer. Conservar el contenido y los recursos actuales.
- FR-006: Delimitar estilos públicos y documentar cómo extender el área sin mezclar negocio administrativo.

## Aceptación

- AC-001: Inicio, donaciones, contacto y página no encontrada presentan exactamente un header, un main y un footer. El layout conserva header/footer al cambiar entre páginas públicas.
- AC-002: Iniciar sesión navega a /acceso; el menú institucional no contiene Gestión ni Guía visual y no presenta un formulario de autenticación nuevo.
- AC-003: El menú expone aria-expanded, se cierra al navegar, y Escape devuelve el foco al botón.
- AC-004: Se mantienen bienvenida, misión, visión, horarios, contacto y QR local; los enlaces y la ruta de donación manual continúan funcionando.
- AC-005: Build, pruebas pertinentes, comprobación SDD, skills y formato pasan; las referencias movidas y la documentación siguen resolviendo.

## Escenarios y dudas

El botón solicitado es un enlace semántico con apariencia de botón: abre la página de acceso existente sin implementar login. La guía visual conserva su URL directa. La base administrativa permanece preparada y protegida para un incremento futuro.
