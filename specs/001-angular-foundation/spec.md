# 001 — Base Angular y Spec-Driven Development

Estado: Verificada para el alcance de preparación, con las limitaciones documentadas en `validation.md`.

## Necesidad

Preparar el sitio existente para desarrollo Angular con un flujo de especificaciones y skills que conserven el contexto institucional. El usuario confirmó Spec-Driven Development como metodología.

## Alcance

Aplicación ejecutable, navegación básica, contenido de referencia, configuración de recursos y hosting, pruebas iniciales, documentación, herramientas SDD y skills locales.

No incluye la migración visual completa, envíos reales, validación del QR, nuevas plataformas de pago, panel administrativo ni despliegue.

## Requisitos

- FR-001: Mantener el sitio original y crear una aplicación standalone en `frontend/` compatible con el runtime instalado.
- FR-002: Ofrecer rutas de inicio, donaciones, contacto y no encontrado, con navegación compartida accesible.
- FR-003: Servir recursos originales localmente y compilar a un directorio apto para hosting estático separado.
- FR-004: Proporcionar comandos reproducibles de desarrollo, pruebas, build y depuración en VS Code.
- FR-005: Preparar documentación de contexto, arquitectura, decisiones, migración y operación.
- FR-006: Permitir crear y comprobar especificaciones y usar skills locales con el contexto del proyecto.

## Aceptación

- AC-001: Con dependencias instaladas, las pruebas y la compilación de producción terminan correctamente bajo Node.js 20.19.0; el sitio original se conserva.
- AC-002: La navegación resuelve `/`, `/donar`, `/contacto` y una ruta desconocida; el menú puede abrirse y cerrarse usando un botón con estado accesible.
- AC-003: El build contiene las imágenes originales bajo `/assets/`; donaciones muestra el QR local y mantiene instrucciones de transferencia manual.
- AC-004: Desde la raíz existen comandos documentados y un perfil de VS Code está configurado para iniciar Angular en el puerto 4200 conservando el perfil previo.
- AC-005: La documentación distingue lo implementado de la migración pendiente, contiene fuentes del contexto y explica la decisión de plataforma.
- AC-006: El generador produce especificaciones consecutivas sin sobrescribir existentes; la comprobación detecta trazabilidad inválida y las dos skills contienen metadatos válidos y referencias existentes.

## Decisiones

Angular 21 por compatibilidad con el runtime existente; renderizado cliente para esta base; recursos originales compartidos; SDD local sin dependencia de Spec Kit. Ver ADR 0001. El SEO renderizado y la paridad completa deben resolverse antes del lanzamiento.
