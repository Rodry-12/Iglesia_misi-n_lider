# Validación — 007 public-finalization-cleanup

Estado: verificada en el alcance autorizado de implementación, build, checks y revisión local. Fecha local 2026-10-19, America/Bogota (registros de build en UTC del 20). Pruebas unitarias diferidas por instrucción expresa del usuario.

| Criterio | Método | Resultado y evidencia |
| --- | --- | --- |
| AC-001 | Chrome 320/390/768/930/1440, scroll 0/80/81/0 | En escritorio color rgba(0,0,0,0) en 0/80 y rgb(0,0,0) en 81; logo 100→80→100 px. Móvil permanece negro, sin perder navegación. Interiores y 404 negros. |
| AC-002 | Capturas original/Angular en 1440 y 390; revisión 404 adicional en 320/768/930 | Tarjeta original de 408 px exteriores (360 de contenido más padding), grises/acento y franja móvil conservados. Diferencias deliberadas: español, eliminación de instrucciones internas Firebase, regreso al inicio y layout público compartido. Sin overflow ni errores; enlace vuelve a /. |
| AC-003 | review:behavior con red externa bloqueada | Overflow 0 en los cinco anchos. Título de Contacto en y≈142 bajo header de 90/104 px. Tarjeta cerrada aria-expanded=false, frente visible y reverso aria-hidden=true aun con puntero encima. Foco de formulario vacío en contact-user. Petición EmailJS interceptada y sin respuesta: a 15 s error, campos habilitados y nombre conservado, sin reintento. |
| AC-004 | SHA-256, assets:check, build/start posteriores a retirada | 98 entradas ZIP cotejadas una a una; 33 recursos/licencias trasladados sin diferencias y 19 copias sin referencias retiradas del frontend. 31 referencias de código correctas. ZIP conserva originals. Build y servidor funcionan sin src/fonts/HTML/Express de raíz. Backend solo .gitkeep. |
| AC-005 | Checks y configuración/documentación | Build final correcto sin advertencias: 463,34 kB iniciales, 116,54 kB transferencia estimada. Firebase solo publica browser del build; perfil Angular 4200 único. Documentos, skill Angular, ignores y trazabilidad actualizados; checks finales registrados abajo. |

## Evidencia

- `npm run build`: correcto antes y después de retirar la aplicación anterior. La fase prebuild solo verifica recursos; no genera ni copia carpetas heredadas.
- `npm start`: iniciado después de retirar fuentes antiguas; localhost:4200 devuelve HTTP 200 y sigue en ejecución.
- `npm run assets:check`, `design:check`, `deps:check`, `skills:check`, `spec:check` y `format:check`: correctos. El formato se aplicó únicamente a archivos de aplicación/documentación/herramientas cambiados, sin modificar archivos de pruebas.
- `npm run review:behavior`: resultados en `frontend/artifacts/final-public-review/behavior.json` y capturas de 404 a 320/390/768/930/1440 px. Se repitió tras corregir el tamaño de la imagen y el offset del router.
- `npm run review:public`: 14 páginas/tamaños, incluidos 404 original y Angular, desde referencia ZIP verificada. Sin imágenes rotas, errores JavaScript/consola o desbordamiento; el script también conserva la revisión de Galleria y tema oscuro del catálogo. Capturas en `frontend/artifacts/public-review/`.
- `docs/reference/legacy-manifest.json`: hash del ZIP y de sus 98 entradas; originales comparados antes de eliminar. `assets-migration.json`: hashes de 33 recursos/licencias conservados. La referencia visual se extrajo y sirvió correctamente desde artifacts después de la retirada de originales.

## Correcciones derivadas de la revisión

CSS scroll-margin por sí solo no compensaba el scroll numérico del router; se añadió ViewportScroller.setOffset leyendo el mismo token. El primer límite de contenedor de Creemos no bastaba: se fijó su ancho y el del picture, con imagen al 100% y proporción cuadrada, eliminando el overflow sin ocultarlo globalmente. El 404 se ajustó a 408 px de ancho exterior para compensar el box-sizing global, manteniendo los 360 px de contenido del original.

## Límites

No se crearon, modificaron ni ejecutaron pruebas unitarias, ni se ejecutó la suite E2E. Las revisiones Chrome son evidencia local de escenarios observados, no garantía de todos los navegadores, alturas o combinaciones de accesibilidad. No se enviaron correos reales, verificaron datos bancarios, implementó backend/autenticación o realizó despliegue. La fecha de evento/horarios/contactos siguen necesitando confirmación institucional. El 404 SPA no acredita estado HTTP 404 del hosting; SSR/SEO y publicación requieren su trabajo específico.

## Evolución posterior

El 2026-10-23 el usuario abrió el incremento backend (ADR 0005). La carpeta ya contiene una solución .NET y dejó de necesitar `.gitkeep`; AC-004 conserva su evidencia histórica en ADR 0004. La trazabilidad enlaza ese documento en lugar del marcador retirado. No se repitió revisión visual ni se modificaron tests Angular por este ajuste documental.
