-- PREPARED, NOT EXECUTED. Requires verified backup, recovery decision and explicit authorization.
-- Run only as postgres on the approved Session pooler. No passwords in this file.
\set ON_ERROR_STOP on
\if :{?MLP_APPROVED_PROJECT}
SELECT :'MLP_APPROVED_PROJECT' = 'sneceodpvscrvjrlqwgw' AS approved \gset
\else
\echo 'Missing explicit approval marker. Stop.'
DO $guard$ BEGIN RAISE EXCEPTION 'Explicit approval marker required'; END; $guard$;
\endif
\if :approved
\else
DO $guard$ BEGIN RAISE EXCEPTION 'Wrong approved project'; END; $guard$;
\endif
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres' OR session_user <> 'postgres'
     OR to_regnamespace('auth_app') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
       ('mlp_ddl_owner','mlp_security_definer','mlp_runtime','mlp_api_runtime','mlp_migrator')) THEN
    RAISE EXCEPTION 'Unexpected target, operator or prior activation. Stop and reconcile.';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='iglesia' AND c.relkind='r' AND pg_catalog.pg_get_userbyid(c.relowner)='postgres'
      AND c.relname IN ('sede','persona','persona_documento','persona_sede','categoria_proceso','proceso',
        'estado_proceso','persona_proceso','rol','permiso','rol_permiso')) <> 11 THEN
    RAISE EXCEPTION 'Expected eleven existing postgres-owned ministry tables.';
  END IF;
END;
$guard$;
CREATE ROLE mlp_ddl_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_security_definer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE mlp_migrator LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CREATE, CONNECT ON DATABASE postgres TO mlp_ddl_owner;
GRANT USAGE, CREATE ON SCHEMA iglesia TO mlp_ddl_owner;
GRANT CONNECT ON DATABASE postgres TO mlp_runtime;
GRANT USAGE ON SCHEMA iglesia TO mlp_runtime, mlp_security_definer;
GRANT mlp_security_definer TO mlp_ddl_owner;
GRANT mlp_ddl_owner TO mlp_migrator;
GRANT mlp_ddl_owner TO CURRENT_USER WITH ADMIN OPTION;
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
REVOKE mlp_ddl_owner FROM CURRENT_USER;
REVOKE USAGE ON SCHEMA iglesia FROM mlp_inspector;
COMMIT;
\password mlp_migrator
