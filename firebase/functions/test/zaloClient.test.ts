import { describe, expect, it, vi } from "vitest";
import { ZaloRequestError, fetchZaloJson, type ZaloFetch } from "../src/zaloClient";

const endpoint = new URL("https://graph.zalo.test/v2.0/me");

describe("fetchZaloJson", () => {
  it("retry một lần khi Zalo trả 5xx", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 500, message: "Tạm thời lỗi" }), { status: 500 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0, id: "zalo-a" }), { status: 200 }),
      );

    const result = await fetchZaloJson(endpoint, {}, { fetchImpl, retryDelayMs: 0 });

    expect(result.payload.id).toBe("zalo-a");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("không retry khi Zalo chặn chính sách IP Việt Nam", async () => {
    const onAttemptFailure = vi.fn();
    const fetchImpl = vi.fn<ZaloFetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: -1,
          message: "Personal information is limited due to IP address not inside Vietnam: 203.0.113.10",
        }),
        { status: 503 },
      ),
    );

    await expect(
      fetchZaloJson(endpoint, {}, { fetchImpl, onAttemptFailure, retryDelayMs: 0 }),
    ).rejects.toMatchObject<Partial<ZaloRequestError>>({
      category: "IP_POLICY_BLOCKED",
      retryable: false,
      attempt: 1,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onAttemptFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        category: "IP_POLICY_BLOCKED",
        retryable: false,
      }),
    );
  });

  it("vẫn retry khi Zalo trả 429", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 429, message: "Too many requests" }), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0, id: "zalo-a" }), { status: 200 }),
      );

    const result = await fetchZaloJson(endpoint, {}, { fetchImpl, retryDelayMs: 0 });

    expect(result.payload.id).toBe("zalo-a");
    expect(result.attempt).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("dừng request quá thời gian và trả lỗi ổn định", async () => {
    const fetchImpl: ZaloFetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });

    await expect(
      fetchZaloJson(endpoint, {}, { fetchImpl, timeoutMs: 100, maxAttempts: 1 }),
    ).rejects.toMatchObject<Partial<ZaloRequestError>>({
      errorCode: "timeout",
      status: "network-error",
      category: "TIMEOUT",
      retryable: true,
    });
  });

  it("không chấp nhận phản hồi JSON sai cấu trúc", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(fetchZaloJson(endpoint, {}, { fetchImpl })).rejects.toMatchObject<
      Partial<ZaloRequestError>
    >({
      errorCode: "invalid-json",
      status: 200,
    });
  });
});
