import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const { emulatorTestEnvironment } = await import("../firebase/functions/scripts/emulator-transport.mjs");
const valid = () => ({ GCLOUD_PROJECT: "demo-haircut", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIRESTORE_PREFER_REST: "false" });
test("REST is enabled only in a copied environment for the local demo child process", () => {
  const parent = valid();
  const child = emulatorTestEnvironment(parent);
  assert.equal(child.FIRESTORE_PREFER_REST, "true");
  assert.equal(child.GCLOUD_PROJECT, parent.GCLOUD_PROJECT);
  assert.equal(parent.FIRESTORE_PREFER_REST, "false");
});
for (const host of ["127.0.0.1:8080", "localhost:8080", "[::1]:8080"]) {
  test(`allows explicit loopback emulator ${host}`, () => assert.equal(emulatorTestEnvironment({ ...valid(), FIRESTORE_EMULATOR_HOST: host }).FIRESTORE_PREFER_REST, "true"));
}
for (const host of ["", "firestore.googleapis.com:443", "127.0.0.1.attacker.test:8080", "127.0.0.1:8080/path", "user@127.0.0.1:8080", "localhost"]) {
  test(`rejects unsafe or missing emulator host ${host}`, () => assert.throws(() => emulatorTestEnvironment({ ...valid(), FIRESTORE_EMULATOR_HOST: host })));
}
for (const project of ["", "haircut-c7d12", "demo-"]) {
  test(`rejects non-demo or invalid project ${project}`, () => assert.throws(() => emulatorTestEnvironment({ ...valid(), GCLOUD_PROJECT: project })));
}
test("runner forwards the real test process result without retrying or swallowing failures", () => {
  const runner = readFileSync(new URL("../firebase/functions/scripts/run-firestore-integration.mjs", import.meta.url), "utf8");
  assert.match(runner, /spawnSync\(process\.execPath/);
  assert.match(runner, /process\.exit\(result\.status \?\? 1\)/);
  assert.doesNotMatch(runner, /retry|setTimeout|catch|for\s*\(|while\s*\(/);
});
