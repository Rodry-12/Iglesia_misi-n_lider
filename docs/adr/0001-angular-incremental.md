# ADR 0001: Angular compatible y migración incremental

Fecha: 2026-10-19. Estado: adoptada para la base de desarrollo.

Actualización: [ADR 0004](0004-single-angular-workspace.md) cierra la convivencia temporal con HTML/Express, traslada recursos a Angular y consolida Firebase. Las instrucciones de copia y publicación separada que siguen son contexto histórico de la etapa inicial.

## Contexto

El usuario pidió preparar Angular y Spec-Driven Development. El equipo dispone de Node.js 20.19.0. El sitio existente es HTML estático con Firebase y un servidor Express incompleto. No existe un requerimiento de API, pagos automáticos ni administración.

## Decisión

Usar Angular 21, standalone, TypeScript estricto, SCSS, Router y Vitest, con CLI local y lockfile. Angular 21 admite Node.js 20.19.0 según la [matriz de compatibilidad](https://angular.dev/reference/versions). La actualización a Angular 22 requiere revisar y actualizar primero el runtime compatible; no se hace un cambio global de Node.js en esta entrega.

Crear `frontend/` en paralelo al HTML original. Mantener recursos gráficos como fuente única y configurar su copia al build. Preparar configuración Firebase separada para la salida Angular. Añadir exclusiones al hosting original para evitar publicar fuentes nuevas, herramientas y documentación; conservar su directorio público y sus páginas.

Fijar Vitest 4.0.18 y jsdom 28.1.0. La selección automática de dependencias de pruebas produjo un error interno `edgesOut` en npm 10.8.2 y en una ejecución temporal con npm 10.9.4; se evita resolver versiones nuevas no verificadas durante esta base.

Aplicar SDD mediante documentos versionados y scripts locales. El usuario confirmó la metodología y no solicitó una distribución específica como GitHub Spec Kit.

## Consecuencias

La migración se puede verificar por etapas y el sitio original sigue siendo una referencia accesible. Durante la convivencia hay dos entradas web, por lo que los comandos y las instrucciones distinguen explícitamente Angular del HTML original.

El renderizado cliente simplifica la base, pero el SEO y la posible generación estática deben revisarse antes de reemplazar el sitio público. Las decisiones pueden evolucionar mediante nuevos ADR vinculados a especificaciones concretas.
