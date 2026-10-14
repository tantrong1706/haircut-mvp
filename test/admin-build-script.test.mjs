import assert from "node:assert/strict";
import test from "node:test";

const module = await import("../scripts/build-admin-hosting.mjs").catch(() => null);
const publicConfig = {
  VITE_FIREBASE_API_KEY: "public-fixture-key",
  VITE_FIREBASE_AUTH_DOMAIN: "haircut-c7d12.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "haircut-c7d12",
  VITE_FIREBASE_STORAGE_BUCKET: "haircut-c7d12.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "100000000000",
  VITE_FIREBASE_APP_ID: "public-fixture-app-id",
  VITE_FIREBASE_APP_CHECK_SITE_KEY: "public-fixture-site-key",
};
function select(...args) {
  assert.equal(typeof module?.selectAdminPublicEnv, "function", "Missing safe Admin build helper");
  return module.selectAdminPublicEnv(...args);
}
test("Admin build takes only approved public Firebase fields, never server secrets", () => {
  const result = select({}, { ...publicConfig, SECRET: "private-value", VITE_OTHER_SECRET: "private-value" }, "a".repeat(40));
  assert.deepEqual(Object.keys(result).sort(), [...Object.keys(publicConfig), "VITE_APP_VERSION"].sort());
  assert.ok(!JSON.stringify(result).includes("private-value"));
});
test("Admin build rejects missing config, wrong project and production debug token", () => {
  assert.equal(typeof module?.selectAdminPublicEnv, "function", "Missing safe Admin build helper");
  assert.throws(() => select({}, {}, "a".repeat(40)), /Thiếu/);
  assert.throws(() => select({ ...publicConfig, VITE_FIREBASE_PROJECT_ID: "another-project" }, {}, "a".repeat(40)), /project/);
  assert.throws(() => select({ ...publicConfig, VITE_APP_CHECK_DEBUG_TOKEN: "private-debug" }, {}, "a".repeat(40)), /debug/i);
  assert.throws(() => select(publicConfig, {}, "unknown"), /commit/);
});
