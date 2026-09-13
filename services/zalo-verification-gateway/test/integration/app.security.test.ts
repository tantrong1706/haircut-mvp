import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGatewayApplication, type GatewayApplication } from "../../src/app.js";
import { createSafeLogger } from "../../src/observability/safeLogger.js";
import { SqliteReplayStore } from "../../src/replay/sqliteReplayStore.js";
import type { GatewayFetch } from "../../src/zalo/zaloIdentityClient.js";
import { listen, signedHeaders } from "../helpers.js";

const keyHex = "11".repeat(32);
let directory: string;
let application: GatewayApplication;
let baseUrl: string;
let fetchImpl: ReturnType<typeof vi.fn<GatewayFetch>>;

beforeEach(async () => {
  const fixedNow = Date.now();
  directory = mkdtempSync(join(tmpdir(), "haircut-gateway-app-"));
  fetchImpl = vi
    .fn<GatewayFetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: "123456789" }), { status: 200 }),
    );
  application = createGatewayApplication({
    keys: new Map([["test-v1", keyHex]]),
    replayStore: new SqliteReplayStore(join(directory, "replay.db")),
    fetchImpl,
    logger: createSafeLogger(() => undefined),
    now: () => fixedNow,
  });
  baseUrl = await listen(application);
});
afterEach(async () => {
  await application.close();
  rmSync(directory, { recursive: true, force: true });
});

function validBody(requestId = "req_test_12345678") {
  return Buffer.from(
    JSON.stringify({
      accessToken: "access-token",
      appsecretProof: "a".repeat(64),
      requestId,
    }),
  );
}
async function verify(body: Buffer, headers = signedHeaders(body)) {
  return fetch(`${baseUrl}/v1/zalo/verify`, { method: "POST", headers, body });
}

describe("gateway HTTP security", () => {
  it("serves health without calling Zalo", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      version: "development",
      uptime: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects a non-JSON content type before authentication", async () => {
    const body = validBody();
    const response = await fetch(`${baseUrl}/v1/zalo/verify`, {
      method: "POST",
      headers: { ...signedHeaders(body), "content-type": "text/plain" },
      body,
    });
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "BAD_REQUEST" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("verifies a valid signed request", async () => {
    const response = await verify(validBody());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      zaloUserId: "123456789",
      requestId: "req_test_12345678",
    });
  });
  it("keeps the public error contract generic when Zalo rejects the token", async () => {
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: -201, message: "Sensitive upstream detail" }), {
        status: 401,
      }),
    );
    const body = validBody("req_zalo_rejected");
    const response = await verify(body, signedHeaders(body, { requestId: "req_zalo_rejected" }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "ZALO_INVALID_TOKEN",
      requestId: "req_zalo_rejected",
    });
  });
  it.each([
    ["unknown key", (body: Buffer) => signedHeaders(body, { keyId: "unknown" }), "AUTH_INVALID"],
    [
      "wrong signature",
      (body: Buffer) => ({ ...signedHeaders(body), "x-signature": "ff".repeat(32) }),
      "AUTH_INVALID",
    ],
    [
      "short signature",
      (body: Buffer) => ({ ...signedHeaders(body), "x-signature": "abcd" }),
      "AUTH_INVALID",
    ],
    [
      "expired request",
      (body: Buffer) => signedHeaders(body, { timestamp: String(Date.now() - 61_000) }),
      "REQUEST_EXPIRED",
    ],
    [
      "malformed timestamp",
      (body: Buffer) => signedHeaders(body, { timestamp: "999999999999999999999" }),
      "REQUEST_EXPIRED",
    ],
    ["method mismatch", (body: Buffer) => signedHeaders(body, { method: "GET" }), "AUTH_INVALID"],
    ["path mismatch", (body: Buffer) => signedHeaders(body, { path: "/wrong" }), "AUTH_INVALID"],
  ])("rejects %s", async (_name, createHeaders, code) => {
    const body = validBody();
    const response = await verify(body, createHeaders(body));
    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects a body changed after signing", async () => {
    const original = validBody();
    const changed = Buffer.from(original.toString().replace("access-token", "changed-token"));
    const response = await verify(changed, signedHeaders(original));
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "AUTH_INVALID" });
  });
  it("rejects the same nonce twice", async () => {
    const body = validBody();
    const headers = signedHeaders(body, { nonce: "00112233445566778899aabbccddeeff" });
    expect((await verify(body, headers)).status).toBe(200);
    const replay = await verify(body, headers);
    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({ code: "REPLAY_DETECTED" });
  });
  it.each([
    [Buffer.from("{"), "BAD_REQUEST"],
    [
      Buffer.from(JSON.stringify({ accessToken: "a", requestId: "req_test_12345678" })),
      "BAD_REQUEST",
    ],
    [
      Buffer.from(
        JSON.stringify({
          accessToken: "a",
          appsecretProof: "a".repeat(64),
          requestId: "req_test_12345678",
          url: "https://evil.test",
        }),
      ),
      "BAD_REQUEST",
    ],
  ])("rejects malformed or unsafe JSON", async (body, code) => {
    const response = await verify(body);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("rejects requestId disagreement", async () => {
    const body = validBody("req_body_12345678");
    const response = await verify(body, signedHeaders(body, { requestId: "req_header_12345678" }));
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "BAD_REQUEST" });
  });
  it("rejects an oversized request", async () => {
    const body = Buffer.alloc(8_193, 97);
    const response = await verify(body);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "BAD_REQUEST" });
  });
  it("rate-limits unauthenticated requests before signature parsing", async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await fetch(`${baseUrl}/v1/zalo/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${baseUrl}/v1/zalo/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("enforces burst 50 per key", async () => {
    for (let index = 0; index < 50; index += 1) {
      const requestId = `req_rate_${String(index).padStart(8, "0")}`;
      const body = validBody(requestId);
      expect((await verify(body, signedHeaders(body, { requestId }))).status).toBe(200);
    }
    const body = validBody("req_rate_overflow");
    const response = await verify(body, signedHeaders(body, { requestId: "req_rate_overflow" }));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: "RATE_LIMITED" });
  });
});
