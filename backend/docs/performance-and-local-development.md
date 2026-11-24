# Rendimiento y arranque local

## Corrección del 2026-11-09

El coste identificado es la repetición de viajes a PostgreSQL remoto: cada consulta
ministerial sin transacción explícita instala el contexto firmado en una transacción
propia. Incluye validación Identity por conexión independiente, desafío y verificación
SQL. No se ha demostrado que falte capacidad de CPU o un índice.

`MinistryDirectory.ResolveAsync` agrupa consultas en una transacción READ ONLY y omite
búsquedas de sedes/permisos explícitos cuando no hay identificadores. Los listados de
sedes, personas, categorías, procesos y asignaciones agrupan datos, conteos y filtros
en otra transacción READ ONLY después de autorizar. Las transacciones del llamador
se reutilizan sin confirmarlas ni cerrarlas.

| Recorrido global sin persona vinculada | Transacciones ministeriales anteriores | Actuales |
| --- | --- | --- |
| Resolver concesiones | 4 | 1 |
| Listar sedes/categorías/procesos | 6 | 2 |
| Listar personas con opciones de sede | 7 | 2 |
| Listar asignaciones con opciones de filtros | 11 | 2 |

Son conteos de transacciones, no consultas totales ni latencias HTTP. La resolución
global pasa de cuatro consultas EF a dos. Las consultas útiles de los listados
permanecen; se evita reinstalar el contexto para cada una. Cada llamada comprueba
los accesos actuales: no hay caché de permisos/usuarios entre peticiones. Se mantienen
RLS, HMAC, security stamp, TLS, cancelación y conexiones separadas.

## Resto del recorrido y prioridades

Corrección posterior del2026-11-09: sessionGuard reutiliza la sesión en memoria,
sin GET session previo a cada navegación/filtro. Conserva consulta inicial, recarga,
verificación canónica después de login y actualización manual. El interceptor
retira sesión ante401 y distingue403. Sustituye el handoff de cinco segundos.
No hay caché de permisos backend: cada recurso sigue validando accesos actuales.
La UI puede conservar etiquetas/enlaces anteriores hasta refrescar; no autoriza datos.

La captura del usuario muestra session4,06–5,33s, listado sedes5,78–6,33s y
administradores9,99–11,27s. Son observaciones del navegador, no un benchmark propio.
El cambio elimina la consulta previa; no demuestra que baje la latencia del recurso.
Corrección2026-11-10: AdministratorsAsync agrupa existencia de sede y catálogo de
roles en una sola transacción READ ONLY, después conteo y página en Identity. Pasa
de3 a2 transacciones ministeriales contando la resolución de permisos. InstallAsync valida
Identity y hace desafío, instalación y verificación por transacción ministerial.
16 integraciones aisladas confirman autorización,2 transacciones y limpieza.
Sigue pendiente medir HTTP autenticado real sin omitir controles.

- Angular en desarrollo tiene compilación y carga diferida; distinguir ese coste de
  la duración API. Tras el ajuste posterior del login, AuthStore consulta sesión y
  renueva CSRF en paralelo. sessionGuard reutiliza esa sesión ya comprobada sin
  volver a consultar sesión en cada entrada; la recarga recupera la sesión real.
  No se elimina la comprobación de cookie ni la autorización backend por solicitud.
- Los listados usan proyecciones, paginación y AsNoTracking. No ejecutar consultas
  paralelas sobre el mismo DbContext.
- Contains/ToUpper y filtros correlacionados requieren planes con volumen real antes
  de recomendar índices. No se aplicaron cambios SQL.
- No se aumentaron timeouts ni tamaños de pool. Se conserva limpieza de conexiones,
  sin multiplexing ni NoResetOnClose.
- Opciones, reportes y algunos detalles todavía pueden abrir varias transacciones.
  No se afirma que todos los endpoints estén optimizados.
- Siguiente medición: p50/p95 HTTP autenticado en Supabase con usuario/parámetros
  equivalentes y conexión caliente. No registrar cookies, tokens, cuerpos ni datos
  personales. Los resultados aislados no acreditan una reducción de segundos remotos.

## Arranque en este equipo

Desde `D:\PERSONAL\repos\Iglesiamisinlider`, utilizar dos terminales PowerShell.
Detener la API antes de recompilar Release en Windows: bloquea sus ensamblados.
Identificar el proceso concreto; no terminar todos los procesos dotnet/node.

Terminal API:

```powershell
dotnet build backend/MisionLiderParis.slnx --configuration Release --no-restore
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/.local/supabase-key-review/Start-VerifiedApi.ps1 -LocalInvitations
```

El lanzador existente inicia el DLL Release en segundo plano en
`https://localhost:7243`, importa configuración privada, mantiene Data Protection
persistente protegido y valida runtime/Identity/contexto/RLS en solo lectura.
`-LocalInvitations` usa Testing y aplica la URL local de activación solo al proceso;
Testing aquí sigue conectado a Supabase real. No ejecuta migraciones ni bootstrap.
Estado seguro: `backend/.local/supabase-key-review/api-status.json`.

Terminal Angular:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/.local/gmail-browser/Start-Frontend.ps1
```

El helper reutiliza/exporta el certificado HTTPS de desarrollo y protege sus archivos;
configura NODE_EXTRA_CA_CERTS y ejecuta `npm start` desde frontend con host localhost,
puerto 4200 y las rutas del certificado/clave privados del perfil. Angular queda en
`https://localhost:4200`. `frontend/proxy.conf.cjs` dirige `/api` a
`https://localhost:7243`, con secure=true. Angular no conecta directamente a PostgreSQL.

Los helpers ya existían en `.local`, ignorado por Git; pertenecen a este equipo.
El perfil versionado `dotnet run --project backend/src/MisionLiderParis.Api --launch-profile https`
también declara 7243, pero usa Development y no reproduce por sí solo la carga privada
del lanzador operativo. `npm start` raíz delega en frontend; requiere la confianza
TLS configurada. No iniciar otra instancia en puertos ocupados.

## Evidencia

Ver la sección de rendimiento de `backend/specs/001-ministry-backend/validation.md`.
Los tests cuentan eventos EF sin guardar SQL ni parámetros. Las integraciones usan
exclusivamente loopback y base `_tests`, nunca secretos de producción.

## Diagnóstico ejecutado — 2026-11-23

Se instrumentó el recorrido existente, sin añadir un exportador ni capturar SQL:
`RequestPerformanceMiddleware`, `PerformanceActionFilter`, `PerformanceDiagnostics`,
el listener de Activities de Npgsql y los interceptores de apertura/transacciones.
La resolución de permisos y la instalación del contexto firmado tienen fases propias.
Cada petición habilitada emite un JSON `MLP_PERFORMANCE` con identificador de traza,
plantilla de ruta, estado, duración y conteos. Nunca incluye valores de ruta/query,
cuerpos, cookies, credenciales, documentos ni etiquetas/SQL de Activities.
El detalle se limita a 256 comandos por solicitud; el total sigue contando todos.

### Hallazgo y cambio comprobado

La configuración efectiva tenía pooling ministerial activo e Identity con
`Pooling=false`. Las muestras posteriores abrían dos conexiones físicas en resolver
accesos y tres en cada listado: aproximadamente 2–3 segundos por operación en
aperturas, aun sin ser el primer uso. No era evidencia de espera por saturación
del pool ni de CPU PostgreSQL. Se añadió `Database:IdentityPoolingEnabled` como
opción explícita, desactivada por defecto, con `IdentityPoolMaximumSize=10`
(rango permitido 1–20). Se aplica tanto al DbContext Identity como a la conexión
independiente usada para verificar la cuenta al instalar el contexto firmado.
Conserva cadena original, TLS VerifyFull, roles separados y reset. Rechaza
NoResetOnClose y multiplexing al activar la opción. No cachea permisos ni suprime
validaciones de cuenta/security stamp.

Comparación real de servicios contra Supabase desde este equipo: cinco muestras
secuenciales por operación y configuración; tabla con mediana de las cuatro
posteriores. El primer uso se conserva separado en los artefactos. No es arranque
frío completo: cargar la cuenta existente precede a la captura. Son 70 lecturas;
ninguna escritura ministerial, invitación, login fabricado ni cambio SQL.

| Servicio | Antes ms | Pool Identity ms | Mejora | Comandos antes/después |
| --- | ---: | ---: | ---: | ---: |
| Resolver accesos | 2855,2 | 976,2 | 65,8 % | 8 / 8 |
| Sedes | 4638,1 | 1852,4 | 60,1 % | 15 / 15 |
| Personas | 4861,5 | 1979,8 | 59,3 % | 16 / 16 |
| Categorías | 4716,6 | 1886,1 | 60,0 % | 15 / 15 |
| Procesos | 4664,5 | 1864,7 | 60,0 % | 15 / 15 |
| Seguimiento con filtros | 5287,1 | 2551,1 | 51,7 % | 21 / 21 |
| Seguimiento sin reconstruir filtros | 4784,4 | 1987,2 | 58,5 % | 16 / 16 |

Tras calentar el pool no se observaron nuevas aperturas físicas en esas muestras;
la apertura lógica quedó por debajo de 1 ms. Persisten viajes SQL de aproximadamente
90–130 ms cada uno. Sus duraciones incluyen red/lectura cliente, no CPU del servidor.
No se justifican índices ni cambios de esquema con esta evidencia.

Seguimiento ahora reutiliza sus etiquetas de filtros durante 60 segundos en el
store de la pantalla/sesión; primera carga, caducidad, actualización forzada y cambio
de sesión renuevan o eliminan esas opciones. Las filas se vuelven a consultar y
autorizar normalmente. La mediana medida con pool pasa de 2551,1 a 1987,2 ms al
omitir esa reconstrucción (cinco comandos menos, 22,1 %); no equivale a una medición
HTTP posterior al cambio Angular. Las etiquetas pueden quedar antiguas hasta la
siguiente consulta tras caducar; no conceden acceso y no hay caché compartida.

Los artefactos locales ignorados son `backend/artifacts/performance/service-baseline.json`,
`service-pooled.json` y `comparison.json`. El operador local
`backend/.local/supabase-key-review/Measure-Performance-ReadOnly.ps1` usa la cuenta
global existente verificada en Identity y los servicios reales; no emite cookies.
La comparación usa la misma configuración con `MLP_PERFORMANCE_POOL_IDENTITY=1`
solo durante la segunda ejecución. Los artefactos contienen tiempos/conteos,
no resultados personales. El helper y los archivos privados no forman parte del
checkout; esta tabla conserva la evidencia revisable sin requerir credenciales.
`service-pooled.json` es la salida temporal reutilizada del ejecutor y se sobrescribió
en tandas posteriores. La comparación histórica conserva su resumen en comparison.json;
para la segunda optimización usar los archivos con nombres de etapa indicados abajo,
sin interpretar el archivo temporal como la captura histórica original.

### Captura HTTP y uso local

Arrancar la API Release con el helper existente y las opciones explícitas:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/.local/supabase-key-review/Start-VerifiedApi.ps1 -LocalInvitations -Performance -PooledIdentity
```

Esto configura solamente ese proceso. Alternativamente, configurar
`Database__IdentityPoolingEnabled=true`, `Database__IdentityPoolMaximumSize=10`,
`Diagnostics__Performance__Enabled=true`, `Diagnostics__Performance__CommandDetails=true`
y nivel Information para `MisionLiderParis.Api.Diagnostics`. Default puede seguir
en Warning para evitar SQL de EF. En Production el diagnóstico requiere además
`Diagnostics__Performance__AllowProduction=true`; no activarlo permanentemente.
No cambiar cadenas ni secretos almacenados. Reiniciar sin `-Performance` desactiva
la captura; reiniciar sin `-PooledIdentity` recupera el comportamiento previo.
El límite es por pool/cadena/proceso: comprobar presupuesto de conexiones antes de
multiplicar réplicas. No se ensayó carga concurrente ni saturación de Supabase.

En el navegador ya autenticado, abrir DevTools → Network, filtrar Fetch/XHR y
ejecutar la misma lectura cinco veces, separando la primera. Anotar Duration y
`X-MLP-TraceId`; buscar esa traza en el JSON `MLP_PERFORMANCE` del log privado de
la API indicado en `api-status.json`. No exportar HAR ni copiar cookies/cuerpos.
`Server-Timing` muestra `app_headers`, `db_client` y `access` hasta el envío de
cabeceras; **no es el total final**. El JSON final mide el pipeline hasta terminar
la respuesta, sin proxy/red hasta el navegador. Fases anidadas no se suman.

| Operación Angular | Ruta API | HTTP autenticado real en esta ejecución |
| --- | --- | --- |
| Login / sesión | POST /api/v1/auth/login; GET /api/v1/auth/session | Capturados tras prueba interactiva del usuario; ver tabla siguiente |
| Permisos efectivos | Incluidos en sesión y resolución por recurso | Servicio y fases HTTP capturados |
| Sedes / personas | GET /api/v1/branches; GET /api/v1/people | Capturados tras prueba interactiva del usuario |
| Categorías / procesos | GET /api/v1/process-categories; GET /api/v1/processes | Servicios medidos; HTTP pendiente |
| Seguimiento | GET /api/v1/process-assignments/participants | Servicio con/sin filtros y dos muestras HTTP capturadas |
| Abrir formularios | GET de detalle y opciones de cada módulo | Instrumentados; sin muestras autenticadas |
| Guardar | POST/PUT de cada módulo | Instrumentados; no ejecutados sobre registros reales |

No había credencial interactiva disponible para automatizar login remoto seguro;
la credencial retenida de E2E pertenece exclusivamente a loopback y no se reutilizó
contra Supabase. El usuario finalmente inició sesión por el mecanismo existente
y confirmó sus consultas de Sedes, Miembros y Seguimiento. Se leyeron exclusivamente
las métricas técnicas; no se accedió a cookies ni se fabricaron sesiones.

### HTTP real observado después de activar el pool

Muestras correlacionadas del pipeline API, estado200, posteriores al cambio. No hay
línea base HTTP autenticada equivalente anterior: no calcular porcentajes HTTP usando
la línea base de servicios. Los dos listados repetidos se numeran en orden observado;
no son necesariamente parámetros idénticos, pues no se registran query strings.

| Ruta / muestra | HTTP API ms | Autenticación ms | Resolver accesos ms | Comandos cliente ms | SQL | Control transaccional ms | Aperturas físicas ms / cantidad |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| POST auth/login | 4017,152 | 0,694 | 2181,518 | 1279,570 | 10 | 93,611 | 2146,421 / 2 |
| GET auth/session | 1895,368 | 1019,904 | 867,599 | 854,576 | 9 | 94,102 | 911,380 / 1 |
| GET branches | 1800,287 | 98,423 | 861,318 | 1559,830 | 16 | 180,172 | 0 / 0 |
| GET people / 1 | 1938,925 | 103,317 | 844,897 | 1652,620 | 17 | 188,200 | 0 / 0 |
| GET people / 2 | 1853,885 | 91,125 | 870,253 | 1650,056 | 17 | 194,964 | 0 / 0 |
| GET process-assignments/participants / 1 | 2504,542 | 99,464 | 835,669 | 2172,764 | 22 | 183,482 | 0 / 0 |
| GET process-assignments/participants / 2 | 4425,070 | 1135,463 | 1872,896 | 2155,952 | 22 | 208,918 | 2041,119 / 2 |

Authentication mide el middleware de cookie, no la comprobación de contraseña de
POST login: esa operación está dentro de Action. Result fue0,380–11,076ms en estas
lecturas: no domina el tiempo. La autorización HTTP de política fue inferior a1ms;
AccessResolution, anidada en Action, sigue costando835–1873ms en los listados.
Los HTTP añaden un comando Identity de validación de cookie frente al servicio CLI.
Reaperturas físicas pueden reaparecer: no atribuir su causa a saturación o expiración
sin más métricas. El pool mejora lecturas calientes, no elimina TLS/red ni garantiza
conexión caliente después de inactividad. No se automatizaron guardados ministeriales.
La captura técnica de lecturas está en `backend/artifacts/performance/http-pooled-observed.json`.

No se afirma HTTP ≤2 segundos para toda la aplicación ni P95. Las muestras de
Seguimiento y login superan ese objetivo; faltan repeticiones HTTP equivalentes,
concurrencia y los formularios/guardados autorizados. Siguiente foco respaldado por
evidencia: los22 comandos y viajes secuenciales de Seguimiento inicial, separando
capturas con/sin opciones y aperturas físicas; conservar íntegros contexto firmado
y comprobaciones de cuenta. No hay evidencia de N+1, índices faltantes o CPU del
servidor que justifique modificar SQL remoto.

El primer intento interactivo falló porque el servidor automático de Playwright
arrancó sin confiar en el certificado del proxy. Se dejó Angular con el helper
Start-Frontend.ps1 y NODE_EXTRA_CA_CERTS. Comprobación real a través de4200:
session anónimo401 en187,8ms y csrf200 en28,9ms, con traza emitida por la API.
El usuario confirmó después que pudo consultar las tres pantallas. No se desactivó
la validación TLS del proxy.

`Authentication` incluye validación de cookie; `AuthorizationMiddleware` es la
política HTTP, `AccessResolution` la resolución de accesos en servicios,
`SignedContext` incluye validación independiente y protocolo firmado, `Action`
incluye la ejecución de la acción/caso de uso después del model binding, y `Result` incluye
serialización/escritura, no CPU pura del serializador. `ConnectionOpen` observa
apertura lógica y pool como conjunto; no separa espera de pool y TLS.
`PhysicalConnectionOpenMs` cuenta conexiones físicas de Npgsql. `DatabaseClientMs`
y `SqlCommands` cuentan spans de comandos del driver, sin BEGIN/COMMIT automáticos;
`TransactionControl` y `TransactionControlOperations` los contabilizan aparte
mediante EF. Los conteos de la tabla se capturaron antes de añadir este último
contador y excluyen control transaccional. Abortos llevan `RequestAborted=true`.

Referencia primaria del mecanismo del driver:
[Npgsql tracing](https://www.npgsql.org/doc/diagnostics/tracing.html).

## Segunda optimización ejecutada — 2026-11-23

La captura del usuario confirmó que quedaban1,8–4,5s y viajes repetidos. Se añadió
NpgsqlBatch al protocolo firmado: READ ONLY + desafío comparten un intercambio;
set_config local + verificación explícita comparten otro. Los resultados se consumen
en orden y el valor de verified_actor_id debe coincidir antes de permitir consultas.
No se envía la clave HMAC a SQL, no se elimina la consulta Identity independiente,
no hay multiplexing y cada lote pertenece a la transacción existente.
Referencia: [batching oficial de Npgsql](https://www.npgsql.org/doc/basic-usage.html#batching).

`MinistryReadScopeFilter` agrupa además resolución de permisos y datos dentro de
una única transacción firmada READ ONLY por acción GET materializada de los
controladores de sedes/personas/categorías/procesos/asignaciones y usuarios.
Los servicios ya preservaban una transacción del llamador; se reutiliza ese contrato.
Una nueva petición resuelve accesos actuales e instala un contexto nuevo. No se
guardan permisos en caché entre peticiones. No envuelve POST/PUT ni los controladores
de autenticación, reportes o integraciones. Se libera al finalizar la
acción, con rollback ante excepción/cancelación. No se mantiene durante navegación.

Comparación nueva y equivalente de servicios reales, misma página10 y actor,
cinco muestras por operación/etapa. Medianas de cuatro posteriores, sin sumar el
primer uso ni mezclar con HTTP.105 lecturas, sin escrituras ministeriales remotas:

| Servicio | Pool antes ms | Solo lotes ms | Lotes + ámbito por acción ms | Reducción adicional |
| --- | ---: | ---: | ---: | ---: |
| Resolver accesos | 906,1 | 706,6 | 713,1 | 21,3 % |
| Sedes | 1702,6 | 1299,9 | 933,1 | 45,2 % |
| Personas | 1827,9 | 1409,8 | 1036,6 | 43,3 % |
| Categorías | 1717,8 | 1285,8 | 938,7 | 45,4 % |
| Procesos | 1734,3 | 1292,3 | 938,1 | 45,9 % |
| Seguimiento sin reconstruir filtros | 1836,0 | 1434,6 | 1058,2 | 42,4 % |
| Seguimiento con filtros | 2355,2 | 1919,2 | 1577,7 | 33,0 % |

Sedes/categorías/procesos pasan de15 sentencias en dos transacciones a10 en una,
con8 ejecuciones de comandos/lotes. Personas:16→11 sentencias/9 ejecuciones;
Seguimiento con filtros:21→16/14. BEGIN/COMMIT se contabilizan aparte, como antes.
No se atribuye al lote una menor cantidad de comprobaciones: conserva sentencias;
el ámbito único evita repetir la instalación para permisos y listado en la misma
acción. `SqlCommands` ahora contabiliza sentencias de los lotes conocidos,
`DatabaseExecutions` cuenta invocaciones de comandos/lotes del driver y cada detalle
indica `StatementCount`; su duración corresponde al lote completo, sin inventar
duraciones individuales por sentencia. No son conteos de paquetes TCP.

Artefactos locales sin datos personales: `service-roundtrips-before.json`,
`service-roundtrips-after.json`, `service-shared-scope-after.json` y
`shared-scope-comparison.json` en backend/artifacts/performance. El diagnóstico CLI
local usa `MLP_PERFORMANCE_POOL_IDENTITY=1` en las tres etapas y
`MLP_PERFORMANCE_SHARED_READ_SCOPE=1` únicamente en la tercera para reproducir el
alcance de acción. Los servicios CLI no ejecutan middleware de cookie.

Verificaciones:114 unitarias correctas;89 integraciones ministeriales focalizadas
correctas en clúster preaprovisionado de loopback (detenido al finalizar), incluida
la nueva prueba HTTP de una transacción por lectura y una instalación nueva en la
siguiente petición. Cubren firma, manipulación, revocación, cancelación, pooling,
concurrencia/aislamiento y operaciones existentes.15 pruebas HTTP/diagnóstico sin
base correctas. La batería amplia inicial tuvo88 correctas/3 fallos: readiness503,
registration-options503 y precisión de fecha de siete frente a seis decimales;
no se ocultan ni se atribuyen sin comprobación a una causa nueva. Los89 focalizados
excluyen esos tres e incorporan el caso HTTP nuevo. La prueba Development/OpenAPI
con certificado privado sigue fuera de la batería focalizada, según evidencia anterior.

API Release compila y permanece conectada a Supabase; verificación remota solo
lectura confirma TLS, roles separados, RLS en11 tablas, contexto aceptado y limpieza
tras rollback, readiness200 y anónimos401. El primer intento simultáneo de dos
operadores fue rechazado por el lock privado; la repetición secuencial pasó. No se
modificaron secretos, esquema, roles ni datos ministeriales remotos.

Esta reducción adicional **no acredita95% ni P95 HTTP**. La latencia cliente por
consulta ronda90–110ms y el protocolo necesita intercambios secuenciales; conseguir
decenas de milisegundos requeriría revisar también proximidad API/base y medir allí,
no omitir seguridad ni añadir índices sin planes. Es una inferencia de los tiempos
observados, no una prueba de latencia de otra región o infraestructura. Login y
guardados reciben la mejora del protocolo compartido; el filtro GET no los envuelve.

### Confirmación HTTP interactiva y extensión medida a Usuarios

El usuario repitió el recorrido después de la primera activación del filtro.
Todas las siguientes lecturas dieron200, sin aperturas físicas nuevas:

| Endpoint | HTTP API observado ms | Sentencias / ejecuciones | Operaciones transaccionales |
| --- | ---: | ---: | ---: |
| auth/login (conexiones calientes) | 1639,600 | 10 / 8 | 2 |
| auth/session | 861,851 | 9 / 7 | 2 |
| branches | 1061,364; 1008,324 | 11 / 9 | 2 |
| people | 1350,470; 1146,306 | 12 / 10 | 2 |
| process-categories | 1044,577; 1003,545 | 11 / 9 | 2 |
| processes | 1032,618; 1030,819 | 11 / 9 | 2 |
| process-assignments/participants con opciones | 1808,252; 1609,684 | 17 / 15 | 2 |
| process-assignments/participants reutilizando opciones | 1131,534 | 12 / 10 | 2 |

Observaciones HTTP posteriores reales, no benchmark controlado ni P95. La duración
es del pipeline API, no tiempo de navegador/proxy. Artefacto:
`backend/artifacts/performance/http-shared-scope-observed.json`. GET añade la validación
Identity de cookie a la medición de servicios. El403/401 de sesión sin cookie no es
una lectura autenticada lenta y no se mezcla con esta tabla.

En ese mismo recorrido, Usuarios aún sin el filtro tenía administration-options
en2258–2354ms,27 sentencias/19 ejecuciones y8 operaciones transaccionales (cuatro
transacciones). Se amplió el filtro a GET del UsersController, tras verificar que
son consultas materializadas y que las escrituras usan POST/PUT. Se mantienen
Identity y ministerio separados y toda la política de acceso personalizado/sede.
Nuevo caso HTTP comprueba también listado y opciones de Usuarios con una transacción
ministerial cada uno. Diez regresiones específicas correctas de vinculación,
revocación, administración por sede y acceso personalizado; clúster aislado detenido.

Comparación pareada nueva de servicios de Usuarios, con lotes ya activos en ambos
casos, misma cuenta/página10/operación USER_VIEW, cinco muestras cada uno y mediana
de cuatro posteriores.20 lecturas, sin invitaciones, guardados ni correos:

| Servicio Usuarios | Sin ámbito único ms | Con ámbito único ms | Sentencias antes/después |
| --- | ---: | ---: | ---: |
| Listado | 1250,0 | 1027,5 | 16 / 11 |
| Opciones | 1981,4 | 1031,0 | 26 / 11 |

Archivos: service-users-before.json, service-users-after.json y
users-scope-comparison.json en backend/artifacts/performance. El ejecutor usa
MLP_PERFORMANCE_ONLY=users y compara el alcance desactivado/activado; registra las
dependencias existentes de protección de datos/entorno sin llamar al correo.
No hay nueva captura HTTP de Usuarios después de ampliar el filtro; no convertir
estos tiempos de servicio en una promesa HTTP. API Release final compilada y
verificación remota de solo lectura correcta tras la ampliación.
