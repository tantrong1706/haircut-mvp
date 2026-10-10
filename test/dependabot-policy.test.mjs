import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync(new URL("../.github/dependabot.yml", import.meta.url), "utf8");
const entries = config.split(/\r?\n  - package-ecosystem:/).slice(1);

test("five update surfaces each allow one version-update PR", () => {
  assert.equal(entries.length, 5);
  for (const entry of entries) assert.match(entry, /open-pull-requests-limit: 1(?:\s|$)/);
});

test("minor/patch groups explicitly apply to version updates, not security updates", () => {
  for (const entry of entries) {
    assert.match(entry, /groups:/);
    assert.match(entry, /applies-to: version-updates/);
    assert.match(entry, /patterns: \["\*"\]/);
    assert.match(entry, /update-types: \[minor, patch\]/);
    assert.doesNotMatch(entry, /\n\s+ignore:|applies-to: security-updates/);
  }
});
