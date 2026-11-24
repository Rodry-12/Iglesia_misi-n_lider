-- GENERATED from sql/002-explicit-operator-permissions.sql; copy/run this ENTIRE FILE alone in SQL Editor.
-- Project sneceodpvscrvjrlqwgw. Role postgres. Verified backup and approval required.
-- Single-use deployment wrapper. Stop on any error. Do not run all files together.
START TRANSACTION;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $checkpoint$ BEGIN
  IF NOT (current_database()='postgres' AND current_user='postgres'
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_ddl_owner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)) THEN RAISE EXCEPTION 'Select the approved project and SQL Editor role postgres; provisioning 010 is required'; END IF;
END; $checkpoint$;
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
SET LOCAL ROLE mlp_ddl_owner;
DO $checkpoint$ BEGIN
  IF NOT (EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024015144_InitialApplicationIdentity') AND to_regclass('auth_app.user_grant_permissions') IS NULL) THEN RAISE EXCEPTION '030: unexpected Identity state'; END IF;
END; $checkpoint$;
-- BEGIN UNCHANGED SOURCE BODY


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    CREATE TABLE auth_app.user_grant_permissions (
        access_grant_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        CONSTRAINT "PK_user_grant_permissions" PRIMARY KEY (access_grant_id, permission_id),
        CONSTRAINT "FK_user_grant_permissions_user_access_grants_access_grant_id" FOREIGN KEY (access_grant_id) REFERENCES auth_app.user_access_grants (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    CREATE INDEX "IX_user_grant_permissions_permission_id" ON auth_app.user_grant_permissions (permission_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId" = '20261024044431_ExplicitOperatorPermissions') THEN
    INSERT INTO auth_app.__ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261024044431_ExplicitOperatorPermissions', '10.0.13');
    END IF;
END $EF$;
-- END UNCHANGED SOURCE BODY
DO $checkpoint$ BEGIN
  IF NOT (EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024044431_ExplicitOperatorPermissions') AND to_regclass('auth_app.user_grant_permissions') IS NOT NULL) THEN RAISE EXCEPTION '030: explicit permissions checkpoint failed'; END IF;
END; $checkpoint$;
SET LOCAL ROLE postgres;

REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO $checkpoint$ BEGIN
  IF NOT (NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET') AND NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE')) THEN RAISE EXCEPTION 'Temporary DDL access was not removed; transaction must abort'; END IF;
END; $checkpoint$;
SELECT '030-identity-002.sql' AS step, 'OK - check COMMIT and continue only after review' AS result;
COMMIT;
