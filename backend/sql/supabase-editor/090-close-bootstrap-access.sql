-- SEPARATE STEP: only AFTER successful .NET bootstrap and first-account review.
-- Do not execute immediately after 080 if bootstrap has not run.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $guard$
BEGIN
  IF current_user<>'postgres' OR current_database()<>'postgres' THEN
    RAISE EXCEPTION 'Expected SQL Editor role postgres in approved project';
  END IF;
END; $guard$;
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
SET LOCAL ROLE mlp_ddl_owner;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_app.users u JOIN auth_app.user_access_grants g ON g.user_id=u.id
      JOIN iglesia.rol r ON r.id=g.role_id WHERE u.is_active AND u.email_confirmed
        AND r.codigo='SUPER_ADMIN' AND r.activo AND r.es_global AND g.branch_id IS NULL) THEN
    RAISE EXCEPTION 'No confirmed active global administrator; bootstrap must complete first';
  END IF;
END; $guard$;
SET LOCAL ROLE postgres;
REVOKE mlp_ddl_owner FROM mlp_migrator GRANTED BY postgres;
ALTER ROLE mlp_migrator NOLOGIN;
REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO $checkpoint$
BEGIN
  IF (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname='mlp_migrator')
    OR pg_catalog.pg_has_role('mlp_migrator','mlp_ddl_owner','MEMBER')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE') THEN
    RAISE EXCEPTION 'Temporary bootstrap access was not closed';
  END IF;
END; $checkpoint$;
SELECT '090' AS step,'OK - remove migration credentials from API environment before normal startup' AS result;
COMMIT;
