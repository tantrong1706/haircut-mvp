import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateWebMaintenance } from "./web-maintenance-policy.mjs";

const root = resolve(import.meta.dirname, "..");
const readJson = (path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8").replace(/^\uFEFF/u, ""));
function command(executable, args) {
  return execFileSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
try {
  if (
    process.argv.length !== 4 ||
    process.argv[2] !== "--sha" ||
    !/^[a-f0-9]{40}$/u.test(process.argv[3])
  )
    throw new Error("Usage: node scripts/check-web-maintenance.mjs --sha <40-character SHA>");
  const sha = process.argv[3];
  const scope = readJson("scripts/web-maintenance-scope.json");
  const checkRuns = JSON.parse(
    command("gh", ["api", `repos/tanTrong1706/haircut-mvp/commits/${sha}/check-runs?per_page=100`]),
  );
  if (checkRuns.total_count !== checkRuns.check_runs?.length)
    throw new Error("Incomplete CI response");
  const status = JSON.parse(
    command("gh", ["api", `repos/tanTrong1706/haircut-mvp/commits/${sha}/status?per_page=100`]),
  );
  if (status.total_count !== status.statuses?.length)
    throw new Error("Incomplete commit status response");
  const result = validateWebMaintenance(
    {
      expectedSha: sha,
      headSha: command("git", ["rev-parse", "HEAD"]),
      remoteMainSha: command("git", ["ls-remote", "origin", "refs/heads/main"]).split(/\s/u)[0],
      branch: command("git", ["branch", "--show-current"]),
      status: command("git", ["status", "--porcelain"]),
      origin: command("git", ["remote", "get-url", "origin"]),
      project: readJson("firebase/.firebaserc").projects?.default,
      hostingSite: readJson("firebase/firebase.json").hosting?.site,
      functionsEnvFiles: readdirSync(resolve(root, "firebase/functions")).filter(
        (f) => /^\.env(?:\.|$)/u.test(f) && !f.endsWith(".example"),
      ),
      evidence: readJson(".tmp/release-readiness.json"),
      checks: checkRuns.check_runs,
      statuses: status.statuses,
    },
    scope,
  );
  console.log(
    `WEB_MAINTENANCE_GATE=PASS SHA=${result.sha} CALLABLES=${result.functions.length} SITE=${result.hosting}`,
  );
} catch (error) {
  // Do not echo provider stderr, which can contain configuration details.
  console.error(
    `WEB_MAINTENANCE_GATE=FAIL ${error instanceof Error && !error.message.startsWith("Command failed:") ? error.message : "Could not verify release evidence or remote state"}`,
  );
  process.exitCode = 1;
}
