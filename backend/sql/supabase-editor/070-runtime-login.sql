-- RUN ONCE, ENTIRE FILE ALONE, only after 060 committed successfully.
-- SQL Editor role postgres. Password assignment is a separate secure operation outside SQL Editor.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $guard$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres'
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='auth_app' AND p.proname='can_access_branch' AND p.pronargs=1
        AND p.proargtypes[0]='uuid'::regtype AND p.prosecdef)
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_api_runtime')
    OR (SELECT count(DISTINCT tablename) FROM pg_catalog.pg_policies
      WHERE schemaname='iglesia' AND 'mlp_runtime'=ANY(roles))<>11 THEN
    RAISE EXCEPTION 'Expected completed 060 and absent mlp_api_runtime; stop on partial deployment';
  END IF;
END; $guard$;
CREATE ROLE mlp_api_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT mlp_runtime TO mlp_api_runtime WITH INHERIT TRUE, SET TRUE GRANTED BY postgres;
DO $checkpoint$
BEGIN
  IF NOT pg_catalog.pg_has_role('mlp_api_runtime','mlp_runtime','USAGE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_api_runtime'
      AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'Runtime group inheritance or attributes checkpoint failed';
  END IF;
END; $checkpoint$;
SELECT '070' AS step,'OK - LOGIN created; password and real API connection still pending' AS result;
COMMIT;
