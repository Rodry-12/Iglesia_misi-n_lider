# HU-002 — Registro de personas

Estado: Verificada en entorno aislado; aceptación Supabase pendiente. Angular 21 + PrimeNG 21 y `docs/design-system.md`. Incremento de solo alta sobre HU-001; autorizado únicamente en entorno aislado.

- FR-001: Registrar mediante POST /api/v1/people y PERSON_CREATE, con persona/documento/sede en una transacción; sin cuentas automáticas ni SQL.
- FR-002: Formulario reactivo de identificación obligatoria, nombres/apellidos, contacto y nacimiento opcionales, sede activa y estado inicial activo. UUID/fechas automáticas.
- FR-003: Sedes por PERSON_CREATE, sin exigir PERSON_VIEW o BRANCH_VIEW. Tipos del catálogo existente iglesia.tipo_documento: documentTypes contiene code/name; Select muestra nombre y envía código, sin entrada libre ni valores deducidos de personas. Lectura con contexto firmado y RLS, sin cambios en registros del catálogo.
- FR-004: Bloquear doble envío, preservar datos ante fallo, confirmar abandono de borrador, limpiar al perder sesión, invalidar listado y permitir ficha solo con PERSON_VIEW efectivo en la sede creada.
- AC-001: Backend prueba alta completa, metadatos autorizados, validaciones, duplicados locales/ajenos/concurrentes y rollback sin persona incompleta.
- AC-002: Angular respeta permisos diferenciados, sede única/múltiple, documentos textuales, validaciones y cancelación segura; listado mantiene cinco columnas.
- Presentación vigente AC-002 (2026-11-22): Registrar persona abre un modal tras cargar las opciones autorizadas. Información personal empieza por tipo y número de documento, continúa con nombres, apellidos, teléfono, correo y nacimiento; sede al final. País CO se conserva internamente, sin campo visible; no mostrar Estado inicial activo ni permitir seleccionarlo. Pie persistente con Cancelar y Guardar persona; cierre al éxito confirmado y refresco del listado conservando filtros. PERSON_CREATE sin PERSON_VIEW no consulta el listado ni obtiene lectura por el alta.
- AC-003: Store/pruebas de navegador verifican guardado, errores, sesión, doble envío e integración con HU-001; distinguir E2E controlados de integración real aislada.
- AC-004: Compilación y checks/pruebas pertinentes registrados, sin cambios Supabase, migraciones, bootstrap, históricos SQL ni remediación criptográfica.

- AC-002 (2026-11-22): En registro, documento obligatorio y telefono opcional aceptan solo digitos ASCII 0-9, sin signos ni espacios; conservar ceros iniciales como texto. Correo opcional valida formato y bloquea guardado si es invalido; no implica comprobar existencia del buzon.
