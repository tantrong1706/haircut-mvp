import { describe, expect, it, vi } from "vitest";
import { GatewayError } from "../../src/errors.js";
import { ZaloIdentityClient, type GatewayFetch } from "../../src/zalo/zaloIdentityClient.js";

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}
describe("ZaloIdentityClient", () => {
  it("accepts only a valid user id and sends fixed Zalo headers", async () => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ id: "123456789" }));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(client.verify({ accessToken: "token", appsecretProof: "a".repeat(64), requestId: "req_12345678" }))
      .resolves.toEqual({ zaloUserId: "123456789" });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://graph.zalo.me/v2.0/me?fields=id");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "GET", redirect: "error",
      headers: { access_token: "token", appsecret_proof: "a".repeat(64) },
    });
  });
  it.each([[408, "ZALO_UNAVAILABLE"], [429, "ZALO_RATE_LIMITED"], [500, "ZALO_UNAVAILABLE"], [503, "ZALO_UNAVAILABLE"]] as const)
  ("retries status %s at most once", async (status, code) => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ error: status }, status));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(client.verify({ accessToken: "token", appsecretProof: "a".repeat(64), requestId: "req_12345678" }))
      .rejects.toMatchObject<Partial<GatewayError>>({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("does not retry an invalid token", async () => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response({ error: -201 }, 401));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(client.verify({ accessToken: "token", appsecretProof: "a".repeat(64), requestId: "req_12345678" }))
      .rejects.toMatchObject<Partial<GatewayError>>({ code: "ZALO_INVALID_TOKEN" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([["not-json"], [{ error: 0 }], [{ id: { nested: true } }]])
  ("rejects malformed or missing identity: %j", async (payload) => {
    const fetchImpl = vi.fn<GatewayFetch>().mockResolvedValue(response(payload));
    const client = new ZaloIdentityClient({ fetchImpl, retryDelayMs: 0 });
    await expect(client.verify({ accessToken: "token", appsecretProof: "a".repeat(64), requestId: "req_12345678" }))
      .rejects.toMatchObject<Partial<GatewayError>>({ code: "ZALO_INVALID_RESPONSE" });
  });
});
