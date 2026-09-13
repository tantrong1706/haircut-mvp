import { describe, expect, it } from "vitest";
import { loadGatewayConfig, parseHmacKeys } from "../../src/config.js";

describe("gateway configuration", () => {
  it("accepts current and previous HMAC keys for rotation", () => {
    const keys = parseHmacKeys(
      JSON.stringify({
        "current-v2": "11".repeat(32),
        "previous-v1": "22".repeat(32),
      }),
    );
    expect([...keys.keys()]).toEqual(["current-v2", "previous-v1"]);
  });

  it.each([
    ["not-json"],
    [JSON.stringify({ weak: "aa" })],
    [JSON.stringify({ "bad key": "11".repeat(32) })],
  ])("rejects invalid key configuration", (value) => {
    expect(() => parseHmacKeys(value)).toThrow();
  });

  it("fails closed without keys and rejects a caller-controlled upstream", () => {
    expect(() => loadGatewayConfig({})).toThrow("GATEWAY_HMAC_KEYS is required");
    expect(() =>
      loadGatewayConfig({
        GATEWAY_HMAC_KEYS: JSON.stringify({ current: "11".repeat(32) }),
        ZALO_UPSTREAM_URL: "https://example.com/steal",
      }),
    ).toThrow("fixed Zalo identity endpoint");
  });
});
