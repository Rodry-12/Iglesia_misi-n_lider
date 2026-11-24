# Validación HU-007

Fecha: 2026-11-07. Entorno aislado; Supabase intacto. Estado remoto pendiente del despliegue coordinado de seguridad.

## Resultados y trazabilidad

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| AC-001 | ProcessCatalogTests.cs: cinco escenarios nuevos HTTP/PostgreSQL, DTO/metadatos, permisos independientes, escritura global, CRUD/estado, unicidad, inválidos, relaciones/asignaciones y concurrencia | 58 unitarias .NET y72 integraciones aprobadas |
| AC-002 | catalog.store.spec.ts (9), catalog-form-page.spec.ts (5), guard global nuevo, catálogo E2E (5 casos x 2 viewports) y regresión existente | 116 unitarias Angular y66 E2E controlados aprobados |
| AC-003 | PeopleBrowserFixtureTests ejecuta pruebas reales de catálogo y regresión Personas, una API propia por viewport | Cuatro recorridos reales correctos: catálogo desktop/mobile y Personas desktop/mobile |

Las72 integraciones incluyen una fixture que lanza cuatro casos reales de navegador; no contarlos como integraciones adicionales. Se excluye PostgresActivationTests porque ejecuta migraciones/bootstrap, prohibidos. Cero fallos/omitidos dentro de la selección final.

## Comandos de compilación y checks

- dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore: correcto, cero errores y advertencias.
- npm run build: correcto,491.90kB inicial (bajo presupuesto).
- npm test -- --watch=false:116/116,16 archivos.
- npm run spec:check, npm run design:check, npm run format:check, npm run deps:check, npm run skills:check: correctos.
- Desde frontend: node node_modules/@playwright/test/cli.js test catalog.spec.ts people-state.spec.ts people.spec.ts people-registration.spec.ts people-editing.spec.ts auth.spec.ts public-site.spec.ts:66/66,2.8minutos.
- Comprobación específica posterior al ajuste visual de enlaces/jerarquía/espaciado: node node_modules/@playwright/test/cli.js test catalog.spec.ts:10/10,34.0segundos. Mismos casos únicos de la suite, no diez adicionales.

## Ejecución .NET y navegador real

Reutiliza el clúster aislado existente y roles separados; no instala PostgreSQL ni aplica SQL/migraciones.

```powershell
$env:MLP_TEST_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_test_runtime_d09960275a58;SSL Mode=Disable'
$env:MLP_TEST_IDENTITY_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=mlp_identity_runtime;SSL Mode=Disable'
$env:MLP_TEST_OPERATOR_DATABASE='Host=127.0.0.1;Port=57693;Database=mlp_user_validation_tests;Username=postgres;SSL Mode=Disable'
$env:MLP_TEST_PREPROVISIONED='1'
$env:MLP_RUN_PEOPLE_BROWSER='1'
& backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe start -D backend/.local/user-validation-20261106/data -o '-p 57693 -h 127.0.0.1' -l backend/.local/user-validation-20261106/catalog-final.log -w
if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL did not start' }
try {
  dotnet test backend/MisionLiderParis.slnx --configuration Release --no-restore --filter 'FullyQualifiedName!~PostgresActivationTests' --logger 'trx;LogFilePrefix=catalog-final' --results-directory backend/artifacts/process-catalog
  $taskExit=$LASTEXITCODE
} finally {
  & backend/.local/postgresql-17.11/pgsql/bin/pg_ctl.exe stop -D backend/.local/user-validation-20261106/data -m fast -w
}
if ($taskExit -ne 0) { throw 'Test failure' }
```

TRX en backend/artifacts/process-catalog:
- catalog-final_net10.0_20261107141145.trx:58 unitarias.
- catalog-final_net10.0_20261107141317.trx:72 integraciones,1min31segundos.
- Resumen real: backend/artifacts/process-catalog/browser-catalog-result.txt.
- La regresión real de Personas conserva backend/artifacts/people-registration/browser-registration-result.txt.

Fixture: cuentas sintéticas efímeras (operador Personas y administrador global catálogo), contraseñas aleatorias en variables de proceso y certificado HTTPS privado efímero. No bootstrap, User Secrets ni cuenta real. No intercepta peticiones HTTP en los cuatro recorridos reales. La API se reinicia entre viewports para respetar los límites120/min e identificación10/min por IP, sin desactivar ni relajar limitadores del producto. El frontend se conecta a esa API propia con proxy TLS verificado mediante CA efímera; trace/video/screenshots de estos recorridos reales permanecen deshabilitados.

## Cobertura concreta

- CATEGORY_VIEW no concede PROCESS_VIEW y viceversa; códigos CREATE/UPDATE de OPERATOR en sede no autorizan escritura global. Acceso a catálogo no concede PROCESS_ASSIGN.
- Creación/edición devuelven fechas persistidas; UUID y creación se conservan. Destino activo/existente obligatorio; caso vacío400, inexistente/inactivo404.
- Unicidad: categorías globales por nombre literal, procesos por categoría+nombre; mismo nombre en categorías distintas permitido. Movimiento hacia duplicado409 revierte relación. Dos creaciones concurrentes idénticas producen201/409.
- Se mueve proceso con asignación existente según regla actual; se desactiva proceso/categoría sin cambiar esa asignación. Reactivación de proceso en categoría inactiva409. Disponibilidad isActive=true no incluye categorías inactivas; AssignmentService rechaza ambos tipos de inactividad.
- Angular: estados vacíos/carga/error, filtros independientes/URL, selección, paginación, precarga, validación, normalización, opciones de categoría superiores a100, envío único, borrador, confirmación de baja/cancelación, permiso global, limpieza de sesión y rechazo401.
- Real: categoría crear201/detalle/editar200/baja204/alta204; proceso crear201/categoría real/detalle/editar200/baja204/recarga/alta204; selección desde catálogo y logout. Replicado desktop/mobile, sin mocks HTTP.

## Revisión visual

Screenshots sintéticos ignorados por Git: frontend/artifacts/013-catalog-detail-desktop.png,013-catalog-detail-mobile.png,013-catalog-list-desktop.png y013-catalog-list-mobile.png. Formularios/fichas se adaptan a móvil; tabla compacta con scroll contenido y UUID solo en ficha. Se corrigió el contraste de enlaces sólidos usando el estilo outlined público de PrimeNG, sin duplicar colores. Jerarquía de encabezados y espaciado usan SCSS y tokens. E2E comprueba ausencia de desbordamiento horizontal. No se afirma auditoría exhaustiva de accesibilidad.

## Incidencias resueltas y límites

Pruebas iniciales: una variable process del test ocultaba process.env; se renombró. Se estabilizaron esperas de navegación y se proporcionó una segunda página real en la fixture de paginación. Los cuatro recorridos rápidos alcanzaban429 al compartir una instancia/IP; cada viewport ahora usa su propia API, conservando limitadores y contratos del producto. El test real comprueba explícitamente respuestas PUT antes de seguir. Ejecuciones fallidas se conservan separadas de la ejecución final aprobada.

La respuesta de edición de categoría se proyecta dentro de su transacción, igual que la de procesos. No se atribuye el429 a una vulnerabilidad o a una pérdida de datos; se mantiene el error sin éxito falso.

Sin conteos agregados disponibles: no se infieren cantidades desde páginas. Sin versión esperada de edición: se conservan bloqueos y semántica existente, sin afirmar detección de formularios obsoletos. Consulta de opciones no es un snapshot transaccional; backend valida otra vez el destino al guardar. Sin interfaz de asignaciones individuales; disponibilidad se comprueba en backend aislado.

No se han ejecutado SQL remoto, migraciones, bootstrap,090 ni cambios al contexto firmado. Las pruebas públicas registran ECONNREFUSED en sondeo opcional de sesión de7243 porque la API operativa no se inicia; la fixture real usa puertos aleatorios propios. Al terminar se detienen procesos de prueba y clúster, y se elimina PFX privado efímero. No se afirma aceptación Supabase ni ejecución en CI.

## Submenu Formacion - 2026-11-22

ADMIN_NAVIGATION define Crear categoria, Crear proceso, Seguimiento y Asignar proceso con las rutas existentes. Children filtrados por capacidad y alcance global de creacion; no se cambian guards ni permisos backend. Layout mantiene enlace al catalogo mas boton PrimeNG/Lucide de expansion con aria-controls/expanded, lista anidada, foco visible, enlace activo y apertura al entrar/recargar rutas hijas. Cierre movil existente conservado.

Verificacion: 11/11 unitarias focalizadas de acceso correctas. Navegador controlado catalogo/asignacion/layout: 26 casos correctos inicialmente; tres fallos corregidos en expectativas/sincronizacion de pruebas (esperar vista renderizada antes de comprobar sidebar, mock pageSize conforme a consulta real). Repeticion focalizada 6/6 correcta en desktop/mobile: cuatro opciones, hrefs, teclado, recarga/activo, sin escritura, ocultar creacion global a sede y paginacion sin sesion previa. En conjunto 29 casos distintos verificados; un caso tablet se omite intencionalmente en proyecto movil y si se verifica en desktop. Build, formato de archivos editados, design:check y spec:check correctos; advertencia previa bundle 583,56 kB/500 kB. Los selectores de creacion de pruebas existentes se limitan a main para distinguir acciones de pagina de enlaces laterales. Fixture real historica solo ajustada en selectores, no ejecutada. Sin imagenes ni cambios Supabase; no se crearon categorias, procesos ni asignaciones reales. Aceptacion con la sesion real del usuario pendiente.

## Separacion funcional de modulos - 2026-11-22

Correccion solicitada tras el submenu inicial: Formacion ahora es TrainingHome, portada de cuatro accesos sin GET de categorias/procesos. Categorias y Procesos tienen rutas/listados separados con la creacion correspondiente dentro de cada uno. TrainingPage reutilizada por data.kind; CatalogStore mantiene el tipo activo al reintentar/refrescar y cancela lecturas del modulo anterior. Ver procesos abre el otro modulo filtrado; cancelar y volver de formularios/fichas regresan a su listado. Seguimiento y Asignar conservan implementaciones y permisos. Sidebar cambia sus dos primeras entradas a Categorias/Procesos y enlaza los listados, no los formularios.

21/21 unitarias focalizadas de acceso/store correctas. 24/24 recorridos de catalogo/asignacion y 8/8 de seguimiento desktop/mobile correctos con HTTP interceptado: consultas separadas aun con ambos permisos, portada sin consultas, rutas/recarga/activo, filtros/paginacion, creacion/edicion y regresos, rechazo de escritura global a sedes y autorizacion independiente de asignacion/lectura. Build correcto, advertencia inicial de 583,74 kB/500 kB. design:check/spec:check y formato editado correctos. Sin imagenes ni cambios Supabase, usuarios o correos; los CRUD de navegador son controlados. Fixture historica aislada adaptada en rutas/regresos, no ejecutada. Aceptacion con sesion real del usuario pendiente.

## Patron administrativo y modales - 2026-11-22

FR-008 implementado en Categorias y Procesos: filtros en panel, crear primario a la derecha, sin segundo titulo ni boton Buscar, texto con debounce 2000ms y estado inmediato (Activa/Inactiva en categorias), X solo con texto. Tabla PrimeNG con scroll interno, acciones Lucide con nombres accesibles/titulos, badges y paginador compartido 10/20/50 con recuento al pie. Categorias deja de usar tarjetas. No se muestran cargas locales duplicadas del overlay global.

Crear/editar y detalle son Dialog con CatalogStore privado. TrainingPage sirve de listado de fondo tambien en rutas directas catalogMode; conserva consulta/filtros/pagina, y evita recargar el listado ya autorizado al abrir un modal. Formularios mantienen validaciones, duplicados, opciones activas, bloqueo de doble envio y guard de borrador; footer fijo Cancelar/Guardar por form/id; guard padre delega canLeave. Guardado confirmado notifica Toast, cierra modal y refresca listado. Detalle espera respuesta GET y es solo lectura, sin UUID/fechas tecnicas ni acciones de editar/estado. Confirmacion y reglas de cambio de estado siguen en la fila. Errores GET se notifican sin abrir modal vacio y ofrecen regreso al listado.

Verificacion: 26/26 unitarias focalizadas (formulario, store y acceso); 16/16 recorridos controlados iniciales del catalogo mas 4/4 nuevos de debounce/estado y espera GET/footer en escritorio/movil (20 casos distintos). Regresion final de apertura y CRUD controlado 4/4 tras evitar recarga del fondo. Build correcto; solo advertencia previa del bundle 583,74 kB/500 kB. design:check/spec:check y formato de archivos editados correctos. Fixture real historica adaptada a modales/nombres accesibles y ausencia de UUID, sin ejecutarla. No se modifico Supabase ni se crearon categorias/procesos reales; HTTP interceptado en navegador, sin imagenes. Aceptacion con sesion real del propietario pendiente.

### Correccion de contraste de botones Crear - 2026-11-22

La regla global a aplicaba el color verde institucional a los enlaces pButton, sobrescribiendo el color de PrimeNG sobre fondo verde. Se limita a a:not([pButton]); los botones conservan el color semantico de su tema y los enlaces normales mantienen el verde. Verificacion de navegador 2/2 desktop/mobile: ambos Crear categoria/Crear proceso con texto e icono visibles y contraste calculado >=4,5:1 en claro/oscuro y hover, sin imagenes ni escrituras reales. design:check correcto.

### Cierre sin consultas y Guardar con cambios - 2026-11-22

La recarga al cerrar provenia de TrainingPage al entrar nuevamente al listado (!mode). Detalle y cancelacion transmiten estado de navegacion catalogUnchangedReturn; se reutiliza solo la pagina en memoria de mismo tipo y filtros. Si no hay pagina o cambian filtros se consulta normalmente; un guardado confirmado no transmite retorno sin cambios y refresca una sola vez. No se crea cache permanente ni se omiten controles de autorizacion. Guardar conserva validacion/changed y se verifico reactividad del boton con entrada real.

Dos recorridos desktop/mobile correctos con HTTP interceptado; cada uno prueba Categorias y Procesos: cerrar vista no suma GET de listado, cancelar sin cambios tampoco, Guardar deshabilitado inicialmente, habilitado con nombre nuevo valido, deshabilitado con nombre vacio y al restaurar original, guardado realiza un PUT y exactamente un GET de refresco. Build correcto; advertencia previa bundle 583,76 kB/500 kB. Sin imagenes, datos ni cambios Supabase.

### Diagnostico operativo de consulta de procesos - 2026-11-22

Consulta real mediante IProcessCatalogService.ProcessesAsync y las dependencias existentes, identidad institucional global activa, conexion runtime TLS VerifyFull y contexto firmado. Transaccion explicita de solo lectura finalizada con ROLLBACK. Sin filtros: totalCount=18 y 18 elementos devueltos (pagina predeterminada 25); consulta del servicio 1243 ms dentro de la transaccion ya instalada, no representa tiempo HTTP extremo a extremo. Categorias=5; conteos por categoria=6,0,4,4,4. No se modificaron datos, permisos, User Secrets ni configuracion de la API.

El resultado acredita que el servicio existente obtiene procesos reales con autorizacion global. No acredita aun la peticion de la sesion del navegador del usuario: falta contrastar URL/filtros, estado HTTP y respuesta concreta para identificar la causa de la pantalla vacia. La busqueda actual usa Contains y es sensible a mayusculas; categoria, estado y pagina tambien pueden restringir el resultado. No se atribuye el fallo a ninguno sin la peticion afectada. Herramienta local de diagnostico compilada correctamente, cero errores/advertencias; sin nuevo endpoint publico.

### Busqueda uniforme de categorias y procesos - 2026-11-22

Se corrige Contains sensible a mayusculas aplicando translate + upper a nombre y termino en ProcessCatalogService antes de paginar/contar. SearchNormalization extrae el mapeo ya utilizado por Sedes, conservando ese comportamiento. No se cambian datos, unicidad, autorizacion, filtros de estado/categoria ni el debounce Angular de 2s.

Prueba real de solo lectura con IProcessCatalogService y contexto firmado sobre Supabase, finalizada en ROLLBACK: categorias Con/con/CON/Consolidación/consolidacion y Unicode descompuesto devuelven los mismos identificadores. Procesos: nombre real en minusculas, mayusculas, sin tildes y Unicode descompuesto conserva el resultado dentro de su categoria. Diez comprobaciones correctas; total sin filtros sigue en 18. Compilaciones KeyOperator/API Release correctas, cero errores y advertencias. Estas son pruebas del servicio real; no se presentan como navegacion E2E ni medicion HTTP. Sin cambios de Supabase ni secretos.

### Correccion de alcance de busqueda consol - 2026-11-22

Causa comprobada mediante servicio real sobre Supabase: consol encontraba una categoria, pero cero procesos porque ninguno de sus nombres contiene esa secuencia; los seis pertenecen a Consolidacion. El predicado de procesos solo buscaba p.Name. Se extiende a p.Name OR p.Category.Name, ambos normalizados antes de contar/paginar, sin cambiar filtros, permisos ni datos. Placeholder Angular aclara nombre o categoria.

Lecturas reales con contexto firmado y ROLLBACK: consol encuentra una categoria y seis procesos; consol/Consol/CONSOL/consolidacion/Consolidación/Unicode descompuesto devuelven totalCount=6 aun con pageSize=1 y un elemento correcto. Se conservan comprobaciones anteriores de busqueda por nombre de procesos y categorias. Dos recorridos Playwright desktop/mobile correctos con HTTP controlado comprueban tecleo de consol/CONSOL/consolidacion y renderizado sin escrituras: no equivalen a E2E autenticado contra Supabase. Build API y Angular correctos; Angular conserva advertencia previa de bundle 583,76/500 kB. Sin imagenes, SQL remoto de escritura, cambios de secretos ni datos.

### Aviso prematuro de categorias activas - 2026-11-22

Causa: catalog-form-page.html notificaba ausencia al evaluar options().length=0 mientras loadOptions aun estaba pendiente; ocultar Dialog durante carga no impide crear su contenido/Toast. Se incorpora optionsLoaded, falso al iniciar/limpiar/error y verdadero solo tras cargar todas las paginas. Aviso vacio requiere optionsLoaded y no optionsLoading. No se oculta un fallo real: optionsError conserva notificacion de error y reintento.

Verificacion real de solo lectura de CategoriesAsync con IsActive=true, PageSize=100: 5 categorias activas disponibles; contexto firmado y ROLLBACK, sin escrituras ni cambios de secretos. Unitarias focalizadas: 16/16 correctas, incluida distincion pendiente/vacio confirmado/error y paginacion completa. Playwright desktop/mobile: 2/2 correctos con HTTP controlado, demora 1800ms sin aviso falso y opciones visibles, error503 con aviso correcto sin aviso vacio, respuesta200 vacia con aviso valido; cero escrituras. Build Angular correcto con advertencia previa de bundle 583,76/500kB; spec:check y design:check correctos. No son E2E autenticados sobre Supabase, no se generaron capturas ni correos.
