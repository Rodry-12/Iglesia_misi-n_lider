# Validación — 005 public-html-parity

Estado: implementado con verificación parcial. Revisión realizada el 19 de octubre de 2026 (America/Bogota; compilación registrada en UTC del 20 de octubre).

| Criterio | Método | Resultado y evidencia |
| --- | --- | --- |
| AC-001 | Capturas y revisión del componente; pruebas Playwright preparadas | Tres imágenes originales renderizadas y temporizador con limpieza del efecto. Interacción, rotación y pausa pendientes de ejecución de pruebas. |
| AC-002 | Comparación del HTML y Angular en Chrome, 1440 × 1000 y 390 × 844 | Mismos encabezados y todas las secciones recuperadas, imágenes locales sin fallos. Controles de ministerios/horarios implementados; prueba de interacción pendiente. |
| AC-003 | `npm run review:public` | Footer en tres columnas en escritorio y apilado en móvil; `scrollWidth` igual al viewport en inicio y donaciones; sin errores JavaScript ni imágenes rotas. Navegación interactiva pendiente de prueba automatizada. |
| AC-004 | Revisión de estados y pruebas unitarias/Playwright con gateway falso/intercepción | Implementado. No se ejecutaron las pruebas nuevas ni se enviaron correos reales. No se acredita entrega externa. |
| AC-005 | Build, revisión visual y checks estáticos | Build de producción correcto: carga inicial 376,15 kB, transferencia estimada 94,99 kB. Formato, dependencias y skills correctos. La suite Playwright no fue autorizada; aceptación completa pendiente. |

`npm run build` falló inicialmente por `spawn EPERM` del sandbox; el mismo comando autorizado fuera del sandbox terminó correctamente, sin advertencias de componente. `npm run deps:check`, `npm run skills:check` y `npm run format:check` pasaron. La trazabilidad se comprueba con `npm run spec:check`.

Evidencia visual local: `frontend/artifacts/public-review/review.json`, capturas `desktop-original.png`, `desktop-angular.png`, `desktop-donations.png` y sus variantes `mobile-*`. Son artefactos generados ignorados por Git. El script reproducible es `scripts/visual-public-review.mjs`; sirve la referencia solo en loopback y bloquea tráfico externo del navegador.

La ejecución de `npm run test:e2e` fue rechazada por el usuario. Se respetó la decisión sin ejecutar esa suite mediante otro comando. Tampoco se ejecutaron las pruebas unitarias nuevas. Los archivos de pruebas son preparación, no evidencia de aprobación. Por ese motivo los criterios permanecen sin verificación completa en `traceability.json`.

No se afirma equivalencia exacta de píxeles, validación de todas las anchuras, disponibilidad de EmailJS, vigencia de horarios/eventos/contactos o validación del destinatario del QR. No se realizó despliegue.
