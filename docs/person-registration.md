# HU-002 — Registro de Personas

Implementada y validada el 2026-11-07 en entorno aislado. Sin cambios en Supabase, esquema, migraciones, scripts históricos, bootstrap, 090 ni remediación criptográfica. La aceptación productiva sigue pendiente del despliegue coordinado de seguridad.

## Funcionalidad

Acción «Registrar persona» en HU-001 para usuarios con PERSON_CREATE. Formulario navegable en `/gestion/miembros/registrar`, con identificación obligatoria, nombres/apellidos, teléfono/correo/nacimiento opcionales y sede activa. Estado inicial activo; UUID y fechas no editables. El listado conserva sus cinco columnas.

Se usan Select editable, InputText, DatePicker, Button, Message y ConfirmDialog de PrimeNG, formularios reactivos, OnPush, Signals y tokens existentes. Las etiquetas del calendario están en español. El documento y teléfono son texto: se conservan ceros iniciales, letras y signos. País/tipo/número se recortan y convierten a mayúsculas; nombres conservan acentos/compuestos. Correo y longitudes se validan según contrato. Fecha como calendario YYYY-MM-DD, sin usar toISOString sobre la fecha ingresada; no admite nacimiento futuro según la regla actual de la API.

Una sede autorizada se asigna automáticamente; varias requieren selección. Las opciones se filtran por PERSON_CREATE, independientemente de PERSON_VIEW/BRANCH_VIEW. Una cuenta solo CREATE puede entrar desde el resumen; no obtiene acceso al listado ni al detalle. Tras guardar, se ofrece ficha/listado únicamente con PERSON_VIEW efectivo en la sede creada.

Guardar bloquea doble envío y confirma éxito exclusivamente tras HTTP 201. Errores conservan el borrador y muestran mensajes controlados. Los fallos de resultado incierto no se reintentan automáticamente: se indica comprobar registros autorizados. Cancelar/cambiar de ruta con cambios solicita confirmación; durante envío no se permite abandono ordinario. Recarga/cierre usan advertencia nativa. Al perder sesión se eliminan datos del store y del formulario.

Tras crear se invalidan páginas y solicitudes HU-001 pendientes. Los enlaces de éxito reinician página/búsqueda sobre la sede creada, para consultar el registro. No se crea una cuenta Identity, traslada personas ni genera historial.

## API

POST `/api/v1/people`, existente, con PERSON_CREATE:

```json
{
  "person": {"firstNames":"…","lastNames":"…","phone":null,"email":null,"birthDate":null},
  "branchId":"UUID autorizado",
  "document":{"issuingCountry":"CO","documentType":"…","documentNumber":"…"}
}
```

Conserva HTTP 201/400/401/403/404/409 y la transacción de persona/documento/vinculación. La respuesta de alta completa ahora también branchName, hasDocuments, createdAt y updatedAt, añadidos en HU-001. Un duplicado visible usa el mismo code/title 409 que el índice UNIQUE cuando el documento está oculto por RLS; nunca devuelve UUID, nombre ni sede ajenos.

Nuevo auxiliar GET `/api/v1/people/registration-options`, autorizado con PERSON_CREATE. Devuelve `branches: [{id,name}]`, `countries: string[]`, `documentTypes: string[]`. No duplica POST ni /branches: este último exige BRANCH_VIEW y no sirve para cuentas solo CREATE. Solo devuelve sedes activas autorizadas y sugerencias documentales de esas sedes; nunca números de documento. CO conserva el default existente. No se inventa un catálogo cerrado: el modelo admite tipos textuales y país de dos letras; los selectores permiten escribir valores compatibles con el contrato.

El guard del contenedor admite VIEW o CREATE; la capacidad específica de cada ruta hija tiene precedencia. Esto impide que el permiso CREATE heredado habilite por accidente listado/detalle VIEW. La API sigue siendo la autoridad final; manipular branchId no amplía accesos.

## Archivos

- Backend: `Application/Ministry/Contracts.cs`, `Infrastructure/Ministry/PeopleService.cs` y `Api/Controllers/MinistryControllers.cs`, bajo `backend/src/`.
- Pruebas backend: `PeopleRegistrationTests.cs`, `PeopleBrowserFixtureTests.cs` y ajuste del helper de grants en `PeopleQueryTests.cs`, bajo `backend/tests/MisionLiderParis.IntegrationTests/`.
- Angular: `features/members/person-registration-page.{ts,html,scss,spec.ts}`, `registration-draft.guard.ts`, `members.store.ts`, `members.store.spec.ts`, `members.models.ts`, `members-page.{ts,html}`; `features/administration/admin.routes.ts` y `overview-page.ts`; `core/auth/access-context.ts`, `access-guards.ts`, `access-guards.spec.ts`; `core/theme/primeng-preset.ts` y `app.config.ts`, bajo `frontend/src/app/`.
- Navegador: `frontend/e2e/people-registration.spec.ts`, `people-registration-real.spec.ts` y `frontend/playwright.people-real.config.ts`.
- Documentación: este archivo, contratos API, administración y `specs/010-person-registration/`.

## Evidencia

- 58 unitarias .NET + 54 integraciones correctas en la selección sin PostgresActivationTests. Cinco integraciones nuevas verifican registro completo, opciones/permisos distintos por sede, datos inválidos, estado/documento/fechas/contacto, ausencia de cuenta Identity, duplicados visibles/ajenos, rollback tardío y concurrencia entre sedes.
- 77 unitarias Angular correctas, incluidas validación/normalización, store, doble envío, 400/401/403/409, limpieza por sesión y precedencia de guards.
- 38 E2E ordinarios correctos, ocho de HU-002 en escritorio/móvil, con API controlada. Los errores ECONNREFUSED de restauración opcional de sesión en tests públicos corresponden a la API habitual detenida; no contactan Supabase.
- Dos E2E **reales** adicionales correctos: Chrome headless → Angular HTTPS → proxy con certificado validado → API Kestrel HTTPS → PostgreSQL aislado. Sin interceptación HTTP. Cubren login con cuenta temporal solo VIEW/CREATE (sin BRANCH_VIEW), listado → registro → POST 201 → ficha → recarga → búsqueda en listado → logout. Se ejecutan dentro de una integración .NET, no son dos integraciones adicionales al total 54.
- Builds .NET Release y Angular correctos, checks spec/design/format/deps/skills correctos. Capturas controladas del formulario desktop/mobile en `frontend/artifacts/010-registration-*.png`; sin desbordamiento del documento. Ajustes de localizadores E2E a texto de sede y diálogo con nombre accesible; repetición posterior correcta.

TRX finales: `backend/artifacts/people-registration/registration-final_net10.0_20261107121504.trx` y `registration-final_net10.0_20261107121608.trx`. Resumen real: `backend/artifacts/people-registration/browser-registration-result.txt`. Sin credenciales en los resultados. La fixture genera contraseña/certificado/clave de contexto temporales, usa conexiones separadas de pruebas y elimina el PFX al terminar; no lee ni modifica User Secrets. API, servidor Angular de la fixture y PostgreSQL de pruebas se detienen al finalizar.

## Reproducción

No iniciar helpers de aplicación con PostgreSQL local. Para **pruebas** usar exclusivamente una base de loopback ya preaprovisionada, sufijo `_tests`, con contexto firmado instalado, y las variables temporales MLP_TEST_DATABASE, MLP_TEST_IDENTITY_DATABASE, MLP_TEST_OPERATOR_DATABASE y MLP_TEST_PREPROVISIONED=1. No migrar ni usar conexiones Supabase.

```powershell
# Las variables anteriores deben existir solo en esta sesión de pruebas.
$env:MLP_RUN_PEOPLE_BROWSER='1'
dotnet test backend/MisionLiderParis.slnx -c Release --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger trx --results-directory backend/artifacts/people-registration
npm --prefix frontend test -- --watch=false
npm --prefix frontend run test:e2e -- auth.spec.ts people.spec.ts people-registration.spec.ts public-site.spec.ts
npm run build
npm run spec:check
npm run design:check
npm run format:check
```

La fixture real elige puertos libres de loopback, prepara credenciales sintéticas y confianza TLS únicamente para sus procesos. No ejecutar su config Playwright manualmente con credenciales productivas. Por defecto la prueba real queda omitida si no existe opt-in explícito. La activación histórica con migraciones/bootstrap se excluye siempre de esta ejecución.

## Límites pendientes

- Supabase: no modificado ni aceptado todavía; requiere activación de seguridad y aceptación separadas. No hay fallback a actor sin firma.
- La restricción UNIQUE existente compara la combinación literal. Todas las altas nuevas se normalizan; no se inspeccionó ni regularizó la normalización histórica de documentos en Supabase. Identificaciones antiguas no canónicas fuera del ámbito requieren revisión separada antes de afirmar unicidad semántica global. No se añadió una consulta privilegiada que omita RLS.
- El 409 informa de un conflicto según el contrato conservado. Se iguala la respuesta visible/ajena y se ocultan datos personales; no se promete ocultar toda inferencia de existencia manteniendo ese código HTTP.
- No existe catálogo institucional cerrado de países/tipos en el modelo inspeccionado. Las sugerencias editables respetan el contrato actual; no equivalen a una nueva regla de homologación documental.
