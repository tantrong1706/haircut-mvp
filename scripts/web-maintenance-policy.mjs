import approvedScope from "./web-maintenance-scope.json" with { type: "json" };

const requiredChecks = [
  "Firebase Functions",
  "Customer Web",
  "Admin Web",
  "Manager Web Bundle",
  "Browser flows",
  "Repository Checks",
  "JavaScript and TypeScript",
];
function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

// This explicitly approved profile does not weaken the default full release.
export function validateWebMaintenance(state, scope) {
  const sha = state.expectedSha;
  requireCondition(/^[a-f0-9]{40}$/u.test(sha ?? ""), "Expected SHA must be a full commit ID");
  requireCondition(
    state.headSha === sha && state.remoteMainSha === sha,
    "Checkout and origin/main must equal expected SHA",
  );
  requireCondition(state.branch === "main" && state.status === "", "Release requires clean main");
  requireCondition(
    /^https:\/\/github\.com\/tanTrong1706\/haircut-mvp(?:\.git)?$/u.test(state.origin),
    "Unexpected origin",
  );
  requireCondition(
    state.project === "haircut-c7d12" && state.hostingSite === "haircut-c7d12",
    "Incorrect Firebase project/site",
  );
  requireCondition(
    Array.isArray(state.functionsEnvFiles) && state.functionsEnvFiles.length === 0,
    "Functions dotenv could overwrite existing endpoint configuration",
  );
  const evidence = state.evidence;
  requireCondition(
    evidence?.headSha === sha &&
      evidence.mode === "full" &&
      evidence.readyForFirebaseDeploy === true,
    "Full-suite evidence must pass on expected SHA",
  );
  requireCondition(
    Array.isArray(evidence.results) &&
      evidence.results.some((r) => r.Required === true) &&
      evidence.results.every((r) => !r.Required || r.Status === "PASSED"),
    "Required local checks have not all passed",
  );
  requireCondition(Array.isArray(state.checks) && state.checks.length > 0, "Missing CI checks");
  requireCondition(
    state.checks.every(
      (c) => c.head_sha === sha && c.status === "completed" && c.conclusion === "success",
    ),
    "CI is incomplete or unsuccessful",
  );
  for (const name of requiredChecks) {
    requireCondition(
      state.checks.some((c) => c.name === name && c.app?.slug === "github-actions"),
      `Missing trusted CI: ${name}`,
    );
  }
  requireCondition(
    Array.isArray(state.statuses) && state.statuses.every((s) => s.state === "success"),
    "Commit status did not pass",
  );
  requireCondition(
    scope?.project === approvedScope.project &&
      scope.hostingSite === approvedScope.hostingSite &&
      scope.region === approvedScope.region,
    "Unapproved deployment target",
  );
  requireCondition(
    Array.isArray(scope.functions) &&
      scope.functions.length === 57 &&
      new Set(scope.functions).size === 57 &&
      scope.functions.every(
        (name) => approvedScope.functions.includes(name) && /^[A-Za-z][A-Za-z0-9]+$/u.test(name),
      ),
    "Unapproved callable scope",
  );
  return {
    sha,
    functions: scope.functions.map((name) => `functions:${name}`),
    hosting: `hosting:${scope.hostingSite}`,
  };
}
