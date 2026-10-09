import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createStaticServer } from "../deploy/botkeep/server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = join(root, "customer-web", "www");
const output = join(root, ".tmp", "botkeep-preview");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};
const roots = [
  "index.html",
  "sw.js",
  "health.json",
  "haircut-icon.svg",
  "manifest.webmanifest",
  "assets",
  "fonts",
];
const files = {};
const privatePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /"type"\s*:\s*"service_account"/,
];
function collect(path, relative) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error("Symlink not allowed in static artifact");
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (name.startsWith(".")) continue;
      collect(join(path, name), `${relative}/${name}`);
    }
    return;
  }
  const extension = extname(path).toLowerCase();
  if (!mime[extension]) throw new Error(`Unexpected public file type: ${extension}`);
  const bytes = readFileSync(path);
  if (
    [".html", ".js", ".css", ".json", ".svg", ".txt"].includes(extension) &&
    privatePatterns.some((pattern) => pattern.test(bytes.toString("utf8")))
  ) {
    throw new Error("Possible private credential in public build; packaging stopped");
  }
  files[`/${relative}`] = { type: mime[extension], data: bytes.toString("base64") };
}
if (!existsSync(join(input, "index.html"))) throw new Error("Build production Web first");
for (const name of roots) if (existsSync(join(input, name))) collect(join(input, name), name);
const policy = readFileSync(join(root, "config", "content-security-policy.txt"), "utf8").trim();
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}).trim();
const site = { sourceSha, reportOnlyCsp: policy, files };
const validationServer = createStaticServer(site);
validationServer.close();
mkdirSync(output, { recursive: true });
writeFileSync(join(output, "site.json"), JSON.stringify(site));
for (const name of ["server.mjs", "package.json"])
  copyFileSync(join(root, "deploy", "botkeep", name), join(output, name));
console.log(
  JSON.stringify({
    packageDirectory: output,
    publicFiles: Object.keys(files).length,
    archiveSourceFiles: 3,
    rawJsonBytes: Buffer.byteLength(JSON.stringify(site)),
    credentialsIncluded: false,
    legacyReviewQrIncluded: false,
    sourceSha,
  }),
);
