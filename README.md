# Iglesia Misión Líder París

Aplicación Angular desarrollada con Spec-Driven Development. El stack vigente es **Angular 21 + PrimeNG 21 + Tailwind CSS 4 + SCSS + Design Tokens + Lucide**, Signals y Reactive Forms. Consultar [el contrato de diseño](docs/design-system.md) y [ADR 0003](docs/adr/0003-primeng-design-system.md).

```text
frontend/        Aplicación Angular y sus recursos propios
backend/         Reservado; vacío salvo .gitkeep, sin implementación
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

Abrir [http://localhost:4200](http://localhost:4200). VS Code: perfil `Angular: Chrome`. La entrada HTML es `frontend/src/index.html`; las páginas y componentes viven en `frontend/src/app/`. No utilizar Live Server ni el antiguo puerto 8080 para Angular.

```powershell
npm run assets:check
npm run design:check
npm run deps:check
npm run skills:check
npm run spec:check
npm run format:check
npm run build
```

Las pruebas unitarias están diferidas por instrucción del usuario: no crearlas, modificarlas ni ejecutarlas hasta que se retomen. Sus herramientas y archivos se conservan para ese incremento. No ejecutar un formateador que reescriba sus archivos.

## Sitio público

Rutas `/`, `/donar`, `/contacto` y página 404. Header y footer compartidos; portada con Galleria. En escritorio el header es transparente al inicio y negro al superar 80 px de scroll; interiores y móvil mantienen contraste. Iniciar sesión enlaza a `/acceso`, sin autenticación real. `/gestion` deniega acceso sin proveedor de sesión. Finanzas, Miembros, Formación, Sedes y Usuarios conservan únicamente su preparación futura.

La guía `/diseno` muestra los tokens y controles PrimeNG. Los valores se definen en `frontend/src/styles/tokens.css`; el preset PrimeNG y Tailwind los comparten. El contenido institucional está en `core/content` y las secciones editoriales. No inventar vigencia de datos, eventos o QR.

## Recursos y limpieza

`frontend/public/assets/` es la fuente de recursos, incluida en el repositorio. Se edita directamente; no se regenera desde carpetas de la raíz. Los hooks de inicio/build verifican referencias mediante `scripts/check-assets.mjs`.

El sitio HTML/Express anterior fue retirado de la estructura activa tras verificar su copia en [la referencia comprimida](docs/reference/README.md). Se conservaron los recursos utilizados byte a byte, incluido el QR. `backend/` no contiene servidor, framework ni dependencias. [ADR 0004](docs/adr/0004-single-angular-workspace.md) documenta la estructura final.

## Documentación

- [Arquitectura](docs/architecture.md) y [arquitectura pública](docs/public-site-architecture.md).
- [Desarrollo y publicación](docs/development.md).
- [Sistema de diseño](docs/design-system.md) y [stack frontend](docs/frontend-stack.md).
- [Flujo SDD](docs/spec-driven-development.md) y [ruta de trabajo](docs/migration-roadmap.md).
- [Administración futura](docs/administration.md).
- [Cierre y limpieza](specs/007-public-finalization-cleanup/spec.md).

Skills: [iglesia-angular](.agents/skills/iglesia-angular/SKILL.md) e [iglesia-sdd](.agents/skills/iglesia-sdd/SKILL.md). Las decisiones históricas se conservan como evidencia; las instrucciones vigentes apuntan a la estructura actual. El build no acredita entrega real de EmailJS, validez bancaria ni publicación en producción.
