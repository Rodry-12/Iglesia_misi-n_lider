# Plan — 005 public-html-parity

## Diseño

Comparar DOM/CSS originales y Angular. Extraer contenido de secciones a componentes públicos, adaptar rutas de assets, normalizar rem del original (base 10 px) a la base global de 16 px y delimitar estilos. Usar signals/scroll nativo para los carruseles en lugar de jQuery. Recuperar header/footer y donaciones.

## Verificación

Probar comportamiento del slider y formulario con proveedores falsos. Revisar escritorio/móvil con Playwright y Chrome instalado; comparar con HTML original servido localmente. Interceptar cualquier envío de EmailJS. Registrar capturas, overflow, imágenes, composición del footer y consola.

## Riesgos y decisiones

No modificar HTML, QR o fotos originales. Evitar cambios globales de font-size que rompan Material/Tailwind. Mantener avisos de las fuentes e iconos y recursos locales. Documentar discrepancias heredadas, fecha de evento sin año y estado externo de EmailJS.
