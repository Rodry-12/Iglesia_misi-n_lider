# 001 — Backend ministerial

Estado: En curso. Solicitud del 2026-10-23. Fuente: documento «PROMPT MAESTRO — DESARROLLO COMPLETO DEL BACKEND DE MISIÓN LÍDER PARÍS» adjunto en la conversación.

## Resultado y alcance

Implementar una API .NET 10 para administración ministerial multi-sede consumible por Angular. Esta petición abre el incremento de backend antes diferido. Tras una suspensión intermedia de unitarias, la fase de activación del 2026-10-24 retoma explícitamente las pruebas automatizadas del backend, incluidas unitarias. Las unitarias Angular siguen diferidas.

En la entrega inicial el usuario indicó que no proporcionaría el DDL y el repositorio no tenía SQL ni conexión. Después se aportaron la referencia y credenciales, como se describe a continuación. No se inventan mapeos ni se crea una base ministerial alternativa.

Actualización del 2026-10-23: el usuario aportó una reconstrucción SQL de referencia, conservada como texto en `docs/reference/ministerial-reconstruction.sql.reference.txt`, y datos completos de conexión para inspección autorizada. La referencia NO acredita la estructura real. El intento de conexión directa falló por falta de ruta IPv6 (NetworkUnreachable), antes de verificar credenciales o ejecutar consultas. Instrucción obligatoria nueva: verificar Supabase y comparar ANTES de implementar sus mapeos EF. No ejecutar la reconstrucción, ni siquiera para simular que se verificó Supabase. Sin conexión operativa, avanzar solo en análisis, comparador, diseño incremental y autenticación independiente de las tablas ministeriales.

## Requisitos

- FR-001: Solución .NET 10, C# en inglés y capas Domain, Application, Infrastructure y Api; EF Core 10 y Npgsql; configuración sin secretos.
- FR-002: Inspección PostgreSQL de solo lectura previa a mapear `iglesia`; conservar tablas, índices, CHECK, FK, RLS y triggers. Nunca EnsureCreated, EnsureDeleted ni migraciones automáticas.
- FR-003: Identity sin duplicar roles funcionales, aislado en `auth_app`. Login, confirmación, recuperación, cambio/restablecimiento, logout, revocación y bootstrap por comando local.
- FR-004: Cookies HttpOnly/Secure/SameSite, CSRF incluso en login, CORS explícito, lockout, rate limiting, ProblemDetails, logs sin datos personales y comprobación del security stamp por petición.
- FR-005: Administración de usuarios con paginación, activación, asociación a persona y accesos por rol/sede, impidiendo acceso horizontal y escalada. Los permisos se resolverán de tablas reales.
- FR-006: CRUD de sedes, personas/documentos/vinculación/traslado, categorías/procesos y asignaciones; transacciones e integridad según el esquema y triggers confirmados.
- FR-007: Reportes que distinguen personas de asignaciones y limitan datos en SQL al ámbito permitido.
- FR-008: OpenAPI, health checks, instrucciones operativas, CI, pruebas unitarias backend e integración HTTP/PostgreSQL aisladas; retomadas en fase de activación.
- FR-009: Comparar referencia y metadatos reales de tablas, columnas, tipos, nullabilidad, defaults, relaciones, CHECK, índices, triggers, funciones y RLS. Registrar diferencias y fallar de forma segura si falta conexión o hay diferencias pendientes; el SQL de referencia nunca es un ejecutable de inicio/migración/test.
- FR-010: Separar USER_VIEW/CREATE/UPDATE/CHANGE_STATUS/ASSIGN_ROLE por operación y diseñar concesiones explícitas para OPERATOR, sin duplicar el catálogo de permisos ni roles en Identity.

## Aceptación

- AC-001: La solución restaura y compila con .NET 10 sin errores ni advertencias; Angular conserva su build.
- AC-002: La exportación de metadatos inspecciona las once tablas, restricciones y funciones de los tres triggers con conexión autorizada, sin alterar datos.
- AC-003: Identity autentica credenciales reales, confirma correo, bloquea intentos y cambia/restablece contraseñas con tokens temporales de un uso; logout invalida cookies copiadas.
- AC-004: Sin sesión se devuelve 401 sin redirección, sin CSRF se rechazan escrituras, CORS no autoriza orígenes ajenos y readiness falla cuando faltan conexión o mapeos.
- AC-005: SuperAdmin puede administrar globalmente; BranchAdmin solo operadores subordinados en sedes con permiso de administrar usuarios; operador sin permiso y acceso horizontal quedan denegados.
- AC-006: Los CRUD ministeriales y las asignaciones cumplen FR-006, incluyendo documento único obligatorio, una sede principal activa y responsable distinto de la persona en la misma sede.
- AC-007: Los reportes globales y por sede cumplen FR-007 con paginación y conteos independientes.
- AC-008: Existen especificación, trazabilidad, README, configuración, contrato Angular y workflow reproducible, con límites de evidencia explícitos.
- AC-009: La herramienta de comparación no ejecuta SQL de referencia, identifica diferencias estructurales y exige revisión de CHECK/funciones/RLS; una comparación sintética no se presenta como verificación real de Supabase.
- AC-010: Cada operación de usuarios exige su permiso correspondiente y sede autorizada; los permisos explícitos del operador no superan los delegables por el administrador. El modelo propio de concesiones no altera tablas ministeriales.

## Decisiones y exclusiones

Continuación con Session pooler: se abrió conexión IPv4 con certificado raíz público de Supabase y VerifyFull. Se inspeccionaron las once tablas reales en transacción READ ONLY: no hay diferencias de columnas/tipos/defaults/nullabilidad/relaciones, y las 37 observaciones iniciales corresponden a RLS, representación de CHECK/predicados y cuerpos de funciones. Se revisan explícitamente antes de implementar mapeos. No se ejecutó reconstrucción ni DDL. El bloqueo de conectividad IPv6 descrito antes es histórico y ya está resuelto para este pooler; no volver a solicitar credenciales por ese motivo.

Sin registro público, diezmos/ofrendas, LMS, historiales de procesos, responsables o seguimientos, envío real de correo en pruebas ni despliegue. Las tablas nuevas de Identity son diseño propio revisable. Las referencias UUID a persona/rol/sede/permiso tienen FK verificadas en el script incremental 004, aplicado solamente en PostgreSQL local aislado.

`IMinistryDirectory` consulta ahora los catálogos ministeriales reales. `MinistryDbContext` mapea las once tablas confirmadas y las excluye de migraciones. Se implementaron CRUD, asignaciones y reportes; no se considera habilitado Supabase hasta revisar y aplicar los scripts incrementales con un usuario de ejecución sin BYPASSRLS.

Backend sin UI. `docs/design-system.md` y ADR 0003 siguen vigentes para Angular; no se modifican tokens, PrimeNG ni formularios en este incremento.

## Activación autorizada — 2026-10-24

La nueva solicitud retoma explícitamente las pruebas automatizadas, incluidas las unitarias del backend. Las unitarias de Angular siguen diferidas. El objetivo es activar y verificar una instancia PostgreSQL local representativa, conservando los módulos existentes; no autoriza aplicar cambios en Supabase productivo.

- FR-011: Revisar configuración, UUID/FK entre esquemas, triggers, modelo y separación de credenciales DDL/runtime. Rechazar runtime propietario de tablas o con capacidad de omitir RLS.
- FR-012: Aplicar en una base local nueva el baseline real y los scripts 001–005, conservando filas de prueba existentes y la identidad de las once tablas.
- FR-013: Verificar respaldo y restauración reales en otra base aislada; registrar límites de una recuperación productiva.
- FR-014: Ejecutar bootstrap mediante el comando real, rechazar repetición y verificar el primer login por HTTPS con cookie y CSRF usando credencial runtime distinta.
- AC-011: Restore/build y todas las unitarias/integración disponibles pasan con resultados exactos registrados.
- AC-012: La aplicación de SQL 001–005 preserva contenido y OID de las once tablas, y valida FK/UUID, vínculos cuenta/persona y concesiones por sede sin escalada observada en los escenarios ejecutados.
- AC-013: Un respaldo local se restaura correctamente en una base nueva con contenido equivalente; una migración que falla preflight revierte sin alterar filas.
- AC-014: Bootstrap CLI crea una única cuenta SUPER_ADMIN confirmada con hash Identity, no permite repetirse y admite primer login HTTPS bajo NOBYPASSRLS; logout invalida sesión.
- AC-015: Existen comandos reproducibles, inventario SQL ordenado, configuración sin secretos y guía de aplicación/recuperación/primer acceso, sin cambios en Supabase.

## Paso 18 — preparación segura de Supabase

El usuario autoriza una comparación nueva de metadatos de solo lectura en Supabase y correcciones/ensayos locales; prohíbe modificaciones productivas, reconstrucción de tablas, cambios de credenciales existentes y acceso público sin verificar autorización.

- FR-016: Revisar objetos, dependencias, locks, idempotencia, consultas posteriores y recuperación de los cinco scripts, con especial atención a 003/005.
- FR-017: Inspeccionar ACL/default ACL, propietarios, RLS, roles/membresías y compatibilidad del operador Supabase, sin consultar registros personales ni contraseñas.
- FR-018: Comprobar credenciales en archivos e historia Git sin imprimir sus valores; limitar DPAPI a helpers Windows y preparar configuración portable de producción con secretos externos y claves persistentes cifradas.
- AC-016: Captura viva READ ONLY y comparación actual, con límites/diferencias explícitos, sin DDL productivo.
- AC-017: Scripts revisados y ensayados con conservación de tablas/datos, verificación posterior y rechazo de configuraciones inseguras; probar también operador local sin SUPERUSER/BYPASSRLS.
- AC-018: Suite backend completa ejecutada con resultados exactos, respaldo/restauración, bootstrap y aislamiento por sede en PostgreSQL local aislado representativo.
- AC-019: Auditoría de secretos de Git y delimitación DPAPI/producción documentadas, sin persistir secretos en archivos versionados.
- AC-020: Procedimiento controlado de producción con prerrequisitos, comandos exactos, verificaciones y recuperación; aplicación pendiente de autorización explícita.

## Corrección de coherencia de cuentas — 2026-11-06

- FR-019: Creación, edición de persona vinculada, sustitución de concesiones y resolución de sesión validan la persona contra las concesiones efectivas de la cuenta destinataria; los privilegios del actor solo autorizan la operación y la delegación.
- FR-020: Una cuenta no global vinculada exige persona activa y pertenencia principal vigente a una sede activa incluida en sus concesiones. SUPER_ADMIN global exige persona activa si está vinculada, sin exigir sede concreta. Se conservan personas sin cuenta y cuentas sin persona.
- FR-021: Cambiar personId o concesiones revoca sesiones anteriores; traslado/desactivación de personas conservan su revocación y la siguiente resolución de acceso aplica el ámbito actual.
- AC-021: Una integración reproduce antes de la corrección el alta por SUPER_ADMIN de cuenta de sede B con persona de A; después se rechaza sin persistir la cuenta. Edición y sustitución inválidas preservan datos y sesión anteriores.
- AC-022: Un servicio compartido usa el ámbito destinatario en administración y sesión. Unitarias cubren ámbitos globales, por sede, múltiples sedes y vínculo opcional; integraciones cubren altas válidas e inválidas y actualización de personId/concesiones.
- AC-023: Integraciones verifican revocación tras vínculo/desvínculo, sustitución de concesiones, traslado y baja de persona, así como rechazo de escalada por un administrador de sede.
- AC-024: Restore/build y suite backend con PostgreSQL aislado pasan con resultados registrados, sin cambios de contratos HTTP, esquema ni Supabase.

## Remediación RLS firmada — 2026-11-07

- FR-022: Toda operación ministerial EF, incluidas lecturas, utiliza una transacción con actor firmado HMAC-SHA256 vinculado a xid8, conexión, base, login, vencimiento y security stamp. Un UUID o contexto de creación sin firma no autoriza.
- FR-023: AuthDbContext utiliza una credencial Identity separada del runtime ministerial; ninguno puede leer el almacén privado de claves. La revocación ministerial de sesiones solo se permite mediante un helper autorizado.
- FR-024: Preparar incremento SQL único y recuperación cerrada sin reconstruir tablas ni restaurar confianza en UUID sin firma. Conservar persona_documento y los históricos 010–080; no modificar Supabase ni ejecutar bootstrap/migraciones/090.
- AC-025: Las dos regresiones iniciales reproducen suplantación y persistencia; tras corregir, SQL sin prueba, prueba adulterada/vencida/reutilizada y contexto de creación no firmado no autorizan.
- AC-026: Pruebas verifican commit, rollback, cancelación, excepciones, reutilización física de conexión y solicitudes concurrentes por sede sin fuga de contexto.
- AC-027: Identity separado admite login/logout y administración existentes; el runtime no puede consultar/modificar Identity ni leer claves. Revocaciones conservan la invalidación de cookies y restringen la administración global.
- AC-028: Compilación, unitarias e integración aislada verifican personas/documentos/sedes/procesos y autorización; SQL incremental y recuperación tienen evidencia local y procedimiento remoto pendiente de autorización expresa.

## Rendimiento de lecturas firmadas — 2026-11-09

- FR-025: Agrupar resolución de concesiones y consultas relacionadas de listados en transacciones de solo lectura, omitiendo consultas con conjuntos vacíos, sin caché entre solicitudes ni cambios de RLS/HMAC/Identity.
- AC-029: Integraciones verifican una transacción y dos consultas para concesión global, dos transacciones para autorización/listado y autorización/lecturas ministeriales de administradores de sede, solo lectura, limpieza tras error, reutilización de transacciones del llamador y rechazo tras desactivar una cuenta. Documentar arranque y límites sin afirmar latencias HTTP no medidas.

## Diagnóstico ejecutable de rendimiento — 2026-11-23

- FR-026: Instrumentación opt-in por petición: correlación, ruta plantilla, estado HTTP, duración total, autenticación, resolución de accesos, contexto firmado, acción y ejecución del resultado, comandos Npgsql y aperturas lógicas/físicas. Sin SQL, parámetros, nombres, documentos, secretos, cuerpos, cookies ni valores de ruta/query. Detalles de comandos limitados y controlados por nivel/ambiente; no exportar tags del driver.
- AC-030: Unitarias comprueban aislamiento entre peticiones, ausencia de datos sensibles, modo inactivo y límites. Medir con contexto real seguro antes/después de una mejora acotada. Separar servicio real de HTTP autenticado, tiempos fríos/calientes y duración de cliente SQL de CPU PostgreSQL. Sin escrituras Supabase, nuevas cuentas, SQL DDL ni cambios de seguridad.

### Continuación — reducir viajes sin relajar controles

- FR-027: Agrupar comandos independientes del protocolo firmado en lotes Npgsql dentro de la misma transacción. Mantener READ ONLY antes del desafío, validación Identity independiente, desafío/HMAC, instalación local y verificación explícita, incluyendo cancelación y rollback. No reutilizar permisos entre peticiones ni cambiar SQL remoto.
- AC-031: Comparar servicios equivalentes antes/después; demostrar contexto aceptado y eliminado tras rollback, y ejecutar regresiones disponibles. Contabilizar lotes separados de sentencias para no confundir menos viajes con menos comprobaciones. No prometer95% ni milisegundos sin medición HTTP equivalente.

- FR-028: En GET ministeriales materializados de sedes/personas/categorías/procesos/asignaciones y lectura/selección de usuarios, reutilizar una única transacción firmada READ ONLY para resolución de permisos y datos dentro de la acción. Cada petición resuelve sus permisos actuales. Excluir escrituras, autenticación, controlador de reportes e integraciones externas; conservar transacción externa si existe. Las conexiones Identity siguen separadas.
- AC-032: Una lectura HTTP ministerial autorizada abre una transacción ministerial, mantiene RLS/autorización y finaliza su contexto al terminar. Comparar servicios con el mismo alcance de acción; conservar POST/PUT y comprobar regresiones disponibles, registrando fallos sin ocultarlos.
