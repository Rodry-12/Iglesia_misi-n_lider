# Plan — 017 assignment-responsible

## Diseño

- Reutilizar PUT /api/v1/process-assignments/{id}/responsible. Añadir expectedResponsiblePersonId opcional; Angular siempre lo envía. Comparar dentro del bloqueo para detectar formularios obsoletos.
- Añadir GET /api/v1/process-assignments/{id}/responsible-options con CHANGE_RESPONSIBLE, sede derivada del registro; reutilizar proyección/paginación sin ampliar people-options (ASSIGN). Excluir participante y responsable actual.
- Validar documento dentro de la transacción y bloqueos existentes; devolver fechas con precisión persistida PostgreSQL. Repetir el mismo responsable válido es idempotente; terminal sigue rechazándose.
- Extender AssignmentStore y AssignmentPage. PrimeNG Select fluid, InputText, Button, Message y ConfirmDialog; labels de teclado, búsqueda paginada, carga/vacío/error/éxito, sin otra ruta.

Para UI: seleccionar componentes PrimeNG según `docs/design-system.md`; identificar tokens existentes/nuevos, estados de interacción, foco/teclado y adaptación móvil/escritorio. El preset de PrimeNG y Tailwind comparten `tokens.css`.

## Verificación

Unidades dirigidas Angular; integraciones de permisos, candidatos, preservación, concurrencia y rollback en loopback _tests. E2E controlados y fixture HTTPS real existente con cuentas/datos sintéticos. Regresión HU-008–010 y autenticación. Build, diseño, especificación y formato. Sin imágenes ni secretos en diagnósticos.

HU-011 autoriza expresamente las pruebas unitarias y de integración.

## Riesgos y decisiones

Los consumidores anteriores que omiten expectedResponsiblePersonId mantienen su contrato y la detección existente de cambios durante la operación; no detectan ediciones anteriores a su petición. Angular siempre envía la precondición. No se añade esquema ni se cambia la autorización. La aceptación remota sigue pendiente.
