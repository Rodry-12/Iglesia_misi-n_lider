# 011 — HU-003 Edición de personas

Estado: Verificada en entorno aislado. Fuente: HU-003 entregada por el usuario, 2026-11-07. Aceptación Supabase pendiente.

## Alcance

Editar datos personales en el UUID existente, sin alterar documentos, sede, estado, creación, cuentas ni procesos. Supabase excluido; sin SQL/migraciones ni cambios al actor firmado.

## Contrato transversal de UI

Aplicar docs/design-system.md, docs/frontend-stack.md y ADR 0003: PrimeNG 21, Signals, Reactive Forms, OnPush, control flow moderno y tokens existentes.

## Requisitos

- FR-001: Reutilizar GET y PUT /api/v1/people/{id}. PERSON_VIEW para precarga y PERSON_UPDATE para guardar, efectivos en la misma sede. Actualizar no concede consultar.
- FR-002: Precargar nombres, apellidos, teléfono, correo y fecha local; identificación/sede/estado solo lectura. Heredados sin documento siguen consultables/editables sin agravar su condición.
- FR-003: Validación, prevención de envíos simultáneos, cancelación confirmada, borrado por pérdida/cambio de sesión y refresco conservando filtros.
- FR-004: Versión esperada opcional en contrato heredado; Angular siempre la envía. Comparación exacta del timestamp persistido bajo bloqueo y token EF en WHERE, respuesta 409 concurrent_update. Sin columnas nuevas.

## Aceptación

- AC-001: API persiste campos autorizados, conserva relaciones y rechaza inválidos/acceso ajeno; dos guardados con igual versión no se sobrescriben.
- AC-002: Formulario precargado/validado, acciones según permisos por sede, cancelación y errores sin éxito falso ni datos tras perder sesión.
- Presentación vigente AC-002 (2026-11-21): edición en Dialog desde el lápiz, después de precargar los datos. Cancelar y Guardar cambios en pie persistente; identificación, sede y estado de solo lectura. Conservar permisos, versión exacta, conflicto 409 y guard de borradores. Éxito confirmado cierra modal, notifica por Toast y refresca listado sin perder filtros.
- AC-003: Recorrido real escritorio/móvil listado/detalle/editar/guardar/recarga/listado contra PostgreSQL aislado.

## Decisiones y límites

El endpoint documental reemplaza creando un documento y finalizando el previo; queda fuera de esta HU sin historiales. Identificación visible sin modificación: duplicado documental no aplica al PUT personal. ExpectedUpdatedAt opcional conserva clientes anteriores: estos no tienen protección contra formularios obsoletos. Angular exige versión leída desde PostgreSQL, no el timestamp de creación previo a persistencia. Heredados sin documento no se regularizan automáticamente.
