import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const assetRoot = path.join(root, "frontend/public/assets");
export function referencedAssets() {
  const urls = new Set();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!/\.(ts|html|scss|css)$/.test(file) || file.endsWith(".spec.ts"))
        continue;
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(/\/assets\/[^'"<>\r\n)]+/g)) {
        urls.add(decodeURIComponent(match[0].split(/[?#]/)[0]));
      }
    }
  }
  visit(path.join(root, "frontend/src"));
  return [...urls].sort();
}
export function checkAssets() {
  const errors = [];
  const licenses = [
    "/assets/fonts/DM-Sans-OFL.txt",
    "/assets/fonts/Grape-Nuts-OFL.txt",
    "/assets/licenses/font-awesome-OFL.txt",
  ];
  for (const url of [...referencedAssets(), ...licenses]) {
    const file = path.resolve(assetRoot, "." + url.slice("/assets".length));
    if (
      !file.startsWith(assetRoot + path.sep) ||
      !existsSync(file) ||
      !statSync(file).isFile()
    ) {
      errors.push(`Recurso local ausente o fuera de assets: ${url}`);
    }
  }
  return errors;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkAssets();
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else
    console.log(
      `Recursos propios verificados: ${referencedAssets().length} referencias. No se generan copias desde el sitio anterior.`,
    );
}
