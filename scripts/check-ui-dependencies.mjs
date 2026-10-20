import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const manifest = read("frontend/package.json");
const lock = read("frontend/package-lock.json");
const policy = read("docs/ui-dependencies.json");
const errors = [];
for (const expected of policy.packages) {
  try {
    const folder = `frontend/node_modules/${expected.name}`;
    const installed = read(`${folder}/package.json`);
    const declared =
      manifest.dependencies?.[expected.name] ??
      manifest.devDependencies?.[expected.name];
    assert.equal(
      declared,
      expected.version,
      "la declaración debe fijar la versión revisada",
    );
    assert.equal(
      installed.version,
      expected.version,
      "la instalación debe coincidir",
    );
    assert.equal(
      lock.packages[`node_modules/${expected.name}`]?.version,
      expected.version,
      "el lockfile debe coincidir",
    );
    assert.equal(
      installed.license,
      expected.license,
      "licencia distinta de la revisada",
    );
    assert.ok(
      readdirSync(path.join(root, folder)).some((name) =>
        /^licen[sc]e(?:\.|$)/i.test(name),
      ),
      "falta archivo de licencia",
    );
    if (expected.licenseSection) {
      const license = readFileSync(
        path.join(root, folder, "LICENSE.md"),
        "utf8",
      );
      const start = license.indexOf(`## ${expected.licenseSection}`);
      assert.ok(start >= 0, "falta la sección de licencia revisada");
      const end = license.indexOf("\n## ", start + 1);
      const section = license.slice(start, end < 0 ? undefined : end);
      assert.ok(
        section.includes(expected.licenseText),
        "la sección no contiene la licencia revisada",
      );
      assert.ok(
        !installed.version.includes("-lts"),
        "la política no autoriza versiones LTS comerciales",
      );
    }
    console.log(
      `${expected.name}@${installed.version}: ${installed.license}, declaración y lockfile correctos.`,
    );
  } catch (error) {
    errors.push(`${expected.name}: ${error.message}`);
  }
}
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
}
