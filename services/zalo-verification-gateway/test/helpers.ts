import { createHmac, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { buildCanonicalRequest, sha256Hex } from "../src/security/signature.js";
import type { GatewayApplication } from "../src/app.js";

export function signedHeaders(
  body: Buffer,
  options: {
    keyId?: string;
    keyHex?: string;
    timestamp?: string;
    nonce?: string;
    requestId?: string;
    method?: string;
    path?: string;
  } = {},
) {
  const keyId = options.keyId ?? "test-v1";
  const keyHex = options.keyHex ?? "11".repeat(32);
  const timestamp = options.timestamp ?? String(Date.now());
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const requestId = options.requestId ?? "req_test_12345678";
  const bodySha256 = sha256Hex(body);
  const canonical = buildCanonicalRequest({
    method: options.method ?? "POST",
    path: options.path ?? "/v1/zalo/verify",
    timestamp,
    nonce,
    requestId,
    bodySha256,
  });
  return {
    "content-type": "application/json",
    "x-key-id": keyId,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-request-id": requestId,
    "x-body-sha256": bodySha256,
    "x-signature": createHmac("sha256", Buffer.from(keyHex, "hex")).update(canonical).digest("hex"),
  };
}
export async function listen(application: GatewayApplication) {
  await new Promise<void>((resolve) => application.server.listen(0, "127.0.0.1", resolve));
  const address = application.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}
