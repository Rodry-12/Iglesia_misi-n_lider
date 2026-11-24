// Offline PostgreSQL 17 syntax and full source-statement comparison. No connections.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const parser = require(path.join(backend,'.local/sql-parser-020/node_modules/libpg-query'));
const read = (f) => readFileSync(path.join(backend,f),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['location','stmt_location','stmt_len'].includes(key))
    .map(([key,item]) => [key,normalize(item)]));
  return value;
}
const source = read('sql/proposals/003-assignment-integrity.sql');
const corrected = read('sql/supabase-editor/040-integrity-003.sql');
const start = '-- BEGIN ORIGINAL SOURCE - ROUTINE LITERAL QUOTING ONLY\n';
const end = '-- END ORIGINAL SOURCE - ROUTINE LITERAL QUOTING ONLY';
assert.ok(corrected.includes(start) && corrected.includes(end));
const body = corrected.slice(corrected.indexOf(start)+start.length,corrected.indexOf(end));
const originalBody = source.slice(source.indexOf('\nBEGIN;')+'\nBEGIN;'.length,source.lastIndexOf('COMMIT;'));
const expected = await parser.parse(originalBody);
const actual = await parser.parse(body);
assert.deepEqual(normalize(actual.stmts),normalize(expected.stmts),'A statement, function/DO body, trigger, lock, constraint or index changed');
assert.ok(!/\$[A-Za-z_0-9]*\$/.test(corrected),'040 still contains dollar-quoted delimiters');
assert.ok(corrected.trimEnd().endsWith('-- FIN 040: archivo completo; ejecutar desde BEGIN hasta COMMIT, sin seleccion parcial.'));
const full = await parser.parse(corrected);
assert.equal(Math.floor(full.version/10000),17);
assert.deepEqual(full.stmts.filter((s)=>s.stmt.TransactionStmt).map((s)=>s.stmt.TransactionStmt.kind),['TRANS_STMT_BEGIN','TRANS_STMT_COMMIT']);
const syntax = [];
for (const file of readdirSync(path.join(backend,'sql/supabase-editor')).filter((f)=>/^(040|041|050|060|070|080|090).*\.sql$/.test(f))) {
  const parsed = await parser.parse(read(`sql/supabase-editor/${file}`));
  syntax.push({file,parserVersion:parsed.version,statements:parsed.stmts.length,syntax:'valid'});
}
const report = {checkedAtUtc:new Date().toISOString(),databaseConnections:0,sqlExecuted:false,
  parserPackage:'libpg-query@17.6.0',parserVersion:full.version,
  originalStatementsCompared:expected.stmts.length,fullSourceAstMatches:true,routineBodiesUnchanged:true,
  dollarQuotes:0,transaction:'BEGIN/COMMIT',syntax,
  limits:'SQL syntax and decoded routine/source AST verified offline. No PL/pgSQL semantic execution, role checks against live database, or SQL Editor transport test.'};
const destination = path.join(backend,'artifacts/integrity-040');
mkdirSync(destination,{recursive:true});
writeFileSync(path.join(destination,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(`040 PostgreSQL ${full.version}: ${expected.stmts.length} source statements/decoded routine bodies identical; ${syntax.length} files parsed. No SQL execution.`);
