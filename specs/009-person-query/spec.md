# HU-001 — Consulta de personas

Estado: Verificada en entorno aislado; aceptación Supabase pendiente. Angular 21 + PrimeNG 21; contrato visual `docs/design-system.md` y arquitectura existente. Solo lectura en `/gestion/miembros` y ficha navegable. Sin SQL, cambios en Supabase, bootstrap ni remediación criptográfica.

- FR-001: Buscar por nombres, apellidos o documento con debounce y paginación/filtros de servidor; descartar respuestas obsoletas.
- FR-002: Listado reducido a persona, documento vigente, sede, estado y detalle. Teléfono/correo/nacimiento/UUID/fechas solo en ficha.
- FR-003: Consultar con PERSON_VIEW, sin BRANCH_VIEW, con opciones de sede limitadas al permiso efectivo; conservar 401/403/404.
- FR-004: Ficha muestra los nueve campos escalares, identificación vigente y sede. Distingue ausencia de documentos y ausencia de documento vigente; fecha de nacimiento sin desplazamiento.
- FR-005: Limpiar datos personales al perder/cambiar sesión. Guards/interceptores existentes; sin sesiones simuladas en producto.
- AC-001: Backend conserva parámetros/paginación y expone fechas, sede e indicadores documentales sin SQL; pruebas de filtros, búsqueda, permisos y personas antiguas.
- AC-002: Angular muestra listado compacto y ficha accesibles, búsqueda/filtros/paginación y navegación directa/recarga/regreso.
- Presentación vigente (2026-11-21): ficha modal con Información personal e Información ministerial. Tipo y número de documento aparecen primero dentro de Información personal, sin tarjeta ni título independiente de Identificación. No renderizar país, Información del sistema, UUID ni fechas técnicas. Compartir orden y estilo con edición, conservando documento readonly, tokens, responsive y pie persistente.
- Ajuste de consulta AC-002 (2026-11-21): el ojo abre un modal exclusivamente de lectura tras recibir el detalle; pie Cerrar, sin editar ni activar/desactivar dentro. Conservar listado, filtros, página, permisos, acceso directo y restauración del foco. El lápiz conserva edición y el tercer icono conserva activación/desactivación autorizada desde el listado.
- Ajuste AC-002 (2026-11-21): Registrar persona a la derecha con texto e icono visibles; sustituir Limpiar por X condicional; mantener permisos efectivos en acciones con iconos accesibles. Tabla con scroll interno y contador inferior; paginación compartida con los demás listados, tamaños 10/20/50 y 10 iniciales, conservando filtros y tamaño en URL.
- AC-003: Tests verifican carreras, limpieza por sesión, errores, autorizaciones y responsive; distinguir mocks, PostgreSQL aislado y aceptación remota pendiente.
- AC-004: Builds, checks SDD/diseño y pruebas pertinentes registrados; sin cambios remotos ni funcionalidades de escritura.
