import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = resolve(root, "config", "content-security-policy.txt");
const firebasePath = resolve(root, "firebase", "firebase.json");
const mode = process.argv[2] || "--check";

if (!["--check", "--write"].includes(mode)) {
  throw new Error("Dùng --check hoặc --write.");
}

const expectedPolicy = readFileSync(policyPath, "utf8").trim();
const firebaseConfig = JSON.parse(readFileSync(firebasePath, "utf8"));
const headers = firebaseConfig.hosting?.headers ?? [];
const securityHeaders = headers
  .flatMap((entry) => entry.headers ?? [])
  .filter((header) =>
    ["Content-Security-Policy", "Content-Security-Policy-Report-Only"].includes(header.key),
  );

if (securityHeaders.length === 0) {
  throw new Error("firebase.json chưa khai báo CSP.");
}

if (mode === "--check") {
  const mismatched = securityHeaders.filter((header) => header.value !== expectedPolicy);
  if (mismatched.length > 0) {
    throw new Error("CSP trong firebase.json không khớp config/content-security-policy.txt.");
  }
  console.log(`CSP đồng bộ (${securityHeaders.map((header) => header.key).join(", ")}).`);
  process.exit(0);
}

for (const header of securityHeaders) {
  header.value = expectedPolicy;
}
writeFileSync(firebasePath, `${JSON.stringify(firebaseConfig, null, 2)}\n`, "utf8");
console.log("Đã đồng bộ CSP vào firebase/firebase.json.");
