# HU-001 — Consulta de personas

Implementación del 2026-11-07. Solo lectura. No se modifica Supabase, SQL, migraciones, bootstrap ni contexto firmado. Aceptación remota pendiente del despliegue de seguridad coordinado.

## Comportamiento

`/gestion/miembros`: tabla con **Persona (nombres y apellidos), Documento vigente, Sede, Estado y Ver detalle**. Teléfono, correo, nacimiento, UUID y fechas técnicas se muestran exclusivamente en la ficha `/gestion/miembros/:id`.

Búsqueda de servidor con debounce de 350 ms, filtros de sede/actividad, paginación de servidor y cancelación de consultas anteriores. No se descarga todo el directorio. Los filtros se conservan en query params; cambiarlos reinicia la página. Ficha navegable con acceso directo, recarga y regreso al listado. El estado se elimina al cambiar/perder sesión y no se guarda en almacenamiento del navegador.

Se reutilizan guards, cookies e interceptores actuales. PERSON_VIEW controla toda la consulta; no se añade BRANCH_VIEW. El backend conserva 403 para sede explícita prohibida y 404 para ficha inexistente/fuera de ámbito. Los errores no muestran datos internos. Las respuestas del controlador llevan Cache-Control no-store.

Una persona sin documentos muestra «Documento pendiente de regularización». Si solo tiene documentos anteriores, «Sin documento vigente». No se inventan datos ni se regularizan registros automáticamente. BirthDate se presenta como calendario DD/MM/YYYY; fechas técnicas en es-CO y America/Bogota. Documentos anteriores no se muestran como historial en la ficha.

## Contrato aditivo

GET `/api/v1/people` conserva page/pageSize/search/branchId/isActive y los cuatro campos de paginación JSON. Añade `branches: [{id,name}]`: todas las sedes consultables con PERSON_VIEW, independientemente de filtros/página. SUPER_ADMIN ve las sedes de su ámbito global; una concesión PROCESS_VIEW en otra sede no añade esa sede al selector.

La proyección de consulta de PersonDto añade branchName, hasDocuments, createdAt y updatedAt. GET `/api/v1/people/{id}` devuelve esos campos y los documentos existentes. El listado devuelve solo documentos vigentes; hasDocuments distingue correctamente registros anteriores. No se consultan nombres mediante `/branches` y no hay peticiones HTTP por fila ni endpoints adicionales.

## Archivos

- Backend: `backend/src/MisionLiderParis.Application/Ministry/Contracts.cs`, `backend/src/MisionLiderParis.Infrastructure/Ministry/PeopleService.cs`, `backend/src/MisionLiderParis.Api/Controllers/MinistryControllers.cs`, `backend/tests/MisionLiderParis.IntegrationTests/PeopleQueryTests.cs` y `backend/docs/angular-api-contract.md`.
- Angular: `frontend/src/app/features/members/` (listado, ficha, modelos/formatos, store, estilos y unitarias), `features/administration/admin.routes.ts`, `core/theme/primeng-preset.ts` y ajuste de expectativa en `core/auth/access-context.spec.ts`.
- Navegador: `frontend/e2e/people.spec.ts`.
- Documentación: este archivo, `docs/administration.md` y los cinco documentos SDD de `specs/009-person-query/`.

## Verificación y límites

- Backend: 58 unitarias y 48 integraciones correctas en base loopback `_tests` preaprovisionada. Incluye tres nuevas integraciones de Personas; se repitieron las tres tras añadir no-store, correctas. Evidencia TRX en `backend/artifacts/people-query/`.
- Angular: 63 unitarias correctas (13 nuevas de store/formatos).
- Navegador: 30 E2E correctos en escritorio y móvil; ocho corresponden a Personas. Las pruebas de Personas/autenticación usan respuestas controladas e interceptadas; no acreditan una sesión Supabase ni navegador→API→PostgreSQL completo. El backend sí se probó con HTTP TestServer, Identity y PostgreSQL reales aislados.
- Builds .NET Release y Angular correctos. SDD, diseño, formato, dependencias y skills correctos.
- Revisión visual de listado y ficha en 1440×1000 y 390×844 mediante capturas `frontend/artifacts/009-{list,detail}-{desktop,mobile}.png`. Solo contienen datos sintéticos de pruebas. Tabla con región de scroll propia; sin desbordamiento horizontal del documento. Etiquetas accesibles de filtros, texto de estado y encabezados de tabla comprobados.
- No se ejecutó PostgresActivationTests (migraciones/bootstrap históricos), ni E2E de autenticación real, ni API conectada a Supabase. Los tests públicos ordinarios registran ECONNREFUSED en la restauración opcional de sesión porque no hay API levantada; las pruebas pasan y no contactan Supabase. El clúster de pruebas se detuvo al terminar.

## Comandos

```powershell
npm --prefix frontend test -- --watch=false
npm --prefix frontend run test:e2e -- --grep-invert '008 real'
npm run build
dotnet build backend/MisionLiderParis.slnx -c Release --no-restore
npm run spec:check
npm run design:check
npm run format:check
npm run deps:check
npm run skills:check
```

Para integración .NET, configurar solo las variables MLP_TEST_DATABASE, MLP_TEST_IDENTITY_DATABASE, MLP_TEST_OPERATOR_DATABASE y MLP_TEST_PREPROVISIONED=1 sobre una base aislada existente con el incremento firmado instalado; no usar User Secrets/Supabase:

```powershell
dotnet test backend/MisionLiderParis.slnx -c Release --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger trx --results-directory backend/artifacts/people-query
```

No iniciar este backend contra Supabase antes de aprobar y desplegar por separado su contexto firmado y credencial Identity. No se introduce un fallback para políticas antiguas. No se han implementado altas, edición, traslados, procesos, cuentas ni historiales en esta HU.
