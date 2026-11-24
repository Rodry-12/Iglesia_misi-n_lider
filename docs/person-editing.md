# HU-003 — Edición de personas

Implementación del 2026-11-07. Especificación y evidencia: `specs/011-person-editing/`.

## Contratos reutilizados

- GET `/api/v1/people/{id}`: PERSON_VIEW efectivo; 403 sin capacidad y 404 para recurso fuera de su ámbito.
- PUT `/api/v1/people/{id}`: PERSON_UPDATE efectivo, devuelve 200 PersonDto. No concede PERSON_VIEW. La UI necesita ambas capacidades en la sede del registro para precargar/editar. Sin BRANCH_VIEW ni cambios en concesiones.
- PersonRequest conserva firstNames, lastNames, phone, email y birthDate; añade expectedUpdatedAt opcional para compatibilidad. La UI siempre envía la versión de la consulta GET, como cadena sin convertirla a Date JavaScript ni perder microsegundos.
- 400 datos inválidos, 401 sin sesión, 403 sin capacidad, 404 recurso no visible, 409 concurrent_update versión obsoleta. CSRF y cookies usan los interceptores existentes.

## Integridad y concurrencia

UUID, sede, estado y creación se conservan. El backend actualiza fecha_actualizacion; nombres y contacto se recortan, nacimiento viaja como YYYY-MM-DD con componentes locales. Teléfono es texto. El PUT no modifica documentos, vinculaciones, cuentas ni asignaciones.

La identificación se muestra solo de lectura: el POST documental existente reemplaza creando otro documento y finalizando el anterior; esa operación queda fuera de HU-003. El PUT personal no puede producir duplicados documentales ni dejar sin vigencia un documento existente. Los heredados sin documento pueden actualizar información personal sin inventar identificación ni agravar esa inconsistencia; regularización separada.

PeopleService compara expectedUpdatedAt contra la versión persistida después de tomar los bloqueos existentes. MinistryDbContext marca UpdatedAt como token EF: el UPDATE SQL incluye su valor original en WHERE, sin nueva columna. La versión siguiente se trunca a microsegundos y aumenta al menos uno respecto de la anterior. El handler existente traduce DbUpdateConcurrencyException a 409 concurrent_update. No hay reintento automático ni sobrescritura forzada; la UI conserva el borrador y exige recargar tras 409, confirmando su descarte.

Límite de compatibilidad: clientes anteriores que omitan expectedUpdatedAt conservan el comportamiento de último guardado sobre formularios obsoletos; el token EF protege cambios entre lectura y escritura del servidor. La nueva UI siempre exige versión. No se afirma protección universal para clientes antiguos ni escrituras SQL externas que no actualicen fecha_actualizacion.

## Interfaz y autorización

Ruta `/gestion/miembros/:id/editar`, accesible desde listado/ficha. Tabla conserva cinco columnas, agregando acción dentro de Acciones. Campos editables: nombres, apellidos, teléfono, correo y nacimiento. Documento, sede y estado solo texto; UUID y fechas técnicas permanecen en ficha.

Signals/OnPush/Reactive Forms, PrimeNG, tokens y SCSS existentes. Guard de borrador compartido con HU-002; Cancelar sin cambios vuelve a ficha, con cambios pide confirmación. Durante guardado no se permiten navegación ni envíos repetidos. Éxito solo tras respuesta API; invalida listado y actualiza detalle, conserva filtros/página y borra datos ante cambios de identidad o sesión expirada. Un resultado puede desaparecer de la búsqueda si deja de coincidir con sus filtros, sin modificar esos filtros silenciosamente.

Los roles no sustituyen capacidades: SUPER_ADMIN usa alcance global; BRANCH_ADMIN y OPERATOR sus concesiones efectivas. Tener lectura en A y actualización en B no permite editar A. Los recursos sin sede exigen alcance global explícito en la UI. El backend y RLS continúan siendo la autoridad.

## Archivos de implementación

- Backend: `Contracts.cs`, `PeopleService.cs`, `MinistryDbContext.cs`.
- Angular: `person-edit-page.ts/html/spec.ts`, `person-form.ts`, `members.store.ts/spec.ts`, `members.models.ts`, `members-page.html`, `person-detail-page.ts/html`, `person-registration-page.ts` (reutiliza validadores), `registration-draft.guard.ts`, `admin.routes.ts`, `access-context.ts/spec.ts`.
- Integración: `PeopleEditingTests.cs`, fixture `PeopleBrowserFixtureTests.cs`, `people-registration-real.spec.ts` ampliado; `people-editing.spec.ts` para estados controlados.

## Verificación

Consultar `specs/011-person-editing/validation.md` para resultados y comandos exactos. El fixture real crea únicamente datos sintéticos en una base loopback terminada en _tests, con runtime/Identity separados y contexto firmado ya aprovisionado; inicia API HTTPS y Angular temporales, sin interceptar HTTP en el recorrido real. Certificado privado efímero eliminado al finalizar. No se han ejecutado migraciones, bootstrap, SQL remoto ni script 090. Supabase permanece intacto y su aceptación requiere el despliegue coordinado de seguridad pendiente.
