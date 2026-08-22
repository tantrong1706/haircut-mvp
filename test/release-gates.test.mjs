import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const checkScript = readFileSync(new URL("scripts/check.ps1", root), "utf8");
const gatewayWorkflow = readFileSync(new URL(".github/workflows/zalo-gateway.yml", root), "utf8");
const screenshotSpec = readFileSync(
  new URL("zalo-mini-app/e2e/review-screenshots.spec.ts", root),
  "utf8",
);
const miniPackage = JSON.parse(readFileSync(new URL("zalo-mini-app/package.json", root), "utf8"));
const secretScanner = readFileSync(new URL("scripts/check-secrets.mjs", root), "utf8");

test("repository check includes the gateway release gates", () => {
  assert.match(checkScript, /Gateway npm ci/u);
  assert.match(checkScript, /Gateway source checks/u);
  assert.match(checkScript, /Gateway dependency audit/u);
  assert.match(checkScript, /Gateway Functions compatibility/u);
  assert.match(checkScript, /services\/zalo-verification-gateway/u);
  assert.match(checkScript, /npm audit --audit-level=high/u);
});

test("gateway CI validates both integration and main PRs", () => {
  assert.match(
    gatewayWorkflow,
    /pull_request:\s*\n\s*branches:\s*\[release\/zalo-version-8-readiness, main\]/u,
  );
});

test("secret scanner covers both gateway HMAC representations", () => {
  assert.match(secretScanner, /GATEWAY_HMAC_SECRET/u);
  assert.match(secretScanner, /GATEWAY_HMAC_KEYS/u);
});

test("review capture tooling uses exactly the current 16-name checklist", () => {
  assert.equal(
    miniPackage.scripts["check:zalo-submission"],
    "node ../scripts/check-zalo-submission-readiness.mjs",
  );
  const names = [
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
  for (const name of names) {
    assert.match(screenshotSpec, new RegExp(`${name}\\.png`, "u"));
  }
  assert.doesNotMatch(screenshotSpec, /chu-salon|nhan-vien|khach-trang-chu/u);
});
