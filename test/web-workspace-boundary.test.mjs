import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
test("customer Web has an explicit workspace name", () => {
  assert.ok(existsSync(new URL("customer-web/package.json", root)));
  assert.equal(existsSync(new URL("zalo-mini-app/package.json", root)), false);
});
test("shared client domain is independent of customer UI", () => {
  for (const file of ["types.ts", "wheel.ts", "safeStorage.ts"]) {
    const source = readFileSync(new URL(`packages/client-domain/${file}`, root), "utf8");
    assert.doesNotMatch(source, /customer-web|zalo-mini-app|zmp-sdk|firebase\//);
  }
});
test("active CI builds the renamed customer workspace", () => {
  const source = readFileSync(new URL(".github/workflows/build.yml", root), "utf8");
  assert.match(source, /working-directory: customer-web/);
  assert.doesNotMatch(source, /zalo-mini-app/);
});
