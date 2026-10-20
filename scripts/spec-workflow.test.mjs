import assert from "node:assert/strict";
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
