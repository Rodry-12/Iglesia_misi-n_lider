# Recuperación del sitio público

La migración anterior conservaba una versión resumida: faltaban el slider y varias secciones, y el layout genérico no reproducía el HTML. Además, el reset de Tailwind eliminaba la negrita predeterminada de los títulos. La corrección se registra en la spec 005.

Se recuperan las tres imágenes originales de bienvenida, comunidad, misión/visión, creencias, valores, pastores, cinco ministerios, horarios, el evento publicado, formulario, footer y la página completa de donaciones. Header y footer siguen siendo componentes únicos del layout público. Iniciar sesión conserva su entrada futura.

Los estilos originales se adaptaron a selectores públicos, recursos locales y rem equivalentes; no se cambia el tamaño global de fuente ni se ejecutan Glider/jQuery. Se corrige la regla `div.logo` que desplazaba el menú y se restaura el fondo decorativo de los horarios. Los carruseles y tarjetas añaden controles de teclado y táctiles. Las fuentes DM Sans y Grape Nuts incluyen su licencia OFL en `fonts/`; Font Awesome conserva su atribución y los recursos existentes.

## Evidencia y límites

`npm run review:public` compara Chrome en 1440 × 1000 y 390 × 844. Guarda capturas completas del HTML original y Angular, donaciones y `review.json` en `frontend/artifacts/public-review/`. Se observaron todas las secciones, imágenes locales cargadas, footer con tres columnas/apilado y ausencia de errores JavaScript o desbordamiento horizontal en esos tamaños. Los controles adicionales, el botón de acceso, la presentación móvil y el slider Angular generan diferencias intencionadas; no se afirma igualdad exacta de píxeles.

La compilación de producción pasó. Se prepararon pruebas unitarias del formulario y pruebas Playwright de secciones, slider, ministerios, horarios, donaciones, entrada de sesión y correo simulado. La suite Playwright no se ejecutó porque su autorización fue rechazada; las pruebas unitarias nuevas tampoco se ejecutaron en esta revisión. No presentar estos archivos como pruebas aprobadas. Consultar `specs/005-public-html-parity/validation.md`.

La comparación visual bloquea peticiones externas. No se enviaron correos reales ni se verificó la disponibilidad/configuración del servicio EmailJS. Horarios, nombres, contactos, QR y la fecha del evento provienen del original; no acreditan su vigencia. No se realizó despliegue.
