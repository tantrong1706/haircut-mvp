import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFileSync(path.join(root, name), "utf8");
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

test("Web branding and CSS do not carry retired Mini App names", () => {
  for (const file of walk(path.join(root, "customer-web/src"))) {
    if (!/\.(ts|tsx|css)$/.test(file) || /\.test\./.test(file)) continue;
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /MINI_APP_(?:NAME|MARK)|\.zalo-[\w-]+/,
      path.relative(root, file),
    );
  }
  assert.doesNotMatch(read("customer-web/index.html"), /zalo-platform-site-verification/);
  assert.match(read("customer-web/index.html"), /<title>CH Haircut Salon<\/title>/);
});

test("shared Web Firebase error mapping does not route to retired callables", () => {
  assert.doesNotMatch(
    read("customer-web/src/services/firebase.ts"),
    /FromZalo|ZALO_VERIFICATION_FAILED|isZaloInfrastructureVerificationMessage/,
  );
});

test("local startup and GitHub contribution templates describe Web", () => {
  assert.ok(existsSync(path.join(root, "scripts/start-web.ps1")));
  assert.equal(existsSync(path.join(root, "scripts/start-miniapp.ps1")), false);
  for (const name of [
    "scripts/setup.ps1",
    ".github/PULL_REQUEST_TEMPLATE.md",
    ".github/ISSUE_TEMPLATE/bug.yml",
  ]) {
    assert.doesNotMatch(read(name), /Zalo|Mini App|start-miniapp/i, name);
  }
  assert.match(read("scripts/setup.ps1"), /start-web\.ps1/);
});

test("Firebase setup documents Phone Auth without obsolete secret instructions", () => {
  const doc = read("firebase/README.md");
  assert.match(doc, /Phone Auth/);
  assert.doesNotMatch(doc, /ZALO_APP_SECRET\s*=|ZALO_MINI_APP_ID\s*=|Luồng khách Zalo|Mini App ID/);
  assert.ok(existsSync(path.join(root, "docs/archive/ZALO_GATEWAY_PRE_VPS.md")));
  assert.equal(existsSync(path.join(root, "docs/ZALO_GATEWAY_PRE_VPS.md")), false);
});
