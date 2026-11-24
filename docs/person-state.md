# HU-004 — Activación y desactivación de personas

Implementación del 2026-11-07. Especificación, plan y evidencia en `specs/012-person-state/`.

## Contrato reutilizado

PUT `/api/v1/people/{id}/active`, entrada `ActiveRequest` con `{ "isActive": true/false }`, éxito 204 sin cuerpo. No hay endpoint ni permiso nuevo. `PERSON_DEACTIVATE` controla ambas acciones; la UI necesita además PERSON_VIEW en la misma sede para consultar el registro. Sin BRANCH_VIEW ni administración de cuentas.

El servidor conserva 401 sin sesión, 403 sin capacidad, 404 persona inexistente/fuera del ámbito visible, 400 por solicitud inválida y 409 por conflicto ministerial. Las sedes introducidas en consultas explícitas conservan su autorización 403; el endpoint de estado trabaja por UUID y no recibe sede. Agregar un branchId en JSON no cambia el ámbito.

## Reglas e integridad

- Desactivar no elimina persona, documentos, vinculaciones ni procesos; solo actualiza activa y fecha_actualizacion.
- Asignaciones abiertas, tanto como participante como responsable, impiden desactivar. Los procesos finalizados permanecen intactos.
- AssignmentService sigue exigiendo participante/responsable activos y de la misma sede al asignar o cambiar responsable. No se han cambiado sus reglas.
- Una cuenta global activa vinculada impide desactivar según la regla existente. El helper SQL mantiene su protección adicional contra revocar cuentas globales desde un actor de sede, incluso cuentas inactivas. Su denegación SQL 42501 ahora se comunica como 403, revirtiendo el UPDATE previo, en lugar de presentarse como indisponibilidad 503. No se modifica Identity ni el contexto firmado.
- Reactivar exige documento vigente y vinculación vigente con una sede activa, además del ámbito autorizado. No inventa documentos ni reconstruye vinculaciones. Heredados inconsistentes siguen consultables; no se reactivan hasta regularizarse mediante las operaciones autorizadas.
- En una transición real se revocan sesiones mediante `auth_app.revoke_person_sessions(uuid)` en la misma transacción ministerial que guarda el estado. Cambian security_stamp/concurrency_stamp según el mecanismo existente; las contraseñas, cuentas y concesiones se conservan. Reactivar no resucita sesiones anteriores.
- Repetir el mismo estado válido devuelve 204 sin volver a cambiar versión ni revocar sesiones. Para true se comprueban documento/sede incluso si ya está activa. Se conserva el rechazo de inconsistencias de activación.
- Se reutilizan bloqueos de sede/persona y token EF de HU-003. Fecha avanza al menos un microsegundo, centralizada en AdvanceVersion para edición y estado. Un fallo antes de completar la revocación revierte estado y fecha; no se deja una baja parcial.

## Interfaz

Componente funcional `PersonStateAction` reutilizado en Acciones del listado y en ficha; muestra Desactivar/Activar según estado y capacidades efectivas, con alcance global explícito para registros sin sede. Reactivar esos registros será rechazado por el backend hasta regularizar la sede.

ConfirmDialog explica conservación de datos, restricción de asignaciones/responsabilidades y revocación de sesiones. Cancelar no envía HTTP; confirmar vuelve a comprobar permisos, UUID y estado local. La selección actual o una cuenta distinta no pueden aprovechar una confirmación antigua. PrimeNG, Signals, OnPush, tokens y flujo moderno Angular, sin otra biblioteca.

MembersStore concentra HTTP, bloqueo de envíos simultáneos (incluidas altas/ediciones), clasificación de errores y limpieza/cancelación por cambio de identidad. Solo reconoce 204 como éxito; no inventa timestamp ni cambia estado optimistamente. Tras confirmación invalida lecturas pendientes y recarga la vista activa desde la API conservando filtros/página. Una fila deja de mostrarse si ya no coincide con el filtro de estado. Un fallo del refresco no revierte una transición ya confirmada; muestra el error de consulta correspondiente. Si la persona se desactiva a sí misma, la lectura siguiente puede devolver 401 y el flujo de sesión la lleva a acceso.

No se muestran mensajes crudos SQL, información de cuentas vinculadas ni credenciales. El feedback de conflicto enumera las restricciones revisables y conserva el estado consultado. Se mantiene el interceptor global: 401 conduce a acceso y 403 a /sin-acceso; el store clasifica igualmente los errores para consumidores aislados. Si hay timeout/fallo de red, no reintenta automáticamente ni declara éxito: pide consultar el estado actual, porque la operación podría haberse confirmado en el servidor.

## Archivos modificados/creados

- `backend/src/MisionLiderParis.Infrastructure/Ministry/PeopleService.cs`: precondiciones de reactivación, idempotencia y helper compartido de fecha; misma transacción/revocación.
- `backend/tests/MisionLiderParis.IntegrationTests/PeopleStateTests.cs`: pruebas HTTP, sesiones, integridad, concurrencia y fallo controlado de revocación.
- `backend/tests/MisionLiderParis.IntegrationTests/PeopleBrowserFixtureTests.cs`: concesión explícita de PERSON_DEACTIVATE y resumen real ampliado.
- `frontend/src/app/core/auth/access-context.ts`: reconoce el código real PERSON_DEACTIVATE devuelto por la API.
- `frontend/src/app/features/members/person-state-action.ts` y `.spec.ts`: acción/confirmación y feedback compartidos.
- `frontend/src/app/features/members/members.store.ts` y `.spec.ts`: comando de estado y refresco seguro.
- `frontend/src/app/features/members/members-page.ts/html` y `person-detail-page.ts/html`: integración en pantallas existentes, sin nuevas columnas.
- `frontend/e2e/people-state.spec.ts`: escenarios controlados desktop/mobile.
- `frontend/e2e/people-registration-real.spec.ts`: recorrido real HU-002/003/004 sobre API HTTPS y PostgreSQL aislado.
- `backend/docs/angular-api-contract.md`, `docs/administration.md`, este documento y `specs/012-person-state/{spec,plan,tasks,validation,traceability}`: contrato y evidencia.

## Límites

ActiveRequest no incluye versión/estado esperado: se mantiene PUT de valor absoluto y serialización por filas. No se promete detectar una intención antigua ni se agrega un contrato nuevo; cambios opuestos válidos se aplican en orden y el último prevalece. Los timeouts deben resolverse consultando la API.

La aceptación en Supabase sigue pendiente del despliegue coordinado de seguridad. No se han ejecutado SQL remoto, migraciones, bootstrap, 090, cambios de tablas ni nuevas políticas. Las pruebas de escritura son exclusivamente datos sintéticos en PostgreSQL loopback con nombre terminado en _tests. La prueba de rollback usa un interceptor solo de test; no agrega flags o comportamientos de fallo al producto. Pruebas públicas controladas y recorridos reales se registran por separado en `specs/012-person-state/validation.md`.
