# Stack frontend y diseño

El stack vigente para el sitio público y los módulos futuros es **Angular 21 + PrimeNG 21.1.10 + Tailwind CSS 4 + SCSS + Design Tokens + Lucide**, con TypeScript estricto, Signals y Reactive Forms. [ADR 0003](adr/0003-primeng-design-system.md) sustituye la elección histórica de Material.

## Responsabilidades

| Capa | Uso |
| --- | --- |
| Angular standalone y TypeScript estricto | Funcionalidades, rutas diferidas y contratos |
| PrimeNG | Controles, galerías, formularios, tablas, diálogos y filtros |
| @primeuix/themes, preset Aura adaptado | Apariencia de PrimeNG mediante tokens compartidos |
| Angular CDK | Dependencia técnica requerida por PrimeNG; sin Material |
| Tailwind 4 | Grid, flex, espaciado y distribución responsive |
| SCSS | Composición y estilos específicos |
| Tokens CSS | Valores de identidad, colores semánticos, tipografías, espacios, radios y estados |
| Lucide | SVG individuales para iconos nuevos |
| Signals | Estado reactivo local, tema, menú y carrusel |
| Reactive Forms | Formularios tipados y validación de valores actuales |

## Fuente de diseño

El contrato obligatorio es [sistema de diseño](design-system.md). `frontend/src/styles/tokens.css` define los valores, `core/theme/primeng-preset.ts` los aplica a PrimeNG y `styles/tailwind.css` los expone como utilidades. `app.config.ts` registra el tema y el español. No se duplica la paleta en componentes o documentos.

Tailwind se compila desde CSS separado de Sass. Usar clases completas, sin construir nombres como `bg-${color}`. No usar `@apply` en SCSS ni importar la entrada Tailwind desde Sass. No usar selectores privados o `::ng-deep` para alterar componentes de PrimeNG. El modo oscuro se activa explícitamente con `html[data-theme='dark']`; no hay persistencia implementada.

`/diseno` es el catálogo navegable de tabla, formulario, colores y selector de tema; no guarda sedes ni requiere sesión. Galleria sirve la portada de imágenes; Slider es un selector numérico, y Carousel sirve listas deslizantes de tarjetas cuando se justifique. Los iconos de fuente heredados se mantienen como compatibilidad visual; el estándar nuevo es Lucide.

## Licencias y actualización

`docs/ui-dependencies.json` fija versiones y licencias revisadas. `npm run deps:check` contrasta manifest, instalación, lockfile y archivos de licencia, incluida la sección comunitaria MIT de PrimeNG. El hook `postbuild` incorpora los avisos directos y los extraídos por Angular a `browser/third-party-notices.txt`.

No instalar `latest`, versiones `-lts`, temas o bloques comerciales por suponer que son gratuitos. Una actualización mayor requiere revisar licencia, peers y ADR. El control cubre las dependencias directas declaradas, no certifica todo el árbol transitivo.

Por instrucción del usuario las pruebas unitarias se retomarán después. El trabajo vigente se valida con build, checks aplicables y revisión visual, registrando el alcance real de cada comprobación.
