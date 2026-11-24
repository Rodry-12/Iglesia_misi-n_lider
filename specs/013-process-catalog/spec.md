# 013 — HU-007 Catálogo de procesos ministeriales

Estado: Verificada en entorno aislado. Fuente: HU-007 del usuario, 2026-11-07. Aceptación Supabase pendiente.

## Alcance

Catálogo global categoría → procesos dentro de /gestion/formacion. Consulta, creación, edición y estado con API existente; sin asignaciones individuales, borrado, historiales, DDL, migraciones, Supabase, bootstrap, 090 ni cambios al contexto firmado.

## Contrato transversal de UI

Aplicar docs/design-system.md, docs/frontend-stack.md y ADR 0003: PrimeNG 21, Signals, OnPush, Reactive Forms, control flow moderno y tokens existentes. Pruebas autorizadas por HU.

## Requisitos

- FR-001: Consultar categorías con CATEGORY_VIEW y procesos con PROCESS_VIEW por separado. Permisos de lectura no conceden escritura ni asignación.
- FR-002: Crear con CATEGORY_CREATE/PROCESS_CREATE y modificar/estado con CATEGORY_UPDATE/PROCESS_UPDATE, siempre con alcance global conforme a API. No agregar sede_id ni nuevos permisos.
- FR-003: Campos reales: id, nombre, descripcion, orden, activa/activo, fecha_creacion/actualizacion y categoria_id en proceso. UUID/fechas/estado solo lectura en formularios; estado mediante operación independiente. Longitudes: nombre150 y descripción4000 según DTO; orden entero0..2147483647.
- FR-004: Respetar UNIQUE nombre categoría y (categoria_id,nombre) proceso, comparación PostgreSQL existente; no inventar códigos. Categoría destino activa; cambiar categoría está permitido por backend, conserva asignaciones por UUID. Baja conserva procesos/asignaciones, sin cascada de estados.
- FR-005: Búsqueda/filtros/paginación del servidor independientes y persistidos en URL, selección de categoría, fichas completas, formularios precargados, cancelación de borrador, envíos únicos, confirmación de bajas y manejo de sesión/errores.
- FR-006: Fechas DTO aditivas y categoría contextual del proceso; no inferir conteos desde páginas parciales. Sin contador si la API no ofrece agregado.
- FR-007: Opciones de categoría activas se recuperan paginando, sin truncar a primera página; sin sesión simulada ni datos iniciales ficticios.

## Aceptación

- AC-001: Contratos/seguridad/validez/duplicados/relaciones y concurrencia verificados en PostgreSQL aislado.
- AC-002: Angular usa API real, CRUD/estado de ambas entidades, permisos separados, validación, borrador, filtros y limpieza; unitarias y E2E controlados.
- AC-003: Recorrido real HTTPS desktop/mobile sobre PostgreSQL aislado y compilaciones/checks/revisión visual.

## Decisiones

El backend permite desactivar categorías/procesos con asignaciones abiertas sin alterarlas. isActive=true de procesos excluye también categorías inactivas; sin filtro se muestra estado propio y estado de categoría. La administración global no se habilita a sedes aunque tengan códigos CREATE/UPDATE. La búsqueda de categorías y procesos ignora mayúsculas, tildes y composición Unicode antes de paginar, según corrección del usuario del 2026-11-22. Se conserva la unicidad literal de los datos. No hay versión esperada de catálogo: bloqueos serializan operaciones; no se promete detección de formularios obsoletos.

- FR-007 (2026-11-22, correccion vigente del usuario): Formacion es una portada sin listados ni consultas de catalogo y contiene cuatro modulos: Categorias, Procesos, Seguimiento y Asignar proceso. Sidebar abre los respectivos modulos, no solo formularios sueltos. Categorias en /gestion/formacion/categorias muestra unicamente su listado y accion Crear categoria; Procesos en /gestion/formacion/procesos muestra su listado y Crear proceso. Creacion conserva alcance global. Seguimiento y Asignar reutilizan sus rutas/pantallas. Regresos y cancelacion vuelven al catalogo especifico; Ver procesos de una categoria abre Procesos filtrado. Cada listado solo consulta su API aunque el usuario tenga ambos permisos. Mantener submenu, teclado, enlace activo y vista movil sin cambiar autorizacion backend.

- FR-008 (2026-11-22): Categorias y Procesos siguen el patron de Sedes/Usuarios: panel de filtros con crear alineado a la derecha, busqueda tras 2000 ms sin pulsar Buscar, estado inmediato, X solo con texto, tabla con scroll y paginacion 10/20/50 al pie. Acciones accesibles por iconos (ver, editar, estado y ver procesos de categoria). Crear/editar/ver en Dialog sobre el listado, rutas directas conservadas, carga completada antes de abrir detalle/edicion, vista solo consulta sin acciones de escritura ni UUID, pie fijo Cancelar/Guardar y guard de borrador. Exitos/errores en Toast; no mostrar indicadores locales de carga duplicados.

- FR-009 (2026-11-22): Cerrar detalle o cancelar edicion sin guardar conserva el listado autorizado en memoria sin GET nuevo, siempre que coincidan tipo/filtros y exista la pagina. Guardado confirmado refresca una sola vez. Guardar permanece deshabilitado sin cambios, con campos invalidos o durante envio; se habilita con cambios validos y se deshabilita al restaurar los valores originales. Aplica a Categorias y Procesos.

- FR-010 (2026-11-22): Busqueda parcial en Procesos incluye nombre de proceso y nombre de categoria, ambos sin distinguir mayusculas/tildes, antes de contar/paginar. Categorias busca por nombre. Conservar filtros, permisos y debounce de 2s; placeholder explicita nombre o categoria en Procesos.

- FR-011 (2026-11-22): No notificar ausencia de categorias durante carga/inicializacion ni ante error. Solo avisar lista vacia tras completar satisfactoriamente todas las paginas de categorias activas.

Actualizacion 2026-11-22 (prevalece sobre FR-007 anterior de cuatro accesos): Asignar proceso se mueve al icono por persona en Miembros, mediante modal y FR-007 de specs/014-process-assignment. Formacion contiene solo Categorias, Procesos y Seguimiento; no concede PERSON_VIEW a quien solo tenga PROCESS_ASSIGN.
