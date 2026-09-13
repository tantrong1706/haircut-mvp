import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type CanonicalRequest = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  requestId: string;
  bodySha256: string;
};

export function buildCanonicalRequest(input: CanonicalRequest) {
  return [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    input.requestId,
    input.bodySha256,
  ].join("\n");
}

export function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

export function signCanonicalRequest(canonical: string, hmacKeyHex: string) {
  return createHmac("sha256", decodeHmacKey(hmacKeyHex)).update(canonical).digest("hex");
}

export function verifyCanonicalSignature(
  canonical: string,
  signatureHex: string,
  hmacKeyHex: string,
) {
  if (!/^[a-f0-9]{64}$/u.test(signatureHex)) return false;
  let provided: Buffer;
  let expected: Buffer;
  try {
    provided = Buffer.from(signatureHex, "hex");
    expected = Buffer.from(signCanonicalRequest(canonical, hmacKeyHex), "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function safeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function decodeHmacKey(hmacKeyHex: string) {
  if (!/^(?:[a-f0-9]{2}){32,}$/u.test(hmacKeyHex)) {
    throw new Error("Gateway HMAC keys must be hexadecimal and at least 32 bytes");
  }
  return Buffer.from(hmacKeyHex, "hex");
}
