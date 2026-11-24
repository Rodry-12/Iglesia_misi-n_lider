# Trabajo guiado por especificaciones

SDD significa que el comportamiento esperado y su verificación guían la implementación. Este repositorio utiliza Markdown y scripts locales; no requiere una herramienta o suscripción adicional ni pretende haber instalado GitHub Spec Kit.

## Decisiones compartidas y especificaciones

Las reglas transversales no se reinventan en cada spec: [ADR 0003](adr/0003-primeng-design-system.md) fija el stack y [sistema de diseño](design-system.md) fija el contrato de UI. Los valores ejecutables viven en `frontend/src/styles/tokens.css`; el preset de PrimeNG y Tailwind los consumen. Las skills y `AGENTS.md` remiten a estas fuentes.

Para una funcionalidad, definir primero el resultado y sus estados; después seleccionar componentes PrimeNG, tokens, accesibilidad y responsive en `plan.md`; descomponer tareas y registrar evidencia. No duplicar hexadecimales ni elegir otra biblioteca porque una spec no repita el stack. Si cambia una decisión compartida, crear/sustituir el ADR y actualizar contrato, instrucciones y guía. Las plantillas ya incluyen esta referencia.

Las unitarias Angular siguen diferidas. La fase de activación del backend del 2026-10-24 retoma explícitamente sus pruebas unitarias e integración PostgreSQL aislada. Registrar resultados separados; build y revisión visual no acreditan cobertura unitaria.

## Ciclo de trabajo

1. Leer el contexto y localizar una especificación existente. Para una nueva funcionalidad, ejecutar `npm run spec:new -- nombre-de-funcionalidad`.
2. Completar `spec.md`: problema, alcance, exclusiones, requisitos `FR-001`, criterios `AC-001`, escenarios y dudas relevantes. Registrar supuestos de bajo riesgo; consultar los que cambian el alcance o el comportamiento.
3. Escribir `plan.md`: archivos y componentes afectados, datos, dependencias, riesgos y estrategia de pruebas. Separar hechos observados de decisiones propuestas.
4. Convertir el plan en tareas verificables en `tasks.md`. Relacionar cada tarea con los criterios que satisface.
5. Implementar la parte autorizada. Actualizar los documentos si cambia el alcance; no usarlos para impedir correcciones rutinarias o pedir aprobaciones innecesarias.
6. Registrar en `validation.md` la fecha, comandos, resultado y limitaciones. Ejecutar `npm run spec:check` y los checks de código pertinentes.

## Estados

`Borrador` identifica requisitos propuestos; `Lista` significa que existe suficiente información para implementar; `En curso` indica trabajo activo; `Verificada` requiere evidencia para todos sus criterios. La autorización del usuario procede de la conversación, no del nombre de un estado.

`traceability.json` relaciona criterios con archivos y verificación. En cada criterio, `verified` solo puede ser `true` cuando la evidencia ya existe. Los nombres de pruebas deben describir el comportamiento y pueden incluir el ID de aceptación.

Desde ADR 0005, el backend tiene su propio ámbito `backend/specs/`: crear con `npm run spec:new -- nombre --backend`. Las rutas de su trazabilidad se resuelven desde `backend/`; la numeración es independiente de las specs de raíz. `npm run spec:check` recorre ambos ámbitos. La fase de activación del 2026-10-24 retoma las pruebas del backend; la prohibición de pruebas unitarias sigue aplicando a Angular.

## Qué comprueba el script

`spec:check` exige los cuatro documentos y la trazabilidad de cada especificación numerada. Comprueba IDs de aceptación únicos, su presencia en `spec.md`, rutas de implementación y verificación existentes, y evidencia escrita para criterios marcados como verificados. Resuelve rutas dentro del repositorio y rechaza rutas que salen de él.

La comprobación estructural no prueba que la funcionalidad funcione ni sustituye los tests, la revisión o la comprobación visual. La evidencia de esos pasos pertenece a `validation.md`.

## Finalización

Una funcionalidad está terminada cuando sus criterios están cubiertos, las tareas correspondientes están completadas, pasan los checks aplicables y quedan documentadas las limitaciones. Una prueba que solo compara la implementación consigo misma no demuestra un criterio de producto.

Para trabajar con el asistente, usar `$iglesia-sdd` en definición y planificación y `$iglesia-angular` en implementación. Ambas skills remiten al contexto compartido para evitar mantener copias divergentes de la información.
