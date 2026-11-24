-- PREPARED, NOT EXECUTED. After 005 and explicit approval, as postgres.
\set ON_ERROR_STOP on
\if :{?MLP_APPROVED_PROJECT}
SELECT :'MLP_APPROVED_PROJECT' = 'sneceodpvscrvjrlqwgw' AS approved \gset
\else
DO $guard$ BEGIN RAISE EXCEPTION 'Explicit approval marker required'; END; $guard$;
\endif
\if :approved
\else
DO $guard$ BEGIN RAISE EXCEPTION 'Wrong approved project'; END; $guard$;
\endif
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR to_regprocedure('auth_app.can_access_branch(uuid)') IS NULL
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_api_runtime') THEN
    RAISE EXCEPTION 'Unexpected context, missing 005 or existing runtime. Stop.';
  END IF;
END;
$guard$;
CREATE ROLE mlp_api_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT mlp_runtime TO mlp_api_runtime;
COMMIT;
\password mlp_api_runtime
