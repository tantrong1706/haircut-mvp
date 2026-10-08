import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const lock = JSON.parse(
  readFileSync(new URL("../firebase/functions/package-lock.json", import.meta.url), "utf8"),
);
const requireFunctions = createRequire(
  new URL("../firebase/functions/package.json", import.meta.url),
);
const proxyAddr = requireFunctions("proxy-addr");
const qs = requireFunctions("qs");

for (const [name, minimum] of [
  ["@fastify/busboy", "3.2.2"],
  ["@grpc/grpc-js", "1.14.5"],
  ["proxy-addr", "2.0.8"],
  ["qs", "6.16.0"],
]) {
  test(`production ${name} must retain the reviewed security floor ${minimum}`, () => {
    const copies = Object.entries(lock.packages).filter(
      ([path, entry]) => path.endsWith(`node_modules/${name}`) && entry.dev !== true,
    );
    assert.ok(copies.length > 0, `Missing production ${name}`);
    for (const [path, entry] of copies) {
      assert.match(entry.version, /^\d+\.\d+\.\d+$/);
      const version = entry.version.split(".").map(Number);
      const floor = minimum.split(".").map(Number);
      const firstDifference = version.findIndex((part, index) => part !== floor[index]);
      assert.ok(
        firstDifference === -1 || version[firstDifference] > floor[firstDifference],
        `${path}: ${entry.version} is below ${minimum}`,
      );
    }
  });
}

test("IPv4-mapped trust subnet does not trust unrelated IPv4 clients", () => {
  const trust = proxyAddr.compile("::ffff:10.0.0.0/8");
  assert.equal(trust("203.0.113.25", 0), false);
});

test("normal IPv4 proxy subnet keeps its intended boundary", () => {
  const trust = proxyAddr.compile("10.0.0.0/8");
  assert.equal(trust("10.1.2.3", 0), true);
  assert.equal(trust("203.0.113.25", 0), false);
});

test("query round-trip cannot invoke an attacker-supplied isBuffer property", () => {
  const parsed = qs.parse("x[constructor][isBuffer]=not-callable", { plainObjects: true });
  assert.doesNotThrow(() => qs.stringify(parsed));
  assert.equal(qs.stringify({ salonId: "fixture-salon", page: 1 }), "salonId=fixture-salon&page=1");
});
