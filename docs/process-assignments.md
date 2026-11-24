# HU-008 — Asignaciones ministeriales

Entrada: /gestion/formacion → Asignar proceso → /gestion/formacion/asignar. Detalle: /gestion/formacion/asignaciones/:id. PROCESS_ASSIGN se incorpora a navegación sin conceder lectura del Catálogo ni Personas.

## Contratos reales

| Método | Ruta /api/v1 | Permiso y respuesta |
| --- | --- | --- |
| GET | process-assignments/selection-options | Nuevo, PROCESS_ASSIGN: categorías/procesos activos y estado inicial real |
| GET | process-assignments/people-options | Nuevo, PROCESS_ASSIGN: Page de opciones elegibles por sede |
| POST | process-assignments | Existente, PROCESS_ASSIGN en BranchId:201 AssignmentDto |
| GET | process-assignments/{id} | Existente, PROCESS_VIEW:200 o404 fuera del ámbito |

Opciones de personas: Page/PageSize/Search (máximo150)/BranchId/ExcludePersonId. Sin sede filtra por todas las concesiones ASSIGN; sede explícita no autorizada403. Proyecta únicamente Id, Name, BranchId, BranchName, DocumentType y DocumentNumber, sin contactos/nacimiento/cuentas. Activos, documento vigente sin finalización, membresía vigente y sede activa. Búsqueda nombre completo/documento con Contains existente, sin prometer insensibilidad a acentos/mayúsculas. Orden estable apellidos/nombres/UUID, página10 en UI. Responsable limita sede y excluye participante.

Catálogo global compartido, opciones completas activas (no primera página truncada). Si crece mucho necesitará paginación. Estado inicial PENDING se resuelve desde estado_proceso, no desde constantes Angular. No se conceden permisos independientes para completar selectores.

## Campos existentes

| DTO | iglesia.persona_proceso | UI |
| --- | --- | --- |
| PersonId | persona_id | Nombre, documento, sede, estado elegible |
| ProcessId | proceso_id | Categoría/proceso activo, descripción |
| ResponsiblePersonId | responsable_persona_id | Responsable obligatorio y diferente, de la misma sede |
| BranchId | sede_id | Derivada del participante; sin selector |
| Id | id | UUID técnico generado, comprobante/detalle |
| StateCode (resuelto mediante StateId) | estado_id → estado_proceso.codigo | Inicial real, informativo |
| AssignedAt | fecha_asignacion | Backend genera, API confirma |
| StartedAt | fecha_inicio | NULL al crear, sin control editable |
| FinishedAt | fecha_finalizacion | NULL al crear, sin finalización automática |

Documento exclusivamente persona_documento, nunca añadido a persona. No se duplican datos personales en asignación. Fecha_creacion/actualizacion permanecen existentes. POST conserva exactamente cuatro UUID; sin fechas/estado/actorId en solicitud.

## Reglas y seguridad

AssignmentService conserva autorización, contexto firmado, transacción y bloqueos existentes de sede/categoría/proceso/personas. Revalida actividad, pertenencia, categoría/proceso activo, responsable diferente y ahora documento vigente de ambos antes de crear. Registros históricos sin documento se conservan pero no son elegibles. No se modifica comportamiento de cambios de responsable/finalización, fuera del alcance.

Sede enviada se autoriza y compara contra membresías de ambos; manipular UUID no traslada personas. Vacíos/autorresponsabilidad400; proceso inexistente404; incompatibilidad/inactividad/documentos/duplicidad409 genérico; sede sin permiso403. Se conservan respuestas existentes para persona inexistente/no elegible (409), sin PII de otras sedes.

Unicidad abierta: comprobación de servicio y ux_persona_proceso_abierto_fecha existente; estado/fechas protegidos por trigger y restricciones existentes. No SQL nuevo ni reconstrucción. Documento obligatorio es regla del API bajo bloqueos existentes compartidos con escrituras documentales: no se añade trigger ni se afirma proteger frente a un operador DDL. Se prueban ausencia de efectos parciales y concurrencia.

## Confirmación y límites

Solo201 confirma éxito. Se muestran nombres seleccionados y estado/fechas/UUID devueltos. PROCESS_ASSIGN aislado recibe comprobante POST hasta salir, sin guardar en navegador; GET posterior conserva PROCESS_VIEW. Con VIEW se abre detalle persistido y recargable. HU-009 amplía el DTO GET con nombres/documento vigente, categoría/descripción y nombre de estado bajo el mismo permiso. Relaciones ocultas por RLS permanecen nulas sin eliminar la asignación; UUID en sección técnica plegable. Seguimiento en /gestion/formacion/asignaciones, sin solicitudes adicionales a Personas/Catálogo; evidencia en specs/015-assignment-follow-up/validation.md.

Sin reenvío automático en timeout: resultado incierto exige consultar antes de reenviar.400/403/404/409 controlados;401/cambio de identidad cancela y elimina datos, usando cookies/CSRF/interceptores existentes. Cancelación con borrador pide confirmación y protege recarga. Sin localStorage, historial, observaciones nuevas, cuentas o cambios colaterales.

Supabase no se modifica. Pruebas usan exclusivamente PostgreSQL loopback preaprovisionado y HTTPS con cuentas/certificado sintéticos. Aceptación remota pendiente del despliegue coordinado de seguridad firmada/Identity.
