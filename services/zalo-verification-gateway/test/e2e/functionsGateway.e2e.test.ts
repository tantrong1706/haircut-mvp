import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VietnamGatewayVerifier } from "../../../../firebase/functions/src/zaloIdentityVerifier.js";
import { createGatewayApplication, type GatewayApplication } from "../../src/app.js";
import { createSafeLogger } from "../../src/observability/safeLogger.js";
import { SqliteReplayStore } from "../../src/replay/sqliteReplayStore.js";
import { listen } from "../helpers.js";
import { startMockZaloServer } from "../mockZaloServer.js";

const keyHex = "22".repeat(32);
let directory: string;
let application: GatewayApplication;
let gatewayUrl: string;
let mockZalo: Awaited<ReturnType<typeof startMockZaloServer>>;

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "haircut-gateway-e2e-"));
  mockZalo = await startMockZaloServer();
  application = createGatewayApplication({
    keys: new Map([["e2e-v1", keyHex]]),
    replayStore: new SqliteReplayStore(join(directory, "replay.db")),
    logger: createSafeLogger(() => undefined),
    upstreamUrl: mockZalo.url,
    allowInsecureTestUpstream: true,
    upstreamTimeoutMs: 250,
    upstreamRetryDelayMs: 0,
  });
  gatewayUrl = await listen(application);
});
afterEach(async () => {
  await application.close();
  await mockZalo.close();
  rmSync(directory, { recursive: true, force: true });
});

function verifier(
  options: {
    token?: string;
    keyHex?: string;
    now?: () => number;
    nonce?: () => string;
    fetchImpl?: typeof fetch;
  } = {},
) {
  return new VietnamGatewayVerifier({
    gatewayUrl,
    keyId: "e2e-v1",
    hmacKeyHex: options.keyHex ?? keyHex,
    zaloAppSecret: "local-fixture-app-secret",
    allowInsecureLocalhost: true,
    now: options.now,
    nonce: options.nonce,
    fetchImpl: options.fetchImpl,
  });
}

describe("Functions -> gateway -> mock Zalo", () => {
  it("returns a verified Zalo user id", async () => {
    await expect(
      verifier().verify({ accessToken: "VALID_ID", requestId: "req_e2e_valid_1" }),
    ).resolves.toEqual({ zaloUserId: "123456789" });
  });
  it("rejects the wrong service HMAC", async () => {
    await expect(
      verifier({ keyHex: "33".repeat(32) }).verify({
        accessToken: "VALID_ID",
        requestId: "req_e2e_bad_hmac",
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID" });
    expect(mockZalo.attempts.size).toBe(0);
  });
  it("rejects a request body changed after signing", async () => {
    const tamperingFetch: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body)) as { accessToken: string };
      return fetch(input, {
        ...init,
        body: JSON.stringify({ ...body, accessToken: "VALID_ID" }),
      });
    };

    await expect(
      verifier({ fetchImpl: tamperingFetch }).verify({
        accessToken: "INVALID_TOKEN",
        requestId: "req_e2e_tampered_body",
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID" });
    expect(mockZalo.attempts.size).toBe(0);
  });
  it("rejects replay of the same signed nonce", async () => {
    const client = verifier({ nonce: () => "00112233445566778899aabbccddeeff" });
    await client.verify({ accessToken: "VALID_ID", requestId: "req_e2e_replay_1" });
    await expect(
      client.verify({ accessToken: "VALID_ID", requestId: "req_e2e_replay_1" }),
    ).rejects.toMatchObject({ code: "REPLAY_DETECTED" });
  });
  it("rejects an expired timestamp before upstream", async () => {
    await expect(
      verifier({ now: () => Date.now() - 61_000 }).verify({
        accessToken: "VALID_ID",
        requestId: "req_e2e_expired",
      }),
    ).rejects.toMatchObject({ code: "REQUEST_EXPIRED" });
    expect(mockZalo.attempts.size).toBe(0);
  });
  it("fails closed on timeout after two upstream attempts", async () => {
    await expect(
      verifier().verify({ accessToken: "TIMEOUT", requestId: "req_e2e_timeout" }),
    ).rejects.toMatchObject({ code: "ZALO_TIMEOUT" });
    expect(mockZalo.attempts.get("TIMEOUT")).toBe(2);
  });
  it("fails closed on invalid token without retry", async () => {
    await expect(
      verifier().verify({ accessToken: "INVALID_TOKEN", requestId: "req_e2e_invalid" }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_TOKEN" });
    expect(mockZalo.attempts.get("INVALID_TOKEN")).toBe(1);
  });
  it.each([
    ["MISSING_ID", "ZALO_INVALID_RESPONSE", 1],
    ["MALFORMED_JSON", "ZALO_INVALID_RESPONSE", 1],
    ["CONNECTION_RESET", "ZALO_UNAVAILABLE", 2],
    ["408", "ZALO_UNAVAILABLE", 2],
    ["429", "ZALO_RATE_LIMITED", 2],
    ["500", "ZALO_UNAVAILABLE", 2],
    ["503", "ZALO_UNAVAILABLE", 2],
  ] as const)("normalizes mock scenario %s", async (scenario, code, attempts) => {
    await expect(
      verifier().verify({
        accessToken: scenario,
        requestId: `req_e2e_${scenario.toLowerCase()}`,
      }),
    ).rejects.toMatchObject({ code });
    expect(mockZalo.attempts.get(scenario)).toBe(attempts);
  });
});
