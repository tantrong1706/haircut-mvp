import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../firebase/firebase.json", import.meta.url), "utf8"),
);
const headers = config.hosting.headers.find((rule) => rule.source === "**").headers;
const value = (name) => headers.find((header) => header.key === name)?.value;

test("baseline CSP is enforced without restricting unverified Auth/network sources", () => {
  assert.equal(value("Content-Security-Policy"), "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  assert.equal(value("Content-Security-Policy-Report-Only"), undefined);
});

test("Web pages cannot be embedded to trick staff into unintended clicks", () => {
  assert.equal(value("X-Frame-Options"), "DENY");
});
test("existing HTTPS, MIME and referrer defenses stay enabled", () => {
  assert.match(value("Strict-Transport-Security"), /max-age=31536000/);
  assert.equal(value("X-Content-Type-Options"), "nosniff");
  assert.equal(value("Referrer-Policy"), "no-referrer");
});
