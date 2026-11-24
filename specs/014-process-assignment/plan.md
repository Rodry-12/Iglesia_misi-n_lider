# Plan — 014 process-assignment

## Diseño

Reutilizar AssignmentService/POST/GET y contexto firmado. Añadir selection-options y people-options exclusivamente PROCESS_ASSIGN. Exigir documentos vigentes antes de insertar, bajo bloqueos existentes de personas; sin alterar reglas de edición de asignaciones.

AssignmentStore por ruta Formación, AssignmentPage para formulario/detalle. Rutas asignar (ASSIGN) y asignaciones/:id (VIEW). Entrada/navegación Formación acepta ASSIGN sin ampliar accesos al Catálogo.

PrimeNG InputText, Select, Button, Message, ConfirmDialog y PageHeading. catalog.scss/tokens existentes; etiquetas, teclado, regiones de estado, botones táctiles y selectores adaptables. Formulario móvil primero, sin desbordamiento horizontal. Carga/vacío/error/reintento, envío bloqueado, conflicto con borrador intacto, éxito201 y detalle GET. Cancelación y beforeunload; identidad/401 cancela peticiones y borra PII; versionado por canal evita respuestas obsoletas.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Unitarias Angular, HTTP/PostgreSQL, regresión catálogo/concurrencia/seguridad y E2E controlado/real en dos viewports. Fixture existente con base loopback preaprovisionada y roles separados; excluir PostgresActivationTests. Builds y checks estructurales/visuales.

HU-008 autoriza explícitamente las unitarias e integración; prevalece sobre documentos históricos.

## Riesgos y decisiones

Opciones globales de catálogo completas, sin truncar; volúmenes grandes podrían requerir paginación. Opciones no son snapshot: backend revalida al guardar. Sin VIEW solo comprobante POST, no GET. Sin reparación de documentos históricos. Supabase pendiente del despliegue coordinado de seguridad.

FR-006: conservar formulario Reactive Forms standalone y AssignmentStore. PrimeNG Select/Button, TablePagination compartida y Lucide Search/X, SCSS con tokens existentes, dos columnas de escritorio y una movil, pasos numerados con encabezados accesibles. Búsquedas independientes con debounce 2000ms; opciones del responsable por sede y exclusion del participante, reset al cambiar dependencias. Backend normaliza nombres/documentos con translate/upper existente antes de paginar, sin modificar elegibilidad ni autorizacion. Confirmaciones, concurrencia y revalidacion POST existentes conservadas. Pruebas controladas mas consultas reales de solo lectura con rollback, sin POST remoto.

FR-007: reutilizar AssignmentPage/AssignmentStore con input member y outputs closed/savedChange; store aislado bajo MembersPage, sin proveedor alternativo ni endpoint nuevo. PrimeNG Dialog/Form/Select y Lucide ClipboardPlus; resumen no editable desde fila, opciones mediante servicios existentes. Carga inicial responsable por sede/exclusion y categoria/proceso activos; guard padre delega al modal y cierre requiere canLeave. Dialog espera opciones; errores con reintento fuera si aun no puede abrirse. Footer fijo por form/id, responsive una columna, tokens existentes. Pruebas HTTP controlado desktop/mobile, sin escrituras reales.

FR-008: PrimeNG Select filter=true con template filter y FormControl de busqueda existente, sin aplicar filtro local a pagina incompleta. Reutilizar debounce2s y endpoint people-options con branchId/excludePersonId; input accesible, X condicional y resultados conservados durante carga. Quitar input externo y nota de estado inicial, manteniendo catalogo/estado inicial del contrato backend.
