import { decodeHmacKey } from "./security/signature.js";

export type GatewayConfig = {
  port: number;
  keys: Map<string, string>;
  replayDbPath: string;
  requestMaxBytes: number;
  upstreamUrl?: string;
  version: string;
};

export function loadGatewayConfig(environment: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const port = parseInteger(environment.PORT, 3_000, 1, 65_535);
  const requestMaxBytes = parseInteger(environment.REQUEST_MAX_BYTES, 8_192, 1_024, 8_192);
  const replayDbPath = environment.REPLAY_DB_PATH?.trim() || "/var/lib/zalo-gateway/replay.db";
  const keys = parseHmacKeys(environment.GATEWAY_HMAC_KEYS);
  if (keys.size === 0) throw new Error("GATEWAY_HMAC_KEYS is required");
  const upstreamUrl = environment.ZALO_UPSTREAM_URL?.trim() || undefined;
  if (upstreamUrl && upstreamUrl !== "https://graph.zalo.me/v2.0/me") {
    throw new Error("ZALO_UPSTREAM_URL must be the fixed Zalo identity endpoint");
  }
  const version = environment.GATEWAY_VERSION?.trim() || "unknown";
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(version)) throw new Error("Invalid GATEWAY_VERSION");
  return { port, keys, replayDbPath, requestMaxBytes, upstreamUrl, version };
}

export function parseHmacKeys(raw: string | undefined) {
  if (!raw) return new Map<string, string>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GATEWAY_HMAC_KEYS must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("GATEWAY_HMAC_KEYS must be a JSON object");
  }
  const keys = new Map<string, string>();
  for (const [keyId, keyHex] of Object.entries(parsed)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/u.test(keyId) || typeof keyHex !== "string") {
      throw new Error("Invalid gateway key entry");
    }
    decodeHmacKey(keyHex);
    keys.set(keyId, keyHex);
  }
  return keys;
}

function parseInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (!raw) return fallback;
  if (!/^\d+$/u.test(raw)) throw new Error("Invalid numeric environment value");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error("Numeric environment value is outside the allowed range");
  }
  return value;
}
