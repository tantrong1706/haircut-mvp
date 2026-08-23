import { describe, expect, it, vi } from "vitest";
import { createSafeLogger } from "../../src/observability/safeLogger.js";
import { ZaloIdentityClient, type GatewayFetch } from "../../src/zalo/zaloIdentityClient.js";

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
describe("ZaloIdentityClient", () => {
  it("accepts only a valid user id and sends fixed Zalo headers", async () => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ id: "123456789" }));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(
      client.verify({
        accessToken: "token",
        appsecretProof: "a".repeat(64),
        requestId: "req_12345678",
      }),
    ).resolves.toEqual({ zaloUserId: "123456789" });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://graph.zalo.me/v2.0/me?fields=id");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { access_token: "token", appsecret_proof: "a".repeat(64) },
    });
  });
  it.each([
    [408, "ZALO_UNAVAILABLE"],
    [429, "ZALO_RATE_LIMITED"],
    [500, "ZALO_UNAVAILABLE"],
    [503, "ZALO_UNAVAILABLE"],
  ] as const)("retries status %s at most once", async (status, code) => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ error: status }, status));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(
      client.verify({
        accessToken: "token",
        appsecretProof: "a".repeat(64),
        requestId: "req_12345678",
      }),
    ).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("does not retry an invalid token", async () => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ error: -201 }, 401));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(
      client.verify({
        accessToken: "token",
        appsecretProof: "a".repeat(64),
        requestId: "req_12345678",
      }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_TOKEN" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("logs sanitized diagnostics for a rejected HTTP response", async () => {
    const lines: string[] = [];
    const accessToken = "sensitive-access-token";
    const appsecretProof = "b".repeat(64);
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(
      response(
        {
          error: -201,
          message: `Denied ${accessToken}\r\nproof=${appsecretProof}`,
        },
        401,
      ),
    );
    const client = new ZaloIdentityClient({
      fetchImpl,
      retryDelayMs: 0,
      logger: createSafeLogger((line) => lines.push(line)),
    });

    await expect(
      client.verify({ accessToken, appsecretProof, requestId: "req_diag_12345678" }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_TOKEN" });

    const diagnostic = JSON.parse(lines.find((line) => line.includes("zalo_upstream_rejected"))!);
    expect(diagnostic).toMatchObject({
      event: "zalo_upstream_rejected",
      requestId: "req_diag_12345678",
      httpStatus: 401,
      zaloErrorCode: "-201",
    });
    expect(diagnostic.zaloMessage).toBe("Denied [redacted] proof=[redacted]");
    expect(diagnostic.zaloMessage.length).toBeLessThanOrEqual(300);
    expect(JSON.stringify(diagnostic)).not.toContain(accessToken);
    expect(JSON.stringify(diagnostic)).not.toContain(appsecretProof);
  });
  it("logs a non-zero error_code from a successful HTTP response without changing the public error", async () => {
    const lines: string[] = [];
    const fetchImpl = vi
      .fn<GatewayFetch>()
      .mockResolvedValue(response({ error_code: -501, message: "Policy rejected" }, 200));
    const client = new ZaloIdentityClient({
      fetchImpl,
      retryDelayMs: 0,
      logger: createSafeLogger((line) => lines.push(line)),
    });

    await expect(
      client.verify({
        accessToken: "token",
        appsecretProof: "a".repeat(64),
        requestId: "req_diag_87654321",
      }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_RESPONSE" });

    const diagnostic = JSON.parse(lines.find((line) => line.includes("zalo_upstream_rejected"))!);
    expect(diagnostic).toMatchObject({
      event: "zalo_upstream_rejected",
      requestId: "req_diag_87654321",
      httpStatus: 200,
      zaloErrorCode: "-501",
      zaloMessage: "Policy rejected",
    });
  });
  it.each([["not-json"], [{ error: 0 }], [{ id: { nested: true } }]])(
    "rejects malformed or missing identity: %j",
    async (payload) => {
      const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response(payload));
      const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
      await expect(
        client.verify({
          accessToken: "token",
          appsecretProof: "a".repeat(64),
          requestId: "req_12345678",
        }),
      ).rejects.toMatchObject({ code: "ZALO_INVALID_RESPONSE" });
    },
  );
  it("rejects an oversized upstream response while streaming", async () => {
    const client = new ZaloIdentityClient({
      fetchImpl: async () => new Response("x".repeat(8_193), { status: 200 }),
      retryDelayMs: 0,
    });
    await expect(
      client.verify({
        accessToken: "token",
        appsecretProof: "a".repeat(64),
        requestId: "req_12345678",
      }),
    ).rejects.toMatchObject({ code: "ZALO_INVALID_RESPONSE" });
  });
});
