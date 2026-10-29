import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { registerZodSecurityTests } from "./helpers/zod-security.mjs";

const lock = JSON.parse(
  readFileSync(new URL("../customer-web/package-lock.json", import.meta.url), "utf8"),
);
const requireWeb = createRequire(new URL("../customer-web/package.json", import.meta.url));
registerZodSecurityTests(requireWeb, "Customer Web");

for (const directory of [
  "customer-web",
  "apps/admin-web",
  "apps/manager-mobile",
  "firebase/functions",
]) {
  test(`${directory}: production Zod and local contracts metadata are patched`, () => {
    const workspaceLock = JSON.parse(
      readFileSync(new URL(`../${directory}/package-lock.json`, import.meta.url), "utf8"),
    );
    assert.equal(
      workspaceLock.packages["node_modules/@haircut/contracts"].dependencies.zod,
      "^4.6.6",
    );
    for (const [path, entry] of Object.entries(workspaceLock.packages)) {
      if (!path.endsWith("node_modules/zod") || entry.dev === true) continue;
      assert.match(entry.version, /^4\.\d+\.\d+$/);
      const [, minor, patch] = entry.version.split(".").map(Number);
      assert.ok(minor > 6 || (minor === 6 && patch >= 6), `${path}: affected Zod ${entry.version}`);
    }
  });
}

for (const [name, minimum] of [
  ["brace-expansion", "1.1.21"],
  ["browserslist", "4.28.7"],
  ["baseline-browser-mapping", "2.11.0"],
]) {
  test(`production ${name} retains the reviewed security floor ${minimum}`, () => {
    const copies = Object.entries(lock.packages).filter(
      ([path, entry]) => path.endsWith(`node_modules/${name}`) && entry.dev !== true,
    );
    // A retired SDK may remove the entire production chain. Any remaining copy must stay patched.
    for (const [path, entry] of copies) {
      assert.match(entry.version, /^\d+\.\d+\.\d+$/);
      const parts = entry.version.split(".").map(Number);
      const floor = minimum.split(".").map(Number);
      const difference = parts.findIndex((part, index) => part !== floor[index]);
      assert.ok(
        difference === -1 || parts[difference] > floor[difference],
        `${path}: ${entry.version} is below ${minimum}`,
      );
    }
  });
}

test("normal brace patterns still expand without changing their meaning", () => {
  const expand = requireWeb("brace-expansion");
  assert.deepEqual(expand("salon-{a,b}"), ["salon-a", "salon-b"]);
});

test("explicit supported browser queries remain compatible", () => {
  const browserslist = requireWeb("browserslist");
  assert.deepEqual(browserslist("chrome 120"), ["chrome 120"]);
});
