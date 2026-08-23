import { GatewayError } from "../errors.js";
import type { SafeLogger } from "../observability/safeLogger.js";

const PRODUCTION_UPSTREAM = "https://graph.zalo.me/v2.0/me";
const USER_ID_PATTERN = /^\d{1,64}$/u;
export type GatewayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ZaloClientOptions = {
  fetchImpl?: GatewayFetch;
  timeoutMs?: number;
  retryDelayMs?: number;
  random?: () => number;
  upstreamUrl?: string;
  allowInsecureTestUpstream?: boolean;
  logger?: SafeLogger;
};

type UpstreamDiagnosticInput = {
  status: number;
  record: Record<string, unknown> | null;
  fallbackMessage: string;
  accessToken: string;
  appsecretProof: string;
  requestId: string;
};

export class ZaloIdentityClient {
  private readonly fetchImpl: GatewayFetch;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly random: () => number;
  private readonly upstream: URL;
  private readonly logger?: SafeLogger;

  constructor(options: ZaloClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.retryDelayMs = options.retryDelayMs ?? 200;
    this.random = options.random ?? Math.random;
    this.logger = options.logger;
    this.upstream = validateUpstream(
      options.upstreamUrl ?? PRODUCTION_UPSTREAM,
      options.allowInsecureTestUpstream,
    );
  }

  async verify(input: { accessToken: string; appsecretProof: string; requestId: string }) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.attempt(input);
      } catch (error) {
        const normalized =
          error instanceof GatewayError ? error : new GatewayError("ZALO_UNAVAILABLE", 502);
        if (attempt === 2 || !isRetryable(normalized.code)) throw normalized;
        await delay(this.retryDelayMs * 2 ** (attempt - 1) + Math.floor(this.random() * 100));
      }
    }
    throw new GatewayError("ZALO_UNAVAILABLE", 502);
  }

  private async attempt(input: { accessToken: string; appsecretProof: string; requestId: string }) {
    const endpoint = new URL(this.upstream);
    endpoint.search = "";
    endpoint.searchParams.set("fields", "id");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "GET",
        redirect: "error",
        headers: {
          access_token: input.accessToken,
          appsecret_proof: input.appsecretProof,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        await this.logRejectedResponse(response, input);
      }
      if (response.status === 401 || response.status === 403) {
        throw new GatewayError("ZALO_INVALID_TOKEN", 401);
      }
      if (response.status === 429) throw new GatewayError("ZALO_RATE_LIMITED", 502);
      if (response.status === 408 || response.status >= 500) {
        throw new GatewayError("ZALO_UNAVAILABLE", 502);
      }
      if (!response.ok) throw new GatewayError("ZALO_INVALID_TOKEN", 401);

      const text = await readLimitedResponseBody(response, 8_192);
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new GatewayError("ZALO_INVALID_RESPONSE", 502);
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new GatewayError("ZALO_INVALID_RESPONSE", 502);
      }
      const record = payload as Record<string, unknown>;
      if (hasNonZeroUpstreamError(record)) {
        this.logUpstreamRejected({
          status: response.status,
          record,
          fallbackMessage: text,
          ...input,
        });
      }
      if (Number(record.error ?? 0) !== 0) throw new GatewayError("ZALO_INVALID_TOKEN", 401);
      if (typeof record.id !== "string" || !USER_ID_PATTERN.test(record.id)) {
        throw new GatewayError("ZALO_INVALID_RESPONSE", 502);
      }
      return { zaloUserId: record.id };
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      throw new GatewayError(
        controller.signal.aborted ? "ZALO_TIMEOUT" : "ZALO_UNAVAILABLE",
        controller.signal.aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async logRejectedResponse(
    response: Response,
    input: { accessToken: string; appsecretProof: string; requestId: string },
  ) {
    if (!this.logger) return;
    let text = "";
    let record: Record<string, unknown> | null = null;
    try {
      text = await readDiagnosticResponseBody(response.clone(), 8_192);
      record = parseDiagnosticPayload(text);
    } catch {
      text = "";
    }
    this.logUpstreamRejected({
      status: response.status,
      record,
      fallbackMessage: text,
      ...input,
    });
  }

  private logUpstreamRejected(input: UpstreamDiagnosticInput) {
    if (!this.logger) return;
    const zaloErrorCode = diagnosticErrorCode(input.record, input.status);
    const rawMessage = diagnosticMessage(input.record, input.fallbackMessage);
    const zaloMessage = sanitizeDiagnosticMessage(rawMessage, [
      input.accessToken,
      input.appsecretProof,
    ]);
    this.logger.warn("zalo_upstream_rejected", {
      requestId: input.requestId,
      httpStatus: input.status,
      zaloErrorCode,
      zaloMessage,
    });
  }
}

async function readLimitedResponseBody(response: Response, maximumBytes: number) {
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
      if (size > maximumBytes) throw new GatewayError("ZALO_INVALID_RESPONSE", 502);
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError("ZALO_INVALID_RESPONSE", 502);
  } finally {
    if (size > maximumBytes) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function readDiagnosticResponseBody(response: Response, maximumBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maximumBytes - size;
      if (remaining <= 0) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      size += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (value.byteLength > remaining) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseDiagnosticPayload(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function hasNonZeroUpstreamError(record: Record<string, unknown>) {
  for (const value of [record.error, record.error_code]) {
    if (value === undefined || value === null || value === "") continue;
    const numeric = Number(value);
    if ((Number.isFinite(numeric) && numeric !== 0) || (!Number.isFinite(numeric) && String(value))) {
      return true;
    }
  }
  return false;
}

function diagnosticErrorCode(record: Record<string, unknown> | null, status: number) {
  const value = record?.error ?? record?.error_code;
  return typeof value === "string" || typeof value === "number" ? String(value) : `http-${status}`;
}

function diagnosticMessage(record: Record<string, unknown> | null, fallback: string) {
  const value = record?.message ?? record?.error_message;
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function sanitizeDiagnosticMessage(value: string, secrets: string[]) {
  let message = String(value || "Zalo upstream rejected request");
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  message = message.replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ");
  message = message.replace(/\s+/gu, " ").trim();
  return (message || "Zalo upstream rejected request").slice(0, 300);
}

function validateUpstream(value: string, allowInsecureTestUpstream = false) {
  const url = new URL(value);
  const isProduction =
    url.protocol === "https:" && url.hostname === "graph.zalo.me" && url.pathname === "/v2.0/me";
  const isLocalTest =
    allowInsecureTestUpstream &&
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname);
  if (!isProduction && !isLocalTest) throw new Error("Zalo upstream is not allowed");
  return url;
}
function isRetryable(code: string) {
  return ["ZALO_TIMEOUT", "ZALO_RATE_LIMITED", "ZALO_UNAVAILABLE"].includes(code);
}
function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
