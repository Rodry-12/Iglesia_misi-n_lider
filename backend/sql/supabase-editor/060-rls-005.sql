-- GENERATED from sql/005-runtime-role-rls.sql; copy/run this ENTIRE FILE alone in SQL Editor.
-- Project sneceodpvscrvjrlqwgw. Role postgres. Verified backup and approval required.
-- Single-use deployment wrapper. Stop on any error. Do not run all files together.
-- Review with the live schema before applying. Never run automatically in the API.
-- Pre-provision mlp_runtime and mlp_security_definer with a separate role administrator.
-- The migration role must be able to SET ROLE to mlp_security_definer to transfer helper ownership.
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
  IF NOT ((SELECT count(*) FROM pg_catalog.pg_constraint WHERE connamespace='auth_app'::regnamespace
  AND contype='f' AND convalidated AND conname IN ('fk_users_person','fk_access_grants_role','fk_access_grants_branch','fk_grant_permissions_permission'))=4 AND to_regprocedure('auth_app.has_global_access()') IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='iglesia')) THEN RAISE EXCEPTION '060: unexpected state before RLS'; END IF;
END; $checkpoint$;
-- BEGIN UNCHANGED SOURCE BODY

SET LOCAL lock_timeout = '5s';
DO $roles$
DECLARE
    v_runtime oid;
    v_security_definer oid;
BEGIN
    SELECT oid INTO v_runtime FROM pg_catalog.pg_roles WHERE rolname = 'mlp_runtime';
    SELECT oid INTO v_security_definer FROM pg_catalog.pg_roles WHERE rolname = 'mlp_security_definer';
    IF v_runtime IS NULL OR v_security_definer IS NULL THEN
        RAISE EXCEPTION 'Pre-provision mlp_runtime and mlp_security_definer before applying this script';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
        WHERE oid = v_runtime AND
          (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
        RAISE EXCEPTION 'Runtime group has unexpected attributes';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
        WHERE oid = v_security_definer AND
          (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
        RAISE EXCEPTION 'Security-definer owner has unexpected attributes';
    END IF;
    IF NOT pg_catalog.pg_has_role(current_user, v_security_definer, 'MEMBER') THEN
        RAISE EXCEPTION 'Migration identity must be able to SET ROLE to mlp_security_definer';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
        WHERE (r.oid <> v_runtime AND pg_catalog.pg_has_role(v_runtime, r.oid, 'MEMBER'))
           OR (r.oid <> v_security_definer AND pg_catalog.pg_has_role(v_security_definer, r.oid, 'MEMBER'))) THEN
        RAISE EXCEPTION 'Runtime and security-definer roles must not inherit or assume other roles';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
            AND (pg_catalog.pg_has_role(v_runtime, c.relowner, 'MEMBER')
                 OR pg_catalog.pg_has_role(v_security_definer, c.relowner, 'MEMBER')))
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname IN ('iglesia', 'auth_app')
            AND (pg_catalog.pg_has_role(v_runtime, p.proowner, 'MEMBER')
                 OR pg_catalog.pg_has_role(v_security_definer, p.proowner, 'MEMBER')))
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname IN ('iglesia', 'auth_app')
            AND (pg_catalog.pg_has_role(v_runtime, n.nspowner, 'MEMBER')
                 OR pg_catalog.pg_has_role(v_security_definer, n.nspowner, 'MEMBER')))
       OR pg_catalog.pg_has_role(v_runtime,
          (SELECT d.datdba FROM pg_catalog.pg_database d WHERE d.datname = current_database()), 'MEMBER')
       OR pg_catalog.pg_has_role(v_security_definer,
          (SELECT d.datdba FROM pg_catalog.pg_database d WHERE d.datname = current_database()), 'MEMBER')
       OR pg_catalog.has_schema_privilege(v_runtime, 'iglesia', 'CREATE')
       OR pg_catalog.has_schema_privilege(v_runtime, 'auth_app', 'CREATE')
       OR NOT pg_catalog.has_schema_privilege(v_runtime, 'iglesia', 'USAGE')
       OR NOT pg_catalog.has_database_privilege(v_runtime, current_database(), 'CONNECT')
       OR pg_catalog.has_schema_privilege(v_security_definer, 'iglesia', 'CREATE')
       OR pg_catalog.has_schema_privilege(v_security_definer, 'auth_app', 'CREATE')
       OR NOT pg_catalog.has_schema_privilege(v_security_definer, 'iglesia', 'USAGE')
       OR pg_catalog.has_database_privilege(v_runtime, current_database(), 'CREATE')
       OR pg_catalog.has_database_privilege(v_security_definer, current_database(), 'CREATE') THEN
        RAISE EXCEPTION 'Runtime or security-definer role has ownership or inherited privileges outside its design';
    END IF;
END;
$roles$;

CREATE FUNCTION auth_app.has_global_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
    SELECT EXISTS (SELECT 1 FROM auth_app.users u JOIN auth_app.user_access_grants g ON g.user_id = u.id
        JOIN iglesia.rol r ON r.id = g.role_id
        WHERE u.id = NULLIF(pg_catalog.current_setting('mlp.actor_id', true), '')::uuid AND u.is_active
          AND (u.lockout_end IS NULL OR u.lockout_end <= now())
          AND g.branch_id IS NULL AND r.codigo = 'SUPER_ADMIN' AND r.activo AND r.es_global);
$function$;
CREATE FUNCTION auth_app.can_access_branch(branch uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
    SELECT auth_app.has_global_access() OR EXISTS (
        SELECT 1 FROM auth_app.users u JOIN auth_app.user_access_grants g ON g.user_id = u.id
        JOIN iglesia.rol r ON r.id = g.role_id JOIN iglesia.sede s ON s.id = g.branch_id
        WHERE u.id = NULLIF(pg_catalog.current_setting('mlp.actor_id', true), '')::uuid AND u.is_active
          AND (u.lockout_end IS NULL OR u.lockout_end <= now()) AND g.branch_id = branch AND s.activa
          AND r.activo AND NOT r.es_global AND r.codigo IN ('BRANCH_ADMIN', 'OPERATOR'));
$function$;
REVOKE ALL ON FUNCTION auth_app.has_global_access(), auth_app.can_access_branch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_app.has_global_access(), auth_app.can_access_branch(uuid) TO mlp_runtime;
GRANT CREATE ON SCHEMA auth_app TO mlp_security_definer;
ALTER FUNCTION auth_app.has_global_access() OWNER TO mlp_security_definer;
ALTER FUNCTION auth_app.can_access_branch(uuid) OWNER TO mlp_security_definer;
REVOKE CREATE ON SCHEMA auth_app FROM mlp_security_definer;

GRANT USAGE ON SCHEMA auth_app TO mlp_runtime;
GRANT USAGE ON SCHEMA auth_app TO mlp_security_definer;
GRANT SELECT ON auth_app.users, auth_app.user_access_grants, iglesia.rol, iglesia.sede TO mlp_security_definer;
GRANT SELECT, INSERT, UPDATE ON auth_app.users TO mlp_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_app.user_claims, auth_app.user_logins, auth_app.user_tokens,
    auth_app.user_access_grants, auth_app.user_grant_permissions TO mlp_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth_app TO mlp_runtime;
GRANT SELECT ON iglesia.rol, iglesia.permiso, iglesia.rol_permiso, iglesia.estado_proceso TO mlp_runtime;
GRANT SELECT, INSERT, UPDATE ON iglesia.sede, iglesia.persona, iglesia.persona_documento, iglesia.persona_sede,
    iglesia.categoria_proceso, iglesia.proceso, iglesia.persona_proceso TO mlp_runtime;

CREATE POLICY mlp_security_definer_role_read ON iglesia.rol
    FOR SELECT TO mlp_security_definer USING (true);
CREATE POLICY mlp_security_definer_branch_read ON iglesia.sede
    FOR SELECT TO mlp_security_definer USING (true);

CREATE POLICY mlp_runtime_role_read ON iglesia.rol FOR SELECT TO mlp_runtime USING (true);
CREATE POLICY mlp_runtime_permission_read ON iglesia.permiso FOR SELECT TO mlp_runtime USING (true);
CREATE POLICY mlp_runtime_role_permission_read ON iglesia.rol_permiso FOR SELECT TO mlp_runtime USING (true);
CREATE POLICY mlp_runtime_state_read ON iglesia.estado_proceso FOR SELECT TO mlp_runtime USING (true);

CREATE POLICY mlp_runtime_branch_read ON iglesia.sede FOR SELECT TO mlp_runtime USING (auth_app.can_access_branch(id));
CREATE POLICY mlp_runtime_branch_insert ON iglesia.sede FOR INSERT TO mlp_runtime WITH CHECK (auth_app.has_global_access());
CREATE POLICY mlp_runtime_branch_update ON iglesia.sede FOR UPDATE TO mlp_runtime
    USING (auth_app.can_access_branch(id)) WITH CHECK (auth_app.can_access_branch(id));

CREATE POLICY mlp_runtime_membership ON iglesia.persona_sede TO mlp_runtime
    USING (auth_app.can_access_branch(sede_id)) WITH CHECK (auth_app.can_access_branch(sede_id));
CREATE POLICY mlp_runtime_person_read ON iglesia.persona FOR SELECT TO mlp_runtime USING (
    auth_app.has_global_access() OR
    (id = NULLIF(pg_catalog.current_setting('mlp.new_person_id', true), '')::uuid
        AND auth_app.can_access_branch(NULLIF(pg_catalog.current_setting('mlp.write_branch_id', true), '')::uuid)) OR
    EXISTS (SELECT 1 FROM iglesia.persona_sede ps
        WHERE ps.persona_id = persona.id AND ps.fecha_fin IS NULL AND auth_app.can_access_branch(ps.sede_id)));
CREATE POLICY mlp_runtime_person_insert ON iglesia.persona FOR INSERT TO mlp_runtime WITH CHECK (
    auth_app.has_global_access() OR (id = NULLIF(pg_catalog.current_setting('mlp.new_person_id', true), '')::uuid
        AND auth_app.can_access_branch(NULLIF(pg_catalog.current_setting('mlp.write_branch_id', true), '')::uuid)));
CREATE POLICY mlp_runtime_person_update ON iglesia.persona FOR UPDATE TO mlp_runtime USING (
    auth_app.has_global_access() OR EXISTS (SELECT 1 FROM iglesia.persona_sede ps
        WHERE ps.persona_id = persona.id AND ps.fecha_fin IS NULL AND auth_app.can_access_branch(ps.sede_id)));
CREATE POLICY mlp_runtime_document ON iglesia.persona_documento TO mlp_runtime USING (
    EXISTS (SELECT 1 FROM iglesia.persona p WHERE p.id = persona_id)) WITH CHECK (
    EXISTS (SELECT 1 FROM iglesia.persona p WHERE p.id = persona_id));
CREATE POLICY mlp_runtime_assignment ON iglesia.persona_proceso TO mlp_runtime
    USING (auth_app.can_access_branch(sede_id)) WITH CHECK (auth_app.can_access_branch(sede_id));

CREATE POLICY mlp_runtime_category_read ON iglesia.categoria_proceso FOR SELECT TO mlp_runtime USING (true);
CREATE POLICY mlp_runtime_category_insert ON iglesia.categoria_proceso FOR INSERT TO mlp_runtime WITH CHECK (auth_app.has_global_access());
CREATE POLICY mlp_runtime_category_update ON iglesia.categoria_proceso FOR UPDATE TO mlp_runtime USING (auth_app.has_global_access());
CREATE POLICY mlp_runtime_process_read ON iglesia.proceso FOR SELECT TO mlp_runtime USING (true);
CREATE POLICY mlp_runtime_process_insert ON iglesia.proceso FOR INSERT TO mlp_runtime WITH CHECK (auth_app.has_global_access());
CREATE POLICY mlp_runtime_process_update ON iglesia.proceso FOR UPDATE TO mlp_runtime USING (auth_app.has_global_access());
-- END UNCHANGED SOURCE BODY
DO $checkpoint$ BEGIN
  IF NOT ((SELECT count(DISTINCT tablename) FROM pg_catalog.pg_policies WHERE schemaname='iglesia' AND 'mlp_runtime'=ANY(roles))=11
      AND (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch') AND p.prosecdef
          AND pg_catalog.pg_get_userbyid(p.proowner)='mlp_security_definer' AND p.proconfig @> ARRAY['search_path=""'])=2
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f',p.proowner))) a
        WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch') AND a.grantee=0 AND a.privilege_type='EXECUTE')) THEN RAISE EXCEPTION '060: helper or policy checkpoint failed'; END IF;
END; $checkpoint$;
SET LOCAL ROLE postgres;
REVOKE mlp_security_definer FROM mlp_ddl_owner GRANTED BY postgres;
REVOKE CREATE ON SCHEMA iglesia FROM mlp_ddl_owner;
REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
DO $checkpoint$ BEGIN
  IF NOT (NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET') AND NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE')) THEN RAISE EXCEPTION 'Temporary DDL access was not removed; transaction must abort'; END IF;
END; $checkpoint$;
SELECT '060-rls-005.sql' AS step, 'OK - check COMMIT and continue only after review' AS result;
COMMIT;
