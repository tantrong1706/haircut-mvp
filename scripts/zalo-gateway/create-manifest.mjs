import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const root = new URL("../../", import.meta.url);
const command = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sourceSha = command(["rev-parse", "HEAD"]);
const pr30Sha = process.env.PR30_SHA || "9c59e92a44cfb78338f02db21c3f4ba5df4746ca";
const server = readFileSync(new URL("services/zalo-verification-gateway/dist/src/server.js", root));
const manifest = {
  gatewaySourceSha: sourceSha,
  pr30Sha,
  nodeVersion: process.version,
  buildCommand: "npm --prefix services/zalo-verification-gateway run build",
  serverSha256: createHash("sha256").update(server).digest("hex"),
  expectedUbuntu: "22.04 LTS",
  expectedServicePort: 3000,
  requiredEnvironmentNames: [
    "PORT", "NODE_ENV", "GATEWAY_VERSION", "ZALO_UPSTREAM_URL", "GATEWAY_HMAC_KEYS",
    "REPLAY_DB_PATH", "REQUEST_MAX_BYTES",
  ],
  containsSecrets: false,
};
const destination = process.argv[2] || ".tmp/zalo-gateway-pre-vps-manifest.json";
const resolvedDestination = resolve(destination);
mkdirSync(dirname(resolvedDestination), { recursive: true });
writeFileSync(resolvedDestination, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8" });
console.log(destination);
