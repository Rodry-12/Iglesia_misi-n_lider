# Plan 003

FR-013/AC-010: HttpActivity y httpActivityInterceptor antes de authInterceptor para
incluir preparación CSRF sin carreras. begin/finalize por suscripción, sin URLs ni
datos persistidos. LoadingOverlay común con active opcional y blocking:false por
defecto; montaje único en App con blocking/fullscreen:true recibe contador automáticamente.
Proyecta router-outlet y aplica inert a todo el contenido; fixed inset0 y token z-loading
por encima de diálogos. No crear overlays en layouts o páginas. Umbral150ms
sin duración mínima ficticia; timers/supresión/foco se limpian al destruir. Theme
ProgressSpinner registrado, PT público para verde constante y movimiento reducido.

FR-012 / AC-009: incorporar BranchName opcional en ResolvedGrant usando la consulta
existente de sedes activas en MinistryDirectory. Sin nuevas peticiones ni permisos.
La presentación toma la primera concesión con sede, contempla alcance global y usa «Sede
autorizada» con API anterior sin nombres. Mantener OnPush/Signals, Menu/Button
PrimeNG, tokens claro/oscuro y ajuste de texto en móvil. Permisos: h4 en negrita,
li con borde/fondo/padding por tokens. Verificar sesión, ámbitos y navegador
interceptado sin datos reales. La API necesita ejecutar el binario actualizado.

## Corrección de presentación — 2026-11-09

FR-011/AC-009: retirar imagen e import de marca del layout; menú visible inicialmente
en escritorio y cerrado en móvil según matchMedia, conservando el estado al alternar.
Permitir toggle siempre y colapsar la columna de grid. El enlace cierra solo en móvil;
Escape cierra con foco al botón. Header con padding reducido, tema compacto mediante
input opt-in (otras pantallas conservan el control completo), avatar32px y acciones44px.
Plantilla item de Menu PrimeNG con etiqueta centrada. Diccionario puro de24 permisos
para presentación compartida resumen/Usuarios; optionValue sigue id. Suprimir Panel
de detalle técnico y UUID del resumen sin introducir nuevas consultas para nombres.

## Ajuste navbar — 2026-11-09

FR-010/AC-008: sticky top0 con --ml-z-header; scroll de página sin contenedor interno
para main. Sidebar desktop sticky100dvh con overflow-y:auto, solo aparece scrollbar
si el menú lo necesita. En móvil se conserva el desplegable en flujo. Ajustar colores
con brand800/700/600 existentes. AccountMenu encapsula únicamente presentación y
Menu PrimeNG standalone con appendTo=body; logout delega a AuthStore sin cambios.
Verificar las cinco rutas con espacio sintético de scroll y todas las API interceptadas.

## Incremento UX/UI administrativo — 2026-11-09

FR-008/009, AC-007. Reutilizar Angular standalone/Signals/OnPush, PrimeNG Button/Panel,
ThemeToggle y PageHeading, con tokens y Lucide. Layout compartido con sidebar oscuro,
marca existente y header adaptable; menú móvil en flujo, sin overlay permanente,
Escape devuelve foco. Resumen con cuatro tarjetas derivadas de AuthStore, accesos
del filtro ADMIN_NAVIGATION existente y capacidades técnicas agrupadas a demanda.
Extraer solo iconografía compartida y etiquetas de rol (presentación, no seguridad).
Sin endpoints nuevos, cargas HTTP adicionales, dependencias o cambios de formularios.
Verificar múltiples concesiones, conteo único, restricciones, estados sin sesión,
teclado, temas y overflow en escritorio/tablet/móvil con API interceptada.

1. Comprobar fuentes oficiales de PrimeNG/PrimeUI, MIT de Material y metadatos npm; fijar Material/CDK 21.2.14, Tailwind/PostCSS 4.3.3, PostCSS 8.5.31 y Lucide Angular 1.59.0.
2. Mantener Tailwind en CSS y PostCSS; usar SCSS independiente para el tema Material. Compartir CSS custom properties mediante un puente de tokens. No cargar fuentes ni iconos externos.
3. Implementar selector de tema con signals, encabezado reutilizable y formulario de sede tipado sin persistencia, usados en la guía visual pública.
4. Separar layout público y administrativo. Proteger la carga administrativa y cada ruta hija; modelar capacidades con ámbito de sede. Inyectar una sesión de solo lectura que por defecto es nula.
5. Añadir entradas diferidas de los cinco módulos, explícitamente preparatorias. No inventar miembros, saldos ni sedes operativas.
6. Probar formulario, temas, rutas, ausencia de permisos, navegación y aislamiento entre sedes. Comprobar build, CSS y licencias instaladas.
7. Actualizar documentación y skills con el alcance expresamente ampliado por el usuario. Registrar autenticación y CRUD como trabajo posterior.
