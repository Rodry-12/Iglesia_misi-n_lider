# ADR 0003: PrimeNG y sistema de diseño compartido

Fecha: 2026-10-19. Estado: adoptada por instrucción explícita del usuario. Sustituye la elección de Material en ADR 0002.

## Decisión

Angular 21, TypeScript estricto, **PrimeNG 21.1.10**, **@primeuix/themes 2.0.3**, Tailwind CSS 4, SCSS, tokens, Lucide, Signals y Reactive Forms constituyen el stack vigente del sitio público y los módulos futuros. Se elimina Angular Material; Angular CDK 21.2.14 permanece como peer dependency de PrimeNG, sin constituir otra biblioteca visual.

La versión fijada de PrimeNG declara `SEE LICENSE IN LICENSE.md`. Se revisó su sección `PRIMENG COMMUNITY VERSIONS LICENSE`, que contiene MIT. El apartado separado de LTS aplica a versiones con sufijo `-lts`; no se instalan esas versiones ni recursos comerciales. `@primeuix/themes` 2.0.3 declara MIT. La elección no supone gratuidad ni compatibilidad automática de futuras versiones. Evitar `latest` y revisar explícitamente versiones mayores, licencia y peers antes de actualizar.

Fuentes: [licencia del repositorio oficial](https://github.com/primefaces/primeng/blob/master/LICENSE.md), [instalación v21](https://v21.primeng.org/installation), [temas v21](https://v21.primeng.org/theming). La evidencia definitiva de esta instalación está en el lockfile y los archivos de licencia de sus paquetes; `npm run deps:check` comprueba la sección revisada y rechaza sufijos LTS.

## Diseño e integración

`tokens.css` contiene los valores del producto. `primeng-preset.ts` adapta Aura a esas variables sin duplicar colores. `app.config.ts` registra el preset, el selector explícito de tema oscuro, capas CSS y traducciones en español. Tailwind se compila como CSS separado de SCSS y consume los mismos tokens mediante `@theme inline`.

Para imágenes de bienvenida se usa [Galleria](https://v21.primeng.org/galleria). [Slider](https://v21.primeng.org/slider) selecciona un valor numérico; `Carousel` se reserva para listas de tarjetas cuando corresponda. La portada conserva sus imágenes y proporciones. La rotación se coordina desde el wrapper para pausar por foco, puntero, intervención manual o movimiento reducido, usando solo inputs/outputs públicos de Galleria y limpieza del efecto.

Los botones, campos y tabla existentes de la guía visual se migran a PrimeNG. El sitio institucional conserva HTML semántico y las secciones de referencia: adoptar una biblioteca no exige convertir cada enlace o contenedor en un componente de ella. Los iconos heredados quedan como adaptación de la referencia; los nuevos usan Lucide.

## SDD y alcance

El contrato transversal es [sistema de diseño](../design-system.md); cada spec de funcionalidad lo referencia y documenta sus componentes, estados y excepciones. La implementación y evidencia están en spec 006. No se crean ni modifican pruebas unitarias y no se ejecutan por instrucción del usuario; la cobertura se retomará después. La revisión visual y el build se registran separadamente.
