import { createHash, createHmac, randomBytes } from "node:crypto";

export type ZaloIdentityInput = { accessToken: string; requestId: string };
export type ZaloIdentityResult = { zaloUserId: string };
export interface ZaloIdentityVerifier {
  verify(input: ZaloIdentityInput): Promise<ZaloIdentityResult>;
}

type GatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
type DirectVerify = (input: ZaloIdentityInput) => Promise<ZaloIdentityResult>;

export class DirectZaloVerifier implements ZaloIdentityVerifier {
  constructor(private readonly directVerify: DirectVerify) {}
  verify(input: ZaloIdentityInput) {
    return this.directVerify(input);
  }
}

export class ZaloGatewayVerificationError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string,
  ) {
    super(code);
    this.name = "ZaloGatewayVerificationError";
  }
}

export class VietnamGatewayVerifier implements ZaloIdentityVerifier {
  private readonly endpoint: URL;
  private readonly fetchImpl: GatewayFetch;
  private readonly now: () => number;
  private readonly nonce: () => string;
  private readonly createProof: (accessToken: string, appSecret: string) => string;

  constructor(
    private readonly options: {
      gatewayUrl: string;
      keyId: string;
      hmacKeyHex: string;
      zaloAppSecret: string;
      fetchImpl?: GatewayFetch;
      now?: () => number;
      nonce?: () => string;
      createProof?: (accessToken: string, appSecret: string) => string;
      allowInsecureLocalhost?: boolean;
    },
  ) {
    this.endpoint = gatewayEndpoint(options.gatewayUrl, options.allowInsecureLocalhost);
    validateKey(options.hmacKeyHex);
    if (!options.keyId || !options.zaloAppSecret) throw new Error("Missing gateway configuration");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.nonce = options.nonce ?? (() => randomBytes(16).toString("hex"));
    this.createProof =
      options.createProof ??
      ((accessToken, appSecret) =>
        createHmac("sha256", appSecret).update(accessToken).digest("hex"));
  }

  async verify(input: ZaloIdentityInput) {
    const signed = createZaloGatewaySignedRequest({
      accessToken: input.accessToken,
      appsecretProof: this.createProof(input.accessToken, this.options.zaloAppSecret),
      requestId: input.requestId,
      keyId: this.options.keyId,
      hmacKeyHex: this.options.hmacKeyHex,
      timestamp: String(this.now()),
      nonce: this.nonce(),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        redirect: "error",
        headers: signed.headers,
        body: signed.body,
        signal: controller.signal,
      });
      const payload = await parseGatewayResponse(response, input.requestId);
      if (!response.ok || payload.ok !== true) {
        throw new ZaloGatewayVerificationError(
          typeof payload.code === "string" ? payload.code : "ZALO_UNAVAILABLE",
          input.requestId,
        );
      }
      if (
        payload.requestId !== input.requestId ||
        typeof payload.zaloUserId !== "string" ||
        !/^\d{1,64}$/u.test(payload.zaloUserId)
      ) {
        throw new ZaloGatewayVerificationError("ZALO_INVALID_RESPONSE", input.requestId);
      }
      return { zaloUserId: payload.zaloUserId };
    } catch (error) {
      if (error instanceof ZaloGatewayVerificationError) throw error;
      throw new ZaloGatewayVerificationError(
        controller.signal.aborted ? "ZALO_TIMEOUT" : "ZALO_UNAVAILABLE",
        input.requestId,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createZaloIdentityVerifier(options: {
  mode: string;
  gatewayUrl?: string;
  gatewayKeyId?: string;
  gatewayHmacSecret?: string;
  zaloAppSecret: string;
  directVerify: DirectVerify;
  fetchImpl?: GatewayFetch;
}) {
  if (options.mode === "direct") return new DirectZaloVerifier(options.directVerify);
  if (options.mode !== "gateway") throw new Error("Unsupported ZALO_VERIFIER_MODE");
  if (!options.gatewayUrl || !options.gatewayKeyId || !options.gatewayHmacSecret) {
    throw new Error("Missing gateway configuration");
  }
  return new VietnamGatewayVerifier({
    gatewayUrl: options.gatewayUrl,
    keyId: options.gatewayKeyId,
    hmacKeyHex: options.gatewayHmacSecret,
    zaloAppSecret: options.zaloAppSecret,
    fetchImpl: options.fetchImpl,
  });
}

export function createZaloGatewaySignedRequest(input: {
  accessToken: string;
  appsecretProof: string;
  requestId: string;
  keyId: string;
  hmacKeyHex: string;
  timestamp: string;
  nonce: string;
}) {
  const body = JSON.stringify({
    accessToken: input.accessToken,
    appsecretProof: input.appsecretProof,
    requestId: input.requestId,
  });
  const bodySha256 = createHash("sha256").update(Buffer.from(body)).digest("hex");
  const canonical = [
    "POST",
    "/v1/zalo/verify",
    input.timestamp,
    input.nonce,
    input.requestId,
    bodySha256,
  ].join("\n");
  const signature = createHmac("sha256", Buffer.from(input.hmacKeyHex, "hex"))
    .update(canonical)
    .digest("hex");
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "X-Key-Id": input.keyId,
      "X-Timestamp": input.timestamp,
      "X-Nonce": input.nonce,
      "X-Request-Id": input.requestId,
      "X-Body-SHA256": bodySha256,
      "X-Signature": signature,
    },
  };
}

function gatewayEndpoint(value: string, allowInsecureLocalhost = false) {
  const base = new URL(value);
  const localAllowed =
    allowInsecureLocalhost &&
    base.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(base.hostname);
  if ((base.protocol !== "https:" && !localAllowed) || base.username || base.password) {
    throw new Error("Gateway URL must use HTTPS");
  }
  base.pathname = "/v1/zalo/verify";
  base.search = "";
  base.hash = "";
  return base;
}
function validateKey(value: string) {
  if (!/^(?:[a-f0-9]{2}){32,}$/u.test(value)) throw new Error("Invalid gateway HMAC key");
}
async function parseGatewayResponse(response: Response, requestId: string) {
  const text = await readLimitedGatewayResponse(response, requestId);
  try {
    const payload = JSON.parse(text) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return payload as Record<string, unknown>;
  } catch {
    throw new ZaloGatewayVerificationError("ZALO_INVALID_RESPONSE", requestId);
  }
}

async function readLimitedGatewayResponse(response: Response, requestId: string) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_192) {
        throw new ZaloGatewayVerificationError("ZALO_INVALID_RESPONSE", requestId);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof ZaloGatewayVerificationError) throw error;
    throw new ZaloGatewayVerificationError("ZALO_INVALID_RESPONSE", requestId);
  } finally {
    if (size > 8_192) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
