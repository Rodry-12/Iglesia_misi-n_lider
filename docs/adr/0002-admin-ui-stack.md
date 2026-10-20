# ADR 0002: stack de administración sin dependencia comercial

Fecha: 2026-10-19. Estado: sustituida por [ADR 0003](0003-primeng-design-system.md) por instrucción posterior del usuario. El contenido siguiente conserva el historial; no prescribe el stack vigente.

## Contexto y autorización

El usuario amplía el alcance a administración de sedes, Finanzas, Miembros, Formación y Usuarios. Solicita Angular 21, PrimeNG como primera opción, Tailwind CSS 4, SCSS, design tokens y Lucide; autoriza Angular Material si la continuidad gratuita de PrimeNG no cumple el objetivo.

## Comprobación y decisión

El [repositorio oficial de PrimeNG](https://github.com/primefaces/primeng) informa que la línea MIT recibe mantenimiento de seguridad. El [anuncio oficial de PrimeUI](https://primeui.dev/nextchapter) indica que PrimeNG 21 y las versiones MIT previas conservan su licencia, mientras PrimeNG 22 utiliza otro modelo. La [licencia Community](https://primeui.dev/licenses/community) está sujeta a elegibilidad y renovación; no se asume que la iglesia cumpla sus condiciones.

Se elige **Angular Material 21.2.14 y CDK 21.2.14**, con [licencia MIT](https://github.com/angular/components/blob/main/LICENSE), como alternativa expresamente autorizada. La elección evita depender para las futuras actualizaciones de una licencia comunitaria condicionada. No es una afirmación de que PrimeNG 21 haya perdido su licencia ni de que nunca puedan cambiar las condiciones de futuras versiones de cualquier biblioteca.

Se añaden Tailwind CSS 4.3.3 y su plugin PostCSS 4.3.3 (MIT), PostCSS 8.5.31 (MIT) y `@lucide/angular` 1.59.0 (ISC). Material y CDK declaran compatibilidad con Angular 21; Lucide requiere Angular 17+. Las versiones se fijan y se verifican en el lockfile.

## Integración

Tailwind 4 se procesa en CSS con PostCSS según su [guía Angular](https://tailwindcss.com/docs/installation/framework-guides/angular). Su [documentación de compatibilidad](https://tailwindcss.com/docs/compatibility) desaconseja procesarlo con Sass: por ello su entrada CSS es independiente del SCSS de Material y de componentes. Los tokens CSS son compartidos por ambas capas.

Lucide se utiliza mediante componentes standalone individuales del [paquete oficial actual](https://lucide.dev/guide/angular/getting-started), evitando incluir un catálogo completo o fuentes de iconos externas.

## Límites

Esta entrega establece diseño, rutas, sesión inyectable y capacidades. Los módulos no implementan CRUD ni datos reales. Sin proveedor de identidad se deniega la gestión. El servidor deberá validar autenticación, capacidades y ámbitos de sede; los guards del navegador no son la frontera de seguridad de una API.
