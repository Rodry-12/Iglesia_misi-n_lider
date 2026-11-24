# Reanudación de 040

El error comunicado termina dentro de la función, después de un `THEN`, y ya
contiene el pie `source: dashboard`. El servidor recibió un literal sin cierre.
Eso no determina si hubo selección parcial, copia incompleta o transformación
de la interfaz. El 040 anterior completo pasa el parser PostgreSQL 17; no hay
evidencia de un error en las reglas ministeriales. 040 no contiene CREATE TABLE,
por lo que no se atribuye este incidente automáticamente al ajuste RLS de 020.

## Primer paso y ejecución

1. Descargar el **040 corregido completo**: `backend/sql/supabase-editor/040-integrity-003.sql`.
   Se entrega también en `backend/artifacts/integrity-040/integrity-040-corrected.zip`.
   No copiar solamente un fragmento de una vista previa.
2. Abrir una consulta nueva del proyecto `sneceodpvscrvjrlqwgw`, rol `postgres`,
   reemplazar todo el contenido por el archivo. Confirmar que termina con
   `COMMIT;` y el comentario **FIN 040**. Ejecutar todo el archivo, sin selección
   parcial ni modificaciones automáticas. No repetir 010, 020 ni 030.
3. Si hay transacción abortada (25P02), terminarla con ROLLBACK antes de otro
   intento. El archivo exige migración 002 y ausencia del CHECK/índice v2; si
   detecta aplicación previa/parcial, detenerse. No borrar objetos ni forzar una
   repetición. No dividir función y trigger en operaciones independientes.
4. Tras ejecución completa y checkpoint 040 OK, ejecutar
   `041-verify-integrity-readonly.sql`. Debe devolver todas las comprobaciones en
   `true`, incluida `all_checks_passed`. Solo entonces continuar con 050.

## Cambio limitado

Se sustituyen únicamente los delimitadores dollar-quoted de los cuerpos DO y de
la función por literales PostgreSQL `E'...'`, con comillas duplicadas, barras
escapadas y saltos de línea representados por `\n`. Cada cuerpo ocupa una línea
física; PostgreSQL lo decodifica al **mismo texto PL/pgSQL original**, incluidos
saltos de línea y comentarios internos. No editar manualmente esas secuencias.
El archivo completo ocupa unas sesenta líneas, para facilitar la copia íntegra.

Se mantienen exactamente los once statements originales de 003: límites de
tiempo, preflight, bloqueo, validación de fechas/estados/duplicados, CHECK v2,
función, sustitución de trigger, índice único parcial y retiro del CHECK antiguo.
Se mantienen permisos/contexto, search_path vacío, SECURITY INVOKER original y
transacción única con rollback ante fallo. No hay cambio RLS, reparación de datos,
reconstrucción de tablas ni modificación del origen `sql/proposals/003-assignment-integrity.sql`.

## Verificación

```powershell
node backend/scripts/prepare-supabase-sql-editor.mjs --check
node backend/scripts/verify-integrity-040.mjs
node backend/scripts/verify-identity-020.mjs
npm run spec:check
```

Se usa el parser PostgreSQL 17 WASM ya disponible en `.local/sql-parser-020`.
La comparación AST elimina solo posiciones de texto: los once statements y los
cuerpos decodificados de DO/función deben ser idénticos al origen. También valida
sintaxis del archivo completo, BEGIN/COMMIT, ausencia de dollar quotes y el cierre
FIN 040, además de los scripts posteriores. No se ejecuta SQL ni se abre una base.
El parser no ejecuta ni resuelve semántica PL/pgSQL; la igualdad del cuerpo prueba
que se conservó la lógica existente, no que se haya probado el despliegue remoto.

Evidencia: `backend/artifacts/integrity-040/verification.json`. La ejecución en SQL
Editor y sus permisos reales quedan pendientes del operador.
