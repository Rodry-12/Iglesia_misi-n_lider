# Arquitectura Angular

La prioridad vigente es el sitio público (spec 004). Su organización y las reglas para nuevas páginas se describen en [arquitectura pública](public-site-architecture.md). La administración y la autenticación real se retomarán después.

La base incluye administración por sedes (spec 003). El stack vigente es Angular 21 + PrimeNG 21 + Tailwind 4 + SCSS + tokens + Lucide; [ADR 0003](adr/0003-primeng-design-system.md) sustituye Material. Consultar [sistema de diseño](design-system.md), [stack](frontend-stack.md) y [administración](administration.md).

## Organización

```text
frontend/
  public/assets/            # Recursos propios versionados; no son generados
  src/
    app/
      core/content/         # Modelos y contenido institucional público
      layout/
        public/             # Layout público persistente, header, footer y marca
        admin-layout/       # Base del área interna futura
      features/
        public/
          public.routes.ts  # Rutas institucionales diferidas
          home/sections/    # Bienvenida, misión/visión y horarios
          donations/        # Instrucciones y QR
          contact/          # Canales de contacto; formulario en spec 002
          not-found/        # Ruta desconocida
        access/             # Entrada existente; autenticación pendiente
        administration/    # Base futura conservada
      app.ts                # Contenedor de navegación
      app.routes.ts         # Rutas con carga diferida
      app.config.ts         # Proveedores de aplicación
    styles.scss             # Base global mínima
    styles/_public-site.scss # Estilos comunes delimitados al sitio público
backend/                    # Reservado, vacío salvo .gitkeep
specs/                      # Contratos de comportamiento y evidencia
docs/                       # Contexto, decisiones y operación
scripts/                    # Generación y comprobación SDD
.agents/skills/             # Instrucciones reutilizables del repositorio
```

Cada funcionalidad incorpora componentes, servicios y pruebas cuando los necesita. No crear capas vacías o servicios que solo envuelvan constantes. Extraer a `shared/` únicamente elementos con reutilización real entre funcionalidades.

La aplicación raíz contiene un outlet. `PublicLayout` conserva el sitio público y `AdminLayout` proporciona la navegación de gestión. `core/auth` define sesión/capacidades; `core/navigation` enumera módulos; `core/theme` mantiene el tema. `shared/ui` y `shared/forms` contienen elementos reutilizados por gestión y guía visual.

Finanzas (`finance`), Miembros (`members`), Formación (`training`), Sedes (`sites`) y Usuarios (`users`) son entradas diferidas de preparación, no módulos de negocio completos. El área `/gestion` no se carga sin sesión. `/diseno` es una guía visual pública sin datos operativos.

## Convenciones

- Componentes standalone, `ChangeDetectionStrategy.OnPush`, inyección con `inject` cuando corresponde y tipos estrictos.
- Estado local con signals cuando exista interacción; no añadir un almacén global para contenido estático.
- Rutas diferidas mediante `loadComponent`; las URLs públicas se mantienen en español.
- Formularios reactivos tipados para el futuro formulario, con validación al enviar y estado `idle | sending | success | error`.
- No ejecutar scripts heredados ni importar jQuery en Angular. Sustituir interacciones por componentes y bindings.
- Usar HTML semántico, botones de menú accesibles, navegación por teclado y respeto a movimiento reducido.
- Contenido público centralizado en `core/content`. Horarios y destinatarios deben confirmarse antes de una puesta en producción.

## Recursos

Los hooks `prestart`, `prebuild` y `prewatch` ejecutan `scripts/check-assets.mjs`. Verifican referencias a `frontend/public/assets/`, que es la fuente incluida en el repositorio. Publica imágenes en `/assets/images/`, fondos en `/assets/backgrounds/` y fuentes/licencias locales. La compilación ya no depende de carpetas heredadas de la raíz.

Editar los recursos directamente en `frontend/public/assets/` y ejecutar `npm run assets:check`. La referencia original está comprimida y verificada en `docs/reference/`; su extracción sirve solo para comparar. Consultar [ADR 0004](adr/0004-single-angular-workspace.md). El backend permanece vacío; no se eligió un framework ni se implementó Express.

No copiar los CSS globales originales a la aplicación: contienen selectores generales e interacciones dependientes del DOM que requieren adaptación.

## Hosting y renderizado

Esta base usa renderizado cliente y una compilación estática en `frontend/dist/iglesia-web/browser`. La única configuración `firebase.json` reescribe rutas a `index.html`; no publica la raíz del repositorio.

La paridad de metadatos y el SEO de contenido renderizado se evaluarán antes del lanzamiento. No se ha configurado SSR, prerender ni servidor Express. La base no implica que el SEO del sitio original esté completamente migrado.

## Servicios externos

La spec 002 propone un adaptador de envío inyectable para EmailJS. Las pruebas usarán un proveedor falso controlable; no llamarán a EmailJS, WhatsApp ni al banco. Una clave pública del cliente puede aparecer en el bundle; credenciales de servidor no deben hacerlo.
