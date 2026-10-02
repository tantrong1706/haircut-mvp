import { describe, expect, it } from "vitest";
import { extractRewardCode } from "./rewardQrScanner";

describe("reward QR payload", () => {
  it("chỉ nhận payload QR quà version 1 và chuẩn hóa mã", () => {
    expect(extractRewardCode("haircut-reward:v1:hc-20260920-abcd1234")).toBe(
      "HC-20260920-ABCD1234",
    );
  });

  it.each([
    "HC-20260920-ABCD1234",
    "haircut-reward:v2:HC-TEST12",
    "haircut-reward:v1:short",
    "https://example.com/?token=secret",
  ])("từ chối payload không đúng contract: %s", (payload) => {
    expect(() => extractRewardCode(payload)).toThrow("QR quà không hợp lệ");
  });
});
