# Arquitectura del sitio público

Prioridad vigente: terminar de organizar la parte pública. La autenticación y los módulos administrativos se trabajarán posteriormente.

La spec 007 cierra la limpieza y los hallazgos posteriores: header transparente en portada de escritorio hasta 80 px, negro después; 404 con referencia Firebase adaptada al layout; anclas con offset, horarios controlados por estado y contactos únicos. La aplicación anterior se conserva solo en el ZIP de `docs/reference/`; los recursos actuales se editan en `frontend/public/assets/`, sin copias desde la raíz (ADR 0004).

## Límites y responsabilidades

```text
app/
  app.routes.ts                   # Composición: gestión futura, utilidades y sitio público
  core/
    content/                      # Modelos y contenido institucional compartido
    navigation/public-navigation.ts
  layout/
    public/
      public-layout.ts/.html/.scss
      components/
        site-brand/               # Marca reutilizada en header y footer
        site-header/              # Navegación pública y enlace de acceso
        site-footer/              # Contactos, redes y copyright
    admin-layout/                 # Base futura; no forma parte del sitio institucional
  features/
    public/
      public.routes.ts
      home/
        sections/                 # Slider, comunidad, creencias, valores, pastores,
                                  # ministerios, horarios y eventos
      donations/
      contact/
      not-found/
    access/                       # Entrada de acceso existente; sin autenticación real
    administration/              # Base futura conservada
  shared/                         # UI y formularios con reutilización entre áreas
```

`App` solo contiene el outlet raíz. `PublicLayout` es el único propietario del header, del landmark `main` y del footer. Las páginas no los vuelven a incluir: al navegar entre inicio, donaciones y contacto, la misma instancia del layout permanece montada.

El header presenta exclusivamente navegación institucional y **Iniciar sesión**, que enlaza a `/acceso`. La guía `/diseno` continúa disponible por URL directa para desarrollo; no aparece en el menú del visitante. `/gestion` conserva la base protegida ya creada, sin nuevas funciones.

La página de inicio compone secciones independientes. Las colecciones dinámicas y los canales oficiales están tipados en `core/content`; `public-reference-content.ts` conserva el contenido recuperado del HTML. El contenido editorial estático permanece en las plantillas de su sección. La marca se comparte entre header y footer.

## Estilos y convenciones

Usar componentes standalone, OnPush y archivos HTML/SCSS separados para layout y páginas públicas. Las secciones reciben datos mediante inputs; no conocen servicios de administración o autenticación.

`styles/_public-site.scss` adapta el diseño original y delimita sus selectores al host `.public-site`. Normaliza las medidas rem del antiguo root de 10 px al root de 16 px sin cambiar la escala global. Paleta, tipografías y escalas están centralizadas en `styles/tokens.css`; las variables históricas son alias. PrimeNG y Tailwind consumen esos mismos tokens según [el contrato de diseño](design-system.md). DM Sans, Grape Nuts y los iconos existentes se sirven localmente con sus avisos de licencia.

La portada usa PrimeNG Galleria dentro del wrapper `WelcomeSlider`: signals coordinan pausa y selección; la rotación respeta movimiento reducido y limpia su temporizador. Los ministerios conservan scroll nativo y `details`; los horarios tienen botones además de su interacción visual. No se ejecutan jQuery ni Glider en Angular. El formulario reutilizable usa Reactive Forms y controles PrimeNG en `contact/components/`; el contrato inyectable y adaptador EmailJS viven en `contact/data-access/`.

Cada funcionalidad pública incorpora sus componentes y pruebas cerca de su implementación. Un componente específico de una sola página permanece en esa funcionalidad. Solo extraer a `shared/` cuando existe reutilización real entre áreas.

## Cómo añadir una página pública

1. Crear su carpeta en `features/public/` y su componente standalone con template y estilos propios.
2. Registrar una ruta diferida en `public.routes.ts`, con título, antes de la ruta `**`.
3. Si corresponde al menú institucional, añadir su entrada en `PUBLIC_NAVIGATION`; no copiar enlaces en cada plantilla.
4. Añadir contenido tipado y pruebas de navegación, comportamiento y composición que correspondan.
5. Actualizar la especificación y su evidencia. No incorporar header/footer dentro de la nueva página.

## Alcance de esta organización

La spec 004 organizó el layout; la spec 005 recupera el contenido omitido y corrige la presentación tomando el HTML original como referencia. Consulta [la revisión de paridad](public-html-parity.md) y su evidencia; no implica equivalencia exacta de píxeles.

La spec 005 restaura el formulario público con Reactive Forms y EmailJS; las pruebas preparadas simulan la entrega. No se implementan inicio de sesión, backend ni CRUD administrativo. La disponibilidad externa del correo y la vigencia de horarios/eventos requieren validación institucional.
