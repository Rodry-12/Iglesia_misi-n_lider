# Plan — 004 public-site-architecture

## Diseño

Mover páginas a features/public y layout público a layout/public. Centralizar rutas institucionales y navegación. Separar la marca, header y footer; dividir el inicio en tres secciones con inputs tipados. Externalizar templates y estilos de páginas y layout. Delimitar estilos comunes bajo .public-site.

## Verificación

RouterTestingHarness comprobará layout único/persistente, navegación pública y entrada al acceso existente. Pruebas de header cubrirán cierre, Escape y foco. Conservar pruebas de QR y comprobar textos de secciones. Ejecutar build y checks documentales; no iniciar servidor ni hacer peticiones externas.

## Riesgos y decisiones

Actualizar imports y trazabilidad de especificaciones previas al mover archivos. Conservar URLs y pruebas administrativas como regresión sin ampliar sus funciones. No alterar el HTML original ni los recursos bancarios.
