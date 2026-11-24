-- Preparation only: run with the authorized backup administrator, never with runtime.
-- Counts and fingerprints only; no personal rows are returned and no data is repaired.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SELECT jsonb_build_object(
  'checkedAtUtc', clock_timestamp(),
  'database', current_database(), 'operator', current_user,
  'readOnly', current_setting('transaction_read_only'),
  'operatorCanReadAllRows', (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user),
  'authAppAbsent', NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth_app'),
  'deploymentRolesAbsent', NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN
    ('mlp_ddl_owner', 'mlp_security_definer', 'mlp_runtime', 'mlp_api_runtime', 'mlp_migrator')),
  'validStateCount', (SELECT count(*) FROM iglesia.estado_proceso WHERE
    (codigo IN ('PENDING', 'IN_PROGRESS', 'SUSPENDED') AND NOT es_final) OR
    (codigo IN ('COMPLETED', 'WITHDRAWN') AND es_final)),
  'unexpectedStateCount', (SELECT count(*) FROM iglesia.estado_proceso WHERE codigo NOT IN
    ('PENDING','IN_PROGRESS','SUSPENDED','COMPLETED','WITHDRAWN')),
  'invalidAssignmentDateCount', (SELECT count(*) FROM iglesia.persona_proceso pp
    JOIN iglesia.estado_proceso ep ON ep.id = pp.estado_id
    WHERE ep.es_final <> (pp.fecha_finalizacion IS NOT NULL)
       OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_inicio < pp.fecha_asignacion)
       OR (pp.fecha_finalizacion IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_asignacion)
       OR (pp.fecha_inicio IS NOT NULL AND pp.fecha_finalizacion < pp.fecha_inicio)
       OR (ep.codigo = 'PENDING' AND (pp.fecha_inicio IS NOT NULL OR pp.fecha_finalizacion IS NOT NULL))
       OR (ep.codigo IN ('IN_PROGRESS','SUSPENDED','COMPLETED') AND pp.fecha_inicio IS NULL)),
  'openDuplicateGroupCount', (SELECT count(*) FROM (SELECT persona_id, proceso_id
    FROM iglesia.persona_proceso WHERE fecha_finalizacion IS NULL
    GROUP BY persona_id, proceso_id HAVING count(*) > 1) duplicates),
  'activeGlobalSuperAdminRoleCount', (SELECT count(*) FROM iglesia.rol
    WHERE codigo = 'SUPER_ADMIN' AND activo AND es_global),
  'tables', (SELECT jsonb_agg(jsonb_build_object('name', c.relname, 'oid', c.oid,
      'owner', pg_get_userbyid(c.relowner)) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'iglesia' AND c.relkind = 'r')
)::text;
ROLLBACK;
