import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_REVIEW_SCREENSHOTS,
  evaluateZaloSubmissionReadiness,
} from "../scripts/check-zalo-submission-readiness.mjs";

const candidateSha = "a".repeat(40);

function capturedChecklist() {
  return EXPECTED_REVIEW_SCREENSHOTS.map(
    (name) => `| \`${name}\` | \`CAPTURED\` | evidence |`,
  ).join("\n");
}

function completeEvidence() {
  return {
    schemaVersion: 1,
    candidateSha,
    artifactSha256: "b".repeat(64),
    gateway: {
      publicHealthReady: true,
      publicAuthReady: true,
      vnEgressPreserved: true,
      realZaloReady: true,
      directExposure: false,
      httpsEnforced: true,
      runtimeHardened: true,
    },
    firebase: {
      configPrepared: true,
      productionGatewayEnabled: true,
      deployedSha: candidateSha,
    },
    zalo: {
      testingVersionId: "review-v8-final",
      androidVerified: true,
      iosVerified: true,
      reviewSubmitted: false,
      published: false,
    },
  };
}

test("accepts only a complete pre-submission evidence set", () => {
  const blockers = evaluateZaloSubmissionReadiness({
    checklistText: capturedChecklist(),
    submissionText: "CH Haircut Salon final reviewer instructions",
    evidence: completeEvidence(),
    candidateSha,
    screenshotExists: () => true,
  });
  assert.deepEqual(blockers, []);
});

test("blocks placeholders, missing screenshots, unsafe gateway and deployment drift", () => {
  const evidence = completeEvidence();
  evidence.gateway.realZaloReady = false;
  evidence.gateway.httpsEnforced = false;
  evidence.firebase.productionGatewayEnabled = false;
  evidence.firebase.deployedSha = "c".repeat(40);
  evidence.zalo.androidVerified = false;
  const blockers = evaluateZaloSubmissionReadiness({
    checklistText: capturedChecklist().replace("CAPTURED", "BLOCKED_BY_VN_GATEWAY"),
    submissionText: "[DEEPLINK_REVIEW_HỢP_LỆ]=FILL_AFTER_VN_GATEWAY_AND_FINAL_TESTING_DEPLOY",
    evidence,
    candidateSha,
    screenshotExists: (name) => name !== "16-terms",
  });
  assert.ok(blockers.some((value) => value.includes("placeholder")));
  assert.ok(blockers.some((value) => value.includes("01-open")));
  assert.ok(blockers.some((value) => value.includes("16-terms.png")));
  assert.ok(blockers.some((value) => value.includes("real Zalo")));
  assert.ok(blockers.some((value) => value.includes("HTTPS")));
  assert.ok(blockers.some((value) => value.includes("Firebase gateway")));
  assert.ok(blockers.some((value) => value.includes("deployed SHA")));
  assert.ok(blockers.some((value) => value.includes("Android")));
});
