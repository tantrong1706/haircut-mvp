import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const policy = await import("../scripts/web-maintenance-policy.mjs");
const scope = JSON.parse(
  readFileSync(new URL("../scripts/web-maintenance-scope.json", import.meta.url), "utf8"),
);
const sha = "a".repeat(40);
const requiredChecks = [
  "Firebase Functions",
  "Customer Web",
  "Admin Web",
  "Manager Web Bundle",
  "Browser flows",
  "Repository Checks",
  "JavaScript and TypeScript",
];
function snapshot() {
  return {
    expectedSha: sha,
    headSha: sha,
    remoteMainSha: sha,
    branch: "main",
    status: "",
    origin: "https://github.com/tanTrong1706/haircut-mvp.git",
    project: "haircut-c7d12",
    hostingSite: "haircut-c7d12",
    functionsEnvFiles: [],
    evidence: {
      headSha: sha,
      mode: "full",
      readyForFirebaseDeploy: true,
      results: [{ Name: "Actual full-suite fixture", Status: "PASSED", Required: true }],
    },
    checks: requiredChecks.map((name) => ({
      name,
      head_sha: sha,
      status: "completed",
      conclusion: "success",
      app: { slug: "github-actions" },
    })),
    statuses: [],
  };
}

test("maintenance produces only the reviewed 56 callable selectors and exact Hosting site", () => {
  const result = policy.validateWebMaintenance(snapshot(), scope);
  assert.equal(result.functions.length, 56);
  assert.ok(result.functions.includes("functions:updateSalonCustomerName"));
  assert.ok(result.functions.includes("functions:withdrawWebCustomerPhotoConsent"));
  assert.equal(result.hosting, "hosting:haircut-c7d12");
  assert.equal(result.sha, sha);
});

for (const [label, change] of [
  [
    "invalid expected SHA",
    (s) => {
      s.expectedSha = "main";
    },
  ],
  [
    "different checkout",
    (s) => {
      s.headSha = "b".repeat(40);
    },
  ],
  [
    "remote main moved",
    (s) => {
      s.remoteMainSha = "b".repeat(40);
    },
  ],
  [
    "feature branch",
    (s) => {
      s.branch = "codex/test";
    },
  ],
  [
    "dirty worktree",
    (s) => {
      s.status = " M file.ts";
    },
  ],
  [
    "wrong origin",
    (s) => {
      s.origin = "https://github.com/other/repo.git";
    },
  ],
  [
    "wrong project",
    (s) => {
      s.project = "demo-haircut";
    },
  ],
  [
    "wrong Hosting site",
    (s) => {
      s.hostingSite = "haircut-c7d12-admin";
    },
  ],
  [
    "Functions dotenv overwrite",
    (s) => {
      s.functionsEnvFiles = [".env.haircut-c7d12"];
    },
  ],
  [
    "missing full evidence",
    (s) => {
      s.evidence = null;
    },
  ],
  [
    "stale evidence",
    (s) => {
      s.evidence.headSha = "b".repeat(40);
    },
  ],
  [
    "quick evidence",
    (s) => {
      s.evidence.mode = "quick";
    },
  ],
  [
    "failed readiness",
    (s) => {
      s.evidence.readyForFirebaseDeploy = false;
    },
  ],
  [
    "empty test proof",
    (s) => {
      s.evidence.results = [];
    },
  ],
  [
    "failed required test",
    (s) => {
      s.evidence.results[0].Status = "FAILED";
    },
  ],
  [
    "missing CI",
    (s) => {
      s.checks = [];
    },
  ],
  [
    "CI still running",
    (s) => {
      s.checks[0].status = "in_progress";
      s.checks[0].conclusion = null;
    },
  ],
  [
    "skipped CI",
    (s) => {
      s.checks[0].conclusion = "skipped";
    },
  ],
  [
    "failed CI",
    (s) => {
      s.checks[0].conclusion = "failure";
    },
  ],
  [
    "CI wrong SHA",
    (s) => {
      s.checks[0].head_sha = "b".repeat(40);
    },
  ],
  [
    "untrusted check producer",
    (s) => {
      s.checks[0].app.slug = "other";
    },
  ],
  [
    "additional failed check",
    (s) => {
      s.checks.push({ ...s.checks[0], name: "Additional security gate", conclusion: "failure" });
    },
  ],
  [
    "failed commit status",
    (s) => {
      s.statuses = [{ state: "failure" }];
    },
  ],
]) {
  test(`maintenance blocks ${label}`, () => {
    const state = snapshot();
    change(state);
    assert.throws(() => policy.validateWebMaintenance(state, scope));
  });
}

for (const name of [
  "registerCustomerFromZalo",
  "getSystemAdminAccess",
  "registerManagerDevice",
  "createMirror",
  "cleanupExpiredPhotoUploads",
  "*",
  "functions",
  "checkInWebCustomer,firestore",
]) {
  test(`maintenance rejects unapproved selector ${name}`, () => {
    const changed = structuredClone(scope);
    changed.functions[0] = name;
    assert.throws(() => policy.validateWebMaintenance(snapshot(), changed));
  });
}
test("maintenance rejects duplicate, omitted and wrong-region scope", () => {
  for (const change of [
    (s) => {
      s.functions[0] = s.functions[1];
    },
    (s) => {
      s.functions.pop();
    },
    (s) => {
      s.region = "us-central1";
    },
    (s) => {
      s.project = "other";
    },
    (s) => {
      s.hostingSite = "other";
    },
  ]) {
    const changed = structuredClone(scope);
    change(changed);
    assert.throws(() => policy.validateWebMaintenance(snapshot(), changed));
  }
});
test("source exports match the explicitly reviewed Web-only callable inventory", () => {
  const source = readFileSync(
    new URL("../firebase/functions/src/index.ts", import.meta.url),
    "utf8",
  );
  for (const name of scope.functions)
    assert.match(source, new RegExp(`export const ${name} = onCall\\(`));
});

test("Web maintenance excludes every entry point requiring system administrator access", () => {
  assert.equal(scope.functions.includes("getSystemFeatureFlags"), false);
  const source = readFileSync(new URL("../firebase/functions/src/index.ts", import.meta.url), "utf8");
  for (const name of scope.functions) {
    const start = source.indexOf(`export const ${name} =`);
    const next = source.indexOf("export const ", start + 13);
    const block = source.slice(start, next < 0 ? source.length : next);
    assert.doesNotMatch(block, /assertSystemAdmin|getSystemAdminAccess|requireSystemAdminAccess/u, name);
  }
});
test("full release remains strict; maintenance requires strict checks and forbids native release", () => {
  const source = readFileSync(
    new URL("../scripts/check-production-readiness.ps1", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[switch\]\$WebMaintenance/);
  assert.match(
    source,
    /\$WebMaintenance -and \(.*-not \$StrictRelease.*\$ReleaseIncludesIos.*\$RunBuild/,
  );
  assert.match(source, /\$StrictRelease -and -not \$WebMaintenance/g);
  assert.match(source, /check-web-maintenance\.mjs/);
  assert.match(source, /VITE_PUBLIC_SUPPORT_EMAIL/);
});
test("release runner builds first, rechecks gates, supports dry run and never selects all Functions", () => {
  const source = readFileSync(
    new URL("../scripts/release-web-maintenance.ps1", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[switch\]\$DryRun/);
  assert.match(source, /-StrictRelease -WebMaintenance -CheckLiveUrls/);
  assert.ok(source.indexOf("if ($DryRun)") < source.indexOf("firebase deploy"));
  assert.match(source, /functions:\$_/);
  assert.match(source, /--only \$selectors/);
  assert.match(source, /--only hosting:haircut-c7d12/);
  assert.match(source, /--message.*\$ExpectedSha/);
  assert.doesNotMatch(source, /--force|--only functions(?:\s|$)|--only firestore|--only storage/);
  assert.ok(source.lastIndexOf("check-web-maintenance.mjs") > source.indexOf("build-hosting.ps1"));
});

test("actual PowerShell preflight preserves default strict failures and accepts only the scoped Web exception", () => {
  const fixture = mkdtempSync(join(tmpdir(), "haircut-maintenance-test-"));
  const write = (file, value) => {
    const path = join(fixture, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  };
  try {
    write(
      "scripts/check-production-readiness.ps1",
      readFileSync(new URL("../scripts/check-production-readiness.ps1", import.meta.url)),
    );
    write("firebase/.firebaserc", JSON.stringify({ projects: { default: "haircut-c7d12" } }));
    write(
      "customer-web/.env.production.local",
      [
        "VITE_FIREBASE_API_KEY=fixture-public-key",
        "VITE_FIREBASE_AUTH_DOMAIN=haircut-c7d12.firebaseapp.com",
        "VITE_FIREBASE_PROJECT_ID=haircut-c7d12",
        "VITE_FIREBASE_STORAGE_BUCKET=haircut-c7d12.firebasestorage.app",
        "VITE_FIREBASE_MESSAGING_SENDER_ID=123",
        "VITE_FIREBASE_APP_ID=fixture-public-app",
        "VITE_APP_ENV=production",
        "VITE_FUNCTION_WRITE_MODE=required",
        "VITE_PUBLIC_SUPPORT_EMAIL=support@example.test",
      ].join("\n"),
    );
    write("firebase/firestore.rules", "allow create, update, delete: if false;");
    write("customer-web/www/index.html", "<!doctype html><title>isolated fixture</title>");
    write("apps/manager-mobile/src/services/firebase.ts", "VITE_FIREBASE_APP_CHECK_SITE_KEY");
    write("apps/manager-mobile/src/nativeRuntime.ts", "FirebaseAppCheck.initialize");
    write("apps/admin-web/src/services/firebase.ts", "VITE_FIREBASE_APP_CHECK_SITE_KEY");
    write("firebase/functions/package.json", JSON.stringify({ engines: { node: "22" } }));
    write("firebase/functions/package-lock.json", "{}");
    // Synthetic proof belongs only to this disposable fixture, never to the repository.
    write(".tmp/release-readiness.json", JSON.stringify(snapshot().evidence));
    const run = (flags) =>
      spawnSync(
        process.platform === "win32" ? "powershell.exe" : "pwsh",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `
      $ErrorActionPreference = 'Stop'
      function git { if ($args -contains 'status') { return }; '${sha}' }
      function node { if ($args -contains '--version') { 'v22.23.2' } else { 'ISOLATED_POLICY_STUB=PASS' }; $global:LASTEXITCODE=0 }
      function npm { '10.9.4' }
      function firebase { '15.22.3'; $global:LASTEXITCODE=0 }
      function gh { 'gh fixture' }
      function Invoke-WebRequest { @{ StatusCode=200 } }
      $env:ENFORCE_APP_CHECK='false'
      $env:HAIRCUT_MANAGER_APP_CHECK_VERIFIED_SHA=''
      $env:HAIRCUT_IOS_BUILD_VERIFIED_SHA=''
      & '${join(fixture, "scripts/check-production-readiness.ps1").replaceAll("'", "''")}' ${flags}
    `,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30000 },
      );
    const full = run("-StrictRelease -CheckLiveUrls");
    assert.equal(full.status, 1, full.stdout + full.stderr);
    assert.match(full.stdout, /ENFORCE_APP_CHECK=true/);
    assert.match(full.stdout, /HAIRCUT_MANAGER_APP_CHECK_VERIFIED_SHA/);
    assert.match(full.stdout, /VITE_SENTRY_DSN/);
    const web = run("-StrictRelease -WebMaintenance -CheckLiveUrls");
    assert.equal(web.status, 0, web.stdout + web.stderr);
    assert.doesNotMatch(web.stdout, /\[FAIL\]/);
    for (const flags of [
      "-WebMaintenance",
      "-StrictRelease -WebMaintenance -ReleaseIncludesIos",
      "-StrictRelease -WebMaintenance -RunBuild",
    ]) {
      const rejected = run(flags);
      assert.notEqual(rejected.status, 0, rejected.stdout + rejected.stderr);
    }
  } finally {
    assert.equal(dirname(resolve(fixture)), resolve(tmpdir()));
    assert.ok(fixture.includes("haircut-maintenance-test-"));
    rmSync(fixture, { recursive: true, force: true });
  }
});
