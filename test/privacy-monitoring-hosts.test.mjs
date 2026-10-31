import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Exercise the actual observer's regex, not a second copy that could diverge.
const source = readFileSync(
  new URL("../customer-web/e2e/privacy-checklist.spec.ts", import.meta.url),
  "utf8",
);
const literal = source.match(/if \((\/[^\n]+\/u)\.test\(host\)\)/u)?.[1];
assert.ok(literal, "Privacy network observer must expose its hostname matcher");
const matcher = new RegExp(literal.slice(1, -2), "u");

for (const host of [
  "google-analytics.com",
  "www.google-analytics.com",
  "region1.google-analytics.com",
  "googletagmanager.com",
  "www.googletagmanager.com",
  "sentry.io",
  "o1.ingest.sentry.io",
]) {
  test(`privacy observer recognizes exact provider domain ${host}`, () =>
    assert.equal(matcher.test(host), true));
}
for (const host of [
  "notgoogle-analytics.com",
  "google-analytics.com.attacker.test",
  "evilgoogletagmanager.com",
  "googletagmanager.com.attacker.test",
  "notsentry.io",
  "sentry.io.attacker.test",
  "app.chhaircutsalon.cc",
  "localhost",
]) {
  test(`privacy observer rejects unrelated hostname ${host}`, () =>
    assert.equal(matcher.test(host), false));
}
