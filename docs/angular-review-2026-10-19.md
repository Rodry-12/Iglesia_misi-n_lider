# Revisión de la aplicación Angular

Fecha local: 2026-10-19, America/Bogota. Revisión de código y Chrome; las pruebas unitarias permanecen diferidas por instrucción del usuario.

Actualización posterior: los cinco hallazgos concretos se corrigieron en spec 007 y se volvieron a revisar en navegador. El foco/jerarquía del formulario también se ajustó. Consultar [evidencia de cierre](../specs/007-public-finalization-cleanup/validation.md). El cuerpo conserva el diagnóstico histórico; las optimizaciones generales y verificaciones institucionales siguen como trabajo posterior.

## Valoración

La base de arquitectura es coherente y permite continuar el sitio público: Angular standalone, OnPush, TypeScript/plantillas estrictas, rutas diferidas por funcionalidades, layout público persistente, datos tipados, PrimeNG y tema compartido con Tailwind. El sistema de diseño está conectado al código y a las instrucciones SDD. Se encontraron ajustes concretos de interacción, responsive y mantenimiento; la revisión no acredita que todo el producto esté terminado o listo para publicación.

## Hallazgos

### 1. Media: Volver no recupera visualmente el frente de los horarios con el puntero encima

En `frontend/src/styles/_public-site.scss:716` y `:720`, las reglas `.card:hover` fuerzan el giro independientemente de `selected()`. El botón cambia el estado en `service-schedule-section.ts`, pero al cerrar, el hover sigue mostrando el reverso.

Reproducción en Chrome: pulsar Ver detalles y luego Volver sin sacar el puntero. El botón queda con `aria-expanded="false"`, pero la cara frontal conserva la rotación de 180° y el reverso está visible. El estado accesible y la presentación discrepan. Conviene que la apertura/cierre dependa de una única fuente de estado; conservar hover solo como realce visual.

### 2. Media: el header tapa el título al navegar a Contacto en una pantalla baja

El header es fijo (`_public-site.scss:69`) y no hay compensación de scroll para `#contacto`. En 1440 × 720, al pulsar Contacto, la sección queda en y ≈ 0 y su título en y ≈ 30, debajo del header que llega a y ≈ 104. En 1440 × 900 el límite de scroll del documento deja el título visible, por lo que no se detecta mirando solo una altura.

Aplicar un offset coherente con el header al desplazamiento por anclas, mediante `scroll-margin-top`/`scroll-padding-top` y una medida compartida. Revisar también enlaces directos con fragmento, teclado y móvil.

### 3. Media: contactos duplicados en el footer

`frontend/src/app/layout/public/components/site-footer/site-footer.html` conserva enlaces literales de redes, teléfono y correo (por ejemplo líneas 50 y 55). Sin embargo, `core/content/church-content.ts` ya define esos mismos datos y `SiteFooter` expone `church`.

Los datos actuales coinciden, pero cambiar el correo/teléfono central no actualizaría el footer, mientras sí cambiarían las otras pantallas. Vincular esos atributos y etiquetas al contenido central para evitar divergencia. El contenido editorial estático puede seguir en sus plantillas.

### 4. Riesgo medio de robustez: el envío no tiene límite de espera configurado

`contact-gateway.ts:20` usa `firstValueFrom(http.post(...))` sin timeout configurado. `contact-section.ts:46` deshabilita el formulario y lo vuelve a habilitar en `finally`, que espera al gateway. Si la petición permanece pendiente sin respuesta/error, el usuario conserva el estado Enviando y los campos bloqueados.

Definir un tiempo máximo de espera en el adaptador y conservar la recuperación ya implementada: datos intactos, mensaje de fallo y reintento. No reintentar automáticamente correos sin analizar duplicados. Este riesgo se identifica en código; no se provocó una petición real al proveedor.

### 5. Baja: desbordamiento de 2 px en 320 × 900

Con imágenes cargadas, `documentElement.scrollWidth` es 322 para un viewport de 320. Los elementos que salen son `.nosotrosimage`, `picture` y su imagen. La regla de `_public-site.scss:867` usa `36vmax`; su dimensión depende también de la altura de la pantalla.

Limitar la imagen y su contenedor al ancho disponible y permitir que se reduzcan en flex. Confirmar nuevamente en 320 px y en distintas alturas; no ocultar globalmente el overflow para tapar el origen.

## Mejoras posteriores, sin confundirlas con errores de arquitectura

- En `/contacto`, el h2 del formulario aparece antes del h1 de página (`contact-page.html:1`). Ordenar la jerarquía para que el título principal anteceda a las secciones.
- Al enviar vacío, los cuatro campos se marcan como inválidos y el estado comunica el error. El foco permanece en Enviar; llevarlo al primer campo inválido o a un resumen facilitaría la corrección por teclado.
- `_public-site.scss` conserva aproximadamente 1900 líneas de adaptación heredada y reglas de navegación duplicadas, incluso dentro de donaciones. Separar estilos por responsabilidad y retirar reglas sin uso en un incremento que preserve la referencia visual.
- Las fuentes TTF y varios PNG/JPG originales admiten una revisión de peso y formatos. La cifra de carga inicial del build no incluye todas las imágenes, fuentes ni chunks diferidos de la página.
- La fecha del evento sigue sin año; horarios, contactos, QR y disponibilidad de EmailJS requieren confirmación institucional antes de publicar. Son verificaciones pendientes, no información que deba inventarse.

## Comprobaciones realizadas

- `npm run build`: correcto, sin advertencias de presupuesto. Carga inicial 461,76 kB y transferencia estimada 115,64 kB; presupuesto conservado en 500 kB.
- `spec:check`, `design:check`, `deps:check`, `skills:check` y `format:check`: correctos. Son controles estáticos; no acreditan por sí solos comportamiento o accesibilidad completa.
- Chrome: 320/390/768/930/1024 px de ancho con 900 px de alto; 1440 px con alturas 900 y 720. Sin errores JavaScript. Sin overflow del documento salvo los 2 px observados a 320 px.
- Red externa bloqueada durante la revisión. No se enviaron correos ni se efectuaron operaciones bancarias.
- El formulario vacío muestra cuatro campos inválidos y un mensaje de estado. La revisión no acredita entrega real de EmailJS ni todos los escenarios de fallo.
- `/gestion` sin sesión redirige a `/acceso`; no se creó sesión ficticia ni se revisaron operaciones de negocio inexistentes.
- Evidencia local generada: `frontend/artifacts/angular-audit.json`, `angular-audit.mjs` y `audit-320.png`; directorio ignorado por Git.

No se crearon, modificaron ni ejecutaron pruebas unitarias, ni se ejecutó la suite E2E. La revisión ampliada añade escenarios a los de la spec 006; sus resultados previos a 390/1440 × 1000 no cubrían el ancho 320 o la navegación con altura 720.

## Prioridad de cierre

Resolver primero el estado único de horarios y el offset de anclas; después conectar el footer a los datos centrales, definir el tiempo máximo de envío y corregir 320 px. La separación adicional de estilos, optimización de recursos y el incremento de pruebas pueden continuar después, sin reconstruir la arquitectura existente.
