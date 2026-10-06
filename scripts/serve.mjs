import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const flagValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const directory = args.find((arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--port"));
const root = join(projectRoot, directory ?? "site");
const port = Number(flagValue("--port") ?? process.env.PORT ?? 4173);
const disableServiceWorker = args.includes("--no-sw");
const SELF_REMOVING_WORKER = [
  'self.addEventListener("install", () => self.skipWaiting());',
  'self.addEventListener("activate", (event) => {',
  "  event.waitUntil(",
  "    caches.keys()",
  "      .then((names) => Promise.all(names.map((name) => caches.delete(name))))",
  "      .then(() => self.registration.unregister()),",
  "  );",
  "});",
].join("\n");

const CONTENT_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
});

function parseHeadersFile(source) {
  const rules = [];
  let current = null;

  for (const line of source.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    if (!line.startsWith(" ")) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }

    const separator = line.indexOf(":");
    current?.headers.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()]);
  }

  return rules;
}

function matches(pattern, pathname) {
  return pattern.endsWith("*")
    ? pathname.startsWith(pattern.slice(0, -1))
    : pathname === pattern;
}

const headerRules = parseHeadersFile(await readFile(join(root, "_headers"), "utf8"));

async function resolveFile(pathname) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const candidate = join(root, safePath);
  if (!candidate.startsWith(root.endsWith(sep) ? root : `${root}${sep}`) && candidate !== root) {
    return null;
  }

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      if (!pathname.endsWith("/")) {
        return { redirect: `${pathname}/` };
      }
      return { file: join(candidate, "index.html") };
    }
    return { file: candidate };
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");

  for (const rule of headerRules) {
    if (matches(rule.pattern, pathname)) {
      for (const [name, value] of rule.headers) {
        response.setHeader(name, value);
      }
    }
  }

  if (disableServiceWorker && pathname === "/sw.js") {
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[".js"],
      "Cache-Control": "no-store",
    });
    response.end(SELF_REMOVING_WORKER);
    return;
  }

  const resolved = await resolveFile(pathname);
  if (resolved?.redirect) {
    response.writeHead(308, { Location: resolved.redirect }).end();
    return;
  }

  const file = resolved?.file ?? join(root, "404.html");
  try {
    await stat(file);
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(resolved ? 200 : 404, {
    "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`一刻游艺本地预览：http://localhost:${port}/（目录 ${root}）`);
});
