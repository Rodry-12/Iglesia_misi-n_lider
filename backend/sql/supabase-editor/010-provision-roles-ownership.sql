-- RUN ONCE, ENTIRE FILE ALONE. SQL Editor role postgres, project sneceodpvscrvjrlqwgw.
-- Requires verified backup, approved recovery plan, successful 000 and explicit change approval.
-- Adapted from database-rollout.md. No passwords, data changes or table reconstruction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $guard$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres'
    OR NOT (SELECT rolcreaterole FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
    RAISE EXCEPTION 'Expected postgres operator with CREATEROLE in approved project';
  END IF;
  IF to_regnamespace('auth_app') IS NOT NULL OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
    ('mlp_ddl_owner','mlp_security_definer','mlp_runtime','mlp_api_runtime','mlp_migrator')) THEN
    RAISE EXCEPTION 'Existing or partial activation: stop instead of changing existing roles';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='iglesia' AND c.relkind IN ('r','p'))<>11 OR
    (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='iglesia' AND c.relkind='r' AND pg_catalog.pg_get_userbyid(c.relowner)='postgres'
      AND c.relrowsecurity AND NOT c.relforcerowsecurity AND c.relname IN
      ('sede','persona','persona_documento','persona_sede','categoria_proceso','proceso','estado_proceso',
       'persona_proceso','rol','permiso','rol_permiso'))<>11 THEN
    RAISE EXCEPTION 'Expected eleven existing postgres-owned tables with inspected RLS state';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='iglesia' AND p.pronargs=0 AND pg_catalog.pg_get_userbyid(p.proowner)='postgres'
      AND p.proname IN ('validar_asignacion_proceso','validar_estado_fechas','validar_proceso_duplicado'))<>3
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='iglesia') THEN
    RAISE EXCEPTION 'Functions/ownership/policies differ from approved predeployment state';
  END IF;
END; $guard$;
CREATE ROLE mlp_ddl_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_security_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
-- Temporary bootstrap LOGIN, unusable through password authentication until configured outside SQL Editor.
CREATE ROLE mlp_migrator LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT, CREATE ON DATABASE postgres TO mlp_ddl_owner;
GRANT USAGE, CREATE ON SCHEMA iglesia TO mlp_ddl_owner;
GRANT CONNECT ON DATABASE postgres TO mlp_runtime;
GRANT USAGE ON SCHEMA iglesia TO mlp_runtime, mlp_security_definer;
GRANT mlp_security_definer TO mlp_ddl_owner WITH INHERIT FALSE, SET TRUE GRANTED BY postgres;
GRANT mlp_ddl_owner TO mlp_migrator WITH INHERIT TRUE, SET TRUE GRANTED BY postgres;
-- PostgreSQL 17/Supabase: the automatic ADMIN-only membership does not permit SET ROLE.
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
DO $ownership$
BEGIN
  IF NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET')
     OR NOT pg_catalog.has_schema_privilege('mlp_ddl_owner','iglesia','CREATE') THEN
    RAISE EXCEPTION 'New owner must have schema CREATE and operator must be able to SET ROLE';
  END IF;
END; $ownership$;
ALTER TABLE iglesia.sede OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_documento OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_sede OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.categoria_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.estado_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.persona_proceso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.rol OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.permiso OWNER TO mlp_ddl_owner;
ALTER TABLE iglesia.rol_permiso OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_asignacion_proceso() OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_estado_fechas() OWNER TO mlp_ddl_owner;
ALTER FUNCTION iglesia.validar_proceso_duplicado() OWNER TO mlp_ddl_owner;
REVOKE USAGE ON SCHEMA iglesia FROM mlp_inspector;
REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO $checkpoint$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='iglesia' AND c.relkind='r' AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_ddl_owner')<>11
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE')
    OR pg_catalog.has_schema_privilege('mlp_inspector','iglesia','USAGE') THEN
    RAISE EXCEPTION 'Ownership or temporary membership cleanup checkpoint failed';
  END IF;
END; $checkpoint$;
SELECT '010' AS step,'OK - review COMMIT before running 020' AS result;
COMMIT;
