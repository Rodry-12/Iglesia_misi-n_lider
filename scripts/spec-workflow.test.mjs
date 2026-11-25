import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createSpec } from "./new-spec.mjs";
import { checkSpecs } from "./check-specs.mjs";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function fixture(t) {
  const parent = realpathSync(tmpdir());
  const directory = mkdtempSync(path.join(parent, "iglesia-sdd-"));
  mkdirSync(path.join(directory, "specs"));
  cpSync(
    path.join(repository, "specs/templates"),
    path.join(directory, "specs/templates"),
    { recursive: true },
  );
  t.after(() => {
    // La limpieza solo acepta el directorio temporal recién creado por esta prueba.
    const resolved = realpathSync(directory);
    assert.equal(path.dirname(resolved), parent);
    assert.ok(path.basename(resolved).startsWith("iglesia-sdd-"));
    rmSync(resolved, { recursive: true });
  });
  return directory;
}

test("AC-006: genera documentos consecutivos y no sobrescribe una funcionalidad existente", (t) => {
  const root = fixture(t);
  const first = createSpec("ministerios", root);
  const original = readFileSync(path.join(first, "spec.md"), "utf8");
  assert.equal(path.basename(first), "001-ministerios");
  assert.equal(path.basename(createSpec("horarios", root)), "002-horarios");
  assert.throws(() => createSpec("ministerios", root), /Ya existe/);
  assert.equal(readFileSync(path.join(first, "spec.md"), "utf8"), original);
  assert.deepEqual(checkSpecs(root), []);
});

test("AC-006: rechaza nombres que intenten salir del directorio de especificaciones", (t) => {
  const root = fixture(t);
  for (const slug of [
    "../otro",
    "carpeta/otra",
    "Nombre con espacios",
    "",
    "x".repeat(65),
  ]) {
    assert.throws(() => createSpec(slug, root), /nombre/);
  }
});

test("AC-006: detecta criterios sin evidencia y rutas fuera del repositorio", (t) => {
  const root = fixture(t);
  const directory = createSpec("contacto", root);
  const file = path.join(directory, "traceability.json");
  const trace = JSON.parse(readFileSync(file, "utf8"));
  trace.criteria[0].verified = true;
  writeFileSync(file, JSON.stringify(trace));
  assert.match(checkSpecs(root).join("\n"), /sin archivos o evidencia/);
  trace.criteria[0].verified = false;
  trace.criteria[0].implementation = ["../archivo-externo"];
  writeFileSync(file, JSON.stringify(trace));
  assert.match(checkSpecs(root).join("\n"), /fuera del repositorio/);
});

function privateEvidenceFixture(t, scope = "root") {
  const root = fixture(t);
  if (scope === "backend") createSpec("public-parent", root);
  const directory = createSpec("private-capture", root, scope);
  const tracePath = path.join(directory, "traceability.json");
  const trace = JSON.parse(readFileSync(tracePath, "utf8"));
  const capture = "synthetic private test fixture, not Supabase evidence";
  const record = {
    kind: "private-local-evidence",
    path: "artifacts/capture.json",
    state: "captured",
    sha256: createHash("sha256").update(capture).digest("hex"),
  };
  Object.assign(trace.criteria[0], {
    implementation: ["specs/001-private-capture/spec.md"],
    verification: ["specs/001-private-capture/validation.md", record],
    verified: true,
    evidence: "Synthetic fixture for the private historical evidence contract.",
  });
  const save = () => writeFileSync(tracePath, JSON.stringify(trace));
  save();
  return {
    root,
    directory,
    trace,
    record,
    capture,
    save,
    scopeRoot: scope === "backend" ? path.join(root, "backend") : root,
  };
}

test("CI sin captura privada valida el registro y los archivos públicos, también en backend", (t) => {
  const { root } = privateEvidenceFixture(t, "backend");
  assert.deepEqual(checkSpecs(root), []);
});

test("evidencia privada presente verifica SHA-256 y detecta cambios", (t) => {
  const { root, scopeRoot, record, capture } = privateEvidenceFixture(t);
  mkdirSync(path.join(scopeRoot, "artifacts"));
  const localFile = path.join(scopeRoot, record.path);
  writeFileSync(localFile, capture);
  assert.deepEqual(checkSpecs(root), []);
  writeFileSync(localFile, "changed fixture");
  assert.match(checkSpecs(root).join("\n"), /SHA-256.*no coincide/);
});

test("archivos ordinarios siguen siendo obligatorios incluso bajo artifacts", (t) => {
  const { root, trace, save } = privateEvidenceFixture(t);
  trace.criteria[0].verification.push("artifacts/required.json");
  save();
  assert.match(
    checkSpecs(root).join("\n"),
    /no existe el archivo artifacts\/required.json/,
  );
});

test("no permite usar evidencia privada para omitir archivos de implementación", (t) => {
  const { root, trace, record, save } = privateEvidenceFixture(t);
  trace.criteria[0].implementation = [record];
  save();
  assert.match(checkSpecs(root).join("\n"), /ruta de archivo inválida/);
});

test("un criterio verificado sigue necesitando verificación pública y evidencia escrita", (t) => {
  const { root, trace, record, save } = privateEvidenceFixture(t);
  trace.criteria[0].verification = [record];
  save();
  assert.match(checkSpecs(root).join("\n"), /sin archivos o evidencia/);
  trace.criteria[0].verification.unshift(
    "specs/001-private-capture/validation.md",
  );
  trace.criteria[0].evidence = "";
  save();
  assert.match(checkSpecs(root).join("\n"), /sin archivos o evidencia/);
});

for (const [field, value, error] of [
  ["kind", "optional-file", /registro de evidencia privada inválido/],
  ["state", "pending", /registro de evidencia privada inválido/],
  ["sha256", "invalid", /registro de evidencia privada inválido/],
  ["sha256", ["a".repeat(64)], /registro de evidencia privada inválido/],
  ["path", "../outside.json", /fuera del repositorio/],
  ["path", "artifacts/../source.json", /fuera de artifacts o .local/],
]) {
  test(`rechaza registro privado inválido: ${field}=${JSON.stringify(value)}`, (t) => {
    const { root, record, save } = privateEvidenceFixture(t);
    record[field] = value;
    save();
    assert.match(checkSpecs(root).join("\n"), error);
  });
}
