# Plan HU-004

Backend: conservar SetActiveAsync, LockVisibleAsync y helper SQL de revocación, incluyendo bloqueos compartidos con AssignmentService. Agregar solo precondiciones de reactivación e idempotencia. Reutilizar avance de versión microsegundos de HU-003. No tocar SQL ni Identity.

Angular: ampliar MembersStore con operación PUT de estado, señal de envío/error/éxito, cancelación por cambio de identidad y protección contra respuestas antiguas. Tras 204 invalidar resultados obsoletos y recargar listado/ficha con filtros existentes; no falsificar fecha_actualizacion. Componente funcional compartido entre listado y ficha para Button + ConfirmDialog y feedback Message, sin HTTP en presentación. PERSON_DEACTIVATE real, con sede.

UI según docs/design-system.md: PrimeNG Button/ConfirmDialog/Message existentes, SCSS/tokens y tabla de cinco columnas. Estados: actual, confirmación, envío, éxito, conflicto y fallos 401/403/404/servicio. Labels accesibles por acción/persona, teclado/foco, confirmación cancelable, mobile sin desbordamiento de página.

Pruebas: HTTP de ambas acciones/roles/sedes, asignaciones activas/finalizadas/inactivas, sesiones, concurrencia, fallo controlado de revocación sin DDL. Unitarias de store y componente. Extender fixture real de HU-002/003 con PERSON_DEACTIVATE y recorrido reversible. Checks, build y revisión de screenshots sintéticos.
