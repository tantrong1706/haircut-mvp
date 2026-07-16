import { describe, expect, it } from "vitest";
import { extractRewardCode } from "./nativeRuntime";

describe("mã quà từ camera", () => {
  it("nhận mã quà dạng chữ và URL", () => {
    expect(extractRewardCode("hc-20260716-abcd12")).toBe("HC-20260716-ABCD12");
    expect(extractRewardCode("https://haircut.example/reward?code=HC-ABCDEF12")).toBe("HC-ABCDEF12");
  });

  it("từ chối nội dung camera không hợp lệ", () => {
    expect(extractRewardCode("abc")).toBe("");
    expect(extractRewardCode("https://example.com/no-code")).toBe("");
  });
});
