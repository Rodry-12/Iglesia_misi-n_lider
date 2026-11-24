-- Run ONLY after corrected 020, BEFORE 030. SQL Editor role postgres.
-- Catalogs only: no Identity rows/passwords, no privileges or RLS changes.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
DO $verify$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'Select approved project and SQL Editor role postgres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='auth_app'
      AND pg_catalog.pg_get_userbyid(nspowner)='mlp_ddl_owner')
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='auth_app' AND c.relkind='r')<>6
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='auth_app' AND c.relkind='r' AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_ddl_owner'
        AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relname IN
        ('__ef_migrations_history','users','user_access_grants','user_claims','user_logins','user_tokens'))<>6 THEN
    RAISE EXCEPTION 'Unexpected Identity tables/owner/RLS; stop, do not rerun 010/020 or disable RLS';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='auth_app' AND c.contype='p')<>6
    OR (SELECT count(*) FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='auth_app' AND c.contype='f' AND c.convalidated)<>4
    OR (SELECT count(*) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='auth_app' AND i.indisvalid AND i.indisready)<>13 THEN
    RAISE EXCEPTION 'Expected six primary keys, four validated Identity FKs and thirteen valid indexes';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname IN ('iglesia','auth_app'))
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='iglesia' AND c.relkind='r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
        AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_ddl_owner')<>11 THEN
    RAISE EXCEPTION 'Unexpected ministry ownership/RLS/policies before 030-060';
  END IF;
  IF pg_catalog.has_database_privilege('mlp_ddl_owner',current_database(),'CREATE')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE') THEN
    RAISE EXCEPTION 'Temporary permissions from 020 were not removed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN ('anon','authenticated','authenticator','service_role')
      AND pg_catalog.has_schema_privilege(r.oid,(SELECT oid FROM pg_catalog.pg_namespace WHERE nspname='auth_app'),'USAGE')) THEN
    RAISE EXCEPTION 'Unexpected access to private Identity schema; stop for review';
  END IF;
END; $verify$;
SELECT '021' AS step,'OK - expected post-020 catalog state; continue with unchanged 030' AS result,
  (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth_app' AND c.relkind='r') AS identity_tables,
  (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='iglesia' AND c.relkind='r') AS ministry_tables,
  (SELECT count(*) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth_app') AS identity_indexes,
  (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname IN ('iglesia','auth_app')) AS policies;
-- The exact migration row/ProductVersion were checked as owner inside 020.
-- No permanent USAGE/SELECT is granted to postgres to read that row here.
ROLLBACK;
