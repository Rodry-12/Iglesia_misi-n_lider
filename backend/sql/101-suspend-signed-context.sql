-- POST-COMMIT ROLLBACK: fail-closed containment, never restoration of unsigned UUID access.
-- Stop API first. Roles/keys remain so the corrected release can be resumed after review.
-- No ministerial changes, no DROP, no historic scripts, no passwords, no 090.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='auth_app' AND c.relname='actor_context_keys') THEN
   RAISE EXCEPTION '101 requires approved operator and installed signed context';
 END IF;
END $guard$;
DO $owner$ DECLARE owner_name name; BEGIN
 SELECT pg_catalog.pg_get_userbyid(nspowner) INTO owner_name FROM pg_catalog.pg_namespace WHERE nspname='auth_app';
 IF owner_name<>current_user THEN EXECUTE pg_catalog.format('GRANT %I TO postgres WITH INHERIT TRUE, SET TRUE GRANTED BY postgres',owner_name); END IF;
END $owner$;
UPDATE auth_app.actor_context_keys SET enabled=false WHERE enabled;
-- A local-only test may set this NON-secret role name before executing the file.
DO $disable$ DECLARE runtime_name text; BEGIN
 runtime_name:=coalesce(nullif(current_setting('mlp.rollback_runtime_login',true),''),'mlp_api_runtime');
 IF current_database()='postgres' AND runtime_name<>'mlp_api_runtime' THEN RAISE EXCEPTION 'Unexpected production runtime identity'; END IF;
 EXECUTE pg_catalog.format('ALTER ROLE %I NOLOGIN',runtime_name);
END $disable$;
ALTER ROLE mlp_identity_runtime NOLOGIN;
DO $verify$ BEGIN
 IF EXISTS(SELECT 1 FROM auth_app.actor_context_keys WHERE enabled) THEN RAISE EXCEPTION 'Keys remain enabled'; END IF;
END $verify$;
DO $cleanup$ DECLARE owner_name name; BEGIN
 SELECT pg_catalog.pg_get_userbyid(nspowner) INTO owner_name FROM pg_catalog.pg_namespace WHERE nspname='auth_app';
 IF owner_name<>current_user THEN EXECUTE pg_catalog.format('REVOKE %I FROM postgres GRANTED BY postgres',owner_name); END IF;
END $cleanup$;
COMMIT;
