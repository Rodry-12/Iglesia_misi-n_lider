# Activación por Supabase SQL Editor

**Corrección vigente de 040:** ante el literal de función incompleto reportado,
usar el 040 actualizado (cuerpos PL/pgSQL idénticos con literales E, sin dollar
quotes), comprobar `FIN 040` y ejecutar completo. Después verificar 041 antes de
050. No repetir 010–030. [Instrucciones de 040](../../docs/integrity-040-sql-editor-fix.md).

**Reanudación actual:** el operador confirmó 010 OK y rollback de 020 (`auth_app`
ausente). No repetir 010/000. Usar el 020 corregido y después 021 según
[instrucciones específicas](../../docs/identity-020-sql-editor-fix.md). En el aviso
del Editor elegir **Run without RLS**, que conserva el SQL original; no añade ni
desactiva RLS. No usar la transformación `Run and enable RLS` sobre Identity.

Destino: **`sneceodpvscrvjrlqwgw`**, base `postgres`. Preparado, **no ejecutado**.
Elegir rol **postgres** en SQL Editor. No usar conexión inspectora ni otro proyecto.
Los nombres/DTO/servicios de la aplicación permanecen intactos.

No se entrega un único archivo ejecutable: se necesitan checkpoints entre scripts
y un paso externo de contraseñas/bootstrap. Copiar **un archivo completo por vez**
en una consulta separada. No seleccionar solo fragmentos ni ejecutar la carpeta
entera en una única consulta/transacción. No confiar en que SQL Editor conserve
sesión, SET ROLE o variables entre ejecuciones: cada bloque configura su contexto.

## Antes del primer cambio

La inspección 009.1 ya está completada; 000 verifica únicamente precondiciones de
esta aplicación incremental. No consta aún un respaldo real verificado. Antes de
010 deben existir respaldo de `iglesia`, hash, estrategia de recuperación revisada,
escritores detenidos y autorización expresa de cambios. El script de respaldo
`backend/scripts/Backup-Supabase.ps1` ya está preparado; no requiere servidor local.
No asumir backups descargables/PITR por estar en plan gratuito ni confundir un
SELECT de conteos con un respaldo. No ejecutar DDL para obtener el respaldo.

SQL no puede comprobar un backup externo ni identificar por sí solo el proyecto
a partir de una base llamada `postgres`. Confirmar la referencia en la URL del
Dashboard. Los guards comprueban operador, objetos y fases esperadas; no sustituyen
esa selección ni la aprobación humana.

## Orden exacto

| Orden | Archivo completo | Resultado y condición para continuar |
| --- | --- | --- |
| 0 | `000-preflight-readonly.sql` | READ ONLY. Cero errores y resultado OK; no cambia datos. |
| 1 | `010-provision-roles-ownership.sql` | Ejecución única. Roles, ownership de once tablas/tres funciones y limpieza de acceso inspector. Requiere respaldo/aprobación. |
| 2 | `020-identity-001.sql` | Script real 001. `auth_app`, seis tablas incluyendo historial, primera migración; retira CREATE de base al owner. |
| 2.1 | `021-verify-identity-readonly.sql` | Verificación READ ONLY del 020 corregido, antes de 030. |
| 3 | `030-identity-002.sql` | Script real 002. `user_grant_permissions` y segunda migración. |
| 4 | `040-integrity-003.sql` | Script real 003. Preflight con bloqueo, CHECK v2, función/trigger de fechas e índice de asignaciones abiertas. Ejecución única. |
| 4.1 | `041-verify-integrity-readonly.sql` | Metadatos de CHECK/índice/función/trigger/RLS; todas las comprobaciones deben ser true. |
| 5 | `050-references-004.sql` | Script real 004. Cuatro FK validadas, dos índices y validadores de concesiones. Ejecución única. |
| 6 | `060-rls-005.sql` | Script real 005. Privilegios y políticas existentes; helpers SECURITY DEFINER; retira membresía/CREATE temporales. Ejecución única. |
| 7 | `070-runtime-login.sql` | Crea LOGIN `mlp_api_runtime` sin contraseña inicial; hereda únicamente `mlp_runtime`. Ejecución única. |
| 8 | `080-verify-readonly.sql` | Comprueba estructura Identity, ownership, RLS/FORCE, roles y helpers. Repetible. No acredita contraseña ni login. |
| pausa | Operaciones externas descritas abajo | Contraseñas, bootstrap .NET y retirada de credenciales. No se crean usuarios Identity mediante INSERT manual. |
| 9 | `090-close-bootstrap-access.sql` | Solo después del bootstrap: revoca owner del migrator y lo deja NOLOGIN. |
| 10 | `080-verify-readonly.sql` | Repetir después del cierre; comprobar además sesión/API reales. |

Cada archivo de cambio tiene **una transacción propia**. Los guards y checkpoints
internos lanzan excepción antes del COMMIT. Ante cualquier error, **detenerse**;
no continuar, no reparar filas automáticamente y no repetir 010/040/050/060/070.
Si una sesión queda abortada, terminar esa transacción con ROLLBACK antes de otra
operación, sin repetir el bloque fallido por iniciativa propia. Un archivo correcto
no revierte los COMMIT de archivos anteriores si el siguiente falla.

Conservar salida y comprobar ejecución completa/COMMIT; el SELECT de OK precede
al COMMIT y por sí solo no demuestra que éste haya terminado correctamente.
Comparar los once OID de 000 y 080: deben conservarse. Los conteos/fingerprints del
respaldo se contrastan tras los cambios mediante la conexión temporal migrator
configurada fuera del Editor, usando `../activation/011-content-fingerprints-readonly.sql`
en READ ONLY, antes de cerrar su acceso con 090. No ejecutar esa consulta como
postgres después de retirar su SET temporal: BYPASSRLS no concede SELECT de tablas.
No almacenar filas personales en comentarios del Editor, capturas o evidencias.

## Ownership y particularidades Supabase

El operador debe ser el propietario actual (`postgres`), o disponer de sus
privilegios; necesita CREATEROLE y administración de los roles propios. El nuevo
owner necesita CREATE en `iglesia`, y el operador debe poder hacer SET ROLE a él.
010 concede esos permisos temporalmente y transfiere únicamente ownership de los
objetos reales enumerados. 020 retira CREATE de base tras crear `auth_app`; 060
retira CREATE en `iglesia` y la membresía temporal al owner de helpers.

En PostgreSQL 17/Supabase, crear un rol puede dejar a `postgres` una membresía
ADMIN concedida por `supabase_admin`, con INHERIT/SET desactivados. No se intenta
revocar esa concesión de plataforma. Cada bloque concede su propio SET temporal
con INHERIT FALSE y lo retira mediante `GRANTED BY postgres`; comprueba después que
postgres no pueda SET/USAGE al owner. La permanencia de una fila ADMIN-only de
plataforma no equivale a que falle esa limpieza. Si el proveedor rechaza un GRANT,
ALTER OWNER o REVOKE, abortar; no elevar permisos ni usar supabase_admin.

Los checkpoints que leen filas del historial de Identity se ejecutan todavía como
mlp_ddl_owner, antes de liberar el SET temporal. 080 consulta solo catálogos y no
exige acceso permanente de postgres a `auth_app`; las filas de migración ya se
comprobaron dentro de 020/030. 090 asume temporalmente el owner para comprobar que
el bootstrap creó una cuenta global activa y vuelve a retirar su propio acceso.

020 conserva las sentencias originales de tablas/índices/historial en el nivel
superior y elimina únicamente los envoltorios condicionales EF: su guard exige
esquema ausente. 040 conserva el AST y los cuerpos PL/pgSQL decodificados, usando
literales E en lugar de dollar quotes. Los cuerpos de 030/050/060 siguen intactos.
Los demás añadidos son contexto de SQL Editor, guardas, reconocimiento local de
revisión para 003, checkpoints y retirada de privilegios.
No se añade una transacción que englobe los cinco. El script 003 modifica de forma
incremental el CHECK/trigger indicado; conservar datos no significa omitir ese
cambio ya revisado. Ningún bloque reconstruye tablas ni modifica filas ministeriales.

## Contraseñas: operación separada de SQL Editor

070 crea el LOGIN sin contraseña; eso **no habilita aún una conexión autenticada
por contraseña**. SQL Editor guarda consultas y no ofrece un parámetro secreto
para este paquete. No escribir allí ALTER ROLE con una contraseña literal ni un
generador que la devuelva en resultados. No usar el password de postgres en runtime.

Método separado preparado: `backend/scripts/Set-SupabaseLoginPassword.ps1`, cliente
psql 17.11 **ya existente**, Session pooler y TLS verify-full. No instala/inicia
PostgreSQL. Solicita contraseña administrativa y nueva contraseña dos veces,
mediante el mecanismo interactivo del cliente que evita enviar texto claro al
historial de consultas. Ejecutar únicamente tras autorización y roles creados:

```powershell
# Desde la raíz del repositorio; FUERA del SQL Editor.
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\Set-SupabaseLoginPassword.ps1 -Role mlp_api_runtime
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\Set-SupabaseLoginPassword.ps1 -Role mlp_migrator
```

No hay metacomandos psql en ninguno de los archivos `.sql` de esta carpeta. El
método interactivo es externo precisamente porque no es SQL Editor. No ejecutar
estos dos comandos para rotar roles preexistentes; 010/070 deben haber terminado
correctamente en esta activación. Guardar contraseñas en el almacén privado del
operador/host, nunca Git, Angular ni archivos SQL.

## Bootstrap y conexión real: fuera de SQL Editor

La cuenta SuperAdministrador se crea con `--bootstrap-admin` del backend existente,
con `Database__MigrationConnectionString` del LOGIN temporal `mlp_migrator`, TLS
VerifyFull, correo real confirmado por el operador y contraseña segura. No crear
hashes, usuarios ni concesiones Identity manualmente en SQL. Rechaza si ya existe
alguna cuenta; no repetir tras un resultado incierto sin comprobar el estado.

Usar la sección “Configuración runtime y bootstrap preparados” de
`../../docs/supabase-activation-2026-11-06.md` para los comandos .NET exactos. Tras
bootstrap, ejecutar 090 y retirar la conexión migrator del entorno. La conexión
normal usa solo `mlp_api_runtime.sneceodpvscrvjrlqwgw` en el Session pooler,
Production, VerifyFull y key ring protegido; nunca postgres/inspector. No arrancar
el helper histórico que apunta a PostgreSQL local.

Después: `/health/ready` 200, CSRF/login/session reales, consulta GET de personas,
logout 204 y sesión posterior 401. 080 verifica que los dos helpers son SECURITY
DEFINER propiedad de `mlp_security_definer`, search_path vacío, EXECUTE sin PUBLIC y
concedido a runtime. RLS permanece habilitado en las once tablas, FORCE false como
en el esquema existente. Probar aislamiento con cuentas autorizadas por sede;
SuperAdministrador solo no lo acredita. No ejecutar suites destructivas remotas.

## Integridad del paquete y límites de verificación

`manifest.json` registra SHA-256 de fuentes y archivos entregados. Regeneración y
comprobación **sin conexión y sin ejecutar SQL**:

```powershell
node backend/scripts/prepare-supabase-sql-editor.mjs
node backend/scripts/prepare-supabase-sql-editor.mjs --check
npm run spec:check
```

La comprobación conserva sentencias Identity en 020, cuerpos decodificados en 040
y cuerpos originales en 030/050/060, transacciones independientes y ausencia de
metacomandos/contraseñas literales; reutiliza la consulta de seguridad
de `RuntimeDatabaseSafety.cs` parametrizada por nombre de rol para 080. No acredita
ejecución DDL en Supabase, respaldo ni login; nada de eso se ejecutó al preparar
estos archivos. No se inició PostgreSQL local ni se creó otro proyecto.

Recuperación: detener API, conservar checkpoint y revisar rollback del archivo
fallido. No ejecutar Down, DROP SCHEMA, DROP TABLE ni restaurar encima de las once
tablas. Un ensayo de restauración necesita destino vacío autorizado; sigue pendiente
si no existe. El plan gratuito no cambia este requisito ni habilita una restauración
automática segura sobre los datos actuales.

Fuentes oficiales verificadas para esta adaptación:
[ownership y membresías Supabase](https://supabase.com/kb/troubleshooting/cant-revoke-a-role-membership-granted-by-supabase_admin-d08922),
[ALTER TABLE PostgreSQL 17](https://www.postgresql.org/docs/17/sql-altertable.html),
[gestión interactiva de contraseñas](https://www.postgresql.org/docs/17/app-psql.html).
