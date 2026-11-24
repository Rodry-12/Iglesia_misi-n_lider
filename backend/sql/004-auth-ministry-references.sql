-- Reviewed references to the live-inspected UUID keys. Apply after auth migrations, with a DDL operator.
-- No reconstruction, seeds or deletion. Any orphan aborts validation and rolls back the whole transaction.
BEGIN;
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
COMMIT;
