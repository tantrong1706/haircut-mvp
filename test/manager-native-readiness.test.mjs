import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("the Manager iOS manifest uses portable local package paths and the matching Capacitor version", () => {
  const manifest = read("apps/manager-mobile/ios/App/CapApp-SPM/Package.swift");
  const paths = [...manifest.matchAll(/\bpath:\s*"([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(paths.length > 0, "expected local native plugin packages");
  for (const path of paths) {
    assert.match(path, /^\.\.\/\.\.\/\.\.\/node_modules\//u, path);
    assert.ok(!path.includes("\\"), "local package paths must use forward slashes");
  }
  const dependencies = JSON.parse(read("apps/manager-mobile/package.json")).dependencies;
  const capacitor = manifest.match(/capacitor-swift-pm\.git", exact: "([^"]+)"/u)?.[1];
  assert.equal(capacitor, dependencies["@capacitor/ios"]);
});

test("the native workflow checks Android and iOS without store upload or production credentials", () => {
  const workflow = read(".github/workflows/manager-native.yml");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /pull_request:/u);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/u);
  assert.match(workflow, /:app:testDebugUnitTest :app:lintDebug :app:assembleDebug/u);
  assert.match(workflow, /runs-on: macos-15-intel\s/u, "use the Intel runner pool for iOS");
  assert.match(workflow, /xcodebuild[\s\S]*generic\/platform=iOS Simulator[\s\S]*CODE_SIGNING_ALLOWED=NO/u);
  assert.doesNotMatch(workflow, /secrets\.|pull_request_target|bundleRelease|fastlane|firebase deploy|upload-artifact/u);
});
