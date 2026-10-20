import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Valida el formato simple usado por las skills locales sin requerir Python o paquetes externos.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".agents", "skills");
const errors = [];
for (const entry of readdirSync(directory, { withFileTypes: true }).filter(
  (item) => item.isDirectory(),
)) {
  try {
    const folder = path.join(directory, entry.name);
    const skill = readFileSync(path.join(folder, "SKILL.md"), "utf8");
    const frontmatter = skill.match(
      /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
    )?.[1];
    if (!frontmatter) throw new Error("falta el frontmatter");
    const name = frontmatter.match(/^name: ([a-z0-9]+(?:-[a-z0-9]+)*)$/m)?.[1];
    const description = frontmatter.match(/^description: (.+)$/m)?.[1];
    if (name !== entry.name || name.length > 64)
      throw new Error("nombre inválido");
    if (
      !description?.trim() ||
      description.length > 1024 ||
      /[<>]/.test(description)
    )
      throw new Error("descripción inválida");
    if (/\[TODO:/.test(skill))
      throw new Error("contiene marcadores incompletos");
    for (const link of skill.matchAll(/\]\(([^)]+)\)/g)) {
      if (!existsSync(path.resolve(folder, link[1])))
        throw new Error(`referencia inexistente: ${link[1]}`);
    }
    const metadata = readFileSync(
      path.join(folder, "agents/openai.yaml"),
      "utf8",
    );
    const fields = Object.fromEntries(
      [...metadata.matchAll(/^  ([a-z_]+): (".*")$/gm)].map((match) => [
        match[1],
        JSON.parse(match[2]),
      ]),
    );
    if (
      !fields["display_name"] ||
      !fields["default_prompt"]?.includes(`$${name}`)
    )
      throw new Error("metadatos de interfaz incompletos");
    const length = fields["short_description"]?.length ?? 0;
    if (length < 25 || length > 64)
      throw new Error("short_description debe tener de 25 a 64 caracteres");
    console.log(
      `${entry.name}: nombre, descripción, referencias e interfaz válidos.`,
    );
  } catch (error) {
    errors.push(`${entry.name}: ${error.message}`);
  }
}
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
}
