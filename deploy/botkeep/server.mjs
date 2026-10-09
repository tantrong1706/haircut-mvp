import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const routes = new Set([
  "/",
  "/history",
  "/wheel",
  "/rewards",
  "/account",
  "/checkin",
  "/scan",
  "/owner",
  "/staff",
  "/admin",
  "/privacy",
  "/terms",
  "/delete-account",
  "/app-check",
]);
const rootAssets = new Set([
  "/index.html",
  "/sw.js",
  "/health.json",
  "/haircut-icon.svg",
  "/manifest.webmanifest",
]);

export function readPort(env) {
  const port = Number(env.SERVER_PORT || env.PORT || "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid server port");
  return port;
}

export function createStaticServer(site) {
  const files = new Map();
  let total = 0;
  for (const [path, entry] of Object.entries(site.files)) {
    if (
      (!rootAssets.has(path) && !/^\/(assets|fonts)\//.test(path)) ||
      path.split("/").some((part) => part.startsWith(".")) ||
      path.includes("\\") ||
      typeof entry.data !== "string" ||
      entry.data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data) ||
      typeof entry.type !== "string" ||
      !/^[a-z]+\/[a-z0-9.+-]+(?:; charset=utf-8)?$/i.test(entry.type)
    ) {
      throw new Error("Invalid static artifact");
    }
    const body = Buffer.from(entry.data, "base64");
    total += body.length;
    if (total > 32 * 1024 * 1024) throw new Error("Static artifact too large");
    files.set(path, { body, type: entry.type });
  }
  if (!files.get("/index.html")?.body.length) throw new Error("Missing HTML entry");
  const csp = site.reportOnlyCsp || "";
  if (typeof csp !== "string" || /[\r\n]/.test(csp)) throw new Error("Invalid security policy");

  const server = createServer((request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    response.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    response.setHeader("Cache-Control", "no-store");
    if (csp) response.setHeader("Content-Security-Policy-Report-Only", csp);
    function send(status, body, type = "text/plain; charset=utf-8") {
      response.statusCode = status;
      response.setHeader("Content-Type", type);
      response.setHeader("Content-Length", Buffer.byteLength(body));
      response.end(request.method === "HEAD" ? undefined : body);
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      send(405, "Method not allowed");
      return;
    }
    if (request.url.length > 2048) {
      send(414, "URL too long");
      return;
    }
    let path;
    try {
      path = decodeURIComponent(new URL(request.url, "http://preview.invalid").pathname);
    } catch {
      send(400, "Invalid URL");
      return;
    }
    if (path === "/healthz") {
      send(200, '{"status":"ok"}', "application/json");
      return;
    }
    const file = files.get(path) || (routes.has(path) ? files.get("/index.html") : null);
    if (!file) {
      send(404, "Not found");
      return;
    }
    if (/^\/(assets|fonts)\//.test(path))
      response.setHeader("Cache-Control", "public, max-age=3600");
    send(200, file.body, file.type);
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const site = JSON.parse(readFileSync(new URL("./site.json", import.meta.url), "utf8"));
  createStaticServer(site).listen(readPort(process.env), "0.0.0.0");
  console.log("CH Hair Web preview started");
}
