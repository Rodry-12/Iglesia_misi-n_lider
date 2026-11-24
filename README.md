# Iglesia Misión Líder París

Aplicación Angular desarrollada con Spec-Driven Development. El stack vigente es **Angular 21 + PrimeNG 21 + Tailwind CSS 4 + SCSS + Design Tokens + Lucide**, Signals y Reactive Forms. Consultar [el contrato de diseño](docs/design-system.md) y [ADR 0003](docs/adr/0003-primeng-design-system.md).

```text
frontend/        Aplicación Angular y sus recursos propios
backend/         API .NET 10, Identity, CRUD ministeriales, reportes y specs
docs/            Arquitectura, decisiones y referencia original comprimida
specs/           Requisitos, planes, tareas y evidencia SDD
scripts/         Comprobaciones y revisiones locales
.agents/skills/  Instrucciones de desarrollo y SDD
.vscode/         Inicio y depuración de Angular
firebase.json    Hosting de la salida compilada de Angular
```

## Ejecutar

Desde la raíz:

```powershell
npm ci --prefix frontend
npm start
```

Abrir [https://localhost:4200](https://localhost:4200). El proxy HTTPS `/api` apunta a `https://localhost:7243` con validación TLS; consultar [el arranque de autenticación](docs/angular-authentication.md) para certificados y configuración local. VS Code: perfil `Angular: Chrome`. La entrada HTML es `frontend/src/index.html`.

```powershell
npm run assets:check
npm run design:check
npm run deps:check
npm run skills:check
npm run spec:check
npm run format:check
npm run build
```

La etapa 2.1 del 2026-11-06 retoma explícitamente unitarias Angular y E2E; las pruebas backend siguen autorizadas. Ejecutar `npm --prefix frontend test -- --watch=false` y `npm run test:e2e`. Las pruebas con API interceptada y las de cuenta local real se registran por separado.

## Backend

La solución ASP.NET Core 10 está en [backend/](backend/README.md), con Identity, cookies/CSRF/CORS, cuentas, CRUD ministeriales, asignaciones, reportes, OpenAPI y CI. Se inspeccionaron y mapearon las once tablas reales de Supabase antes de implementar EF; las verificaciones persistentes usan PostgreSQL local con RLS. **Los scripts incrementales todavía no se aplicaron en Supabase**. Angular integra la autenticación real según [la etapa 2.1](docs/angular-authentication.md). Consultar [su especificación](backend/specs/001-ministry-backend/spec.md), [evidencia](backend/specs/001-ministry-backend/validation.md) y [aplicación revisable](backend/docs/database-rollout.md).

Desde `backend/`: `dotnet restore MisionLiderParis.slnx --locked-mode`, `dotnet build MisionLiderParis.slnx -c Release` y `dotnet test MisionLiderParis.slnx -c Release`. La [activación local](backend/docs/activation-review.md) verificó 41 unitarias, 27 integraciones, respaldo/restauración, bootstrap y login HTTPS. Desde la raíz, `npm run spec:check` valida también `backend/specs/`; `npm run spec:new -- nombre --backend` crea una spec en ese ámbito.

## Sitio público

Rutas `/`, `/donar`, `/contacto` y página 404. Header y footer compartidos; portada con Galleria. En escritorio el header es transparente al inicio y negro al superar 80 px de scroll; interiores y móvil mantienen contraste. `/acceso` usa Identity real mediante la API; `/gestion` exige sesión verificada y muestra sus concesiones. Los módulos de negocio conservan su preparación sin CRUD.

La guía `/diseno` muestra los tokens y controles PrimeNG. Los valores se definen en `frontend/src/styles/tokens.css`; el preset PrimeNG y Tailwind los comparten. El contenido institucional está en `core/content` y las secciones editoriales. No inventar vigencia de datos, eventos o QR.

## Recursos y limpieza

`frontend/public/assets/` es la fuente de recursos, incluida en el repositorio. Se edita directamente; no se regenera desde carpetas de la raíz. Los hooks de inicio/build verifican referencias mediante `scripts/check-assets.mjs`.

El sitio HTML/Express anterior fue retirado de la estructura activa tras verificar su copia en [la referencia comprimida](docs/reference/README.md). Se conservaron los recursos utilizados byte a byte, incluido el QR. [ADR 0004](docs/adr/0004-single-angular-workspace.md) documenta esa limpieza y [ADR 0005](docs/adr/0005-dotnet-ministry-backend.md) incorpora el nuevo incremento de backend.

## Documentación

- [Arquitectura](docs/architecture.md) y [arquitectura pública](docs/public-site-architecture.md).
- [Desarrollo y publicación](docs/development.md).
- [Sistema de diseño](docs/design-system.md) y [stack frontend](docs/frontend-stack.md).
- [Flujo SDD](docs/spec-driven-development.md) y [ruta de trabajo](docs/migration-roadmap.md).
- [Administración futura](docs/administration.md).
- [Cierre y limpieza](specs/007-public-finalization-cleanup/spec.md).

Skills: [iglesia-angular](.agents/skills/iglesia-angular/SKILL.md) e [iglesia-sdd](.agents/skills/iglesia-sdd/SKILL.md). Las decisiones históricas se conservan como evidencia; las instrucciones vigentes apuntan a la estructura actual. El build no acredita entrega real de EmailJS, validez bancaria ni publicación en producción.
