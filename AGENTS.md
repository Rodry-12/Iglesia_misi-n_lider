# Iglesia Misión Líder París

## Contexto y alcance

Prioridad vigente (spec 007): cerrar el sitio público con header/404 fieles a su referencia y una estructura limpia de frontend/backend. Iniciar sesión conserva su entrada futura; no desarrollar autenticación o módulos internos hasta un nuevo incremento. Consulta `docs/public-site-architecture.md`, `docs/design-system.md` y ADR 0004.

La única aplicación activa es Angular en `frontend/`; `backend/` está reservado, vacío salvo `.gitkeep`. La referencia HTML/Express anterior está archivada en `docs/reference/legacy-site.zip` y no participa en inicio/build.
El stack vigente por indicación explícita del usuario es Angular 21 + PrimeNG 21 + Tailwind 4 + SCSS + Design Tokens + Lucide, Signals y Reactive Forms. PrimeNG sustituye Material (ADR 0003). Consulta `docs/frontend-stack.md`, `docs/design-system.md` y `docs/administration.md` antes de crear UI.
Lee `docs/project-context.md` para conocer el inventario, las fuentes de contenido y los problemas observados.
La petición vigente se interpreta como Spec-Driven Development, confirmado por el usuario; no presupone GitHub Spec Kit.

## Cómo trabajar

- Para una funcionalidad, crea o actualiza `specs/NNN-nombre/` con `spec.md`, `plan.md`, `tasks.md` y `validation.md`. Sigue `docs/spec-driven-development.md`.
- Vincula requisitos y criterios de aceptación con los cambios y su verificación. No marques una tarea como terminada si no existe evidencia.
- Usa las skills locales `.agents/skills/iglesia-sdd/SKILL.md` y `.agents/skills/iglesia-angular/SKILL.md` según el trabajo.
- Ajustes pequeños de documentación o mantenimiento pueden actualizar una especificación existente; evita crear una especificación ceremonial por cada errata.
- La referencia original y sus hashes viven en `docs/reference/`. No recrear aplicaciones paralelas en la raíz. Los recursos fuente se editan directamente en `frontend/public/assets/`; no se regeneran ni deben ignorarse en Git. `npm run assets:check` verifica las referencias.
- Las instrucciones del usuario prevalecen sobre estas convenciones. Resolver detalles rutinarios no requiere solicitar aprobación de cada documento.

## Implementación

- Angular standalone, TypeScript estricto, SCSS y rutas por funcionalidad. Consulta `docs/architecture.md`.
- Contenido institucional en español. Los horarios, contactos, QR y nombres provienen del sitio original y requieren confirmación antes de considerarlos vigentes.
- No introducir jQuery ni scripts que manipulen globalmente el DOM en la aplicación Angular.
- Usar recursos locales; no cargar CSS, JavaScript o imágenes propios desde el dominio de producción.
- Mantener las transferencias de donaciones como proceso manual. No introducir pasarela, autenticación real o base de datos sin sus requisitos y contratos.
- La base de panel y contratos de autorización sí están autorizados por la spec 003; backend, operaciones de negocio y política definitiva de roles permanecen pendientes. Mantener sesión nula por defecto y no crear accesos simulados.
- Rutas administrativas diferidas y capacidades con ámbito de sede. El backend debe aplicar esa misma autorización; ocultar enlaces no autoriza datos.
- Tailwind se compila desde CSS separado. `frontend/src/styles/tokens.css` es la fuente de valores visuales; `core/theme/primeng-preset.ts` conecta PrimeNG con esos tokens. No duplicar colores en componentes ni incorporar otro kit visual. Versiones fijadas y licencias: `docs/ui-dependencies.json` y ADR 0003.
- Cada spec de UI referencia `docs/design-system.md` e identifica componentes PrimeNG, estados, accesibilidad y comportamiento responsive antes de implementar.
- Por instrucción vigente del usuario, no crear, modificar ni ejecutar pruebas unitarias; se retomarán después. Registrar esta limitación en la evidencia. No usar el comando de formato global si reescribe archivos de pruebas.
- La configuración pública de EmailJS no es un secreto de servidor. No copiar credenciales privadas al cliente ni enviar peticiones reales en pruebas.

## Verificación y publicación

En el incremento vigente: `npm run spec:check` y `npm run build`, además de revisión visual cuando proceda. Las pruebas unitarias están diferidas por el usuario.
Para cambios de UI ejecutar `npm run design:check`. Para cambios del stack ejecutar además `npm run deps:check`, `npm run skills:check` y `npm run format:check`.
Prueba comportamientos observables, especialmente navegación, envío pendiente/fallido y validación después de reiniciar formularios.
Documenta las limitaciones de pruebas y los checks no ejecutados.
`firebase.json` sirve únicamente `frontend/dist/iglesia-web/browser/`. No publicar la raíz ni la referencia archivada. Crear infraestructura o desplegar solo entra en alcance cuando se solicite. Los documentos antiguos describen etapas históricas; ADR 0004 y el README definen la estructura vigente.
