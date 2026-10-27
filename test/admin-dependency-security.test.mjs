import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { registerZodSecurityTests } from "./helpers/zod-security.mjs";

const require = createRequire(new URL("../apps/admin-web/package.json", import.meta.url));
registerZodSecurityTests(require, "Admin Web");
test("Admin's inherited Node Firestore transport resolves to patched gRPC without an SDK upgrade", () => {
  assert.equal(require("firebase/package.json").version, "12.16.0");
  assert.equal(require("@firebase/firestore/package.json").version, "4.16.0");
  const firestore = createRequire(require.resolve("@firebase/firestore/package.json"));
  assert.equal(firestore("@grpc/grpc-js/package.json").version, "1.14.6");
  const lock = JSON.parse(
    readFileSync(new URL("../apps/admin-web/package-lock.json", import.meta.url), "utf8"),
  );
  for (const [name, entry] of Object.entries(lock.packages)) {
    if (name.endsWith("node_modules/@grpc/grpc-js")) assert.equal(entry.version, "1.14.6");
  }
});
