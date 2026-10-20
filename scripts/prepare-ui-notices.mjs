import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "frontend/dist/iglesia-web");
if (!existsSync(path.join(output, "browser/index.html")))
  throw new Error("Compila Angular antes de preparar los avisos.");
const policy = JSON.parse(
  readFileSync(path.join(root, "docs/ui-dependencies.json"), "utf8"),
);
const notices = ["Misión Líder París — Avisos de dependencias\n"];
for (const dependency of policy.packages) {
  const directory = path.join(root, "frontend/node_modules", dependency.name);
  const license = readdirSync(directory).find((file) =>
    /^licen[sc]e(?:\.|$)/i.test(file),
  );
  if (!license)
    throw new Error(`Falta archivo de licencia: ${dependency.name}`);
  notices.push(
    `${dependency.name}@${dependency.version} (${dependency.license})\n\n${readFileSync(path.join(directory, license), "utf8")}`,
  );
}
// Angular escribe sus avisos fuera de browser; incluirlos también en la carpeta publicada por Firebase.
notices.push(readFileSync(path.join(output, "3rdpartylicenses.txt"), "utf8"));
writeFileSync(
  path.join(output, "browser/third-party-notices.txt"),
  notices.join("\n\n--------------------\n\n"),
);
console.log(
  "Avisos de licencia incorporados a browser/third-party-notices.txt.",
);
