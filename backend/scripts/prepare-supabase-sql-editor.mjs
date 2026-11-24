import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(backend, 'sql/supabase-editor');
const check = process.argv.includes('--check');
const read = (file) => readFileSync(path.join(backend, file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const sha = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();
const assertSql = (condition, message) => `DO $checkpoint$ BEGIN
  IF NOT (${condition}) THEN RAISE EXCEPTION '${message}'; END IF;
END; $checkpoint$;`;
const histories = `EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024015144_InitialApplicationIdentity')`;
const secondHistory = `EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024044431_ExplicitOperatorPermissions')`;
const references = `(SELECT count(*) FROM pg_catalog.pg_constraint WHERE connamespace='auth_app'::regnamespace
  AND contype='f' AND convalidated AND conname IN ('fk_users_person','fk_access_grants_role','fk_access_grants_branch','fk_grant_permissions_permission'))=4`;
const steps = [
  {
    source: 'sql/001-auth-app.sql', output: '020-identity-001.sql',
    before: assertSql(`to_regnamespace('auth_app') IS NULL`, '020: auth_app already exists; stop and reconcile'),
    after: assertSql(`${histories} AND (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='auth_app' AND c.relkind='r' AND c.relname IN ('__ef_migrations_history','users','user_access_grants','user_claims','user_logins','user_tokens'))=6`, '020: Identity checkpoint failed'),
    cleanup: 'REVOKE CREATE ON DATABASE postgres FROM mlp_ddl_owner;',
  },
  {
    source: 'sql/002-explicit-operator-permissions.sql', output: '030-identity-002.sql',
    before: assertSql(`${histories} AND to_regclass('auth_app.user_grant_permissions') IS NULL`, '030: unexpected Identity state'),
    after: assertSql(`${secondHistory} AND to_regclass('auth_app.user_grant_permissions') IS NOT NULL`, '030: explicit permissions checkpoint failed'),
  },
  {
    source: 'sql/proposals/003-assignment-integrity.sql', output: '040-integrity-003.sql',
    before: `${assertSql(secondHistory, '040: migration 002 required')}
SET LOCAL mlp.reviewed_reference_sha256 = '3E52847EAB332A19D206C08890550A99E46C4914AF3B80B29F7F3067E42BEAC2';`,
    after: assertSql(`EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='iglesia.persona_proceso'::regclass
      AND conname='ck_persona_proceso_fechas_v2' AND convalidated)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='iglesia.persona_proceso'::regclass AND conname='ck_persona_proceso_fechas')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_index WHERE indexrelid=to_regclass('iglesia.ux_persona_proceso_abierto_fecha') AND indisvalid AND indisready AND indisunique)
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='iglesia.persona_proceso'::regclass
        AND tgname='trg_validar_estado_fechas' AND tgfoid=to_regprocedure('iglesia.validar_estado_fechas_v2()') AND NOT tgisinternal)`, '040: integrity checkpoint failed'),
  },
  {
    source: 'sql/004-auth-ministry-references.sql', output: '050-references-004.sql',
    before: assertSql(`${secondHistory} AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid='iglesia.persona_proceso'::regclass AND conname='ck_persona_proceso_fechas_v2' AND convalidated)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE connamespace='auth_app'::regnamespace AND conname='fk_users_person')`, '050: unexpected state before references'),
    after: assertSql(`${references} AND (SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid IN ('auth_app.user_access_grants'::regclass,'auth_app.user_grant_permissions'::regclass)
      AND tgname IN ('validate_access_grant','validate_operator_permission') AND NOT tgisinternal)=2`, '050: cross-schema references checkpoint failed'),
  },
  {
    source: 'sql/005-runtime-role-rls.sql', output: '060-rls-005.sql',
    before: assertSql(`${references} AND to_regprocedure('auth_app.has_global_access()') IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='iglesia')`, '060: unexpected state before RLS'),
    after: assertSql(`(SELECT count(DISTINCT tablename) FROM pg_catalog.pg_policies WHERE schemaname='iglesia' AND 'mlp_runtime'=ANY(roles))=11
      AND (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch') AND p.prosecdef
          AND pg_catalog.pg_get_userbyid(p.proowner)='mlp_security_definer' AND p.proconfig @> ARRAY['search_path=""'])=2
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f',p.proowner))) a
        WHERE n.nspname='auth_app' AND p.proname IN ('has_global_access','can_access_branch') AND a.grantee=0 AND a.privilege_type='EXECUTE')`, '060: helper or policy checkpoint failed'),
    cleanup: 'REVOKE mlp_security_definer FROM mlp_ddl_owner GRANTED BY postgres;\nREVOKE CREATE ON SCHEMA iglesia FROM mlp_ddl_owner;',
  },
];

const context = assertSql(`current_database()='postgres' AND current_user='postgres'
  AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='mlp_ddl_owner' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)`,
  'Select the approved project and SQL Editor role postgres; provisioning 010 is required');
const release = `REVOKE mlp_ddl_owner FROM postgres GRANTED BY postgres;
${assertSql(`NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','SET') AND NOT pg_catalog.pg_has_role('postgres','mlp_ddl_owner','USAGE')`, 'Temporary DDL access was not removed; transaction must abort')}`;

// SQL Editor can rewrite CREATE TABLE when the user selects its RLS action.
// 020 is already guarded as a first deployment into an ABSENT namespace. Emit
// the exact original schema/table/index/history statements at top level rather
// than retaining EF's idempotent DO wrappers. Never alter the source migration.
function firstIdentityStatements(body) {
  const schemas = [...body.matchAll(/CREATE SCHEMA auth_app;/g)].map((m) => m[0]);
  const tables = [...body.matchAll(/CREATE TABLE[\s\S]*?;(?=\n)/g)].map((m) => m[0]);
  const indexes = [...body.matchAll(/CREATE (?:UNIQUE )?INDEX[^;]+;/g)].map((m) => m[0]);
  const history = [...body.matchAll(/INSERT INTO auth_app\.__ef_migrations_history[\s\S]*?;/g)].map((m) => m[0]);
  if (schemas.length !== 2 || tables.length !== 6 || indexes.length !== 7 || history.length !== 1) {
    throw new Error('Unexpected 001 contents: review top-level extraction before regenerating 020');
  }
  return [schemas[0], ...tables, ...indexes, ...history].join('\n\n') + '\n';
}

function standardRoutineLiterals(sql) {
  return sql.replace(/(\$[A-Za-z_0-9]*\$)([\s\S]*?)\1/g, (_match, _tag, body) => {
    // One physical line per body avoids a partially copied multiline delimiter.
    // E-strings decode back to the exact original PL/pgSQL, including newlines/comments.
    return "E'" + body.replaceAll('\\','\\\\').replaceAll("'", "''")
      .replaceAll('\r','\\r').replaceAll('\n','\\n') + "'";
  });
}

const manifest = [];
for (const step of steps) {
  const original = read(step.source);
  const boundary = /^(START TRANSACTION;|BEGIN;)$/m.exec(original);
  const end = original.lastIndexOf('COMMIT;');
  if (!boundary || end < boundary.index || original.slice(end + 7).trim()) throw new Error(`Unexpected transaction boundaries: ${step.source}`);
  const body = original.slice(boundary.index + boundary[0].length, end);
  const isInitialIdentity = step.source === 'sql/001-auth-app.sql';
  const isIntegrity = step.source === 'sql/proposals/003-assignment-integrity.sql';
  const emittedBody = isInitialIdentity ? '\n' + firstIdentityStatements(body) : body;
  const marker = isInitialIdentity ? 'ORIGINAL IDENTITY STATEMENTS - TOP LEVEL, NO EF WRAPPERS'
    : isIntegrity ? 'ORIGINAL SOURCE - ROUTINE LITERAL QUOTING ONLY' : 'UNCHANGED SOURCE BODY';
  const rlsCheckpoint = isInitialIdentity ? assertSql(`NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth_app' AND c.relkind='r' AND (c.relrowsecurity OR c.relforcerowsecurity))
    AND (SELECT count(*) FROM auth_app.__ef_migrations_history)=1
    AND EXISTS (SELECT 1 FROM auth_app.__ef_migrations_history WHERE "MigrationId"='20261024015144_InitialApplicationIdentity' AND "ProductVersion"='10.0.13')`,
    '020: unexpected Identity RLS or migration history; abort instead of changing security') : '';
  let output = `-- GENERATED from ${step.source}; copy/run this ENTIRE FILE alone in SQL Editor.
-- Project sneceodpvscrvjrlqwgw. Role postgres. Verified backup and approval required.
-- Single-use deployment wrapper. Stop on any error. Do not run all files together.
${isInitialIdentity ? '-- 010 ALREADY COMPLETED: DO NOT REPEAT IT. In the RLS warning choose Run without RLS.\n-- Do not use Run and enable RLS: auth_app uses the existing backend/ACL model.\n' : ''}\
${original.slice(0, boundary.index)}${boundary[0]}
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
${context}
GRANT mlp_ddl_owner TO postgres WITH SET TRUE, INHERIT FALSE GRANTED BY postgres;
SET LOCAL ROLE mlp_ddl_owner;
${step.before}
-- BEGIN ${marker}
${emittedBody}-- END ${marker}
${step.after}
${rlsCheckpoint ? rlsCheckpoint + '\n' : ''}\
SET LOCAL ROLE postgres;
${step.cleanup ?? ''}
${release}
SELECT '${step.output}' AS step, 'OK - check COMMIT and continue only after review' AS result;
COMMIT;
`;
  if (isIntegrity) {
    output = standardRoutineLiterals(output);
    output += '-- FIN 040: archivo completo; ejecutar desde BEGIN hasta COMMIT, sin seleccion parcial.\n';
  }
  if (/^\s*\\/m.test(output)) throw new Error('psql metacommand in SQL Editor output');
  if (check) {
    if (read(`sql/supabase-editor/${step.output}`) !== output) throw new Error(`Stale generated SQL: ${step.output}`);
  } else {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, step.output), output);
  }
  manifest.push({ source: step.source, sourceSha256: sha(readFileSync(path.join(backend, step.source))),
    output: step.output, outputSha256: sha(output), unchangedSourceBody: !isInitialIdentity && !isIntegrity,
    ...(isInitialIdentity ? {unchangedIdentityStatements: true, executionMode: 'guarded-first-run-top-level-ddl'} : {}),
    ...(isIntegrity ? {unchangedRoutineBodies: true, executionMode: 'postgres-escape-string-routines'} : {}) });
}

const safetySource = read('src/MisionLiderParis.Infrastructure/Database/RuntimeDatabaseSafety.cs');
const safetyQuery = /public const string UnsafeRoleQuery = """\n([\s\S]*?)\n\s*""";/.exec(safetySource)?.[1];
if (!safetyQuery) throw new Error('RuntimeDatabaseSafety query not found');
const expected = safetyQuery.replace(/\bcurrent_user\b/g, "'mlp_api_runtime'").trim();
const catalogReferences = references.replace("connamespace='auth_app'::regnamespace", "connamespace=(SELECT oid FROM pg_catalog.pg_namespace WHERE nspname='auth_app')");
const finalFile = `-- READ ONLY, repeatable. SQL Editor role postgres, project sneceodpvscrvjrlqwgw.
-- Verifies deployment, not passwords, bootstrap success or real per-user authorization.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
DO $verify$
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' THEN
    RAISE EXCEPTION 'Select approved project and SQL Editor role postgres';
  END IF;
  -- Query reused from RuntimeDatabaseSafety.cs, with target role instead of current_user.
  IF (${expected}) THEN
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
  IF NOT (${catalogReferences})
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
`;
if (check) {
  if (read('sql/supabase-editor/080-verify-readonly.sql') !== finalFile) throw new Error('Stale final verification');
} else writeFileSync(path.join(directory, '080-verify-readonly.sql'), finalFile);
for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql'))) {
  const sql = read(`sql/supabase-editor/${file}`);
  if (/^\s*\\/m.test(sql)) throw new Error(`psql command in ${file}`);
  if (/\bPASSWORD\s+(?:'|\$)/i.test(sql)) throw new Error(`Literal password in ${file}`);
}
const data = JSON.stringify({ project: 'sneceodpvscrvjrlqwgw', status: 'prepared-not-executed', generated: manifest,
  files: readdirSync(directory).filter((f) => f.endsWith('.sql')).sort().map((file) => ({file, sha256: sha(readFileSync(path.join(directory,file)))})) }, null, 2) + '\n';
if (check) {
  if (read('sql/supabase-editor/manifest.json') !== data) throw new Error('Stale manifest');
} else writeFileSync(path.join(directory, 'manifest.json'), data);
console.log(`${check ? 'Verified' : 'Prepared'} SQL Editor package: 020 top-level Identity; 040 equivalent routine literals; other source bodies unchanged. Independent transactions; no SQL execution.`);
