-- SQL Editor: project sneceodpvscrvjrlqwgw; select role postgres.
-- READ ONLY. Does not prove that a backup exists. Stop if any check raises an error.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
DO $preflight$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Select the approved project and SQL Editor role postgres';
  END IF;
  IF to_regnamespace('auth_app') IS NOT NULL OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('mlp_ddl_owner','mlp_security_definer','mlp_runtime','mlp_api_runtime','mlp_migrator')) THEN
    RAISE EXCEPTION 'Prior or partial activation found. Stop; do not repeat provisioning';
  END IF;
  IF (SELECT count(*) FROM iglesia.rol WHERE codigo='SUPER_ADMIN' AND activo AND es_global) <> 1 THEN
    RAISE EXCEPTION 'Exactly one existing active global SUPER_ADMIN role is required';
  END IF;
  IF (SELECT count(*) FROM iglesia.estado_proceso WHERE
      (codigo IN ('PENDING','IN_PROGRESS','SUSPENDED') AND NOT es_final) OR
      (codigo IN ('COMPLETED','WITHDRAWN') AND es_final)) <> 5
    OR EXISTS (SELECT 1 FROM iglesia.estado_proceso WHERE codigo NOT IN
      ('PENDING','IN_PROGRESS','SUSPENDED','COMPLETED','WITHDRAWN')) THEN
    RAISE EXCEPTION 'State catalog differs from script 003';
  END IF;
  IF EXISTS (SELECT 1 FROM iglesia.persona_proceso pp JOIN iglesia.estado_proceso ep ON ep.id=pp.estado_id
    WHERE ep.es_final <> (pp.fecha_finalizacion IS NOT NULL)
      OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_inicio < pp.fecha_asignacion)
      OR (pp.fecha_finalizacion IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_asignacion)
      OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_inicio)
      OR (ep.codigo='PENDING' AND (pp.fecha_inicio IS NOT NULL OR pp.fecha_finalizacion IS NOT NULL))
      OR (ep.codigo IN ('IN_PROGRESS','SUSPENDED','COMPLETED') AND pp.fecha_inicio IS NULL)) THEN
    RAISE EXCEPTION 'Incompatible assignment dates; no data will be repaired';
  END IF;
  IF EXISTS (SELECT 1 FROM iglesia.persona_proceso WHERE fecha_finalizacion IS NULL
      GROUP BY persona_id,proceso_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Open assignment duplicates; no rows will be removed';
  END IF;
END; $preflight$;
SELECT clock_timestamp() AS checked_at, current_database() AS database_name,
  current_user AS operator, current_setting('transaction_read_only') AS read_only,
  'OK - data preconditions only; backup and change authorization are separate' AS result;
SELECT c.relname,c.oid,pg_catalog.pg_get_userbyid(c.relowner) AS owner
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='iglesia' AND c.relkind='r' ORDER BY c.relname;
ROLLBACK;
