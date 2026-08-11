import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCanonicalRequest,
  sha256Hex,
  signCanonicalRequest,
  verifyCanonicalSignature,
} from "../../src/security/signature.js";

const fixture = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../../test/fixtures/zalo-gateway-signature.json"),
    "utf8",
  ),
) as Record<string, string>;

describe("gateway signature contract", () => {
  it("matches the shared deterministic fixture", () => {
    expect(sha256Hex(Buffer.from(fixture.body))).toBe(fixture.bodySha256);
    expect(buildCanonicalRequest({
      method: fixture.method,
      path: fixture.path,
      timestamp: fixture.timestamp,
      nonce: fixture.nonce,
      requestId: fixture.requestId,
      bodySha256: fixture.bodySha256,
    })).toBe(fixture.canonical);
    expect(signCanonicalRequest(fixture.canonical, fixture.hmacKeyHex)).toBe(fixture.signature);
    expect(verifyCanonicalSignature(fixture.canonical, fixture.signature, fixture.hmacKeyHex)).toBe(true);
  });

  it("rejects malformed and wrong-length signatures without throwing", () => {
    expect(verifyCanonicalSignature(fixture.canonical, "abcd", fixture.hmacKeyHex)).toBe(false);
    expect(verifyCanonicalSignature(fixture.canonical, "z".repeat(64), fixture.hmacKeyHex)).toBe(false);
  });
});
