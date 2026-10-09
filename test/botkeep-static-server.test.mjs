import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createStaticServer, readPort } from "../deploy/botkeep/server.mjs";

const entry = (text, type = "text/html; charset=utf-8") => ({
  data: Buffer.from(text).toString("base64"), type,
});
const fixture = {
  files: {
    "/index.html": entry("<h1>CH Hair fixture</h1>"),
    "/assets/app.12345678.js": entry("export const ready=true", "text/javascript; charset=utf-8"),
    "/fonts/fixture.woff2": { data: Buffer.from([0, 1, 255, 42]).toString("base64"), type: "font/woff2" },
  },
};

async function withServer(t, site = fixture) {
  const server = createStaticServer(site);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test("serves all app routes with no-cache HTML and anti-framing headers", async t => {
  const base = await withServer(t);
  for (const route of ["/", "/history", "/wheel", "/rewards", "/account", "/checkin", "/owner", "/staff", "/privacy", "/terms", "/app-check"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /CH Hair fixture/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  }
});

test("serves text and binary assets and HEAD without a response body", async t => {
  const base = await withServer(t);
  const js = await fetch(base + "/assets/app.12345678.js");
  assert.equal(js.status, 200);
  assert.match(js.headers.get("content-type"), /javascript/);
  assert.match(js.headers.get("cache-control"), /max-age/);
  const font = await fetch(base + "/fonts/fixture.woff2");
  assert.deepEqual([...new Uint8Array(await font.arrayBuffer())], [0, 1, 255, 42]);
  const head = await fetch(base + "/fonts/fixture.woff2", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "4");
  assert.equal(await head.text(), "");
});

test("does not expose server source, bundle JSON, dotfiles, traversal or missing assets", async t => {
  const base = await withServer(t);
  for (const route of ["/.env", "/server.mjs", "/site.json", "/package.json", "/assets/missing.js", "/%2e%2e/server.mjs", "/unknown"]) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  assert.equal((await fetch(base + "/%ZZ")).status, 400);
  assert.equal((await fetch(base + "/" + "x".repeat(2100))).status, 414);
});

test("rejects writes and provides minimal health without environment data", async t => {
  const base = await withServer(t);
  const denied = await fetch(base + "/", { method: "POST", body: "fixture" });
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get("allow"), "GET, HEAD");
  assert.deepEqual(await (await fetch(base + "/healthz")).json(), { status: "ok" });
});

test("validates artifact and runtime port before starting", () => {
  assert.throws(() => createStaticServer({ files: {} }));
  assert.throws(() => createStaticServer({ files: { ...fixture.files, "/.env": entry("x") } }));
  assert.throws(() => createStaticServer({ files: { "/index.html": { data: "!", type: "text/html" } } }));
  assert.equal(readPort({ SERVER_PORT: "8123", PORT: "9000" }), 8123);
  assert.equal(readPort({ PORT: "9000" }), 9000);
  assert.equal(readPort({}), 8080);
  for (const value of ["0", "-1", "65536", "NaN", "1.5"]) {
    assert.throws(() => readPort({ SERVER_PORT: value }));
  }
});
