import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function createSpec(slug, root = repository, scope = "root") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? "") || slug.length > 64) {
    throw new Error(
      "Usa un nombre de hasta 64 caracteres: letras minúsculas, números y guiones.",
    );
  }
  if (!["root", "backend"].includes(scope))
    throw new Error("Ámbito SDD inválido.");
  const specs = path.join(
    root,
    scope === "backend" ? "backend/specs" : "specs",
  );
  mkdirSync(specs, { recursive: true });
  const directories = readdirSync(specs, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name),
  );
  if (directories.some((entry) => entry.name.slice(4) === slug)) {
    throw new Error(`Ya existe una especificación con el nombre ${slug}.`);
  }
  const next =
    Math.max(0, ...directories.map((entry) => Number(entry.name.slice(0, 3)))) +
    1;
  if (next > 999) throw new Error("Se agotó la numeración de tres dígitos.");
  const id = String(next).padStart(3, "0");
  const destination = path.join(specs, `${id}-${slug}`);
  const names = [
    "spec.md",
    "plan.md",
    "tasks.md",
    "validation.md",
    "traceability.json",
  ];
  // Leer todo antes de crear el directorio para fallar sin un scaffold parcial si faltan plantillas.
  const content = names.map((name) => [
    name,
    readFileSync(path.join(root, "specs", "templates", name), "utf8"),
  ]);
  if (existsSync(destination))
    throw new Error("El directorio de destino ya existe.");
  mkdirSync(destination);
  for (const [name, template] of content) {
    writeFileSync(
      path.join(destination, name),
      template.replaceAll("{{ID}}", id).replaceAll("{{NAME}}", slug),
      { flag: "wx" },
    );
  }
  return destination;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] === "--help") {
    console.log("Uso: npm run spec:new -- nombre-de-funcionalidad [--backend]");
  } else {
    try {
      console.log(
        `Especificación creada: ${path.relative(repository, createSpec(process.argv[2], repository, process.argv.includes("--backend") ? "backend" : "root"))}`,
      );
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
