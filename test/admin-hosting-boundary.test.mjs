import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Admin hosting never targets the customer site or bundles test fixtures", () => {
  const config = JSON.parse(readFileSync(new URL("../firebase/admin-hosting.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(config), ["hosting"]);
  assert.equal(config.hosting.site, "haircut-c7d12-admin");
  assert.equal(config.hosting.public, "../apps/admin-web/dist");
  const production = readFileSync(new URL("../apps/admin-web/vite.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(production, /fixture|e2e|www-test/);
  assert.ok(config.hosting.headers[0].headers.some(header => header.key === "X-Frame-Options" && header.value === "DENY"));
});
