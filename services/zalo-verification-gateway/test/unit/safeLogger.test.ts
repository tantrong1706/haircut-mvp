import { describe, expect, it, vi } from "vitest";
import { createSafeLogger, redactSensitive } from "../../src/observability/safeLogger.js";

describe("safe gateway logger", () => {
  it("redacts sensitive keys recursively", () => {
    const redacted = redactSensitive({
      accessToken: "token-a",
      nested: {
        access_token: "token-b",
        appsecretProof: "proof-a",
        appsecret_proof: "proof-b",
        appSecret: "secret-a",
        authorization: "Bearer token",
        signature: "signature-a",
        "X-Signature": "header-signature",
        gatewayHmacSecret: "gateway-secret",
        secret: "secret-b",
        safe: "kept",
      },
    });
    const serialized = JSON.stringify(redacted);
    for (const value of ["token-a", "proof-a", "secret-a", "header-signature", "gateway-secret"])
      expect(serialized).not.toContain(value);
    expect(redacted).toMatchObject({ nested: { safe: "kept" } });
  });
  it("writes structured JSON without secret values", () => {
    const sink = vi.fn();
    createSafeLogger(sink).warn("verification_failed", {
      requestId: "req_12345678",
      accessToken: "never-log",
    });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0]?.[0]).not.toContain("never-log");
  });
});
