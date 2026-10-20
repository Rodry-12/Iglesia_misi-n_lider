# Plan 003

1. Comprobar fuentes oficiales de PrimeNG/PrimeUI, MIT de Material y metadatos npm; fijar Material/CDK 21.2.14, Tailwind/PostCSS 4.3.3, PostCSS 8.5.31 y Lucide Angular 1.59.0.
2. Mantener Tailwind en CSS y PostCSS; usar SCSS independiente para el tema Material. Compartir CSS custom properties mediante un puente de tokens. No cargar fuentes ni iconos externos.
3. Implementar selector de tema con signals, encabezado reutilizable y formulario de sede tipado sin persistencia, usados en la guía visual pública.
4. Separar layout público y administrativo. Proteger la carga administrativa y cada ruta hija; modelar capacidades con ámbito de sede. Inyectar una sesión de solo lectura que por defecto es nula.
5. Añadir entradas diferidas de los cinco módulos, explícitamente preparatorias. No inventar miembros, saldos ni sedes operativas.
6. Probar formulario, temas, rutas, ausencia de permisos, navegación y aislamiento entre sedes. Comprobar build, CSS y licencias instaladas.
7. Actualizar documentación y skills con el alcance expresamente ampliado por el usuario. Registrar autenticación y CRUD como trabajo posterior.
