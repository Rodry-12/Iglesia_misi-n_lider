# Plan — 019 branch-administration

FR-008/AC-008: usar el único LoadingOverlay global de App, sin envoltura en SitesPage.
Retirar párrafos de carga list/detail/admin redundantes. Conservar estados de list/admin,
mensajes de error,botones de reintento y busy de escrituras. Probar cargas diferidas,
concurrencia detail/admin,cancelación por navegación,ambos temas y móvil mediante
API interceptada; sin operaciones reales.

FR-007/AC-007: suscribir cambios de Reactive Forms solo en modo list. merge de
texto300ms,estado inmediato y navegaciónURL; switchMap cancela timers, URL usa
emitEvent:false y takeUntilDestroyed limpia. Consultar por ruta existente; filtros
usan replaceUrl para no añadir historia por tecla y paginación conserva historia.
Evitar navegación redundante si parámetros efectivos no cambian. BranchesStore
ya cancela lecturas anteriores. Eliminar botón y adaptar cuadrícula a dos columnas.

## Búsqueda sin tildes — 2026-11-11

FR-006/AC-006: mapear translate(text,text,text) nativa con DbFunction built-in en
MinistryDbContext, sin crear función SQL. BranchService aplica el mismo mapeo de
caracteres y upper a nombre/código/término antes de Contains, manteniendo where por
ámbito/estado y count/skip/take en servidor. Admitir marcas combinadas0300–036F.
Conservar búsqueda explícita y texto original del formulario. Verificar primero
fallo en base aislada preaprovisionada, después regresiones; reiniciar solo la API
local compilada. No instalar unaccent ni editar estructuras/índices de Supabase.

## Presentación del listado — 2026-11-11

FR-005/AC-005: conservar Table, Select, InputText, Button y Message PrimeNG, Signals,
OnPush y formularios reactivos. Añadir solo iconos Lucide individuales para nueva sede,
búsqueda y acciones. Etiquetas accesibles y títulos nativos en enlaces; no incorporar
otro sistema visual. CSS local delimitado al listado, sin editar catalog.scss compartido.
Conservar todos los handlers/condiciones y títulos de las otras tres vistas.
Filtros en una columna móvil y cuadrícula escritorio; tabla con desplazamiento dentro
de región enfocable, sin overflow del documento. Estados mediante tokens semánticos,
texto y punto decorativo; footer con conteo y controles existentes. Verificar lectura,
rutas, permisos globales/limitados y estados usando respuestas interceptadas, nunca
Supabase. Revisión estética manual final queda a cargo del usuario.

## Diseño

Reutilizar BranchService, MinistryAuthorization, MinistryDbContext y AuthDbContext separado. GET /branches/{id}/administrators añade una consulta paginada de asociaciones HU-012, exclusivamente global. No se añade almacenamiento.

Rutas /gestion/sedes, /crear, /:id y /:id/editar. SitesPage + BranchesStore; Table, Button, InputText, Select, Message y ConfirmDialog PrimeNG. Reutilizar catalog.scss y docs/design-system.md sin tokens nuevos. Estados carga/vacío/error/éxito, validación visible, etiquetas asociadas, foco inicial de cancelación en confirmación y tabla con desplazamiento en móvil. Administradores solo en detalle, enlazados a Usuarios.

## Verificación

Unitarias de autorización sin conexión; integración HTTP/EF/Identity/RLS firmada solo en la base preaprovisionada mlp_user_validation_tests; unitarias Angular con HTTP simulado; fixture Kestrel/Angular/Playwright real en escritorio y móvil contra esa misma base aislada, sin correo externo, imágenes ni trazas.

El usuario autoriza expresamente las pruebas focalizadas de HU-013; no ejecutar suites completas ni escrituras de prueba contra Supabase.

## Riesgos y decisiones

FOR UPDATE sobre sede bloqueaba la FK de Identity en otra conexión. FOR NO KEY UPDATE serializa las decisiones de sede/concesión y permite el KEY SHARE de la FK. Se adquiere por UUID ordenado; HU-012 mantiene el bloqueo desde antes de resolver las concesiones hasta después del commit Identity, y lo libera antes del correo. La transacción ministerial solo mantiene bloqueos en ese flujo: no hay dos escrituras de negocio que requieran commit distribuido. La validación posterior al bloqueo vuelve a comprobar que la sede esté activa.

Edición y estado reciben expectedUpdatedAt; BranchDto añade updatedAt. Reutilizar fecha_actualizacion como token EF y normalizar a microsegundos para devolver exactamente la versión PostgreSQL. Contrato compartido actualizado sin columna ni migración nueva. Los consumidores externos deben consultar la versión antes de escribir.

## Modales independientes y Toast — 2026-11-21

- FR-009/AC-009: listado conserva diseño,filtros,paginación y enlaces directos. Crear,Consultar,Editar usan tres componentes standalone p-dialog independientes; listado coordina apertura/resultados. BranchesStore por modal y campos/validadores compartidos. Solo global autorizado escribe; consulta limitada conserva ámbito y no pide administradores. Guard existente protege borradores también desde listado/detalle al abrir edición; no se cambian reglas de autorización.
- Crear vacío;editar precarga UUID y updatedAt actuales,envía expectedUpdatedAt,permanece abierto en409,error ovalidación. Guardado duplicado bloqueado;solo éxito cierra yrefresca listado. Cancelar/Escape advierten cambios sin guardar. Reapertura crea estado nuevo,foco accesible,viewport móvil ytema claro/oscuro. Detalle incluye administradores paginados solo global yconfirmación existente paraestado.
- FR-010/AC-010: Notifications único reutiliza MessageService,un p-toast enApp,arriba derecha debajo navbar,temas/tokens,cierre manual,5/7s,max1 mensaje ydeduplicación1500ms. Sedes notifica creación/edición/estado confirmados yfallos/conflictos/permisos;Usuarios reutiliza bus pararesultados existentes. Errores inline específicos se conservan. Sin avisos pornavegar,abrir ocerrar,sin interceptor HTTP que duplique notificaciones.
- Sin backend,SQL,Supabase,correo,permisos ni despliegues. Verificación con HTTP interceptado,ninguna escritura real.

## Corrección de consulta de Sedes — 2026-11-21

La instrucción posterior del usuario sustituye la presentación inicial del detalle: Ver es exclusivamente lectura,con un único botón Cerrar. Sin Editar,Desactivar,Reactivar,enlaces aUsuarios ni texto explicativo de administración. El p-dialog no se muestra hasta que finalicen detalle yadministradores autorizados;el overlay global informa mientras tanto. Ante error del detalle no se abre un modal vacío;se conserva Toast yretorno al listado. Edición también espera su precarga.

Administradores:lista compacta con inicial,nombre,correo yestado,contador discreto,sin enlaces ni controles Anteriores/Página/Siguientes. Hasta25 registros no se muestra ningún control adicional. Si existen más,se ofrece Ver más yse anexan páginas del endpoint existente,sin ocultar datos ni descargar todas las páginas automáticamente. Activación/desactivación se conserva exclusivamente en edición,con permiso global,confirmación yversión existente;éxito cierra/refresca.

Verificado:17 unitarias focalizadas de Sedes y20 recorridos distintos desktop/mobile (16 modales y4 overlay) aprobados,HTTP interceptado. Incluye apertura trasambas respuestas,detalle readonly,ausencia de gestión/paginador,roles,móvil,foco,estado enedición yconflicto409. La prueba de409 detectó un efecto de precarga que dependía indebidamente de errores;se separó yse verificó conservación del borrador tras actualizar la vista. Build correcto con advertencia inicial583,72kB/500kB. Sin escrituras reales,backend,SQL,imágenes niSupabase. branches-real.spec.ts adaptado pero no ejecutado. Se mantienen pendientes revisión estética del usuario yaceptación operativa autorizada.
