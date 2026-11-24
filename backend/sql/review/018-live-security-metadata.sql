-- Metadata only. Does not select personal/authentication records or password hashes.
-- Safe to run against the authorized project; the transaction is explicitly READ ONLY.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';
SELECT jsonb_pretty(jsonb_build_object(
  'inspectedAtUtc', clock_timestamp(),
  'serverVersion', current_setting('server_version'),
  'operator', current_user,
  'operatorAttributes', (SELECT jsonb_build_object('superuser', rolsuper, 'bypassRls', rolbypassrls,
    'createRole', rolcreaterole, 'createDb', rolcreatedb, 'replication', rolreplication)
    FROM pg_roles WHERE rolname = current_user),
  'schemas', (SELECT jsonb_agg(jsonb_build_object('name', nspname, 'owner', pg_get_userbyid(nspowner), 'acl', nspacl::text)
    ORDER BY nspname) FROM pg_namespace WHERE nspname IN ('iglesia', 'auth_app', 'auth', 'public')),
  'tables', COALESCE((SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname,
    'owner', pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
    'acl', c.relacl::text) ORDER BY n.nspname, c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p')), '[]'::jsonb),
  'defaultAcl', COALESCE((SELECT jsonb_agg(jsonb_build_object('owner', pg_get_userbyid(d.defaclrole),
    'schema', CASE WHEN d.defaclnamespace = 0 THEN '*' ELSE n.nspname END,
    'kind', d.defaclobjtype, 'acl', d.defaclacl::text) ORDER BY d.defaclrole, d.defaclnamespace, d.defaclobjtype)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE d.defaclnamespace = 0 OR n.nspname IN ('iglesia', 'auth_app', 'public')), '[]'::jsonb),
  'relevantRoles', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', rolname, 'login', rolcanlogin,
    'superuser', rolsuper, 'bypassRls', rolbypassrls, 'createRole', rolcreaterole, 'createDb', rolcreatedb,
    'replication', rolreplication, 'inherit', rolinherit) ORDER BY rolname)
    FROM pg_roles WHERE rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated',
      'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user', 'pg_database_owner')), '[]'::jsonb),
  'memberships', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', r.rolname, 'member', m.rolname,
    'admin', a.admin_option, 'inherit', a.inherit_option, 'set', a.set_option) ORDER BY m.rolname, r.rolname)
    FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.roleid JOIN pg_roles m ON m.oid = a.member
    WHERE m.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated', 'service_role', 'authenticator')
       OR r.rolname = 'mlp_runtime'), '[]'::jsonb),
  'membershipClosure', COALESCE((WITH RECURSIVE membership_tree(member_name, role_oid, role_name, depth, path, admin_option, inherit_option, set_option) AS (
      SELECT member.rolname, granted.oid, granted.rolname, 1, ARRAY[member.oid, granted.oid],
        membership.admin_option, membership.inherit_option, membership.set_option
      FROM pg_roles member JOIN pg_auth_members membership ON membership.member = member.oid
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE member.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime',
        'anon', 'authenticated', 'service_role', 'authenticator')
      UNION ALL
      SELECT tree.member_name, granted.oid, granted.rolname, tree.depth + 1,
        tree.path || granted.oid, membership.admin_option, membership.inherit_option, membership.set_option
      FROM membership_tree tree JOIN pg_auth_members membership ON membership.member = tree.role_oid
      JOIN pg_roles granted ON granted.oid = membership.roleid
      WHERE NOT granted.oid = ANY(tree.path)
    )
    SELECT jsonb_agg(jsonb_build_object('member', member_name, 'role', role_name, 'depth', depth,
      'admin', admin_option, 'inherit', inherit_option, 'set', set_option)
      ORDER BY member_name, depth, role_name) FROM membership_tree), '[]'::jsonb),
  'effectiveSchemaPrivileges', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', r.rolname,
      'schema', n.nspname,
      'usage', has_schema_privilege(r.rolname, n.oid, 'USAGE'),
      'create', has_schema_privilege(r.rolname, n.oid, 'CREATE'))
      ORDER BY r.rolname, n.nspname)
    FROM pg_roles r CROSS JOIN pg_namespace n
    WHERE r.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated',
      'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user')
      AND n.nspname IN ('iglesia', 'auth_app')), '[]'::jsonb),
  'effectiveDatabasePrivileges', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', r.rolname,
      'connect', has_database_privilege(r.rolname, current_database(), 'CONNECT'),
      'create', has_database_privilege(r.rolname, current_database(), 'CREATE'),
      'temporary', has_database_privilege(r.rolname, current_database(), 'TEMPORARY'))
      ORDER BY r.rolname)
    FROM pg_roles r
    WHERE r.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated',
      'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user')), '[]'::jsonb),
  'effectiveTablePrivileges', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', r.rolname,
      'schema', n.nspname, 'table', c.relname,
      'owner', pg_get_userbyid(c.relowner),
      'privileges', COALESCE((SELECT jsonb_agg(p.privilege ORDER BY p.privilege)
        FROM (VALUES ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'), ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) p(privilege)
        WHERE has_table_privilege(r.rolname, c.oid, p.privilege)), '[]'::jsonb))
      ORDER BY r.rolname, n.nspname, c.relname)
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE r.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated',
      'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user')
      AND n.nspname IN ('iglesia', 'auth_app') AND c.relkind IN ('r', 'p')), '[]'::jsonb),
  'effectiveSequencePrivileges', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', r.rolname,
      'schema', n.nspname, 'sequence', c.relname, 'owner', pg_get_userbyid(c.relowner),
      'privileges', COALESCE((SELECT jsonb_agg(p.privilege ORDER BY p.privilege)
        FROM (VALUES ('SELECT'), ('USAGE'), ('UPDATE')) p(privilege)
        WHERE has_sequence_privilege(r.rolname, c.oid, p.privilege)), '[]'::jsonb))
      ORDER BY r.rolname, n.nspname, c.relname)
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE r.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime', 'anon', 'authenticated',
      'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user')
      AND n.nspname IN ('iglesia', 'auth_app') AND c.relkind = 'S'), '[]'::jsonb),
  'schemaFunctions', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text,
    'schema', n.nspname, 'owner', pg_get_userbyid(p.proowner), 'securityDefiner', p.prosecdef,
    'config', p.proconfig, 'acl', p.proacl::text,
    'effectiveExecute', COALESCE((SELECT jsonb_agg(r.rolname ORDER BY r.rolname)
      FROM pg_roles r WHERE r.rolname IN (current_user, 'mlp_runtime', 'mlp_api_runtime',
        'anon', 'authenticated', 'service_role', 'authenticator', 'postgres', 'supabase_admin', 'dashboard_user')
        AND has_function_privilege(r.rolname, p.oid, 'EXECUTE')), '[]'::jsonb))
    ORDER BY n.nspname, p.proname, p.oid::regprocedure::text)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('iglesia', 'auth_app')), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies p WHERE schemaname IN ('iglesia', 'auth_app')), '[]'::jsonb),
  'authAppFunctions', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text,
    'owner', pg_get_userbyid(p.proowner), 'securityDefiner', p.prosecdef, 'config', p.proconfig, 'acl', p.proacl::text)
    ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'auth_app'), '[]'::jsonb),
  'eventTriggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', e.evtname, 'event', e.evtevent,
    'enabled', e.evtenabled, 'function', e.evtfoid::regprocedure::text,
    'functionSchema', n.nspname, 'functionOwner', pg_get_userbyid(p.proowner),
    'securityDefiner', p.prosecdef, 'config', p.proconfig) ORDER BY e.evtname)
    FROM pg_event_trigger e JOIN pg_proc p ON p.oid = e.evtfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace), '[]'::jsonb),
  'apiSchemaSettings', COALESCE((SELECT jsonb_agg(jsonb_build_object('role', CASE WHEN s.setrole = 0 THEN '*' ELSE pg_get_userbyid(s.setrole) END,
    'setting', v.value)) FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) v(value)
    WHERE v.value LIKE 'pgrst.db_schemas=%'), '[]'::jsonb)
));
ROLLBACK;
