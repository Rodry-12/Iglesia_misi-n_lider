import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "frontend/src");
const tokenFile = path.join(source, "styles/tokens.css");
const tokens = readFileSync(tokenFile, "utf8");
const names = new Set(
  [...tokens.matchAll(/(--ml-[\w-]+)\s*:/g)].map((match) => match[1]),
);
const errors = [];
const manifest = JSON.parse(
  readFileSync(path.join(root, "frontend/package.json"), "utf8"),
);
if (
  !manifest.dependencies?.primeng ||
  !manifest.dependencies?.["@primeuix/themes"]
) {
  errors.push("Falta PrimeNG o su paquete de temas.");
}
if (manifest.dependencies?.["@angular/material"])
  errors.push("Material no pertenece al stack vigente.");

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file);
      continue;
    }
    // No inspeccionar ni modificar pruebas: se retomarán en su propio incremento.
    if (
      !/\.(ts|scss|css|html)$/.test(file) ||
      file.endsWith(".spec.ts") ||
      file === tokenFile
    )
      continue;
    const content = readFileSync(file, "utf8");
    const label = path.relative(root, file);
    if (/@angular\/material/.test(content))
      errors.push(`${label}: importación de Material.`);
    if (/::ng-deep/.test(content))
      errors.push(`${label}: no usar selectores internos.`);
    // index.html necesita theme-color antes de cargar CSS; está documentado en el contrato.
    if (
      file !== path.join(source, "index.html") &&
      /#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(content)
    ) {
      errors.push(`${label}: color literal fuera de tokens.css.`);
    }
    for (const match of content.matchAll(/var\((--ml-[\w-]+)/g)) {
      if (!names.has(match[1]))
        errors.push(`${label}: token no definido ${match[1]}.`);
    }
  }
}
inspect(source);
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else {
  console.log(
    "Contrato estático de diseño correcto: PrimeNG, colores centralizados y referencias de tokens válidas. No acredita comportamiento o contraste.",
  );
}
