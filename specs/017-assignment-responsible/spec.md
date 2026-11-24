# 017 — assignment-responsible

Estado: Verificada en entorno aislado. Fuente: HU-011 adjunta por el usuario, 2026-11-08.

## Problema y resultado esperado

Cambiar el responsable desde la ficha de asignación existente, con capacidad efectiva por sede y confirmación explícita.

## Alcance y exclusiones

Reutilizar servicio, PUT y store; conservar cookies, CSRF y actor firmado. Sin Supabase, migraciones, historial, traslados ni cambios documentales.

## Contrato transversal de UI

Para frontend, aplicar `docs/design-system.md` y ADR 0003: Angular + PrimeNG + Tailwind + SCSS + tokens + Lucide, Signals y Reactive Forms. Definir componentes, estados, accesibilidad y responsive en el plan. No duplicar colores: `frontend/src/styles/tokens.css`. Registrar cualquier excepción con su motivo.

## Requisitos

- FR-001: exigir PROCESS_CHANGE_RESPONSIBLE efectivo en la sede. VIEW y ASSIGN no lo sustituyen; opciones mínimas sin PERSON_VIEW ni permisos de catálogo.
- FR-002: responsable existente, activo, documentado y vinculado a la misma sede, distinto del participante. Conservar reglas de terminal, catálogo y participante activos.
- FR-003: escritura atómica bajo bloqueos y precondición de responsable anterior; conservar UUID, persona, proceso, sede, estado y fechas funcionales. Solo cambian responsable y fecha técnica.
- FR-004: búsqueda paginada, confirmación anterior/nuevo, cancelación sin PUT, borrador protegido, doble envío bloqueado, errores sin éxito falso, limpieza de sesión y recarga de detalle/listado.

## Aceptación

- AC-001: API rechaza permisos, referencias y responsables inválidos sin exponer candidatos de otra sede; cambio válido conserva los campos funcionales y una sola asignación.
- AC-002: cambios concurrentes con el mismo responsable esperado producen un éxito y un conflicto; fallo al confirmar transacción revierte la actualización.
- AC-003: ficha Angular respeta permisos, confirmación, borrador y sesión; detalle/lista reflejan solo un cambio confirmado, en escritorio y móvil.

## Escenarios y dudas

La aceptación en Supabase queda pendiente del despliegue coordinado de seguridad. Las pruebas unitarias están expresamente autorizadas por HU-011.
