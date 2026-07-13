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
