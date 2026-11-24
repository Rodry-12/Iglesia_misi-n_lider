# 016 — assignment-state

Estado: Verificada en entorno aislado. HU-010 del usuario,2026-11-07; aceptación remota pendiente.

## Problema y resultado esperado

Cambiar el estado desde la ficha HU-009 con PROCESS_CHANGE_STATUS efectivo, transiciones del backend y confirmación manual de finalización.

## Alcance y exclusiones

Reutilizar PUT /api/v1/process-assignments/{id}/state, AssignmentPage/Store y AssignmentLifecycle. Extender GET de estados con assignmentId opcional. Sin nuevos endpoints, tablas, historias, cambio de responsable, fechas arbitrarias, imágenes, migraciones, bootstrap,090 o cambios de Supabase/RLS.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: PROCESS_CHANGE_STATUS por sede para consulta de destinos y escritura; VIEW independiente para detalle. Sin permisos de Personas/Catálogo.
- FR-002: Catálogo real y AssignmentLifecycle determinan destinos; estado/fechas se validan bajo bloqueos/transacción. Terminales no se reabren; repeticiones no modifican fechas.
- FR-003: Finalización únicamente por acción explícita y confirmada, selector dinámico, envío único, errores sin éxito falso, recarga/invalidez de listado y limpieza de sesión.

## Aceptación

- AC-001: Autorización, transiciones/fechas, concurrencia, idempotencia y rollback verificadas en PostgreSQL aislado (CA-001–005,008–013,017–018,020).
- AC-002: Ficha existente muestra destinos del backend, confirma/cancela finalización, mantiene contexto, controla envío/errores/sesión y actualiza lista/detalle (CA-003–007,014–016,019).
- AC-003: Recorrido real HTTPS de inicio/finalización cancelada/confirmada, persistencia y terminales en escritorio/móvil; compilaciones y regresiones focalizadas pasan.

## Escenarios y dudas

Se conserva política existente: transiciones no terminales exigen participante/responsable activos en sede; cierres terminales pueden efectuarse aunque estén inactivos. Fechas se generan en servidor; respuesta PUT confirma precisión persistida. Sin nueva versión optimista: se serializa y revalida contra estado actual. Pruebas autorizadas explícitamente por HU-010.
