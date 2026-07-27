import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const git = spawnSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
if (git.status !== 0) {
  throw new Error("Không đọc được danh sách file Git.");
}

const forbiddenExtensions = new Set([
  ".jks",
  ".keystore",
  ".mobileprovision",
  ".p12",
  ".p8",
]);
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
      /\b(?:ZALO_(?:APP_SECRET|OPEN_API_KEY|OA_SECRET_KEY)|QR_SIGNING_SECRET|SENTRY_AUTH_TOKEN)\s*=\s*(?!your-|example|changeme|\.{3}|<|\[|$)[^\s#]+/u,
  },
];

const findings = [];
const files = git.stdout.split("\0").filter(Boolean);
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
  console.log(`Secret scan đạt trên ${files.length} file Git; không in nội dung credential.`);
}
