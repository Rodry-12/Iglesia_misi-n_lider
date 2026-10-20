# ADR 0004: aplicación Angular única y backend reservado

Fecha: 2026-10-19. Estado: adoptada por solicitud explícita de limpieza. Cierra la convivencia temporal descrita en ADR 0001; no modifica Angular ni el stack definido por ADR 0003.

El usuario solicita corregir el header/404 y retirar archivos de la aplicación anterior cuando la migración sea independiente. Se conserva una referencia comprimida, verificada mediante SHA-256, para mantener trazabilidad y permitir comparación visual sin aplicaciones paralelas en la raíz.

## Estructura adoptada

- `frontend/`: aplicación Angular y recursos propios en `public/assets/`, incluidos en el repositorio. Inicio/build comprueban referencias con `check-assets.mjs`; no copian ni borran assets.
- `backend/`: vacío salvo `.gitkeep`, sin framework, dependencias, servidor o base de datos.
- `docs/`, `specs/`, `scripts/` y `.agents/skills/`: contratos, evidencia e instrucciones de mantenimiento; no se eliminan como si fueran código obsoleto.
- `firebase.json`: única configuración activa, limitada al build Angular. Se retira el archivo alternativo y la configuración para publicar toda la raíz.
- `.vscode/`: depuración de Angular en 4200; se retira el perfil HTML de 8080.

Se retiran `index.html`, `404.html`, `donar/`, `src/`, `fonts/` y `app.js` de la raíz tras archivar y verificar sus originales. El helper de copias `prepare-assets.mjs` se sustituye por comprobación de recursos. Se elimina la dependencia npm local del frontend al paquete de coordinación raíz.

## UI y consecuencias

En portada de escritorio el header original es transparente hasta 80 px y negro después, con reducción del logo. Interiores y móvil mantienen fondo negro. La vista 404 conserva la tarjeta, escala y adaptación móvil de Firebase como referencia visual, pero utiliza español, acción de regreso y el layout público; no muestra instrucciones internas de Firebase al visitante. Su excepción de colores se registra en tokens.

La ruta 404 cliente y las reescrituras SPA no acreditan un estado HTTP 404 en hosting. No se ejecuta despliegue, no se implementa backend y las pruebas unitarias permanecen diferidas. La verificación se registra en spec 007, incluidos build sin fuentes heredadas y revisión de navegador.
