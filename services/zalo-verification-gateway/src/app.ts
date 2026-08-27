import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { GatewayError, toGatewayError, type GatewayErrorCode } from "./errors.js";
import { createSafeLogger, type SafeLogger } from "./observability/safeLogger.js";
import type { ReplayStore } from "./replay/replayStore.js";
import { ConcurrencyGuard, TokenBucketRateLimiter } from "./security/rateLimiter.js";
import {
  buildCanonicalRequest,
  safeHexEqual,
  sha256Hex,
  verifyCanonicalSignature,
} from "./security/signature.js";
import { ZaloIdentityClient, type GatewayFetch } from "./zalo/zaloIdentityClient.js";

const VERIFY_PATH = "/v1/zalo/verify";
const REQUEST_TOLERANCE_MS = 60_000;
const REPLAY_TTL_MS = 120_000;
const NONCE_PATTERN = /^[a-f0-9]{32,128}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;

export type GatewayApplication = {
  server: Server;
  close(): Promise<void>;
};
export type GatewayApplicationOptions = {
  keys: Map<string, string>;
  replayStore: ReplayStore;
  logger?: SafeLogger;
  fetchImpl?: GatewayFetch;
  now?: () => number;
  requestMaxBytes?: number;
  maxConcurrency?: number;
  upstreamUrl?: string;
  allowInsecureTestUpstream?: boolean;
  upstreamTimeoutMs?: number;
  upstreamRetryDelayMs?: number;
  version?: string;
};

export function createGatewayApplication(options: GatewayApplicationOptions): GatewayApplication {
  const logger = options.logger ?? createSafeLogger();
  const now = options.now ?? Date.now;
  const requestMaxBytes = Math.min(options.requestMaxBytes ?? 8_192, 8_192);
  const preAuthRateLimiter = new TokenBucketRateLimiter({ refillPerSecond: 10, capacity: 60 });
  const rateLimiter = new TokenBucketRateLimiter({ refillPerSecond: 20, capacity: 50 });
  const concurrency = new ConcurrencyGuard(options.maxConcurrency ?? 100);
  const appStartedAt = now();
  const zalo = new ZaloIdentityClient({
    fetchImpl: options.fetchImpl,
    upstreamUrl: options.upstreamUrl,
    allowInsecureTestUpstream: options.allowInsecureTestUpstream,
    timeoutMs: options.upstreamTimeoutMs,
    retryDelayMs: options.upstreamRetryDelayMs,
  });

  const server = createServer(async (request, response) => {
    applySecurityHeaders(response);
    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        status: "ok",
        version: options.version ?? "development",
        uptime: Math.max(0, Math.floor((now() - appStartedAt) / 1_000)),
      });
      return;
    }
    if (request.url !== VERIFY_PATH) {
      sendFailure(response, 404, "BAD_REQUEST", safeRequestId(request.headers["x-request-id"]));
      return;
    }
    if (request.method !== "POST") {
      sendFailure(response, 405, "BAD_REQUEST", safeRequestId(request.headers["x-request-id"]));
      return;
    }
    if (!isJsonContentType(request.headers["content-type"])) {
      sendFailure(response, 415, "BAD_REQUEST", safeRequestId(request.headers["x-request-id"]));
      return;
    }

    const requestStartedAt = now();
    let requestId = safeRequestId(request.headers["x-request-id"]);
    let entered = false;
    try {
      if (!preAuthRateLimiter.tryAcquire(clientRateLimitKey(request), now())) {
        throw new GatewayError("RATE_LIMITED", 429);
      }
      const rawBody = await readRawBody(request, requestMaxBytes);
      const authentication = authenticateRequest(request, rawBody, options.keys, now());
      requestId = authentication.requestId;
      if (!rateLimiter.tryAcquire(authentication.keyId, now())) {
        throw new GatewayError("RATE_LIMITED", 429);
      }
      if (
        !options.replayStore.claim(
          authentication.keyId,
          authentication.nonce,
          now() + REPLAY_TTL_MS,
          now(),
        )
      ) {
        throw new GatewayError("REPLAY_DETECTED", 409);
      }
      const payload = parseBody(rawBody, authentication.requestId);
      entered = concurrency.tryEnter();
      if (!entered) throw new GatewayError("RATE_LIMITED", 429);
      logger.info("zalo_verification_started", { requestId, operation: "verify" });
      const result = await zalo.verify({ ...payload, requestId });
      logger.info("zalo_verification_completed", {
        requestId,
        operation: "verify",
        outcome: "success",
        durationMs: Math.max(0, now() - requestStartedAt),
      });
      sendJson(response, 200, { ok: true, zaloUserId: result.zaloUserId, requestId });
    } catch (error) {
      const normalized = toGatewayError(error);
      logger.warn("zalo_verification_failed", {
        requestId,
        operation: "verify",
        outcome: "failure",
        errorCode: normalized.code,
        durationMs: Math.max(0, now() - requestStartedAt),
      });
      sendFailure(response, normalized.status, normalized.code, requestId);
    } finally {
      if (entered) concurrency.leave();
    }
  });
  server.headersTimeout = 5_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5_000;

  return {
    server,
    close: async () => {
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          const forceClose = setTimeout(() => server.closeAllConnections(), 10_000);
          forceClose.unref();
          server.close((error) => {
            clearTimeout(forceClose);
            if (error) reject(error);
            else resolve();
          });
        });
      }
      options.replayStore.close();
    },
  };
}

function clientRateLimitKey(request: IncomingMessage) {
  const remoteAddress = normalizeAddress(request.socket.remoteAddress);
  const cloudflareAddress = request.headers["cf-connecting-ip"];
  if (
    (remoteAddress === "127.0.0.1" || remoteAddress === "::1") &&
    typeof cloudflareAddress === "string" &&
    isIP(cloudflareAddress) !== 0
  ) {
    return `cf:${cloudflareAddress}`;
  }
  return `peer:${remoteAddress || "unknown"}`;
}

function normalizeAddress(value: string | undefined) {
  return value?.startsWith("::ffff:") ? value.slice(7) : value;
}

function isJsonContentType(value: string | string[] | undefined) {
  return typeof value === "string" && /^application\/json(?:\s*;.*)?$/iu.test(value);
}

function authenticateRequest(
  request: IncomingMessage,
  body: Buffer,
  keys: Map<string, string>,
  nowMs: number,
) {
  const keyId = requiredHeader(request, "x-key-id");
  const timestamp = requiredHeader(request, "x-timestamp");
  const nonce = requiredHeader(request, "x-nonce");
  const requestId = requiredHeader(request, "x-request-id");
  const bodySha256 = requiredHeader(request, "x-body-sha256");
  const signature = requiredHeader(request, "x-signature");
  if (!KEY_ID_PATTERN.test(keyId) || !keys.has(keyId)) throw new GatewayError("AUTH_INVALID", 401);
  if (!/^\d{13}$/u.test(timestamp)) throw new GatewayError("REQUEST_EXPIRED", 401);
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > REQUEST_TOLERANCE_MS) {
    throw new GatewayError("REQUEST_EXPIRED", 401);
  }
  if (!NONCE_PATTERN.test(nonce) || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new GatewayError("AUTH_INVALID", 401);
  }
  const actualHash = sha256Hex(body);
  if (!safeHexEqual(bodySha256, actualHash)) throw new GatewayError("AUTH_INVALID", 401);
  const canonical = buildCanonicalRequest({
    method: request.method ?? "",
    path: new URL(request.url ?? "/", "http://gateway.internal").pathname,
    timestamp,
    nonce,
    requestId,
    bodySha256,
  });
  if (!verifyCanonicalSignature(canonical, signature, keys.get(keyId)!)) {
    throw new GatewayError("AUTH_INVALID", 401);
  }
  return { keyId, nonce, requestId };
}

function parseBody(body: Buffer, expectedRequestId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw new GatewayError("BAD_REQUEST", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GatewayError("BAD_REQUEST", 400);
  }
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "accessToken,appsecretProof,requestId") {
    throw new GatewayError("BAD_REQUEST", 400);
  }
  if (
    typeof record.accessToken !== "string" ||
    record.accessToken.length < 1 ||
    record.accessToken.length > 4_096 ||
    typeof record.appsecretProof !== "string" ||
    !/^[a-f0-9]{64}$/u.test(record.appsecretProof) ||
    record.requestId !== expectedRequestId
  ) {
    throw new GatewayError("BAD_REQUEST", 400);
  }
  return { accessToken: record.accessToken, appsecretProof: record.appsecretProof };
}

async function readRawBody(request: IncomingMessage, maximumBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(buffer);
  }
  if (tooLarge) throw new GatewayError("BAD_REQUEST", 413);
  return Buffer.concat(chunks);
}

function requiredHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (typeof value !== "string") throw new GatewayError("AUTH_INVALID", 401);
  return value;
}
function safeRequestId(value: string | string[] | undefined) {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value) ? value : "unavailable";
}
function applySecurityHeaders(response: ServerResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}
function sendFailure(
  response: ServerResponse,
  status: number,
  code: GatewayErrorCode,
  requestId: string,
) {
  sendJson(response, status, { ok: false, code, requestId });
}
function sendJson(response: ServerResponse, status: number, body: object) {
  if (response.headersSent || response.destroyed) return;
  response.statusCode = status;
  response.end(JSON.stringify(body));
}
