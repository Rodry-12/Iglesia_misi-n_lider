# Reanudación de 020 en SQL Editor

Estado comunicado por el operador: 010 terminó OK; el intento de 020 falló con
42601, `auth_app` ausente, cero tablas Identity, once ministeriales, cuatro roles
técnicos y cero políticas. Esta corrección parte de ese estado; **no repetir 010**
ni 000, no reconstruir tablas ni ejecutar cambios remotos desde herramientas.

## Archivo e instrucciones exactas

1. En el proyecto `sneceodpvscrvjrlqwgw`, abrir una **consulta nueva** con rol
   `postgres`. Reemplazar el contenido anterior por **todo**
   `backend/sql/supabase-editor/020-identity-001.sql` corregido. No reutilizar el
   texto que recibió inserciones del Editor ni ejecutar una selección parcial.
2. Pulsar **Run**. Si aparece advertencia de tablas sin RLS, elegir
   **Run without RLS**, **no** `Run and enable RLS`. Esa elección ejecuta el SQL
   original: no desactiva RLS existente. No aceptar cambios automáticos, asistencia
   o reescrituras del script. Si la interfaz no ofrece ejecutar sin transformación,
   cancelar: no intentar compensarlo agregando DISABLE ROW LEVEL SECURITY.
3. Exigir ejecución completa sin errores y checkpoint `020-identity-001.sql: OK`.
   Cada fallo revierte esta transacción; el SELECT de OK precede al COMMIT, por lo
   que la verificación siguiente también es obligatoria. Si SQL Editor informa
   transacción abortada (25P02), terminar esa transacción con ROLLBACK antes de otra
   operación; no repetir aprovisionamiento. Ante otro error, conservarlo y detenerse.
4. En otra consulta, mismo proyecto y rol, ejecutar completo
   `backend/sql/supabase-editor/021-verify-identity-readonly.sql`. Debe terminar sin
   errores y mostrar **6 tablas auth_app, 11 iglesia, 13 índices Identity y 0
   políticas**. Comprueba además seis PK, cuatro FK internas validadas, propietarios,
   RLS, permisos temporales retirados y ausencia de USAGE a roles Data API.
5. Solo después de 021 OK, continuar con **030 original**, sin repetir 010 ni 020.
   Al ejecutar 030, mantener la misma elección de ejecutar el SQL sin agregar RLS:
   contiene un CREATE TABLE dentro de un DO de EF y no se modificó por estar fuera
   del alcance. Los pasos 040–090 permanecen idénticos.

Si `auth_app` aparece tras cualquier intento, el guard de 020 aborta: no intentar
reaplicarlo, borrarlo o desactivar su RLS. Si 021 detecta RLS inesperado, detenerse
y revisar la transformación realmente aplicada antes de modificar políticas.

## Causa y corrección limitada

En el código público de Studio, `onConfirm` ejecuta el SQL sin reescribirlo;
`onConfirmWithRLS` llama a `appendEnableRLSStatements`. El modal identifica ambas
acciones como `Run without RLS` y `Run and enable RLS`. La versión pública actual
añade sentencias al final y usa un detector ligero, no la validación completa de
PostgreSQL. **No se verificó la versión desplegada en la sesión del usuario** ni
el texto exacto enviado; la posición de inserción dentro de DO es el incidente
reportado, no una reproducción remota realizada durante esta corrección.

El SQL EF original es sintácticamente válido. La nueva variante 020 elimina solo
sus envoltorios condicionales `$EF$` y coloca las sentencias originales de esquema,
tablas, índices e INSERT de historial en el nivel superior de la misma transacción.
Esto es válido porque el guard ya exige `auth_app` ausente y es una activación
inicial de ejecución única. **No sustituye la elección correcta del modal RLS.**

Se conservan literalmente las seis definiciones de tablas, los siete índices
explícitos (trece contando los de PK), sus predicados, las columnas/UUID, la columna
identity de claims, PK/FK/CASCADE, restricciones y la fila
`20261024015144_InitialApplicationIdentity` / `10.0.13`. Se conserva el contexto
owner, transacción única, validaciones y revocación de permisos temporales. Se
añade un checkpoint que aborta si Identity tiene RLS/FORCE inesperados antes de
COMMIT o si el historial no contiene exactamente la migración esperada.

El origen `backend/sql/001-auth-app.sql`, modelo EF y scripts 030–090 no se cambian.
El generador refleja esta excepción de 020 para no reintroducir los DO al regenerar.
El manifest distingue sentencias Identity intactas de cuerpo EF sin envoltorios.

## Evaluación de RLS

El diseño existente usa Identity privado en `auth_app`, UserManager/SignInManager,
autorización del backend y ACL de 005. El LOGIN runtime necesita consultar cuentas
incluso antes de autenticar al actor. `mlp_security_definer` también necesita leer
`auth_app.users` y `user_access_grants`; no es propietario ni tiene BYPASSRLS. 005
no crea políticas para esas tablas. Activarles RLS sin políticas daría denegación
por defecto a esos roles, afectando login y los helpers ministeriales.

Por ello se mantiene el estado Identity sin RLS de la migración aprobada, sin
añadir nuevos permisos ni políticas y **sin ejecutar DISABLE RLS**. La protección
se conserva mediante esquema privado, ACL y backend. La verificación comprueba
que anon/authenticated/authenticator/service_role carezcan de USAGE de `auth_app`.
Las once tablas `iglesia` mantienen RLS habilitado; sus políticas siguen pendientes
de 060. Ninguna configuración global de RLS, trigger de plataforma o Data API cambia.

## Verificación sin base de datos

`libpg-query@17.6.0` instalado solo bajo `.local/sql-parser-020`, parser PostgreSQL
17 compilado a WASM; no es servidor PostgreSQL ni dependencia de la aplicación.
`scripts/verify-identity-020.mjs` compara AST de tablas/índices/INSERT con el origen,
comprueba DDL fuera de DO, ausencia de ENABLE/DISABLE RLS, límites transaccionales y
analiza 020/021 y 030–090. El parser comprueba sintaxis SQL sin resolver objetos,
permisos ni ejecutar/validar semánticamente PL/pgSQL. La ejecución real en SQL Editor
sigue pendiente del operador; no se declara desplegada por pasar estas pruebas.

```powershell
node backend/scripts/prepare-supabase-sql-editor.mjs --check
node backend/scripts/verify-identity-020.mjs
npm run spec:check
```

La evidencia local queda en `backend/artifacts/identity-020/verification.json`.
Para reproducir el parser en otro entorno, instalar solo la utilidad aislada:

```powershell
npm install --prefix backend/.local/sql-parser-020 --no-save --package-lock=false --ignore-scripts --no-audit --no-fund libpg-query@17.6.0
```

Fuentes primarias revisadas:
[acciones del modal](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/SQLEditor/RunQueryWarningModal.tsx),
[ejecución original o transformada](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/SQLEditor/SQLEditorLayout.tsx),
[transformación RLS](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/SQLEditor/SQLEditor.utils.ts),
[parser fuera del servidor](https://github.com/pganalyze/libpg_query/tree/17-latest).
