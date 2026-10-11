import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

const lock = JSON.parse(readFileSync(new URL("../customer-web/package-lock.json", import.meta.url), "utf8"));
const webRequire = createRequire(new URL("../customer-web/package.json", import.meta.url));

test("every installed Firestore gRPC copy is on a patched supported 1.x release", () => {
  const copies = Object.entries(lock.packages).filter(([name]) => name.endsWith("node_modules/@grpc/grpc-js"));
  assert.ok(copies.length > 0);
  for (const [name, entry] of copies) {
    const [major, minor, patch] = entry.version.split(".").map(Number);
    assert.ok(major === 1 && (minor > 14 || (minor === 14 && patch >= 6)), `${name} still resolves ${entry.version}`);
  }
  const firestoreRequire = createRequire(webRequire.resolve("@firebase/firestore/package.json"));
  assert.equal(firestoreRequire("@grpc/grpc-js/package.json").version, "1.14.6");
});

test("Firestore browser entry uses WebChannel, not the Node gRPC transport", () => {
  const metadata = webRequire("@firebase/firestore/package.json");
  const entry = metadata.exports["."].browser.import;
  const file = new URL(entry, pathToFileURL(webRequire.resolve("@firebase/firestore/package.json")));
  const source = readFileSync(file, "utf8");
  assert.match(source, /@firebase\/webchannel-wrapper/);
  assert.doesNotMatch(source, /from ["']@grpc\/grpc-js["']/);
});
