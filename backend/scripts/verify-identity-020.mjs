// Offline PostgreSQL 17 syntax/model verification; never opens a database connection.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const parser = require(path.join(backend, '.local/sql-parser-020/node_modules/libpg-query'));
const read = (file) => readFileSync(path.join(backend,file),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const source = read('sql/001-auth-app.sql');
const corrected = read('sql/supabase-editor/020-identity-001.sql');
const originalAst = await parser.parse(source);
const ast = await parser.parse(corrected);
assert.equal(Math.floor(ast.version / 10000), 17, 'PostgreSQL 17 parser required');
function withoutLocations(value) {
  if (Array.isArray(value)) return value.map(withoutLocations);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['location','stmt_location','stmt_len'].includes(key))
    .map(([key,item]) => [key,withoutLocations(item)]));
  return value;
}
const kinds = (tree, kind) => tree.stmts.filter((s) => s.stmt[kind]).map((s) => s.stmt[kind]);
const originalTables = [...source.matchAll(/CREATE TABLE[\s\S]*?;(?=\n)/g)].map((m) => m[0]);
const originalIndexes = [...source.matchAll(/CREATE (?:UNIQUE )?INDEX[^;]+;/g)].map((m) => m[0]);
const originalHistory = [...source.matchAll(/INSERT INTO auth_app\.__ef_migrations_history[\s\S]*?;/g)].map((m) => m[0]);
const expectedTables = kinds(await parser.parse(originalTables.join('\n')), 'CreateStmt');
const expectedIndexes = kinds(await parser.parse(originalIndexes.join('\n')), 'IndexStmt');
const expectedHistory = kinds(await parser.parse(originalHistory.join('\n')), 'InsertStmt');
assert.deepEqual(withoutLocations(kinds(ast,'CreateStmt')), withoutLocations(expectedTables), 'Identity columns/constraints/identity/keys changed');
assert.deepEqual(withoutLocations(kinds(ast,'IndexStmt')), withoutLocations(expectedIndexes), 'Indexes/predicates changed');
assert.deepEqual(withoutLocations(kinds(ast,'InsertStmt')), withoutLocations(expectedHistory), 'Migration history changed');
assert.deepEqual(kinds(ast,'CreateStmt').map((t) => t.relation.relname).sort(),
  ['__ef_migrations_history','users','user_access_grants','user_claims','user_logins','user_tokens'].sort());
assert.equal(expectedIndexes.length,7);
assert.equal(kinds(ast,'CreateSchemaStmt').length,1);
assert.ok(!corrected.includes('$EF$'), '020 must not retain EF dollar-quoted wrappers');
for (const block of kinds(ast,'DoStmt')) {
  const text = JSON.stringify(block);
  assert.ok(!/CREATE\s+TABLE/i.test(text), 'CREATE TABLE still inside DO');
}
assert.ok(!/ALTER\s+TABLE[\s\S]*?(?:ENABLE|DISABLE)\s+ROW\s+LEVEL\s+SECURITY/i.test(corrected), '020 must not change RLS');
assert.ok(corrected.includes('c.relrowsecurity OR c.relforcerowsecurity'), 'Missing unexpected Identity RLS checkpoint');
assert.ok(corrected.includes("to_regnamespace('auth_app') IS NULL"), 'Missing first-run guard');
assert.deepEqual(kinds(ast,'TransactionStmt').map((t) => t.kind),['TRANS_STMT_START','TRANS_STMT_COMMIT']);

const syntax = [];
for (const file of readdirSync(path.join(backend,'sql/supabase-editor')).filter((f) => /^(020|021|030|040|050|060|070|080|090).*\.sql$/.test(f))) {
  const parsed = await parser.parse(read(`sql/supabase-editor/${file}`));
  syntax.push({file,parserVersion:parsed.version,statements:parsed.stmts.length,syntax:'valid'});
}
// RLS on auth_app would default-deny the non-owner runtime/helper; downstream
// 005 intentionally grants ACLs, not Identity RLS policies. Verify that premise.
const runtime = read('sql/005-runtime-role-rls.sql');
assert.ok(runtime.includes('GRANT SELECT, INSERT, UPDATE ON auth_app.users TO mlp_runtime;'));
assert.ok(runtime.includes('GRANT SELECT ON auth_app.users, auth_app.user_access_grants, iglesia.rol, iglesia.sede TO mlp_security_definer;'));
assert.ok(!/CREATE\s+POLICY[^;]*\bON\s+auth_app\./i.test(runtime));
const report = {checkedAtUtc:new Date().toISOString(),databaseConnections:0,sqlExecuted:false,
  parserPackage:'libpg-query@17.6.0',parserVersion:ast.version,
  originalSyntax:originalAst.version,identityTables:6,explicitIndexes:7,
  identityTableAstMatches:true,indexAstMatches:true,migrationInsertAstMatches:true,
  topLevelCreateTableOnly:true,rlsChanged:false,syntax,
  limits:'Parser validates syntax/AST without resolving roles/objects or executing PL/pgSQL. Supabase UI/deployed rewrite and runtime connection not executed.'};
const destination = path.join(backend,'artifacts/identity-020');
mkdirSync(destination,{recursive:true});
writeFileSync(path.join(destination,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PostgreSQL ${ast.version}: 020 syntax/Identity AST preserved; ${syntax.length} SQL files parsed. No database or SQL execution.`);
