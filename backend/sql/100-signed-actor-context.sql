-- Incremental, single-use. Reviewed operator only; API stopped. Never applied by startup.
-- Requires existing 001-005, pgcrypto, verified backup. Contains NO key/password literals.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE owner_name name;
BEGIN
  IF current_user <> 'postgres' OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth_app' AND c.relname='actor_context_keys')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname='pgcrypto')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth_app' AND p.proname='has_global_access') THEN
    RAISE EXCEPTION '100: expected operator, existing RLS, pgcrypto and unapplied increment';
  END IF;
  SELECT pg_catalog.pg_get_userbyid(nspowner) INTO owner_name FROM pg_catalog.pg_namespace WHERE nspname='auth_app';
  IF current_database()='postgres' AND owner_name<>'mlp_ddl_owner' THEN RAISE EXCEPTION 'Unexpected application schema owner'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_security_definer'
      AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN RAISE EXCEPTION 'Unsafe verifier owner'; END IF;
  IF owner_name <> current_user THEN
    EXECUTE pg_catalog.format('GRANT %I TO postgres WITH INHERIT TRUE, SET TRUE GRANTED BY postgres',owner_name);
  END IF;
END $guard$;
GRANT mlp_security_definer TO postgres WITH INHERIT TRUE, SET TRUE GRANTED BY postgres;
DO $identity_roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_identity') THEN
  CREATE ROLE mlp_identity NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_identity_runtime') THEN
  CREATE ROLE mlp_identity_runtime LOGIN INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('mlp_identity','mlp_identity_runtime')
   AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication OR
     (rolname='mlp_identity' AND (rolcanlogin OR rolinherit)) OR
     (rolname='mlp_identity_runtime' AND (NOT rolcanlogin OR NOT rolinherit)))) THEN RAISE EXCEPTION 'Unsafe Identity role attributes'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname<>'mlp_identity' AND pg_has_role('mlp_identity',r.oid,'MEMBER'))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname NOT IN ('mlp_identity_runtime','mlp_identity') AND pg_has_role('mlp_identity_runtime',r.oid,'MEMBER')) THEN
  RAISE EXCEPTION 'Unexpected Identity role memberships';
 END IF;
END $identity_roles$;
GRANT mlp_identity TO mlp_identity_runtime WITH INHERIT TRUE, SET FALSE;
DO $connect$ BEGIN EXECUTE pg_catalog.format('GRANT CONNECT ON DATABASE %I TO mlp_identity',current_database()); END $connect$;
GRANT USAGE ON SCHEMA auth_app, iglesia TO mlp_identity;
GRANT SELECT, INSERT, UPDATE ON auth_app.users TO mlp_identity;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_app.user_claims, auth_app.user_logins, auth_app.user_tokens,
    auth_app.user_access_grants, auth_app.user_grant_permissions TO mlp_identity;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth_app TO mlp_identity;
GRANT SELECT ON iglesia.rol, iglesia.sede, iglesia.permiso TO mlp_identity;
CREATE POLICY mlp_identity_role_read ON iglesia.rol FOR SELECT TO mlp_identity USING (true);
CREATE POLICY mlp_identity_branch_read ON iglesia.sede FOR SELECT TO mlp_identity USING (true);
CREATE POLICY mlp_identity_permission_read ON iglesia.permiso FOR SELECT TO mlp_identity USING (true);

CREATE TABLE auth_app.actor_context_keys (
  key_id text PRIMARY KEY CHECK (key_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  key_material bytea NOT NULL CHECK (octet_length(key_material)>=32),
  enabled boolean NOT NULL DEFAULT true
);
REVOKE ALL ON auth_app.actor_context_keys FROM PUBLIC, mlp_runtime, mlp_identity;
GRANT SELECT ON auth_app.actor_context_keys TO mlp_security_definer;
DO $owner$ DECLARE owner_name name; BEGIN
 SELECT pg_catalog.pg_get_userbyid(nspowner) INTO owner_name FROM pg_catalog.pg_namespace WHERE nspname='auth_app';
 EXECUTE pg_catalog.format('ALTER TABLE auth_app.actor_context_keys OWNER TO %I',owner_name);
END $owner$;

-- Use the existing installation schema; do not assume public or extensions.
DO $crypto$ DECLARE crypto_schema name; BEGIN
 SELECT n.nspname INTO crypto_schema FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto';
 IF NOT pg_catalog.has_schema_privilege('mlp_security_definer',crypto_schema,'USAGE')
 OR NOT pg_catalog.has_function_privilege('mlp_security_definer',pg_catalog.format('%I.hmac(bytea,bytea,text)',crypto_schema),'EXECUTE') THEN
  RAISE EXCEPTION 'Verifier needs USAGE on pgcrypto schema and EXECUTE on hmac(bytea,bytea,text)';
 END IF;
 EXECUTE pg_catalog.format('CREATE FUNCTION auth_app.actor_hmac(bytea,bytea) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path = '''' AS %L',
   pg_catalog.format('SELECT %I.hmac($1,$2,''sha256'')',crypto_schema));
END $crypto$;
GRANT CREATE ON SCHEMA auth_app TO mlp_security_definer;
ALTER FUNCTION auth_app.actor_hmac(bytea,bytea) OWNER TO mlp_security_definer;
REVOKE ALL ON FUNCTION auth_app.actor_hmac(bytea,bytea) FROM PUBLIC, mlp_runtime, mlp_identity;

CREATE FUNCTION auth_app.verified_actor_context() RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $proof$
DECLARE proof text; payload text; fields text[]; material bytea; supplied bytea; expected bytea; expiry bigint;
BEGIN
 proof := pg_catalog.current_setting('mlp.actor_proof',true);
 IF proof IS NULL OR length(proof)>4096 OR array_length(string_to_array(proof,'.'),1)<>2 THEN RETURN NULL; END IF;
 payload := convert_from(decode(split_part(proof,'.',1),'base64'),'UTF8');
 fields := string_to_array(payload,'|');
 IF array_length(fields,1)<>11 OR fields[1]<>'v1' OR fields[2]!~'^[A-Za-z0-9_-]{1,64}$'
    OR length(fields[4])>256 OR fields[4]!~'^[A-Za-z0-9_-]+$' THEN RETURN NULL; END IF;
 expiry := fields[5]::bigint;
 IF expiry <= extract(epoch FROM clock_timestamp()) OR expiry > extract(epoch FROM clock_timestamp())+120
    OR fields[6]<>pg_catalog.pg_current_xact_id()::text OR fields[7]<>pg_catalog.pg_backend_pid()::text
    OR fields[8]<>current_database() OR fields[9]<>session_user THEN RETURN NULL; END IF;
 SELECT key_material INTO material FROM auth_app.actor_context_keys WHERE key_id=fields[2] AND enabled;
 IF NOT FOUND THEN RETURN NULL; END IF;
 supplied := decode(split_part(proof,'.',2),'base64');
 IF octet_length(supplied)<>32 THEN RETURN NULL; END IF;
 expected := auth_app.actor_hmac(convert_to(payload,'UTF8'),material);
 -- Double-HMAC blinding avoids directly comparing attacker-chosen MAC prefixes.
 IF auth_app.actor_hmac(expected,material) <> auth_app.actor_hmac(supplied,material) THEN RETURN NULL; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth_app.users u WHERE u.id=fields[3]::uuid AND u.security_stamp=fields[4]
    AND u.is_active AND u.email_confirmed AND NOT u.two_factor_enabled
    AND (u.lockout_end IS NULL OR u.lockout_end<=clock_timestamp())) THEN RETURN NULL; END IF;
 IF (fields[10]='') IS DISTINCT FROM (fields[11]='') THEN RETURN NULL; END IF;
 IF fields[10]<>'' THEN PERFORM fields[10]::uuid, fields[11]::uuid; END IF;
 RETURN fields;
EXCEPTION WHEN data_exception THEN RETURN NULL;
END $proof$;
ALTER FUNCTION auth_app.verified_actor_context() OWNER TO mlp_security_definer;
REVOKE ALL ON FUNCTION auth_app.verified_actor_context() FROM PUBLIC, mlp_runtime, mlp_identity;

CREATE FUNCTION auth_app.verified_actor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT (auth_app.verified_actor_context())[3]::uuid;
$body$;
ALTER FUNCTION auth_app.verified_actor_id() OWNER TO mlp_security_definer;
REVOKE ALL ON FUNCTION auth_app.verified_actor_id() FROM PUBLIC, mlp_identity;
GRANT EXECUTE ON FUNCTION auth_app.verified_actor_id() TO mlp_runtime;

CREATE OR REPLACE FUNCTION auth_app.has_global_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT EXISTS (SELECT 1 FROM auth_app.user_access_grants g JOIN iglesia.rol r ON r.id=g.role_id
 WHERE g.user_id=auth_app.verified_actor_id() AND g.branch_id IS NULL AND r.codigo='SUPER_ADMIN' AND r.activo AND r.es_global);
$body$;
CREATE OR REPLACE FUNCTION auth_app.can_access_branch(branch uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$
 SELECT auth_app.has_global_access() OR EXISTS (
 SELECT 1 FROM auth_app.user_access_grants g JOIN iglesia.rol r ON r.id=g.role_id JOIN iglesia.sede s ON s.id=g.branch_id
 WHERE g.user_id=auth_app.verified_actor_id() AND g.branch_id=branch AND s.activa
 AND r.activo AND NOT r.es_global AND r.codigo IN ('BRANCH_ADMIN','OPERATOR'));
$body$;

CREATE FUNCTION auth_app.person_insert_context(person uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $body$
DECLARE fields text[];
BEGIN
 fields:=auth_app.verified_actor_context();
 IF fields IS NULL OR fields[10]='' THEN RETURN false; END IF;
 RETURN coalesce(fields[10]::uuid=person AND auth_app.can_access_branch(fields[11]::uuid),false);
END $body$;
ALTER FUNCTION auth_app.person_insert_context(uuid) OWNER TO mlp_security_definer;
REVOKE ALL ON FUNCTION auth_app.person_insert_context(uuid) FROM PUBLIC, mlp_identity;
GRANT EXECUTE ON FUNCTION auth_app.person_insert_context(uuid) TO mlp_runtime;
ALTER POLICY mlp_runtime_person_read ON iglesia.persona USING (
 auth_app.has_global_access() OR auth_app.person_insert_context(id) OR EXISTS (
 SELECT 1 FROM iglesia.persona_sede ps WHERE ps.persona_id=persona.id AND ps.fecha_fin IS NULL AND auth_app.can_access_branch(ps.sede_id)));
ALTER POLICY mlp_runtime_person_insert ON iglesia.persona WITH CHECK (
 auth_app.has_global_access() OR auth_app.person_insert_context(id));

GRANT SELECT ON auth_app.user_grant_permissions, iglesia.permiso, iglesia.rol_permiso, iglesia.persona_sede TO mlp_security_definer;
GRANT UPDATE (security_stamp, concurrency_stamp) ON auth_app.users TO mlp_security_definer;
CREATE POLICY mlp_definer_permission_read ON iglesia.permiso FOR SELECT TO mlp_security_definer USING (true);
CREATE POLICY mlp_definer_role_permission_read ON iglesia.rol_permiso FOR SELECT TO mlp_security_definer USING (true);
CREATE POLICY mlp_definer_membership_read ON iglesia.persona_sede FOR SELECT TO mlp_security_definer USING (true);
CREATE FUNCTION auth_app.revoke_person_sessions(person uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE actor uuid; stamp text;
BEGIN
 actor:=auth_app.verified_actor_id();
 IF actor IS NULL OR NOT (auth_app.has_global_access() OR EXISTS (
   SELECT 1 FROM iglesia.persona_sede ps JOIN auth_app.user_access_grants g ON g.branch_id=ps.sede_id
   JOIN iglesia.rol r ON r.id=g.role_id JOIN iglesia.sede s ON s.id=g.branch_id
   JOIN iglesia.permiso p ON p.codigo='PERSON_DEACTIVATE' AND p.activo
   WHERE ps.persona_id=person AND ps.fecha_fin IS NULL AND s.activa AND g.user_id=actor AND r.activo AND NOT r.es_global
   AND ((r.codigo='BRANCH_ADMIN' AND EXISTS (SELECT 1 FROM iglesia.rol_permiso rp WHERE rp.rol_id=r.id AND rp.permiso_id=p.id))
     OR (r.codigo='OPERATOR' AND EXISTS (SELECT 1 FROM auth_app.user_grant_permissions gp WHERE gp.access_grant_id=g.id AND gp.permission_id=p.id))))) THEN
   RAISE EXCEPTION 'Not authorized to revoke linked sessions' USING ERRCODE='42501';
 END IF;
 IF NOT auth_app.has_global_access() AND EXISTS (
   SELECT 1 FROM auth_app.users u JOIN auth_app.user_access_grants g ON g.user_id=u.id JOIN iglesia.rol r ON r.id=g.role_id
   WHERE u.person_id=person AND g.branch_id IS NULL AND r.codigo='SUPER_ADMIN' AND r.activo AND r.es_global) THEN
   RAISE EXCEPTION 'Global linked accounts require global administration' USING ERRCODE='42501';
 END IF;
 stamp:=pg_catalog.gen_random_uuid()::text;
 UPDATE auth_app.users SET security_stamp=stamp, concurrency_stamp=stamp WHERE person_id=person;
END $body$;
ALTER FUNCTION auth_app.revoke_person_sessions(uuid) OWNER TO mlp_security_definer;
REVOKE ALL ON FUNCTION auth_app.revoke_person_sessions(uuid) FROM PUBLIC, mlp_identity;
GRANT EXECUTE ON FUNCTION auth_app.revoke_person_sessions(uuid) TO mlp_runtime;

REVOKE ALL ON auth_app.users, auth_app.user_claims, auth_app.user_logins, auth_app.user_tokens,
 auth_app.user_access_grants, auth_app.user_grant_permissions FROM mlp_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth_app FROM mlp_runtime;
REVOKE CREATE ON SCHEMA auth_app FROM mlp_security_definer;
DO $checkpoint$ BEGIN
 IF has_table_privilege('mlp_runtime','auth_app.users','SELECT') OR has_table_privilege('mlp_runtime','auth_app.users','UPDATE')
 OR has_table_privilege('mlp_runtime','auth_app.user_access_grants','INSERT')
 OR has_table_privilege('mlp_identity','auth_app.actor_context_keys','SELECT') THEN RAISE EXCEPTION '100 privilege checkpoint failed'; END IF;
END $checkpoint$;
REVOKE mlp_security_definer FROM postgres GRANTED BY postgres;
DO $cleanup$ DECLARE owner_name name; BEGIN
 SELECT pg_catalog.pg_get_userbyid(nspowner) INTO owner_name FROM pg_catalog.pg_namespace WHERE nspname='auth_app';
 IF owner_name<>current_user THEN EXECUTE pg_catalog.format('REVOKE %I FROM postgres GRANTED BY postgres',owner_name); END IF;
END $cleanup$;
-- Provision an enabled key separately through the reviewed privileged operator, using bound parameters.
-- With no key the system denies all actor-dependent access. Set login password OUTSIDE SQL Editor.
COMMIT;
