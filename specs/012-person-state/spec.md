# 012 — HU-004 Activación y desactivación de personas

Estado: Verificada en entorno aislado. Fuente: HU-004 del usuario, 2026-11-07. Aceptación remota pendiente.

## Alcance

Activar/desactivar desde listado y ficha existentes, sin eliminación ni cambios de documento/sede/datos personales/asignaciones/cuentas. Sin Supabase, DDL, migraciones, bootstrap ni 090. No modificar contexto firmado.

## Contrato transversal

Aplicar docs/design-system.md, docs/frontend-stack.md y ADR 0003: Angular 21/PrimeNG, Signals, OnPush, tokens, control flow moderno y accesibilidad. La autorización del usuario incluye unitarias e integración aislada.

## Requisitos

- FR-001: Reutilizar PUT /api/v1/people/{id}/active, ActiveRequest(isActive), PERSON_DEACTIVATE en sede, 204. UI requiere además PERSON_VIEW para consultar; no ampliar concesiones.
- FR-002: Desactivar conserva persona/documentos/sede/procesos; bloquea asignaciones abiertas como participante o responsable y cuentas globales vinculadas según reglas actuales. Las personas inactivas no reciben nuevas asignaciones ni responsabilidades.
- FR-003: Reactivar exige documento vigente y vinculación vigente con sede activa/autorizada; no regularizar legado automáticamente.
- FR-004: Revocar sesiones vinculadas en la transacción ministerial existente, sin modificar contraseñas ni eliminar/desactivar cuentas Identity. Rollback si falla revocación. Repetir mismo estado válido no vuelve a revocar.
- FR-005: Mostrar acción según estado y permiso efectivo; confirmar antes de desactivar explicando consecuencias. Bloquear envíos simultáneos, errores claros, estado confirmado tras 204 y posterior lectura, filtros/página conservados, sin datos tras perder/cambiar sesión.

## Aceptación

- AC-001: Activación/desactivación e integridad, permisos, documento/sede, asignaciones, sesiones y rollback probados en PostgreSQL aislado.
- AC-002: Acciones, confirmación/cancelación, carga, errores, refresco y limpieza verificados con pruebas Angular y E2E controladas.
- AC-003: Recorrido real escritorio/móvil listado/detalle/desactivar/confirmar/verificar/reactivar/verificar con API HTTPS y PostgreSQL aislados; compilaciones y checks.

## Decisiones

No existe token de estado esperado en ActiveRequest. Mantener PUT de valor absoluto e idempotencia, bloqueos de filas y token EF existente; no prometer detección de intenciones antiguas de clientes. Los cambios opuestos válidos se serializan; el último prevalece. 409 conserva conflicto ministerial existente. No exponer mensajes SQL/Identity ni datos de cuentas vinculadas en UI.
