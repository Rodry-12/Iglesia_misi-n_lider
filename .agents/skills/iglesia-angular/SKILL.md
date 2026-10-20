---
name: iglesia-angular
description: Desarrollar la aplicación Angular de Misión Líder París con PrimeNG, tokens compartidos y especificaciones locales; usar para componentes, rutas, formularios y diseño público o por sedes.
---

# Angular de Iglesia Misión Líder París

Antes de crear o cambiar UI lee [stack vigente](../../../docs/frontend-stack.md), [contrato de diseño](../../../docs/design-system.md), [arquitectura](../../../docs/architecture.md) y la spec del incremento. [ADR 0003](../../../docs/adr/0003-primeng-design-system.md) sustituye la elección histórica de Material.

El stack es Angular 21, TypeScript estricto, PrimeNG 21.1.10, @primeuix/themes 2.0.3, Tailwind 4, SCSS, Design Tokens, Lucide, Signals y Reactive Forms. Versiones/licencias en [política de dependencias](../../../docs/ui-dependencies.json). No instalar otro kit visual, versiones LTS comerciales o actualizar a latest por defecto. CDK permanece como dependencia técnica de PrimeNG.

Los valores visuales se definen en `frontend/src/styles/tokens.css`. El preset `core/theme/primeng-preset.ts` conecta PrimeNG y `styles/tailwind.css` conecta Tailwind a esos tokens. No duplicar colores en componentes. Usar el preset y APIs públicas de PrimeNG; no selectores internos ni ::ng-deep. Tailwind se procesa en CSS separado de SCSS y sus clases deben estar completas. Importar iconos Lucide individualmente; los iconos de fuente existentes son compatibilidad heredada.

Para portada de imágenes usar Galleria; Slider selecciona números y Carousel sirve listas deslizantes cuando corresponda. Elegir el componente según el comportamiento de la spec. Preservar pausa, foco, teclado, movimiento reducido y controles táctiles. No recrear widgets cubiertos por PrimeNG ni crear wrappers vacíos de todo su catálogo.

Trabajar en `frontend/` con standalone, OnPush, rutas diferidas por funcionalidad, signals para interacción y formularios reactivos tipados. Header/footer pertenecen al layout público único. Contenido compartido en `core/content`; contenido editorial estático en su sección. Recursos propios y editables en `frontend/public/assets/`, servidos en `/assets/` y verificados por `scripts/check-assets.mjs`; no son copias generadas. La referencia HTML anterior solo está en `docs/reference/legacy-site.zip` (ADR 0004); no recrearla en la raíz ni ejecutar jQuery/Glider en Angular.

Para formularios: validar valores actuales al enviar, bloquear solo durante envío, confirmar éxito después de respuesta, preservar datos ante fallo y reiniciar validación tras éxito. El correo usa un adaptador inyectable; no enviar mensajes reales como comprobación técnica.

La prioridad es el sitio público. Autenticación/CRUD requieren un incremento posterior. Para administración leer [contrato de acceso](../../../docs/administration.md): sesión nula por defecto, capacidades por sede y autorización en servidor. No crear usuarios ficticios ni habilitar gestión simulada. Conservar donación manual y QR original; no inventar vigencia de contactos, doctrina, horarios o eventos.

Instrucción vigente: no crear, modificar ni ejecutar pruebas unitarias; el usuario las retomará después. Evitar formateadores que reescriban archivos de pruebas. Ejecutar build, checks de specs/dependencias/skills/formato y revisión visual pertinente. Registrar evidencia y límites; no presentar build como cobertura unitaria ni como entrega real de correo.
