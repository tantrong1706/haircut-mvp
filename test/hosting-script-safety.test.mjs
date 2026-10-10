import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const build = readFileSync(new URL("../scripts/build-hosting.ps1", import.meta.url), "utf8");
const deploy = readFileSync(new URL("../scripts/deploy-hosting.ps1", import.meta.url), "utf8");

test("a failed frontend build stops before touching Firebase public", () => {
  assert.match(build, /npm run build\s+if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(build, /finally\s*\{\s*Pop-Location/);
  assert.ok(build.indexOf('$LASTEXITCODE -ne 0') < build.indexOf('Remove-Item'));
  assert.match(build, /index\.html/);
});

test("Hosting deployment stops if packaging fails and targets the exact Firebase site", () => {
  assert.match(deploy, /build-hosting\.ps1[^\n]*\n\s*if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(deploy, /firebase deploy --project haircut-c7d12 --only hosting:haircut-c7d12\s+if \(\$LASTEXITCODE -ne 0\)/);
  assert.match(deploy, /finally\s*\{\s*Pop-Location/);
  assert.doesNotMatch(deploy, /--only functions|--only firestore|--only storage/);
});
