import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("active Web CI checks clients, Firebase and browser flows without Mini App deployment", () => {
  const workflow = read(".github/workflows/build.yml");
  for (const job of [
    "firebase-functions:",
    "customer-web:",
    "admin-web:",
    "manager-mobile:",
    "browser-tests:",
    "repository-checks:",
  ])
    assert.ok(workflow.includes(job), job);
  assert.doesNotMatch(workflow, /build:zmp|check:zalo|firebase deploy|zmp deploy/);
  assert.match(workflow, /web-only-retirement\.test\.mjs/);
});

test("secret scanner still protects retained backend credentials", () => {
  const scanner = read("scripts/check-secrets.mjs");
  assert.match(scanner, /GATEWAY_HMAC_SECRET/);
  assert.match(scanner, /GATEWAY_HMAC_KEYS/);
});
