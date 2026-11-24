-- READ ONLY, repeatable. SQL Editor role postgres, project sneceodpvscrvjrlqwgw.
-- Verifies deployment, not passwords, bootstrap success or real per-user authorization.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
DO $verify$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'Select approved project and SQL Editor role postgres';
  END IF;
  -- Query reused from RuntimeDatabaseSafety.cs, with target role instead of current_user.
  IF (SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
            WHERE (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
                OR r.rolname LIKE 'pg\_%' ESCAPE '\')
              AND pg_catalog.pg_has_role('mlp_api_runtime', r.oid, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles r
            WHERE r.oid <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'mlp_api_runtime')
              AND r.rolname <> 'mlp_runtime'
              AND pg_catalog.pg_has_role('mlp_api_runtime', r.oid, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
              AND pg_catalog.pg_has_role('mlp_api_runtime', c.relowner, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname IN ('iglesia', 'auth_app')
              AND pg_catalog.pg_has_role('mlp_api_runtime', p.proowner, 'MEMBER'))
          OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
            WHERE n.nspname IN ('iglesia', 'auth_app')
              AND pg_catalog.pg_has_role('mlp_api_runtime', n.nspowner, 'MEMBER'))
          OR pg_catalog.pg_has_role('mlp_api_runtime',
              (SELECT d.datdba FROM pg_catalog.pg_database d WHERE d.datname = current_database()), 'MEMBER')
          OR pg_catalog.has_schema_privilege('mlp_api_runtime', 'iglesia', 'CREATE')
          OR pg_catalog.has_schema_privilege('mlp_api_runtime', 'auth_app', 'CREATE')
          OR NOT COALESCE((SELECT pg_catalog.pg_has_role('mlp_api_runtime', r.oid, 'MEMBER')
            FROM pg_catalog.pg_roles r WHERE r.rolname = 'mlp_runtime'), false) AS "Value") THEN
    RAISE EXCEPTION 'Runtime has unsafe ownership, attributes, membership or privileges';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_api_runtime' AND rolcanlogin AND rolinherit)
    OR pg_catalog.has_database_privilege('mlp_api_runtime',current_database(),'CREATE')
    OR pg_catalog.has_schema_privilege('mlp_api_runtime','auth','USAGE') THEN
    RAISE EXCEPTION 'Runtime LOGIN/INHERIT or database/schema privileges differ';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('mlp_runtime','mlp_security_definer')
      AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))<>2
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles own_role CROSS JOIN pg_catalog.pg_roles granted
      WHERE own_role.rolname IN ('mlp_runtime','mlp_security_definer') AND own_role.oid<>granted.oid
        AND pg_catalog.pg_has_role(own_role.oid,granted.oid,'MEMBER')) THEN
    RAISE EXCEPTION 'Runtime/helper group attributes or outgoing memberships differ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_ddl_owner'
      AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
    RAISE EXCEPTION 'DDL owner attributes differ';
  END IF;
  IF pg_catalog.has_schema_privilege('mlp_security_definer','iglesia','CREATE')
    OR pg_catalog.has_schema_privilege('mlp_security_definer','auth_app','CREATE')
    OR pg_catalog.has_database_privilege('mlp_security_definer',current_database(),'CREATE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('iglesia','auth_app') AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_security_definer')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE pg_catalog.pg_get_userbyid(nspowner)='mlp_security_definer')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE pg_catalog.pg_get_userbyid(datdba)='mlp_security_definer') THEN
    RAISE EXCEPTION 'Helper owner has CREATE or relation ownership';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='iglesia' AND c.relkind='r' AND c.relrowsecurity AND NOT c.relforcerowsecurity
        AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_ddl_owner')<>11
    OR (SELECT count(DISTINCT tablename) FROM pg_catalog.pg_policies WHERE schemaname='iglesia' AND 'mlp_runtime'=ANY(roles))<>11 THEN
    RAISE EXCEPTION 'Ministry ownership, RLS/FORCE state or runtime policies differ';
  END IF;
  -- Migration rows were checked under mlp_ddl_owner in 020/030 before COMMIT.
  -- postgres has no permanent USAGE/SELECT on auth_app; this file reads catalogs only.
  IF NOT ((SELECT count(*) FROM pg_catalog.pg_constraint WHERE connamespace=(SELECT oid FROM pg_catalog.pg_namespace WHERE nspname='auth_app')
  AND contype='f' AND convalidated AND conname IN ('fk_users_person','fk_access_grants_role','fk_access_grants_branch','fk_grant_permissions_permission'))=4)
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='auth_app' AND c.relkind='r' AND pg_catalog.pg_get_userbyid(c.relowner)='mlp_ddl_owner')<>7 THEN
    RAISE EXCEPTION 'Seven Identity tables or validated references differ';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch')
        AND p.prosecdef AND pg_catalog.pg_get_userbyid(p.proowner)='mlp_security_definer'
        AND p.proconfig @> ARRAY['search_path=""'] AND cardinality(p.proconfig)=1
        AND pg_catalog.has_function_privilege('mlp_runtime',p.oid,'EXECUTE'))<>2
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch')
        AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'SECURITY DEFINER owner, search_path or EXECUTE ACL differs';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname='iglesia'
      AND policyname IN ('mlp_security_definer_role_read','mlp_security_definer_branch_read')
      AND 'mlp_security_definer'=ANY(roles))<>2
    OR pg_catalog.has_schema_privilege('mlp_ddl_owner','iglesia','CREATE')
    OR pg_catalog.has_database_privilege('mlp_ddl_owner',current_database(),'CREATE')
    OR pg_catalog.pg_has_role('mlp_ddl_owner','mlp_security_definer','MEMBER')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET')
    OR pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE') THEN
    RAISE EXCEPTION 'Helper policies or temporary privilege cleanup differ';
  END IF;
END; $verify$;
SELECT '080' AS step,'OK - database deployment checks only; password/bootstrap/API tests are separate' AS result;
SELECT n.nspname,p.proname,pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch');
SELECT r.rolname AS role,m.rolname AS member,g.rolname AS grantor,a.admin_option,a.inherit_option,a.set_option
FROM pg_catalog.pg_auth_members a JOIN pg_catalog.pg_roles r ON r.oid=a.roleid
JOIN pg_catalog.pg_roles m ON m.oid=a.member JOIN pg_catalog.pg_roles g ON g.oid=a.grantor
WHERE r.rolname IN ('mlp_ddl_owner','mlp_security_definer','mlp_runtime','mlp_api_runtime','mlp_migrator')
   OR m.rolname IN ('mlp_ddl_owner','mlp_security_definer','mlp_runtime','mlp_api_runtime','mlp_migrator')
ORDER BY r.rolname,m.rolname,g.rolname;
SELECT n.nspname,c.relname,c.oid,pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('iglesia','auth_app') AND c.relkind='r' ORDER BY n.nspname,c.relname;
ROLLBACK;
