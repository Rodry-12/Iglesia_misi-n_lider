# 005 — public-html-parity

Estado: En curso.

## Problema y resultado esperado

Corregir la migración pública incompleta: Angular debe recuperar las secciones, imágenes, slider, tipografías y distribución del HTML original. La estructura resumida previa no era una migración visual y omitió contenido institucional.

## Alcance y exclusiones

Restaurar inicio completo, navegación, footer, WhatsApp, donaciones y formulario con estados fiables. Mantener la estructura de componentes, recursos locales, accesibilidad e Iniciar sesión. No introducir autenticación o administración. El contenido original no demuestra vigencia de horarios/eventos ni funcionamiento externo del correo.

## Requisitos

- FR-001: Recuperar las tres imágenes de bienvenida en un slider Angular con controles, indicadores, rotación de 3 s y pausa por interacción/movimiento reducido.
- FR-002: Recuperar comunidad, misión/visión, creencias, valores, pastores, cinco ministerios, horarios, evento y contacto con contenido original.
- FR-003: Restaurar distribución, colores, escala tipográfica, imágenes y footer en columnas; adaptar los estilos al ámbito público sin cambiar rem global o ejecutar jQuery/Glider.
- FR-004: Conservar enlaces, WhatsApp y donación manual; mantener Iniciar sesión como entrada futura y navegación usable en móvil.
- FR-005: Restaurar formulario con Reactive Forms y adaptador de EmailJS: validación al enviar, éxito tras confirmación, fallo que conserva datos y protección contra duplicados. No enviar correo real durante pruebas.
- FR-006: Verificar con build, pruebas y navegador de escritorio/móvil; documentar diferencias con la referencia, sin afirmar paridad exacta no comprobada.

## Aceptación

- AC-001: El slider muestra las tres imágenes originales, avanza y retrocede, permite selección y pausa y no deja temporizadores al destruirse.
- AC-002: Todas las secciones y sus textos/imágenes de la referencia aparecen en Angular; ministerios y horarios se pueden explorar sin depender exclusivamente de hover.
- AC-003: Footer en columnas en escritorio y apilado en móvil, sin desbordamiento; imágenes locales cargadas y navegación/contactos funcionales.
- AC-004: El formulario no anuncia éxito pendiente o fallido, conserva datos en error, permite reintento y no envía un segundo formulario vacío tras éxito.
- AC-005: Build y comprobaciones aplicables correctos; comparación visual y pruebas de navegador registradas con sus límites.

## Escenarios y dudas

La fecha del evento y los horarios se conservan como aparecen en la referencia, sin inventar año o vigencia. Se reutiliza únicamente la configuración pública de EmailJS existente; la disponibilidad del proveedor queda fuera de la comprobación local. Las pruebas simulan la entrega y no envían datos a terceros.
