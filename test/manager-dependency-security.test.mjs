import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { registerZodSecurityTests } from "./helpers/zod-security.mjs";
const requireManager = createRequire(new URL("../apps/manager-mobile/package.json", import.meta.url));
registerZodSecurityTests(requireManager, "Manager Web");

test("Manager keeps the Firebase SDK while its inherited Node transport is patched", () => {
  assert.equal(requireManager("firebase/package.json").version, "12.16.0");
  assert.equal(requireManager("@firebase/firestore/package.json").version, "4.16.0");
  const firestore = createRequire(requireManager.resolve("@firebase/firestore/package.json"));
  assert.equal(firestore("@grpc/grpc-js/package.json").version, "1.14.6");
});

test("bundled native dependency metadata retains patched versions without a native release", () => {
  const lock = JSON.parse(readFileSync(new URL("../apps/manager-mobile/package-lock.json", import.meta.url), "utf8"));
  for (const name of ["@capacitor/android", "@capacitor/ios"]) {
    assert.equal(lock.packages[`node_modules/${name}`].version, "8.4.3");
  }
});
