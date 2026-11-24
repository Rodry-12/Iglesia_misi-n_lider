-- Catalog-only verification by the operator. Does not read keys, hashes, users or ministry records.
BEGIN READ ONLY;
SELECT r.rolname,r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb
FROM pg_catalog.pg_roles r WHERE r.rolname IN ('mlp_runtime','mlp_api_runtime','mlp_identity','mlp_identity_runtime');
SELECT r.rolname,c.relname,
 pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE') AS unexpected_access_must_be_false
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='auth_app' AND ((r.rolname='mlp_runtime' AND c.relname IN ('users','user_access_grants','actor_context_keys'))
 OR (r.rolname='mlp_identity' AND c.relname='actor_context_keys'));
SELECT p.proname,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,
 EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute_must_be_false
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='auth_app' AND p.proname IN ('verified_actor_context','verified_actor_id','actor_hmac',
 'has_global_access','can_access_branch','person_insert_context','revoke_person_sessions');
SELECT tablename,policyname,roles,cmd FROM pg_catalog.pg_policies WHERE schemaname='iglesia' ORDER BY tablename,policyname;
ROLLBACK;
