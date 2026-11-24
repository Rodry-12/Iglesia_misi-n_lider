# Plan — 001 Backend ministerial

Continuación2026-11-10/AC-029: agrupar existencia de sede y catálogo de roles en
AdministratorsAsync dentro de BeginReadOnlyAsync; cerrar antes de conteo/página
Identity, cuya conexión separada se mantiene. Conservar autorización global previa,
404, paginación y transacciones externas. Verificar conteo de transacciones y
regresiones en loopback preaprovisionado; no migrar ni modificar Supabase.

## Rendimiento — 2026-11-09

AC-029: contar transacciones mediante eventos EF; centralizar apertura READ ONLY en
ActorTransactionContext; agrupar resolución de accesos y cinco listados, conservando
transacciones del llamador. Omitir lookups vacíos, sin caché de permisos ni cambios SQL.
Verificar aislamiento, revocación, rollback, prohibición de escrituras y concurrencia
en PostgreSQL aislado. Reiniciar únicamente la API local con el lanzador seguro,
comprobar HTTPS y documentar comandos, evidencia y límites de medición remota.

## Verificación de autorización por sede — 2026-11-06

Ejecutar primero pruebas existentes sin base. Reutilizar únicamente una base
loopback `_tests` ya preparada mediante modo explícito que evita migraciones,
DDL y seeds. Añadir escenarios simétricos de dos cuentas/sedes, HTTP/SQL,
asignaciones/reportes y contexto falsificado; comprobar el alcance SQL runtime
en Supabase con READ ONLY/ROLLBACK y SuperAdmin por HTTPS sin cambios ministeriales.
Registrar límites reales de confianza del actor y permisos granulares; no cambiar
código de producto ni presentar pruebas aisladas como prueba multisede remota.

## Corrección limitada de ejecución 040 — 2026-11-06

El usuario reporta query cortada dentro de la función en un THEN, sin cierre dollar-quoted. Conservar fuente 003, lógica PL/pgSQL, roles, locks, validaciones, CHECK, trigger, índice y transacción. Adaptar solo el 040 derivado a cuerpos en literales PostgreSQL E de una línea, sin dollar quotes, con cierre FIN 040. Comparar AST y texto decodificado de los once statements originales, analizar sintaxis offline con el parser ya disponible y añadir 041 READ ONLY. No repetir pasos previos ni ejecutar SQL remoto.

## Corrección limitada de ejecución 020 — 2026-11-06

Estado comunicado por el usuario: 010 OK; 020 falló al transformarse en SQL Editor; auth_app ausente, once tablas ministeriales, cuatro roles técnicos y cero políticas. No repetir 010 ni ejecutar cambios remotos. Derivar 020 de las sentencias reales de 001 con CREATE TABLE fuera de DO EF, preservando AST de modelo/índices/historial y el guard de primera ejecución. Documentar Run without RLS y evaluar denegación runtime si el Editor habilita Identity RLS sin políticas. Añadir 021 READ ONLY, verificación offline mediante parser PostgreSQL 17 y cotejo de 030–090 sin cambios. No cambiar fuente 001, modelo EF, permisos ni políticas.

## Adaptación SQL Editor — 2026-11-06

AC-020: generar cinco archivos derivados de los cuerpos reales de 001–005, conservar sus transacciones independientes y añadir contexto/checkpoints para sesiones SQL Editor. Separar preflight, roles/ownership, LOGIN runtime sin contraseña, verificación READ ONLY y cierre posterior al bootstrap. Usar SET TRUE/INHERIT FALSE temporal concedido por postgres y revocación del mismo grantor; no intentar retirar las membresías ADMIN-only automáticas de Supabase. Contraseñas mediante cliente interactivo externo existente; ningún secreto o metacomando psql en SQL entregado. No conectar ni ejecutar DDL durante esta preparación. Comprobar derivación/manifiesto/sintaxis y trazabilidad, sin atribuirles ejecución remota.

## Preparación de activación Supabase — 2026-11-06

AC-015/020: usar la inspección 009.1 ya completada del proyecto `sneceodpvscrvjrlqwgw`. Mantener frontend/servicios intactos. Preparar respaldo con clientes existentes y password interactivo, preflight READ ONLY de datos, inventario reproducible de roles/ownership y ejecución 001–005, runtime Production/VerifyFull, bootstrap y aceptación remota. No arrancar PostgreSQL local ni crear otro proyecto. No ejecutar DDL ni bootstrap sin respaldo verificado, estrategia de recuperación y aprobación expresa. El ensayo de restauración requiere un destino vacío autorizado aún no disponible; no confundir decodificación de archivo con restauración. Ver `docs/supabase-activation-2026-11-06.md`.

## Corrección de cuentas — 2026-11-06

Reproducir AC-021 por HTTP antes de cambiar producción. Centralizar la validación de persona y ámbito resuelto de la cuenta en AccountAccessValidator, reutilizado por AccessService y UserAdministration. Mantener separadas la autorización/delegación del actor y la coherencia del destinatario; conservar MinistryDirectory como consulta de persona activa y sede vigente. Revocar security stamp al cambiar personId. Sin cambios HTTP, EF, SQL ni UI. Añadir unitarias del servicio e integraciones de altas, edición, concesiones, traslado, baja y revocación. Verificar en un clúster PostgreSQL nuevo de loopback, base _tests, con baseline estructural y catálogos ficticios; nunca usar secretos ni datos remotos.

## Arquitectura

Domain contiene alcance, delegación y reglas de fechas/transiciones; Application publica DTOs, errores, paginación y contratos; Infrastructure implementa EF/Identity, servicios ministeriales, SMTP y catálogos; Api compone HTTP, cookies, CSRF, CORS, OpenAPI y salud.

AuthDbContext administra solamente auth_app, sin roles Identity. MinistryDbContext mapea las once tablas reales de iglesia, excluidas de migraciones. La inspección y comparación READ ONLY en Supabase se completaron antes de implementar estos mapeos. No ejecutar la reconstrucción adjunta.

La autorización resuelve roles/permisos activos existentes; cada operación exige su capacidad y sede. OPERATOR usa referencias explícitas a permisos en auth_app. Las consultas filtran en SQL; cada apertura de conexión fija el actor para RLS. Producción rechaza superuser/BYPASSRLS.

Escrituras ministeriales usan transacciones y bloqueos ordenados: sede, catálogo/proceso, personas y asignación. Traslado/baja rechazan asignaciones abiertas; documentos se reemplazan explícitamente; los reportes separan personas distintas de asignaciones.

## Secuencia

1. Conservar referencia/hash y completar inspección real previa a EF: realizado.
2. Implementar Identity y servicios sobre tablas verificadas: realizado.
3. Preparar scripts incrementales separados de reconstrucción: 001/002 auth_app, 003 integridad, 004 referencias, 005 runtime/RLS.
4. Verificar exclusivamente en PostgreSQL local dedicado y sin datos personales; compilar y ejecutar unitarias backend e integración HTTP/PostgreSQL, retomadas en fase de activación.
5. Actualizar trazabilidad con evidencia real. Mantener separado lo implementado, lo verificado localmente y lo pendiente de aplicación productiva.
6. Aplicación a Supabase únicamente con revisión del paquete concreto, respaldo/preflight, usuario DDL separado y configuración runtime/SMTP/claves. No se ha aplicado.

## Integración

API/Angular esperan HTTPS y mismo sitio con cookies Secure/HttpOnly/SameSite Strict, CSRF en escrituras y orígenes exactos. Sin credenciales en localStorage. Angular mantiene sesión nula hasta un incremento de integración. No se modifican PrimeNG, tokens ni UI.

CI restaura la estructura real únicamente dentro de PostgreSQL efímero y compila/prueba la solución backend completa; no despliega. Las unitarias Angular continúan diferidas.

Un TestServer no acredita SMTP, cookies en navegador, producción ni ejecución del workflow remoto. Registrar estas limitaciones y cualquier escenario omitido.

## Plan de activación (solicitud posterior)

Se retoman unitarias del backend y la solución completa. No ejecutar unitarias Angular. Revisar primero los mapeos existentes y los scripts; ampliar la verificación sin reconstruir módulos.

1. Separar conexión del comando bootstrap, sanitizar su fallo y fortalecer la validación runtime frente a propiedad/membresía privilegiada. Ampliar readiness a FK/políticas instaladas.
2. Crear un escenario de integración que aprovisione una base local nueva, restaure exclusivamente el baseline real, agregue filas ficticias en las once tablas y aplique los cinco scripts SQL reales.
3. Comparar contenido y OID antes/después de cada script; conservar los dos triggers no afectados. Verificar scripts Identity idempotentes y preflight fallido sin cambios de datos.
4. Crear respaldo pg_dump y restaurarlo con pg_restore en otra base nueva; comparar contenido. Ejecutar bootstrap CLI, repetición rechazada y Kestrel HTTPS con certificado local validado por confianza explícita, cookie/CSRF y credencial runtime sin DDL.
5. Conservar opcionalmente credenciales locales con DPAPI Windows, fuera de Git, y ofrecer comandos de arranque/prueba sin imprimir contraseñas. Documentar cómo usar credenciales propias en una instancia de pruebas/Supabase.
6. Restore/build/test, checks del repositorio y evidencia exacta; cero DDL o cambios de datos en Supabase productivo.

## Remediación RLS firmada — 2026-11-07

Reproducir primero la suplantación y persistencia. Sustituir el interceptor de conexión por interceptores transaccionales y de comandos, mantener la transacción durante la vida del lector y forzar transacción para SaveChanges. Firmar un desafío PostgreSQL con HMAC y comprobarlo en helpers privados SECURITY DEFINER; vincular el stamp a la cookie autenticada. Separar Identity y revocación mínima. Preparar SQL 100–102 fuera de históricos 010–080 y ensayar solo en PostgreSQL aislado. La reversión posterior al commit suspende acceso, nunca restaura el mecanismo vulnerable. Registrar las limitaciones y el orden de activación en `docs/signed-actor-rollout.md`. Sin UI ni cambios remotos.
# Diagnóstico ejecutable 2026-11-23

RequestPerformanceMiddleware y filtros MVC, ActivityListener Npgsql nativo sin exportadores ni nuevas dependencias, interceptor EF de apertura y medición explícita de apertura Identity raw. Capturar exclusivamente tiempos, contadores y rutas plantilla. Activar Diagnostics:Performance:Enabled y nivel Information de la categoría; fuera de Development/Testing requiere AllowProduction explícito. Server-Timing corresponde al momento de cabeceras; log final incluye resultado. Fases anidadas no se suman. Pool wait no se infiere de Open.

Diagnóstico local mediante servicios existentes, actor global real y READ ONLY/ROLLBACK; sin fabricar cookies ni usar credenciales históricas de base aislada para Supabase. Medir carga de opciones de Seguimiento con/sin filtros antes de decidir reutilización local con invalidación por sesión/operación y caducidad; permisos backend siempre frescos.

Continuación FR-027/AC-031: medir primero con pool vigente; probar NpgsqlBatch para SET READ ONLY + desafío y para instalación + verificación. Son dos intercambios secuenciales necesarios para firmar el desafío, sin omitir sentencias ni validación Identity. El lector debe consumir cada resultado antes de aceptar la verificación. Probar contra servicios de solo lectura y PostgreSQL aislado si está disponible, registrar omisiones. Sin cambios UI ni de esquema. Referencia primaria: https://www.npgsql.org/doc/basic-usage.html#batching.

FR-028/AC-032: MinistryReadScopeFilter rodea solo acciones GET de controladores ministeriales y UsersController con el ámbito firmado ya soportado por los servicios. Consume DTOs materializados antes de devolver; no mantener transacción durante navegación ni reutilizar entre peticiones. Cada acción autoriza normalmente y comparte contexto transaccional, con commit de lectura o rollback al fallar. Medición CLI equivalente mediante opción local del diagnóstico, diferenciada de HTTP. Usuarios se amplía después de medir cuatro transacciones en sus opciones; no afecta POST/PUT ni cambia la conexión Identity.
