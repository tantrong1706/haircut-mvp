import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

function checkoutFixture(check) {
  const temp = mkdtempSync(join(tmpdir(), "haircut-eol-test-"));
  const source = join(temp, "source"), checkout = join(temp, "checkout");
  mkdirSync(source);
  const git = (args, cwd = source) => {
    const result = spawnSync("git", ["-c", "core.hooksPath=" + join(temp, "empty-hooks"), ...args], { cwd, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  };
  const write = (path, text) => { const target = join(source, path); mkdirSync(dirname(target), {recursive:true}); writeFileSync(target, text); };
  try {
    write(".gitattributes", readFileSync(new URL("../.gitattributes", import.meta.url), "utf8"));
    write("packages/contracts/package.json", '{"name":"fixture-contracts"}\n');
    write("firebase/functions/contracts/package.json", '{"name":"fixture-contracts"}\n');
    write("apps/manager-mobile/src/components/Fixture.tsx", 'export const Fixture = () => <p>Fixture</p>;\n');
    git(["init", "--quiet"]);
    git(["add", "."]);
    git(["-c", "commit.gpgsign=false", "-c", "user.name=Test Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"]);
    git(["-c", "core.autocrlf=true", "clone", "--quiet", "--no-hardlinks", source, checkout], temp);
    check(checkout);
  } finally {
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()));
    assert.ok(basename(temp).startsWith("haircut-eol-test-"));
    rmSync(temp, {recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
}

test("a fresh autocrlf checkout keeps shared contracts byte-identical to the deployment mirror", () => checkoutFixture(dir => {
  const source = readFileSync(join(dir, "packages/contracts/package.json"), "utf8");
  const mirror = readFileSync(join(dir, "firebase/functions/contracts/package.json"), "utf8");
  assert.equal(source, mirror);
  assert.ok(!source.includes("\r\n"));
}));

test("a fresh autocrlf checkout keeps Manager Web source compatible with LF formatting checks", () => checkoutFixture(dir => {
  const text = readFileSync(join(dir, "apps/manager-mobile/src/components/Fixture.tsx"), "utf8");
  assert.ok(!text.includes("\r\n"));
}));
