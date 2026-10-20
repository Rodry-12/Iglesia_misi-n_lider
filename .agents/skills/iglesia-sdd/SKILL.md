---
name: iglesia-sdd
description: Definir especificaciones, planes, tareas y evidencia de Misión Líder París, aplicando el contrato compartido de diseño y el stack PrimeNG del repositorio.
---

# SDD de Iglesia Misión Líder París

Lee [contexto](../../../docs/project-context.md), [flujo SDD](../../../docs/spec-driven-development.md) y, para UI, [contrato de diseño](../../../docs/design-system.md) y [ADR 0003](../../../docs/adr/0003-primeng-design-system.md). PrimeNG sustituye Material; una spec que no repita el stack sigue heredando esa decisión.

Busca una spec existente. Para una capacidad nueva usa `npm run spec:new -- nombre-de-funcionalidad` y completa spec, plan, tasks, validation y traceability. Las plantillas incluyen el contrato transversal. No crear una spec ceremonial por una errata.

Define resultado, usuario, alcance, FR-NNN y AC-NNN observables antes de implementar. El plan identifica componentes PrimeNG, tokens existentes/nuevos, estados vacíos/carga/error/éxito, foco/teclado y responsive según corresponda. Colores y escalas viven en `frontend/src/styles/tokens.css`, no se copian en especificaciones o componentes. Cambios transversales de biblioteca/identidad requieren actualizar ADR, contrato e instrucciones; documentar excepciones con motivo y alcance.

Distingue datos del HTML, hechos verificados y decisiones. No inventar horarios vigentes, doctrina, destinatarios bancarios o disponibilidad externa. Mantener autenticación y CRUD fuera del incremento público salvo nueva solicitud; las futuras operaciones por sede necesitan validación y autorización en servidor y auditoría.

Vincula criterios con archivos y evidencia real. Actualiza validation después de ejecutar cada comprobación y `traceability.json` solo cuando el criterio se haya verificado. `npm run spec:check` valida estructura y rutas, no comportamiento. Una pantalla Próximamente, un guard o un formulario de ejemplo no acreditan CRUD o autenticación real.

Instrucción vigente: no crear, modificar ni ejecutar pruebas unitarias hasta que el usuario las retome. Especificar comportamientos y criterios sin desarrollar sus tests. Registrar por separado build, checks y revisión visual; mantener pendientes las comprobaciones sin evidencia y no prometer cobertura. La autorización procede de la conversación, no de un estado documental.
