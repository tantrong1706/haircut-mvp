export type ZaloFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type ZaloRequestCategory =
  | "IP_POLICY_BLOCKED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "UPSTREAM_REJECTED";

export type ZaloAttemptEvent = {
  attempt: number;
  maxAttempts: number;
  status: number | "network-error";
  errorCode: string | number;
  category: ZaloRequestCategory;
  retryable: boolean;
};

export class ZaloRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | "network-error",
    readonly errorCode: string | number,
    readonly category: ZaloRequestCategory = "UPSTREAM_REJECTED",
    readonly retryable = false,
    readonly attempt = 1,
  ) {
    super(message);
    this.name = "ZaloRequestError";
  }
}

export async function fetchZaloJson(
  endpoint: URL,
  headers: Record<string, string>,
  options: {
    fetchImpl?: ZaloFetch;
    timeoutMs?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    random?: () => number;
    onAttemptFailure?: (event: ZaloAttemptEvent) => void;
  } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.max(100, options.timeoutMs ?? 7_000);
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  const random = options.random ?? Math.random;
  const onAttemptFailure = options.onAttemptFailure;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await fetchImpl(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      const timedOut = controller.signal.aborted;
      const category: ZaloRequestCategory = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
      const errorCode = timedOut ? "timeout" : "network-error";
      onAttemptFailure?.({
        attempt,
        maxAttempts,
        status: "network-error",
        errorCode,
        category,
        retryable: true,
      });
      if (attempt < maxAttempts) {
        await delay(retryDelay(retryDelayMs, attempt, random));
        continue;
      }

      throw new ZaloRequestError(
        controller.signal.aborted
          ? "Zalo phản hồi quá chậm. Vui lòng thử lại."
          : "Không kết nối được Zalo. Vui lòng thử lại.",
        "network-error",
        errorCode,
        category,
        true,
        attempt,
      );
    }

    clearTimeout(timeout);
    let payload: Record<string, unknown>;
    try {
      const parsed = (await response.json()) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("invalid json object");
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      const retryable = isRetryableStatus(response.status);
      onAttemptFailure?.({
        attempt,
        maxAttempts,
        status: response.status,
        errorCode: "invalid-json",
        category: "INVALID_RESPONSE",
        retryable,
      });
      if (attempt < maxAttempts && retryable) {
        await delay(retryDelay(retryDelayMs, attempt, random));
        continue;
      }
      throw new ZaloRequestError(
        "Zalo trả về dữ liệu không hợp lệ. Vui lòng thử lại.",
        response.status,
        "invalid-json",
        "INVALID_RESPONSE",
        retryable,
        attempt,
      );
    }

    const errorCode = String(payload.error ?? payload.error_code ?? `http-${response.status}`);
    if (!response.ok) {
      const message = String(payload.message ?? "Zalo chưa xác minh được tài khoản. Vui lòng thử lại.");
      const category = classifyZaloRequestFailure(message);
      const retryable = category !== "IP_POLICY_BLOCKED" && isRetryableStatus(response.status);
      onAttemptFailure?.({
        attempt,
        maxAttempts,
        status: response.status,
        errorCode,
        category,
        retryable,
      });
      if (attempt < maxAttempts && retryable) {
        await delay(retryDelay(retryDelayMs, attempt, random));
        continue;
      }
      throw new ZaloRequestError(
        message,
        response.status,
        errorCode,
        category,
        retryable,
        attempt,
      );
    }

    return { payload, status: response.status, errorCode, attempt };
  }

  throw new ZaloRequestError(
    "Không kết nối được Zalo. Vui lòng thử lại.",
    "network-error",
    "network-error",
    "NETWORK_ERROR",
    true,
    maxAttempts,
  );
}

export function classifyZaloRequestFailure(message: unknown): ZaloRequestCategory {
  const normalized = String(message || "").toLowerCase();
  if (
    normalized.includes("personal information is limited") &&
    normalized.includes("ip address") &&
    normalized.includes("not inside vietnam")
  ) {
    return "IP_POLICY_BLOCKED";
  }
  return "UPSTREAM_REJECTED";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function retryDelay(baseDelayMs: number, attempt: number, random: () => number) {
  if (baseDelayMs === 0) {
    return 0;
  }
  const randomValue = Math.min(Math.max(random(), 0), 0.999999);
  return baseDelayMs * attempt + Math.floor(randomValue * 150);
}
