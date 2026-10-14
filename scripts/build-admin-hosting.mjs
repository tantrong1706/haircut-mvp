import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const publicNames = [
  "VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET", "VITE_FIREBASE_MESSAGING_SENDER_ID", "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APP_CHECK_SITE_KEY",
];

export function selectAdminPublicEnv(primary, fallback, version) {
  if (primary.VITE_APP_CHECK_DEBUG_TOKEN) throw new Error("Không dùng App Check debug token trong production");
  const selected = Object.fromEntries(publicNames.map(name => [name, String(primary[name] || fallback[name] || "").trim()]));
  const missing = publicNames.filter(name => !selected[name]);
  if (missing.length) throw new Error(`Thiếu cấu hình public Admin: ${missing.join(", ")}`);
  if (selected.VITE_FIREBASE_PROJECT_ID !== "haircut-c7d12") throw new Error("Sai Firebase project cho Admin production");
  if (!/^[a-f0-9]{40}$/.test(version)) throw new Error("Thiếu commit SHA hợp lệ");
  return { ...selected, VITE_APP_VERSION: version };
}

export function resolveViteEntry(metadata) {
  const entry = metadata.exports?.["."]?.import?.default || metadata.main;
  if (typeof entry !== "string" || !entry.startsWith("./")) throw new Error("Không xác định được ESM entry của Vite");
  return entry;
}

async function buildAdmin() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const adminDir = join(root, "apps/admin-web");
  const require = createRequire(join(adminDir, "package.json"));
  const vitePackage = require.resolve("vite/package.json");
  const metadata = JSON.parse(readFileSync(vitePackage, "utf8"));
  const { loadEnv } = await import(pathToFileURL(resolve(dirname(vitePackage), resolveViteEntry(metadata))).href);
  const version = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
  if (dirty) throw new Error("Commit các thay đổi đã kiểm thử trước khi đóng gói production Admin");
  const config = JSON.parse(readFileSync(join(root, "firebase/admin-hosting.json"), "utf8"));
  assert.equal(config.hosting.site, "haircut-c7d12-admin");
  assert.equal(config.hosting.public, "../apps/admin-web/dist");
  assert.deepEqual(Object.keys(config), ["hosting"]);
  // Reuse only the existing project's public Web configuration. Never copy dotenv files or secrets.
  const publicEnv = selectAdminPublicEnv(loadEnv("production", adminDir, "VITE_"), loadEnv("production", join(root, "customer-web"), "VITE_"), version);
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("VITE_")));
  const result = spawnSync("npm run build", { cwd: adminDir, shell: true, windowsHide: true, stdio: "inherit", env: { ...inherited, ...publicEnv } });
  if (result.status !== 0) throw new Error("Admin production build failed; no deploy was attempted");
  const dist = join(adminDir, "dist");
  const files = readdirSync(dist, { recursive: true });
  assert.ok(files.includes("index.html"));
  assert.ok(!files.some(file => /(^|[\\/])\.env|\.map$|fixture|www-test/i.test(file)));
  const source = files.filter(file => file.endsWith(".js")).map(file => readFileSync(join(dist, file), "utf8")).join("\n");
  assert.ok(source.includes(version), "Admin bundle must carry its source revision");
  assert.doesNotMatch(source, /ADMIN_E2E_FIXTURE_ONLY|fixture-project|fixture-admin|PRIVATE_TOKEN_FIXTURE/);
  const htmlSha256 = createHash("sha256").update(readFileSync(join(dist, "index.html"))).digest("hex");
  console.log(JSON.stringify({ project: publicEnv.VITE_FIREBASE_PROJECT_ID, site: config.hosting.site, source: version, htmlSha256, buildOnly: true }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildAdmin();
