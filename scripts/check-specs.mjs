import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function checkSpecs(root = repository) {
  const errors = [];
  const specs = path.join(root, "specs");
  const directories = readdirSync(specs, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && /^\d{3}-[a-z0-9-]+$/.test(entry.name),
  );
  const ids = new Set();
  for (const entry of directories) {
    const label = entry.name;
    if (ids.has(label.slice(0, 3)))
      errors.push(`${label}: número de especificación duplicado.`);
    ids.add(label.slice(0, 3));
    const directory = path.join(specs, label);
    const required = [
      "spec.md",
      "plan.md",
      "tasks.md",
      "validation.md",
      "traceability.json",
    ];
    const missing = required.filter(
      (name) => !existsSync(path.join(directory, name)),
    );
    if (missing.length) {
      errors.push(`${label}: faltan ${missing.join(", ")}.`);
      continue;
    }
    try {
      const trace = JSON.parse(
        readFileSync(path.join(directory, "traceability.json"), "utf8"),
      );
      if (!["draft", "ready", "in-progress", "verified"].includes(trace.status))
        throw new Error("estado inválido");
      if (!Array.isArray(trace.criteria) || trace.criteria.length === 0)
        throw new Error("faltan criterios");
      const spec = readFileSync(path.join(directory, "spec.md"), "utf8");
      const specCriteria = new Set(spec.match(/\bAC-\d{3}\b/g) ?? []);
      const seen = new Set();
      for (const criterion of trace.criteria) {
        if (!/^AC-\d{3}$/.test(criterion.id) || seen.has(criterion.id))
          throw new Error("ID inválido o duplicado");
        seen.add(criterion.id);
        if (!specCriteria.has(criterion.id))
          throw new Error(`${criterion.id} no aparece en spec.md`);
        if (typeof criterion.verified !== "boolean")
          throw new Error(`${criterion.id} requiere verified booleano`);
        for (const field of ["implementation", "verification"]) {
          if (!Array.isArray(criterion[field]))
            throw new Error(`${criterion.id}: ${field} debe ser una lista`);
          for (const file of criterion[field]) {
            if (typeof file !== "string")
              throw new Error("ruta de archivo inválida");
            const destination = path.resolve(root, file);
            const relative = path.relative(root, destination);
            if (relative.startsWith("..") || path.isAbsolute(relative))
              throw new Error("ruta fuera del repositorio");
            if (!existsSync(destination) || !statSync(destination).isFile())
              throw new Error(`no existe el archivo ${file}`);
          }
        }
        if (
          criterion.verified &&
          (!criterion.implementation.length ||
            !criterion.verification.length ||
            !criterion.evidence?.trim())
        ) {
          throw new Error(
            `${criterion.id}: verificado sin archivos o evidencia`,
          );
        }
      }
      for (const criterion of specCriteria)
        if (!seen.has(criterion))
          throw new Error(`${criterion} no tiene trazabilidad`);
      if (
        trace.status === "verified" &&
        trace.criteria.some((criterion) => !criterion.verified)
      )
        throw new Error("estado verified con aceptación pendiente");
    } catch (error) {
      errors.push(`${label}: ${error.message}.`);
    }
  }
  if (!directories.length) errors.push("No hay especificaciones numeradas.");
  return errors;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkSpecs();
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else {
    console.log(
      "Estructura y trazabilidad SDD válidas. La verificación funcional se registra por separado.",
    );
  }
}
