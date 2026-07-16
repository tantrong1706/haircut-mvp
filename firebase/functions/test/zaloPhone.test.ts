import { describe, expect, it, vi } from "vitest";
import { ZaloRequestError, type ZaloFetch } from "../src/zaloClient";
import { decodeZaloPhoneNumber } from "../src/zaloPhone";

describe("decodeZaloPhoneNumber", () => {
  it("đổi phone token thành số điện thoại bằng API server-to-server", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { number: "84912345678" }, error: 0, message: "Success" }),
          { status: 200 },
        ),
      );

    await expect(
      decodeZaloPhoneNumber("access-token-test", "phone-token-test", "app-secret-test", {
        fetchImpl,
      }),
    ).resolves.toBe("84912345678");

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://graph.zalo.me/v2.0/me/info"),
      expect.objectContaining({
        method: "GET",
        headers: {
          access_token: "access-token-test",
          code: "phone-token-test",
          secret_key: "app-secret-test",
        },
      }),
    );
  });

  it("từ chối phản hồi không có số điện thoại hợp lệ", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: {}, error: 0 }), { status: 200 }));

    await expect(
      decodeZaloPhoneNumber("access-token-test", "phone-token-test", "app-secret-test", {
        fetchImpl,
      }),
    ).rejects.toMatchObject<Partial<ZaloRequestError>>({ errorCode: "invalid-phone" });
  });

  it("không thử lại phone token dùng một lần khi Zalo báo lỗi", async () => {
    const fetchImpl = vi
      .fn<ZaloFetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 400, message: "Invalid token" }), { status: 400 }),
      );

    await expect(
      decodeZaloPhoneNumber("access-token-test", "phone-token-test", "app-secret-test", {
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(ZaloRequestError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
