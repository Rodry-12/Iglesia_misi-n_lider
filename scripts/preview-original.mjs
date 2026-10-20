import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function referenceRoot() {
  const archive = path.join(root, "docs/reference/legacy-site.zip");
  const manifest = JSON.parse(
    readFileSync(
      path.join(root, "docs/reference/legacy-manifest.json"),
      "utf8",
    ),
  );
  const hash = createHash("sha256").update(readFileSync(archive)).digest("hex");
  if (hash !== manifest.sha256)
    throw new Error("El ZIP de referencia no coincide con su SHA-256.");
  const target = path.join(root, "frontend/artifacts/legacy-reference", hash);
  if (!existsSync(path.join(target, "index.html"))) {
    if (process.platform === "win32") {
      const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
      execFileSync("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(target)} -Force`,
      ]);
    } else {
      execFileSync("unzip", ["-q", archive, "-d", target]);
    }
  }
  return target;
}
export function createReferenceServer() {
  const reference = referenceRoot();
  return createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://127.0.0.1").pathname,
      );
      let file = path.resolve(reference, "." + pathname);
      const relative = path.relative(reference, file);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        response.writeHead(403).end();
        return;
      }
      if (existsSync(file) && statSync(file).isDirectory())
        file = path.join(file, "index.html");
      if (!existsSync(file)) {
        response.writeHead(404).end();
        return;
      }
      let content = readFileSync(file);
      const extension = path.extname(file);
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css",
        ".js": "text/javascript",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
      };
      if (extension === ".html") {
        let html = content
          .toString("utf8")
          .replaceAll("https://iglesiamisionliderparis.org/", "/");
        html = html
          .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/g, "")
          .replace(
            /<script[^>]*src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/g,
            "",
          )
          .replace(/<script type="text\/javascript">[\s\S]*?<\/script>/g, "")
          .replace(
            /<script[^>]*src="\/src\/js\/form\.js"[^>]*><\/script>/g,
            "",
          );
        html = html.replace(
          "</head>",
          `<style>@font-face{font-family:'DM Sans';src:url('/fonts/DM-Sans.ttf');font-weight:100 1000}@font-face{font-family:'DM Sans';src:url('/fonts/DM-Sans-Italic.ttf');font-style:italic;font-weight:100 1000}@font-face{font-family:'Grape Nuts';src:url('/fonts/Grape-Nuts.ttf')}</style></head>`,
        );
        content = Buffer.from(html);
      }
      response
        .writeHead(200, {
          "Content-Type": types[extension] ?? "application/octet-stream",
        })
        .end(content);
    } catch {
      response.writeHead(500).end();
    }
  });
}
