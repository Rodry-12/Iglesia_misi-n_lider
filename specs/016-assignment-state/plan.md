# Plan — 016 assignment-state

## Diseño

Ampliar StatesAsync/GET states con assignmentId opcional: requiere CHANGE_STATUS, resuelve asignación en su ámbito y filtra catálogo por AssignmentLifecycle.CanTransition. Sin id conserva VIEW/catálogo previo. PUT conserva body {stateCode}, bloqueos, transacción e idempotencia; leer resultado persistido antes de commit para devolver fechas exactas sin ampliar datos de escritura.

AssignmentPage existente: stateForm, Select/Button/ConfirmDialog/Message ya disponibles, Signals/OnPush, tokens/catalog.scss. Destinos desde API, confirmación explícita para terminales, bloqueo de duplicados/navegación durante envío, limpieza/cancelación al perder sesión. Guard de borrador reutilizado en detalle; VIEW mantiene autorización de ruta. AssignmentStore comparte ejecución de comandos POST/PUT, canal de transiciones cancelable y refresco de detalle/lista solo tras200. Sin componentes/stores nuevos ni imágenes.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

14 unitarias nuevas y regresión focalizada assignment*/core/auth; integraciones de permisos, semántica/fechas, terminales, concurrencia e interceptor de fallo después de SaveChanges y antes del commit. E2E controlado estados/HU-008/HU-009/auth. Fixture real existente con opt-in MLP_RUN_ASSIGNMENT_STATE_BROWSER=1 y cuenta sintética ASSIGN/VIEW/CHANGE; omitir historias ajenas. Build Angular/.NET y checks, sin suite completa.

HU-010 autoriza explícitamente las pruebas, prevaleciendo sobre reservas históricas.

## Riesgos y decisiones

Opciones son una fotografía: PUT revalida estado real bajo bloqueo. No nuevo ETag/versionado. Precisión PostgreSQL de microsegundos puede diferir de DateTimeOffset en memoria; devolver fechas persistidas. No se cambia creación ni semántica de inactivos. Retirada sin inicio conserva precondición SQL existente503 si falta CHECK revisado. Aceptación remota pendiente del despliegue de seguridad; sin modificarlo.
