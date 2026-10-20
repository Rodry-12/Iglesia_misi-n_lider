# Validación — 006 primeng-design-system

Estado: verificada tras cerrar los ajustes ampliados mediante spec 007. Se conserva abajo el historial de revisión inicial/detección. Fecha local: 2026-10-19, America/Bogota; los registros UTC de compilación corresponden al 20 de octubre. No incluye pruebas unitarias, expresamente diferidas por el usuario.

Cierre posterior: spec 007 corrigió y revisó los escenarios ampliados, incluido 320 px y header/anclas a 720 px de alto. Ver `specs/007-public-finalization-cleanup/validation.md`; los párrafos siguientes preservan el historial de detección.

Revisión posterior: [informe Angular](../../docs/angular-review-2026-10-19.md). Se reproduce overflow de 2 px a 320 × 900 y ocultación del título de Contacto tras el header a 1440 × 720. También se detectan conflicto hover/estado en horarios y datos de footer duplicados. Los resultados siguientes conservan la evidencia histórica de los tamaños originales; no constituyen aprobación de estos nuevos escenarios.

| Criterio | Método | Resultado y evidencia |
| --- | --- | --- |
| AC-001 | npm view, instalación y archivo de licencia; deps:check; build | PrimeNG 21.1.10, temas 2.0.3, sección MIT comunitaria y MIT de temas comprobados. Material retirado; CDK requerido conservado. Avisos generados por postbuild. |
| AC-002 | design:check y revisión del catálogo | Colores centralizados, sin imports Material ni tokens sin definir. En ambos tamaños, campos claros con fondo blanco/texto rgb(32,39,30); oscuros con fondo rgb(32,39,30)/texto rgb(228,236,222). Tabla y catálogo renderizados. |
| AC-003 | Chrome móvil/escritorio, Galleria | Las tres imágenes originales se recorren con siguiente/selección/anterior. En escritorio avanza a imagen 2 tras 3,3 s y mantiene esa imagen durante 3,3 s con foco dentro. Movimiento reducido usado en capturas; wrapper con media query y limpieza revisado. Sin desbordamiento ni imágenes rotas. |
| AC-004 | Build y revisión de controles PrimeNG | Inicio, donaciones, acceso y catálogo renderizados en ambos tamaños, con Galleria, tabla, campos y botones. Tema alternado. Contrato de datos del contacto conservado; red externa bloqueada, sin mensajes reales. No se acredita entrega de EmailJS ni todos sus escenarios de error. |
| AC-005 | skills:check, format:check, spec:check, design:check, deps:check y documentación | Checks correctos. ADR, contrato, AGENTS, skills y plantillas actualizados. Build final sin advertencias de presupuesto: 461,76 kB iniciales y 115,64 kB de transferencia estimada. |

La primera compilación detectó dos claves ARIA no admitidas por la API v21 y se corrigieron usando los tipos reales del paquete y PassThrough para nombrar la navegación de Galleria. La siguiente compilación con Aura completo pasó con advertencia de presupuesto (539,20 kB). Importar Aura base y los temas usados redujo la carga inicial a 460,87 kB (transferencia estimada 115,53 kB), sin modificar el presupuesto de 500 kB.

La primera revisión visual encontró una caché Vite obsoleta que solicitaba módulos de Material retirados (504 Outdated Optimize Dep). Se reinició el servidor Angular; no se cambió el código para ocultar ese error.

La revisión también detectó que el selector compuesto `html[data-theme='dark']` dejaba claros los campos PrimeNG. Se corrigió con el selector de atributo `[data-theme='dark']`, que PrimeUI normaliza sobre root/host. La última revisión confirmó los colores semánticos oscuros también en campos y tabla, no solo en las tarjetas del catálogo.

Resultado final de `npm run review:public`: 10 páginas/tamaños capturados (original, Angular, donaciones, diseño y acceso en escritorio/móvil), sin errores JavaScript/consola, imágenes rotas ni desbordamiento horizontal. `review.json` registra las imágenes 1/2/3 y vuelta a 2, rotación y pausa por foco, además de colores computados del tema. Capturas adicionales `desktop-design-dark.png` y `mobile-design-dark.png` muestran la guía oscura.

No se crearon, modificaron ni ejecutaron pruebas unitarias por instrucción del usuario. Los tests históricos que dependían de markup Material quedan pendientes de adaptación al retomar esa tarea. Tampoco se ejecutó la suite E2E. `design:check` y los otros checks son verificaciones estáticas, no pruebas de comportamiento o certificación de accesibilidad. No se enviaron correos reales ni se desplegó.

La revisión visual reproducible usa `scripts/visual-public-review.mjs`, Chrome y ambos tamaños (1440 × 1000 y 390 × 844), con red externa bloqueada. Capturas y métricas se guardan en `frontend/artifacts/public-review/`, ignorado por Git. No se acredita igualdad exacta de píxeles con el HTML ni vigencia del contenido institucional.
