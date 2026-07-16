import { createHash, timingSafeEqual } from "node:crypto";

const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;

export type ZaloPrivacyEvent = {
  appId: string;
  userId: string;
  eventName: "user.revoke.consent";
  timestamp: string;
};

export type ZaloPrivacyProcessingResult = {
  duplicate: boolean;
  jobCount: number;
};

type WebhookRequest = {
  method: string;
  rawBody?: Uint8Array;
  get(name: string): string | undefined;
};

type WebhookResponse = {
  status(code: number): WebhookResponse;
  set(name: string, value: string): WebhookResponse;
  json(body: unknown): unknown;
};

type WebhookDependencies = {
  miniAppId: string;
  apiKey: string;
  processEvent(event: ZaloPrivacyEvent, eventId: string): Promise<ZaloPrivacyProcessingResult>;
};

class WebhookError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function requiredString(body: Record<string, unknown>, field: string, maxLength = 128): string {
  const value = typeof body[field] === "string" ? body[field].trim() : "";
  if (!value || value.length > maxLength) {
    throw new WebhookError(400, "invalid_payload");
  }
  return value;
}

function requiredTimestamp(body: Record<string, unknown>): string {
  const value = body.timestamp;
  const timestamp = typeof value === "number" || typeof value === "string" ? String(value) : "";
  if (!/^\d{10,16}$/.test(timestamp)) {
    throw new WebhookError(400, "invalid_payload");
  }
  return timestamp;
}

function parsePayload(rawBody: string): Record<string, unknown> {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new WebhookError(400, "invalid_payload");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new WebhookError(400, "invalid_payload");
  }

  return body as Record<string, unknown>;
}

function parseEvent(body: Record<string, unknown>): ZaloPrivacyEvent {
  const eventName = requiredString(body, "event", 64);
  if (eventName !== "user.revoke.consent") {
    throw new WebhookError(400, "invalid_payload");
  }

  return {
    appId: requiredString(body, "appId"),
    userId: requiredString(body, "userId"),
    eventName,
    timestamp: requiredTimestamp(body),
  };
}

export function calculateZaloPrivacySignature(
  data: Record<string, unknown>,
  apiKey: string,
): string {
  const content = Object.keys(data)
    .sort()
    .map((key) => {
      const value = data[key];
      if (typeof value === "object") {
        return JSON.stringify(value) ?? "";
      }
      return String(value);
    })
    .join("");

  return createHash("sha256").update(`${content}${apiKey}`, "utf8").digest("hex");
}

function signaturesMatch(actualInput: string, expected: string): boolean {
  const actual = actualInput.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(actual)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function zaloPrivacyEventId(event: ZaloPrivacyEvent): string {
  return createHash("sha256")
    .update(
      ["zalo-privacy", event.appId, event.userId, event.eventName, event.timestamp].join("\u0000"),
    )
    .digest("hex");
}

export function createZaloPrivacyWebhookHandler(dependencies: WebhookDependencies) {
  return async (request: WebhookRequest, response: WebhookResponse): Promise<void> => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    if (!request.get("content-type")?.toLowerCase().startsWith("application/json")) {
      response.status(415).json({ ok: false, error: "unsupported_media_type" });
      return;
    }

    if (!dependencies.miniAppId || !dependencies.apiKey) {
      response.status(503).json({ ok: false, error: "webhook_not_configured" });
      return;
    }

    const rawBytes = request.rawBody ? Buffer.from(request.rawBody) : Buffer.alloc(0);
    if (rawBytes.length === 0) {
      response.status(400).json({ ok: false, error: "invalid_payload" });
      return;
    }
    if (rawBytes.length > MAX_WEBHOOK_BODY_BYTES) {
      response.status(413).json({ ok: false, error: "payload_too_large" });
      return;
    }

    try {
      const rawBody = rawBytes.toString("utf8");
      const payload = parsePayload(rawBody);
      const event = parseEvent(payload);
      const signature = request.get("x-zevent-signature") ?? "";
      const expectedSignature = calculateZaloPrivacySignature(payload, dependencies.apiKey);

      if (
        event.appId !== dependencies.miniAppId ||
        !signaturesMatch(signature, expectedSignature)
      ) {
        throw new WebhookError(401, "invalid_signature");
      }

      const result = await dependencies.processEvent(event, zaloPrivacyEventId(event));
      response.status(200).json({
        ok: true,
        duplicate: result.duplicate,
        jobCount: result.jobCount,
      });
    } catch (error) {
      if (error instanceof WebhookError) {
        response.status(error.status).json({ ok: false, error: error.code });
        return;
      }
      response.status(500).json({ ok: false, error: "processing_failed" });
    }
  };
}
