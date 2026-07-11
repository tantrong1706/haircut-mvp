import { describe, expect, it } from "vitest";
import { parseQrContext } from "./qr";

describe("parseQrContext", () => {
  it("đọc đúng salon, gương và token từ URL", () => {
    window.history.replaceState({}, "", "/?salonId=salon-a&mirrorId=mirror-2&qrToken=secure-token");

    expect(parseQrContext()).toEqual({
      salonId: "salon-a",
      mirrorId: "mirror-2",
      qrToken: "secure-token",
    });
  });

  it("dùng dữ liệu demo khi URL không có QR", () => {
    expect(parseQrContext()).toEqual({
      salonId: "demo-salon",
      mirrorId: "demo-mirror-1",
      qrToken: "demo-token",
    });
  });
});
