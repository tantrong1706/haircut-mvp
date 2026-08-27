import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_REVIEW_SCREENSHOTS = [
  "01-open",
  "02-salon-qr",
  "03-branch-selector",
  "04-branch",
  "05-profile-explanation",
  "06-zalo-permission",
  "07-checkin",
  "08-waiting",
  "09-serving",
  "10-points",
  "11-history",
  "12-wheel-before",
  "13-wheel-result",
  "14-reward",
  "15-privacy",
  "16-terms",
];

export function evaluateZaloSubmissionReadiness(input) {
  const blockers = [];
  const requireEvidence = (condition, label) => {
    if (!condition) blockers.push(label);
  };

  if (
    /FILL_AFTER_VN_GATEWAY_AND_FINAL_TESTING_DEPLOY/u.test(input.submissionText) ||
    /\[(?:TÊN_[^\]]+|DEEPLINK_[^\]]+|QR_[^\]]+)\]/u.test(input.submissionText)
  ) {
    blockers.push("Hồ sơ reviewer vẫn còn placeholder");
  }

  const notCaptured = [];
  const missingFiles = [];
  for (const name of EXPECTED_REVIEW_SCREENSHOTS) {
    const row = input.checklistText.match(
      new RegExp("\\|\\s*\\x60" + name + "\\x60\\s*\\|\\s*\\x60([^\\x60]+)\\x60", "u"),
    );
    if (row?.[1] !== "CAPTURED") {
      notCaptured.push(name);
    }
    if (!input.screenshotExists(name)) {
      missingFiles.push(name + ".png");
    }
  }
  if (notCaptured.length > 0) blockers.push("Ảnh chưa CAPTURED: " + notCaptured.join(", "));
  if (missingFiles.length > 0) blockers.push("Thiếu file ảnh: " + missingFiles.join(", "));

  const evidence = input.evidence;
  requireEvidence(evidence?.schemaVersion === 1, "Thiếu evidence schema version 1");
  requireEvidence(
    typeof input.candidateSha === "string" && /^[a-f0-9]{40}$/u.test(input.candidateSha),
    "Thiếu candidate SHA hợp lệ",
  );
  requireEvidence(
    evidence?.candidateSha === input.candidateSha,
    "Evidence không khớp candidate SHA",
  );
  requireEvidence(
    typeof evidence?.artifactSha256 === "string" && /^[a-f0-9]{64}$/u.test(evidence.artifactSha256),
    "Thiếu SHA-256 của artifact ZMP cuối",
  );

  requireEvidence(evidence?.gateway?.publicHealthReady === true, "Public gateway health chưa PASS");
  requireEvidence(evidence?.gateway?.publicAuthReady === true, "Public gateway auth chưa PASS");
  requireEvidence(
    evidence?.gateway?.vnEgressPreserved === true,
    "Vietnam egress chưa được bảo toàn",
  );
  requireEvidence(evidence?.gateway?.realZaloReady === true, "Chưa có real Zalo PASS");
  requireEvidence(
    evidence?.gateway?.directExposure === false,
    "Thiếu evidence DIRECT_GATEWAY_EXPOSURE=false",
  );
  requireEvidence(evidence?.gateway?.httpsEnforced === true, "HTTPS chưa được enforce");
  requireEvidence(evidence?.gateway?.runtimeHardened === true, "Windows runtime chưa hardened");

  requireEvidence(
    evidence?.firebase?.configPrepared === true,
    "Firebase gateway config chưa chuẩn bị",
  );
  requireEvidence(
    evidence?.firebase?.productionGatewayEnabled === true,
    "Firebase gateway production chưa được bật",
  );
  requireEvidence(
    evidence?.firebase?.deployedSha === input.candidateSha,
    "Firebase deployed SHA không khớp candidate",
  );

  requireEvidence(
    typeof evidence?.zalo?.testingVersionId === "string" &&
      evidence.zalo.testingVersionId.trim().length > 0,
    "Thiếu Zalo Testing Version ID cuối",
  );
  requireEvidence(evidence?.zalo?.androidVerified === true, "Android chưa được xác minh");
  requireEvidence(evidence?.zalo?.iosVerified === true, "iOS chưa được xác minh");
  requireEvidence(
    evidence?.zalo?.reviewSubmitted === false,
    "Thiếu evidence reviewSubmitted=false",
  );
  requireEvidence(evidence?.zalo?.published === false, "Thiếu evidence published=false");

  return blockers;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function currentHead(root) {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const screenshotRoot = resolve(repoRoot, "docs", "zalo-review-screenshots.local");
  const blockers = evaluateZaloSubmissionReadiness({
    checklistText: readFileSync(resolve(repoRoot, "docs", "ZALO_REVIEW_CHECKLIST.md"), "utf8"),
    submissionText: readFileSync(resolve(repoRoot, "docs", "ZALO_VERSION_8_SUBMISSION.md"), "utf8"),
    evidence: readJson(resolve(repoRoot, ".tmp", "zalo-submission-evidence.json")),
    candidateSha: currentHead(repoRoot),
    screenshotExists: (name) => existsSync(resolve(screenshotRoot, name + ".png")),
  });

  if (blockers.length > 0) {
    for (const blocker of blockers) console.error("BLOCKED " + blocker);
    console.error("Zalo submission readiness còn " + blockers.length + " blocker.");
    process.exitCode = 1;
    return;
  }
  console.log("ZALO_SUBMISSION_READY=true");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
