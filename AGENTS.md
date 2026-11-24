# Iglesia Misión Líder París

Activación vigente (2026-11-06): el destino operativo de la aplicación pasa a Supabase `sneceodpvscrvjrlqwgw`; no arrancar los helpers de aplicación con PostgreSQL local. La inspección 009.1 ya está completada. Preparar activación según `backend/docs/supabase-activation-2026-11-06.md`; no instalar PostgreSQL ni crear otro proyecto. Antes de cualquier modificación remota, verificar respaldo, presentar comandos/riesgos/recuperación y obtener autorización expresa. La preparación no autoriza ejecutar 001–005, aprovisionar roles ni bootstrap. Ensayos locales anteriores son evidencia histórica; no sustituyen aceptación real en Supabase.

Etapa vigente 2.1 (2026-11-06): autenticación Angular real contra la API existente, según specs/008-angular-authentication. El usuario retoma explícitamente las unitarias Angular y E2E. Esta autorización sustituye las reservas de sesión nula y pruebas diferidas de los apartados históricos siguientes. Sin CRUD nuevo ni modificaciones de Supabase productivo.

## Contexto y alcance

La spec 007 cierra el sitio público. Nuevo incremento autorizado el 2026-10-23: backend .NET 10 según `backend/specs/001-ministry-backend/` y ADR 0005. Angular conserva su entrada futura de sesión, sin integración ni nuevos módulos visuales en este incremento. Consulta `docs/public-site-architecture.md`, `docs/design-system.md` y ADR 0004/0005.

Angular vive en `frontend/`; la solución .NET está en `backend/`. Se inspeccionaron las once tablas reales de Supabase antes de mapear EF, usando Session pooler y TLS VerifyFull. Los CRUD y reportes están implementados; los scripts incrementales aún no se aplicaron en Supabase. La referencia HTML/Express anterior está archivada en `docs/reference/legacy-site.zip` y no participa en inicio/build.

El SQL ministerial recibido está conservado como texto por hash en `backend/docs/reference/`; nunca ejecutarlo ni reconstruir tablas existentes. La misma carpeta contiene ahora una captura real de metadatos y un dump real exclusivamente de estructura, obtenido de solo lectura y restaurado únicamente en una base local aislada. El bloqueo inicial IPv6 se resolvió con el pooler; no volver a solicitar credenciales por ese motivo. SQL incremental requiere revisión y no se aplica al iniciar ni en tests sobre producción.
El stack vigente por indicación explícita del usuario es Angular 21 + PrimeNG 21 + Tailwind 4 + SCSS + Design Tokens + Lucide, Signals y Reactive Forms. PrimeNG sustituye Material (ADR 0003). Consulta `docs/frontend-stack.md`, `docs/design-system.md` y `docs/administration.md` antes de crear UI.
Lee `docs/project-context.md` para conocer el inventario, las fuentes de contenido y los problemas observados.
La petición vigente se interpreta como Spec-Driven Development, confirmado por el usuario; no presupone GitHub Spec Kit.

## Cómo trabajar

- Para una funcionalidad, crea o actualiza `specs/NNN-nombre/` con `spec.md`, `plan.md`, `tasks.md` y `validation.md`. Sigue `docs/spec-driven-development.md`.
- Para backend, usa `backend/specs/NNN-nombre/` y `npm run spec:new -- nombre --backend`; las rutas de trazabilidad son relativas a backend y `spec:check` también las valida.
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
- La base de panel y contratos de autorización están autorizados por spec 003; el backend se desarrolla según ADR 0005. Mantener sesión nula por defecto en Angular hasta integrar la API real; no crear accesos simulados. Los códigos de permisos ministeriales y sus mapeos requieren datos confirmados.
- Rutas administrativas diferidas y capacidades con ámbito de sede. El backend debe aplicar esa misma autorización; ocultar enlaces no autoriza datos.
- Tailwind se compila desde CSS separado. `frontend/src/styles/tokens.css` es la fuente de valores visuales; `core/theme/primeng-preset.ts` conecta PrimeNG con esos tokens. No duplicar colores en componentes ni incorporar otro kit visual. Versiones fijadas y licencias: `docs/ui-dependencies.json` y ADR 0003.
- Cada spec de UI referencia `docs/design-system.md` e identifica componentes PrimeNG, estados, accesibilidad y comportamiento responsive antes de implementar.
- La fase de activación del 2026-10-24 retoma explícitamente las pruebas automatizadas del backend, incluidas las unitarias disponibles. Las unitarias de Angular siguen diferidas. Verificar restore/build/test .NET y la integración PostgreSQL aislada; no usar formato global que reescriba pruebas frontend.
- La configuración pública de EmailJS no es un secreto de servidor. No copiar credenciales privadas al cliente ni enviar peticiones reales en pruebas.

## Verificación y publicación

En el incremento vigente: `npm run spec:check` y `npm run build`, además de revisión visual cuando proceda. Las pruebas unitarias de Angular están diferidas por el usuario.
Para backend restaurar, compilar y ejecutar `dotnet test` sobre `backend/MisionLiderParis.slnx`: la fase de activación retoma sus unitarias. La integración necesita una base de loopback con sufijo `_tests`; registrar escenarios omitidos. No tocar datos de Supabase ni aplicar migraciones sin proceso revisado. La API no ejecuta migraciones al iniciar. Bootstrap exige conexión administrativa separada en `Database:MigrationConnectionString`.
Para cambios de UI ejecutar `npm run design:check`. Para cambios del stack ejecutar además `npm run deps:check`, `npm run skills:check` y `npm run format:check`.
Prueba comportamientos observables, especialmente navegación, envío pendiente/fallido y validación después de reiniciar formularios.
Documenta las limitaciones de pruebas y los checks no ejecutados.
`firebase.json` sirve únicamente `frontend/dist/iglesia-web/browser/`. No publicar la raíz ni la referencia archivada. Crear infraestructura o desplegar solo entra en alcance cuando se solicite. Los documentos antiguos describen etapas históricas; ADR 0004 y el README definen la estructura vigente.
