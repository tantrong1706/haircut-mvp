import { describe, expect, it, vi } from "vitest";
import {
  calculateZaloPrivacySignature,
  createZaloPrivacyWebhookHandler,
} from "../src/zaloPrivacyWebhook";

const miniAppId = "2038116772828167300";
const openApiKey = "open-api-key-test";
const validPayload = {
  event: "user.revoke.consent",
  appId: miniAppId,
  userId: "mini-app-user-test",
  timestamp: 1784077200000,
};

function signedRequest(payload: Record<string, unknown>, signatureOverride?: string) {
  const rawBody = JSON.stringify(payload);
  const signature = signatureOverride ?? calculateZaloPrivacySignature(payload, openApiKey);
  const headers = new Map([
    ["content-type", "application/json; charset=utf-8"],
    ["x-zevent-signature", signature],
  ]);

  return {
    method: "POST",
    rawBody: Buffer.from(rawBody),
    get(name: string) {
      return headers.get(name.toLowerCase());
    },
  };
}

function responseRecorder() {
  const state: { status: number; body: unknown; headers: Record<string, string> } = {
    status: 200,
    body: null,
    headers: {},
  };
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    set(name: string, value: string) {
      state.headers[name] = value;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
}

describe("zaloPrivacyWebhook", () => {
  it("chấp nhận sự kiện rút lại đồng ý hợp lệ", async () => {
    const processEvent = vi.fn().mockResolvedValue({ duplicate: false, jobCount: 2 });
    const handler = createZaloPrivacyWebhookHandler({
      miniAppId,
      apiKey: openApiKey,
      processEvent,
    });
    const { response, state } = responseRecorder();

    await handler(signedRequest(validPayload), response);

    expect(state.status).toBe(200);
    expect(state.body).toEqual({ ok: true, duplicate: false, jobCount: 2 });
    expect(processEvent).toHaveBeenCalledOnce();
    expect(processEvent.mock.calls[0][0]).toEqual({
      appId: miniAppId,
      userId: validPayload.userId,
      eventName: validPayload.event,
      timestamp: String(validPayload.timestamp),
    });
  });

  it("từ chối chữ ký sai mà không gọi luồng xóa", async () => {
    const processEvent = vi.fn();
    const handler = createZaloPrivacyWebhookHandler({
      miniAppId,
      apiKey: openApiKey,
      processEvent,
    });
    const { response, state } = responseRecorder();

    await handler(signedRequest(validPayload, "0".repeat(64)), response);

    expect(state.status).toBe(401);
    expect(state.body).toEqual({ ok: false, error: "invalid_signature" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("từ chối payload thiếu trường bắt buộc", async () => {
    const processEvent = vi.fn();
    const handler = createZaloPrivacyWebhookHandler({
      miniAppId,
      apiKey: openApiKey,
      processEvent,
    });
    const missingUser = {
      event: validPayload.event,
      appId: validPayload.appId,
      timestamp: validPayload.timestamp,
    };
    const { response, state } = responseRecorder();

    await handler(signedRequest(missingUser), response);

    expect(state.status).toBe(400);
    expect(state.body).toEqual({ ok: false, error: "invalid_payload" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("dùng cùng event id khi Zalo gửi lại nhiều lần", async () => {
    const processed = new Set<string>();
    const processEvent = vi.fn(async (_event, eventId: string) => {
      const duplicate = processed.has(eventId);
      processed.add(eventId);
      return { duplicate, jobCount: 1 };
    });
    const handler = createZaloPrivacyWebhookHandler({
      miniAppId,
      apiKey: openApiKey,
      processEvent,
    });
    const first = responseRecorder();
    const second = responseRecorder();

    await handler(signedRequest(validPayload), first.response);
    await handler(signedRequest(validPayload), second.response);

    expect(first.state.body).toEqual({ ok: true, duplicate: false, jobCount: 1 });
    expect(second.state.body).toEqual({ ok: true, duplicate: true, jobCount: 1 });
    expect(processEvent.mock.calls[0][1]).toBe(processEvent.mock.calls[1][1]);
  });

  it("tạo chữ ký ổn định dù thứ tự field trong JSON thay đổi", () => {
    const reorderedPayload = {
      timestamp: validPayload.timestamp,
      userId: validPayload.userId,
      appId: validPayload.appId,
      event: validPayload.event,
    };

    expect(calculateZaloPrivacySignature(reorderedPayload, openApiKey)).toBe(
      calculateZaloPrivacySignature(validPayload, openApiKey),
    );
  });
});
