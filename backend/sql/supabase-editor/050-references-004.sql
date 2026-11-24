-- GENERATED from sql/004-auth-ministry-references.sql; copy/run this ENTIRE FILE alone in SQL Editor.
-- Project sneceodpvscrvjrlqwgw. Role postgres. Verified backup and approval required.
-- Single-use deployment wrapper. Stop on any error. Do not run all files together.
-- Reviewed references to the live-inspected UUID keys. Apply after auth migrations, with a DDL operator.
-- No reconstruction, seeds or deletion. Any orphan aborts validation and rolls back the whole transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $checkpoint$ BEGIN
  IF NOT (current_database()='postgres' AND current_user='postgres'
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_ddl_owner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)) THEN RAISE EXCEPTION 'Select the approved project and SQL Editor role postgres; provisioning 010 is required'; END IF;
END; $checkpoint$;
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
SET LOCAL ROLE mlp_ddl_owner;
DO $checkpoint$ BEGIN
  IF NOT (EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024044431_ExplicitOperatorPermissions') AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='iglesia.persona_proceso'::regclass AND conname='ck_persona_proceso_fechas_v2' AND convalidated)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE connamespace='auth_app'::regnamespace AND conname='fk_users_person')) THEN RAISE EXCEPTION '050: unexpected state before references'; END IF;
END; $checkpoint$;
-- BEGIN UNCHANGED SOURCE BODY

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE auth_app.users ADD CONSTRAINT fk_users_person
    FOREIGN KEY (person_id) REFERENCES iglesia.persona(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE auth_app.user_access_grants ADD CONSTRAINT fk_access_grants_role
    FOREIGN KEY (role_id) REFERENCES iglesia.rol(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE auth_app.user_access_grants ADD CONSTRAINT fk_access_grants_branch
    FOREIGN KEY (branch_id) REFERENCES iglesia.sede(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE auth_app.user_grant_permissions ADD CONSTRAINT fk_grant_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES iglesia.permiso(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE auth_app.users VALIDATE CONSTRAINT fk_users_person;
ALTER TABLE auth_app.user_access_grants VALIDATE CONSTRAINT fk_access_grants_role;
ALTER TABLE auth_app.user_access_grants VALIDATE CONSTRAINT fk_access_grants_branch;
ALTER TABLE auth_app.user_grant_permissions VALIDATE CONSTRAINT fk_grant_permissions_permission;
CREATE INDEX ix_access_grants_role ON auth_app.user_access_grants(role_id);
CREATE INDEX ix_access_grants_branch ON auth_app.user_access_grants(branch_id);

CREATE FUNCTION auth_app.validate_access_grant() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE v_role iglesia.rol;
BEGIN
    SELECT * INTO v_role FROM iglesia.rol WHERE id = NEW.role_id AND activo;
    IF NOT FOUND OR v_role.codigo NOT IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'OPERATOR')
        OR (v_role.codigo = 'SUPER_ADMIN') IS DISTINCT FROM v_role.es_global
        OR (v_role.es_global AND NEW.branch_id IS NOT NULL)
        OR (NOT v_role.es_global AND NEW.branch_id IS NULL) THEN
        RAISE EXCEPTION 'Concesion de rol y sede no valida';
    END IF;
    IF NEW.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM iglesia.sede WHERE id = NEW.branch_id AND activa) THEN
        RAISE EXCEPTION 'La sede de la concesion no esta activa';
    END IF;
    IF v_role.codigo <> 'OPERATOR' AND EXISTS (SELECT 1 FROM auth_app.user_grant_permissions WHERE access_grant_id = NEW.id) THEN
        RAISE EXCEPTION 'Solo OPERATOR admite permisos directos';
    END IF;
    RETURN NEW;
END;
$function$;
CREATE TRIGGER validate_access_grant BEFORE INSERT OR UPDATE OF role_id, branch_id
ON auth_app.user_access_grants FOR EACH ROW EXECUTE FUNCTION auth_app.validate_access_grant();

CREATE FUNCTION auth_app.validate_operator_permission() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth_app.user_access_grants g JOIN iglesia.rol r ON r.id = g.role_id
        WHERE g.id = NEW.access_grant_id AND r.codigo = 'OPERATOR' AND r.activo) OR NOT EXISTS (
        SELECT 1 FROM iglesia.permiso WHERE id = NEW.permission_id AND activo) THEN
        RAISE EXCEPTION 'Permiso directo o rol de operador no valido';
    END IF;
    RETURN NEW;
END;
$function$;
CREATE TRIGGER validate_operator_permission BEFORE INSERT OR UPDATE
ON auth_app.user_grant_permissions FOR EACH ROW EXECUTE FUNCTION auth_app.validate_operator_permission();
-- END UNCHANGED SOURCE BODY
DO $checkpoint$ BEGIN
  IF NOT ((SELECT count(*) FROM pg_catalog.pg_constraint WHERE connamespace='auth_app'::regnamespace
  AND contype='f' AND convalidated AND conname IN ('fk_users_person','fk_access_grants_role','fk_access_grants_branch','fk_grant_permissions_permission'))=4 AND (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid IN ('auth_app.user_access_grants'::regclass,'auth_app.user_grant_permissions'::regclass)
      AND tgname IN ('validate_access_grant','validate_operator_permission') AND NOT tgisinternal)=2) THEN RAISE EXCEPTION '050: cross-schema references checkpoint failed'; END IF;
END; $checkpoint$;
SET LOCAL ROLE postgres;

REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO $checkpoint$ BEGIN
  IF NOT (NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET') AND NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE')) THEN RAISE EXCEPTION 'Temporary DDL access was not removed; transaction must abort'; END IF;
END; $checkpoint$;
SELECT '050-references-004.sql' AS step, 'OK - check COMMIT and continue only after review' AS result;
COMMIT;
