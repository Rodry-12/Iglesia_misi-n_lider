import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.join(root, "frontend");

export function resolveApiBaseUrl(environment, dotenv = {}) {
  const value =
    environment.MLP_API_BASE_URL ?? dotenv.MLP_API_BASE_URL ?? "/api/v1";
  const base = value.trim().replace(/\/+$/, "");
  if (base === "/api/v1") return base;
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error(
      "MLP_API_BASE_URL debe ser /api/v1 o una URL HTTPS terminada en /api/v1.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/v1"
  ) {
    throw new Error(
      "MLP_API_BASE_URL debe ser /api/v1 o una URL HTTPS terminada en /api/v1.",
    );
  }
  return url.origin + url.pathname;
}

function build() {
  const envFile = path.join(frontend, ".env");
  const dotenv = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, "utf8"))
    : {};
  const base = resolveApiBaseUrl(process.env, dotenv);
  const result = spawnSync(
    process.execPath,
    [
      path.join(frontend, "node_modules/@angular/cli/bin/ng.js"),
      "build",
      ...process.argv.slice(2),
      "--define",
      `MLP_API_BASE_URL=${JSON.stringify(base)}`,
    ],
    { cwd: frontend, stdio: "inherit", shell: false },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  build();
}
