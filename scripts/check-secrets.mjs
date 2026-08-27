import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const includeWorkingTree = process.argv.includes("--include-working-tree");

function gitFiles(args, errorMessage) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(errorMessage);
  }
  return result.stdout.split("\0").filter(Boolean);
}

const trackedFiles = gitFiles(["ls-files", "-z"], "Không đọc được danh sách file Git.");
const files = includeWorkingTree
  ? gitFiles(
      ["ls-files", "-co", "--exclude-standard", "-z"],
      "Không đọc được danh sách file working tree.",
    )
  : trackedFiles;

const forbiddenExtensions = new Set([".jks", ".keystore", ".mobileprovision", ".p12", ".p8"]);
const patterns = [
  {
    name: "private key",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  },
  {
    name: "GitHub token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  },
  {
    name: "OpenAI secret key",
    regex: /\bsk-(?:live|proj)-[A-Za-z0-9_-]{16,}\b/u,
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  },
  {
    name: "Firebase service account",
    regex: /"type"\s*:\s*"service_account"[\s\S]{0,2000}"private_key"\s*:/u,
  },
  {
    name: "server secret assignment",
    regex:
      /\b(?:ZALO_(?:APP_SECRET|OPEN_API_KEY|OA_SECRET_KEY|GATEWAY_HMAC_SECRET)|QR_SIGNING_SECRET|SENTRY_AUTH_TOKEN)\s*=\s*(?!your-|example|changeme|managed-by-|\.{3}|<|\[|$)[^\s#]+/u,
  },
  {
    name: "gateway HMAC key map",
    regex: /\bGATEWAY_HMAC_KEYS\s*=\s*\{[^\r\n]{0,512}"[a-f0-9]{64,}"/u,
  },
];

const findings = [];
const forbiddenTrackedPaths = [
  /(^|\/)\.env(?:\.|$)/u,
  /(^|\/)google-services\.json$/u,
  /(^|\/)GoogleService-Info\.plist$/u,
];
for (const file of trackedFiles) {
  if (
    forbiddenTrackedPaths.some((pattern) => pattern.test(file)) &&
    !file.endsWith(".example") &&
    file !== "zalo-mini-app/.env.test"
  ) {
    findings.push({ file, line: 1, type: "tracked local credential/config file" });
  }
}

const requiredIgnoredPaths = [
  "zalo-mini-app/.env.production.local",
  "firebase/functions/.env",
  "apps/manager-mobile/android/app/google-services.json",
  "apps/manager-mobile/ios/App/App/GoogleService-Info.plist",
  ".tmp/release-readiness.json",
];
for (const file of requiredIgnoredPaths) {
  const ignored = spawnSync("git", ["check-ignore", "--quiet", "--no-index", file], {
    cwd: root,
    windowsHide: true,
  });
  if (ignored.status !== 0) {
    findings.push({ file, line: 1, type: "missing ignore rule for sensitive artifact" });
  }
}

for (const file of files) {
  const extension = extname(file).toLowerCase();
  if (forbiddenExtensions.has(extension)) {
    findings.push({ file, line: 1, type: `credential file ${extension}` });
    continue;
  }

  let bytes;
  try {
    bytes = readFileSync(resolve(root, file));
  } catch {
    continue;
  }
  if (bytes.length > 2 * 1024 * 1024 || bytes.includes(0)) {
    continue;
  }

  const text = bytes.toString("utf8");
  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const line = text.slice(0, match.index).split(/\r?\n/u).length;
    findings.push({ file, line, type: pattern.name });
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`SECRET ${finding.type}: ${finding.file}:${finding.line}`);
  }
  process.exitCode = 1;
} else {
  const scope = includeWorkingTree ? "tracked + untracked working tree" : "tracked Git files";
  console.log(
    `Secret scan đạt trên ${files.length} file (${scope}); không in nội dung credential.`,
  );
}
