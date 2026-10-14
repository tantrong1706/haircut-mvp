import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("Admin artifact is inside the Firebase config project root", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const builder = readFileSync(new URL("../scripts/build-admin-hosting.mjs", import.meta.url), "utf8");
  const configName = builder.match(/readFileSync\(join\(root, "([^"]+\.json)"\)/)?.[1];
  assert.ok(configName, "The build must validate its actual Firebase config");
  const configFile = resolve(root, configName);
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  const projectRoot = dirname(configFile);
  const artifact = resolve(projectRoot, config.hosting.public);
  const withinProject = relative(projectRoot, artifact);
  assert.ok(!withinProject.startsWith(".."), "Firebase refuses artifacts outside the config directory");
  assert.equal(artifact, resolve(root, "apps/admin-web/dist"));
});

test("Admin hosting never targets the customer site or bundles test fixtures", () => {
  const config = JSON.parse(readFileSync(new URL("../firebase/admin-hosting.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(config), ["hosting"]);
  assert.equal(config.hosting.site, "haircut-c7d12-admin");
  assert.equal(config.hosting.public, "../apps/admin-web/dist");
  const production = readFileSync(new URL("../apps/admin-web/vite.config.ts", import.meta.url), "utf8");
  assert.doesNotMatch(production, /fixture|e2e|www-test/);
  assert.ok(config.hosting.headers[0].headers.some(header => header.key === "X-Frame-Options" && header.value === "DENY"));
});
