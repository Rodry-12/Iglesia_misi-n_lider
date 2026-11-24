# 019 — branch-administration

Estado: implementación local en validación. HU-013, 2026-11-09. Sin autorización para escrituras en Supabase ni publicación Cloudflare.

## Problema y resultado esperado

Administrar sedes desde Angular reutilizando BranchService, las tablas ministeriales y las concesiones de HU-012, con escrituras exclusivamente globales y sin dejar dependencias operativas inconsistentes.

## Alcance y exclusiones

Listado, filtros y paginación, detalle, registro, edición, estado lógico y consulta paginada de administradores. Sin traslados, borrado físico, cuentas nuevas automáticas, SQL, migraciones, cambios de RLS, HMAC, Gmail ni despliegue público.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-008/AC-008 (2026-11-21,corrección del usuario): reutilizar overlay global de App:
  cubre todo el viewport y centra indicador durante cualquier petición propia.
  Sin overlays locales ni textos Cargando sedes/Cargando administradores duplicados.
  Guardar conserva busy/disabled/loading existentes, crear sin fetch no se
  bloquea. Sin tocar lógica HTTP, stores, permisos, backend ni datos reales.

- FR-007 (2026-11-11): búsqueda automática al escribir tras300ms de pausa; estado
  aplica inmediatamente. Sin botón Buscar; Enter sigue permitido. Cambiar filtros
  vuelve a página1, sin consultas session ni peticiones por cada tecla. Mantener
  URL/recarga/paginación, cancelar búsqueda pendiente al navegar y suscripciones
  al destruir. Sustituye la búsqueda explícita de FR-005, sin cambiar backend.

- FR-006 (2026-11-11): buscar sedes por nombre/código sin distinguir mayúsculas,
  acentos latinos, diéresis o ñ/n, incluyendo marcas Unicode combinadas. Aplicar
  normalización de comparación en PostgreSQL antes de conteo/paginación, conservando
  texto guardado, filtros de estado, ámbito y coincidencia literal de %/_. Sin
  extensiones, migraciones ni escrituras remotas. Esta petición amplía el incremento
  visual anterior con una corrección funcional limitada a la búsqueda de sedes.

- FR-005 (2026-11-11): mejorar exclusivamente el listado /gestion/sedes siguiendo
  docs/design-system.md. Superficies compactas, acción «Nueva sede» global, filtros
  explícitos, tabla Código/Nombre/Estado/Acciones, estados con texto, iconos accesibles
  y paginación existente. No cambiar store, API, permisos, layout compartido ni vistas
  de creación/edición/detalle. Usar tokens claros/oscuros y scroll contenido en móvil.

- FR-001: Reutilizar GET/POST/PUT /api/v1/branches; crear/editar/cambiar estado exige SUPER_ADMIN global efectivo. Consulta exige BRANCH_VIEW por sede. Campos reales: código20, nombre150, dirección250 y teléfono30; unicidad solo por código.
- FR-002: Desactivación rechaza vínculos vigentes, procesos no finales y cualquier concesión existente. No hay flag activo/vencimiento en concesiones: incluso una cuenta desactivada conserva su vínculo y bloquea la baja. No se revocan permisos ni se cambian personas automáticamente.
- FR-003: Conservar fecha_actualizacion y usarla como versión esperada para edición/estado; rechazo 400 sin versión y 409 si cambió. Coordinación con creación y sustitución de concesiones mediante bloqueos compartidos de fila hasta el commit Identity; sin transacción distribuida ni cambios estructurales.
- FR-004: Angular standalone, Signals, OnPush, formularios reactivos, PrimeNG y control flow moderno; HTTP únicamente en BranchesStore. Tabla Código/Nombre/Estado/Acciones; detalle separado y administradores solo para globales, sin N+1.

## Aceptación

- AC-007: navegador verifica una consulta por escritura rápida, estado inmediato,
  limpiar texto, primera página, errores/reintento y ausencia de session repetida.

- AC-006: integraciones PostgreSQL aisladas reproducen fallo y verifican búsquedas
  paris/París/PARIS y Unicode combinado, conteo/página, nombre original, código,
  ámbito, estado y caracteres literales. API local actualizada sin cambios de datos.

- AC-005: listado legible en escritorio/tablet/móvil y temas claro/oscuro, sin overflow
  de página; enlaces/iconos accesibles mantienen rutas/visibilidad global, filtros
  conservan búsqueda explícita y paginación. Verificar carga/error/vacío con API
  interceptada, compilación y checks, sin escrituras reales.

- AC-001: CRUD validado y escrituras rechazadas a BRANCH_ADMIN y OPERATOR aun con BRANCH_UPDATE; datos y UUID se conservan.
- AC-002: Dependencias bloquean la baja; versiones obsoletas y carreras entre concesiones/estado no producen sobrescrituras ni concesiones nuevas sobre sedes inactivas.
- AC-003: Angular permite listado, formularios, detalle y estado con confirmación según autorización; casos dirigidos y recorrido HTTPS contra PostgreSQL aislado.
- AC-004: Aceptación operativa manual contra Supabase con datos autorizados; pendiente y no implícitamente autorizada por las pruebas aisladas.

## Escenarios y dudas

No se incorpora unicidad por nombre ni municipio. La exclusividad global se aplica en la API; las políticas RLS históricas siguen aislando por sede, sin modificación remota. Los bloqueos coordinan los escritores de aplicación; no controlan DML administrativo externo, que requiere mantenimiento supervisado. No se agrega un historial de auditoría: se conservan las fechas existentes. Véase validation.md para resultados y límites.

## Modales independientes y Toast — 2026-11-21

- FR-009/AC-009: listado conserva diseño,filtros,paginación y enlaces directos. Crear,Consultar,Editar usan tres componentes standalone p-dialog independientes; listado coordina apertura/resultados. BranchesStore por modal y campos/validadores compartidos. Solo global autorizado escribe; consulta limitada conserva ámbito y no pide administradores. Guard existente protege borradores también desde listado/detalle al abrir edición; no se cambian reglas de autorización.
- Crear vacío;editar precarga UUID y updatedAt actuales,envía expectedUpdatedAt,permanece abierto en409,error ovalidación. Guardado duplicado bloqueado;solo éxito cierra yrefresca listado. Cancelar/Escape advierten cambios sin guardar. Reapertura crea estado nuevo,foco accesible,viewport móvil ytema claro/oscuro. Detalle incluye administradores paginados solo global yconfirmación existente paraestado.
- FR-010/AC-010: Notifications único reutiliza MessageService,un p-toast enApp,arriba derecha debajo navbar,temas/tokens,cierre manual,5/7s,max1 mensaje ydeduplicación1500ms. Sedes notifica creación/edición/estado confirmados yfallos/conflictos/permisos;Usuarios reutiliza bus pararesultados existentes. Errores inline específicos se conservan. Sin avisos pornavegar,abrir ocerrar,sin interceptor HTTP que duplique notificaciones.
- Sin backend,SQL,Supabase,correo,permisos ni despliegues. Verificación con HTTP interceptado,ninguna escritura real.

## Corrección de consulta de Sedes — 2026-11-21

La instrucción posterior del usuario sustituye la presentación inicial del detalle: Ver es exclusivamente lectura,con un único botón Cerrar. Sin Editar,Desactivar,Reactivar,enlaces aUsuarios ni texto explicativo de administración. El p-dialog no se muestra hasta que finalicen detalle yadministradores autorizados;el overlay global informa mientras tanto. Ante error del detalle no se abre un modal vacío;se conserva Toast yretorno al listado. Edición también espera su precarga.

Administradores:lista compacta con inicial,nombre,correo yestado,contador discreto,sin enlaces ni controles Anteriores/Página/Siguientes. Hasta25 registros no se muestra ningún control adicional. Si existen más,se ofrece Ver más yse anexan páginas del endpoint existente,sin ocultar datos ni descargar todas las páginas automáticamente. Activación/desactivación se conserva exclusivamente en edición,con permiso global,confirmación yversión existente;éxito cierra/refresca.

Verificado:17 unitarias focalizadas de Sedes y20 recorridos distintos desktop/mobile (16 modales y4 overlay) aprobados,HTTP interceptado. Incluye apertura trasambas respuestas,detalle readonly,ausencia de gestión/paginador,roles,móvil,foco,estado enedición yconflicto409. La prueba de409 detectó un efecto de precarga que dependía indebidamente de errores;se separó yse verificó conservación del borrador tras actualizar la vista. Build correcto con advertencia inicial583,72kB/500kB. Sin escrituras reales,backend,SQL,imágenes niSupabase. branches-real.spec.ts adaptado pero no ejecutado. Se mantienen pendientes revisión estética del usuario yaceptación operativa autorizada.

### Espera de búsqueda solicitada — 2026-11-21

Texto en buscadores Sedes yUsuarios:3000ms sin nuevos caracteres antes de consultar;cada pulsación reinicia el plazo. Sedes conserva estado inmediato yUsuarios conserva selección de sede/estado350ms. Navegación cancela texto pendiente ydestrucción limpia suscripción. Sin modificar HTTP,permisos oSupabase. Build correcto;advertencia inicial583,72kB previa. Verificación focalizada de filtros mediante navegador interceptado.
