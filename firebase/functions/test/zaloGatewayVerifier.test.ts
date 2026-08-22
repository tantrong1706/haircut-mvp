import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { VietnamGatewayVerifier, createZaloIdentityVerifier } from "../src/zaloIdentityVerifier";

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../test/fixtures/zalo-gateway-signature.json"),
    "utf8",
  ),
) as Record<string, string>;
const functionsSource = readFileSync(resolve(import.meta.dirname, "../src/index.ts"), "utf8");
const envExample = readFileSync(resolve(import.meta.dirname, "../.env.example"), "utf8");

describe("VietnamGatewayVerifier", () => {
  it("produces the shared deterministic signature fixture", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          zaloUserId: "123456789",
          requestId: fixture.requestId,
        }),
        { status: 200 },
      ),
    );
    const verifier = new VietnamGatewayVerifier({
      gatewayUrl: "https://gateway.example.test",
      keyId: fixture.keyId,
      hmacKeyHex: fixture.hmacKeyHex,
      zaloAppSecret: "fixture-app-secret",
      fetchImpl,
      now: () => Number(fixture.timestamp),
      nonce: () => fixture.nonce,
      createProof: () => "a".repeat(64),
    });
    await expect(
      verifier.verify({ accessToken: "fixture-access-token", requestId: fixture.requestId }),
    ).resolves.toEqual({ zaloUserId: "123456789" });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(fixture.body);
    expect(init.headers).toMatchObject({
      "X-Key-Id": fixture.keyId,
      "X-Timestamp": fixture.timestamp,
      "X-Nonce": fixture.nonce,
      "X-Request-Id": fixture.requestId,
      "X-Body-SHA256": fixture.bodySha256,
      "X-Signature": fixture.signature,
    });
  });
  it("fails closed when gateway mode is missing configuration", () => {
    expect(() =>
      createZaloIdentityVerifier({
        mode: "gateway",
        gatewayUrl: "",
        gatewayKeyId: "",
        gatewayHmacSecret: "",
        zaloAppSecret: "configured",
        directVerify: vi.fn(),
      }),
    ).toThrow(/gateway configuration/i);
  });
  it("binds the gateway HMAC through Firebase Secret Manager", () => {
    expect(functionsSource).toContain('defineSecret("ZALO_GATEWAY_HMAC_SECRET")');
    expect(functionsSource).toMatch(/secrets:\s*\[zaloAppSecret,\s*zaloGatewayHmacSecret\]/u);
    expect(envExample).toContain("ZALO_GATEWAY_HMAC_SECRET=managed-by-secret-manager");
  });
  it("fails closed when verifier mode is omitted", () => {
    expect(functionsSource).not.toContain('process.env.ZALO_VERIFIER_MODE || "direct"');
    expect(functionsSource).toContain('process.env.ZALO_VERIFIER_MODE || ""');
  });
  it("does not silently fallback to direct mode after gateway failure", async () => {
    const directVerify = vi.fn();
    const verifier = createZaloIdentityVerifier({
      mode: "gateway",
      gatewayUrl: "https://gateway.example.test",
      gatewayKeyId: "test-v1",
      gatewayHmacSecret: "11".repeat(32),
      zaloAppSecret: "configured",
      directVerify,
      fetchImpl: vi.fn().mockRejectedValue(new Error("network")),
    });
    await expect(
      verifier.verify({ accessToken: "token", requestId: "req_12345678" }),
    ).rejects.toBeDefined();
    expect(directVerify).not.toHaveBeenCalled();
  });
  it("rejects an oversized gateway response without falling back", async () => {
    const directVerify = vi.fn();
    const verifier = createZaloIdentityVerifier({
      mode: "gateway",
      gatewayUrl: "https://gateway.example.test",
      gatewayKeyId: "test-v1",
      gatewayHmacSecret: "11".repeat(32),
      zaloAppSecret: "configured",
      directVerify,
      fetchImpl: vi.fn().mockResolvedValue(new Response("x".repeat(8_193), { status: 200 })),
    });
    await expect(
      verifier.verify({ accessToken: "token", requestId: "req_oversize_123" }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_RESPONSE" });
    expect(directVerify).not.toHaveBeenCalled();
  });
});
