# 014 — process-assignment

Estado: Verificada en entorno aislado. HU-008, autorizada el 2026-11-07. Aceptación remota pendiente.

## Problema y resultado esperado

Un usuario con PROCESS_ASSIGN busca un participante elegible, selecciona un proceso activo y un responsable de la misma sede, guarda y consulta el resultado confirmado.

## Alcance y exclusiones

Reutilizar AssignmentService y persona_proceso. No crear personas, cuentas, catálogos, historial, traslados, cambios de responsable ni finalización. Sin SQL nuevo, migraciones, bootstrap,090 o cambios de Supabase. Pruebas expresamente autorizadas por HU-008.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: PROCESS_ASSIGN efectivo por sede sin exigir PERSON_VIEW ni lectura de Catálogo para seleccionar/asignar. GET posterior conserva PROCESS_VIEW.
- FR-002: Participante y responsable diferentes, activos, documentados y miembros vigentes de la misma sede activa. Sede derivada, no editable.
- FR-003: Catálogo activo y estado inicial real desde API. DTO existente de cuatro UUID, fechas generadas sin inicio/finalización automática.
- FR-004: Transacción/bloqueos existentes, duplicados409, índice físico existente para concurrencia, sin cambios colaterales.
- FR-005: Búsquedas paginadas, validación, carga/vacío/error/reintento, protección de borrador, envío único y limpieza de sesión.

## Aceptación

- AC-001: API/PostgreSQL aislado validan elegibilidad, permisos, aislamiento, integridad y concurrencia (CA-001–024 y028, con regresiones existentes).
- AC-002: Angular permite buscar y seleccionar, sede automática, errores controlados, sesión, cancelación y confirmación solo tras201 (CA-004–018 y023–027).
- AC-003: Recorrido escritorio/móvil Angular → API HTTPS → PostgreSQL aislado → consulta persistida, sin mocks ni credenciales reales; límites documentados.

## Escenarios y dudas

PROCESS_ASSIGN solo confirma comprobante POST; PROCESS_VIEW habilita GET posterior, sin ampliar concesiones. Registros históricos sin documento se conservan pero no son elegibles. Opciones no son snapshot; POST revalida dentro de bloqueos/transacción. Sin aceptación remota hasta desplegar seguridad coordinada.

- FR-006 (2026-11-22): ordenar Asignar proceso en tres bloques (participante, proceso, responsable) con tokens compartidos y responsive. Busqueda tras 2s, sin mayusculas/tildes, X condicional, selectores con limpieza condicional, paginacion 10/20/50 cuando necesaria, errores/exito Toast y overlay global sin cargas locales duplicadas. Cancelar/Guardar juntos al pie. Conservar permisos, elegibilidad, sede derivada, duplicados, estado inicial y proteccion del borrador. No crear asignaciones reales durante preparacion.

- FR-007 (2026-11-22, sustituye entrada de asignacion en Formacion): asignar desde icono accesible en cada fila de Miembros, visible con PROCESS_ASSIGN efectivo por sede y deshabilitado para personas inactivas/sin sede/documento vigente. Modal con persona fija (nombre/documento/sede), categoria, proceso y responsable de misma sede; esperar opciones, pie Cancelar/Guardar, confirmar descarte, Toast, restaurar foco y no recargar listado al cerrar/guardar. Quitar entrada y tarjeta de Formacion y acceso desde Seguimiento; conservar servicios/backend y permisos sin ampliarlos. Miembros exige PERSON_VIEW existente; no otorgarlo implicitamente a PROCESS_ASSIGN. Ruta antigua queda por compatibilidad sin enlaces.

- FR-008 (2026-11-22): ocultar texto de estado inicial/fechas en formulario. Buscador de responsable dentro del desplegable Select, con consulta remota tras2s; no filtrar solo primera pagina en cliente. Conservar activos, documento vigente, sede y exclusion del participante aplicados por backend.
