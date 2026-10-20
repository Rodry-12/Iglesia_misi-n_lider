# Plan — 007 public-finalization-cleanup

## Diseño

Mantener standalone, PrimeNG y contrato compartido de diseño. Recuperar estado de header por ruta/scroll y transparencia desktop con CSS scoped; inicializar scroll tras render. El router usa ViewportScroller.setOffset con el token --ml-header-offset porque sus desplazamientos numéricos no aplican automáticamente el scroll-margin de CSS.

El 404 adapta la tarjeta de la referencia Firebase con colores centralizados y estilos encapsulados; mantiene layout público, español y botón PrimeNG de regreso. Corregir horarios usando selected como estado único, limitar imagen de Creemos al contenedor, vincular footer a CHURCH_CONTENT, ordenar encabezados y enfocar errores. Timeout de 15 s en el gateway de correo, sin reintento automático.

Preparar ZIP de originales y verificar sus entradas SHA-256. Trasladar solo recursos referenciados y licencias a frontend/public/assets y comparar hashes, con manifiesto del traslado. Sustituir el helper de copia por check-assets y actualizar hooks/ignores antes de retirar la fuente anterior. Archivar configuraciones y consolidar Firebase/VS Code. El comparador visual extrae el ZIP validado a artifacts; el build no depende de él.

Conservar docs, specs, skills y scripts de mantenimiento. Actualizar arquitectura, README, desarrollo, ADR 0004 y skill protegida. Crear backend/.gitkeep sin añadir código o dependencias. Retirar dependencia npm frontend→paquete raíz y archivos sin referencias. No modificar pruebas unitarias.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Build antes y después de retirar fuentes originales. Ejecutar assets/design/deps/skills/specs/format checks. En Chrome revisar 320/390/768/930/1440 px, umbral 0/80/81/0, anclas, tarjetas, foco, 404 y regreso. Interceptar EmailJS sin respuesta y observar recuperación a 15 s sin envío externo. Comparar 404 y portada con referencia archivada; registrar diferencias deliberadas y límites. Verificar hash ZIP y QR/recursos retenidos.

Instrucción vigente: pruebas unitarias diferidas por el usuario. No crearlas, modificarlas ni ejecutarlas hasta que se retomen explícitamente. Registrar build, checks y revisión visual por separado; no afirmar cobertura unitaria.

## Riesgos y decisiones

No ejecutar eliminación recursiva sin verificar rutas absolutas dentro del workspace y copia previa. El archivo ZIP evita depender de un estado Git no inspeccionable. La carpeta backend vacía necesita .gitkeep para mantenerse en control de versiones. La vista 404 conserva composición, pero el hosting SPA puede responder HTTP 200. No desplegar ni validar terceros con correos reales. Pruebas unitarias diferidas explícitamente; no confundir revisión visual o checks estáticos con su cobertura.
