import { describe, expect, it } from "vitest";
import { isValidMirrorQr } from "../src/security";

describe("isValidMirrorQr", () => {
  const mirror = {
    salonId: "salon-a",
    qrToken: "token-an-toan",
    isActive: true,
  };

  it("chấp nhận QR đúng salon, token và đang bật", () => {
    expect(isValidMirrorQr(mirror, "salon-a", "token-an-toan")).toBe(true);
  });

  it("từ chối token sai, salon sai hoặc gương đã tắt", () => {
    expect(isValidMirrorQr(mirror, "salon-a", "token-gia")).toBe(false);
    expect(isValidMirrorQr(mirror, "salon-b", "token-an-toan")).toBe(false);
    expect(isValidMirrorQr({ ...mirror, isActive: false }, "salon-a", "token-an-toan")).toBe(false);
  });
});
