import { beforeEach, describe, expect, it } from "vitest";
import { hasQrContext, parseQrContext, resolveQrContext } from "./qr";

describe("parseQrContext", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("đọc đúng salon, gương và token từ URL", () => {
    window.history.replaceState({}, "", "/?salonId=salon-a&mirrorId=mirror-2&qrToken=secure-token");

    const legacyQr = parseQrContext();
    expect(legacyQr).toEqual({
      qrType: "legacy-mirror",
      salonId: "salon-a",
      branchId: "",
      mirrorId: "mirror-2",
      qrToken: "secure-token",
    });
    expect(hasQrContext(legacyQr)).toBe(false);
    expect(window.location.search).not.toContain("qrToken");
  });

  it("dùng dữ liệu demo khi URL không có QR", () => {
    expect(parseQrContext()).toEqual({
      qrType: "legacy-mirror",
      salonId: "demo-salon",
      branchId: "",
      mirrorId: "demo-mirror-1",
      qrToken: "demo-token",
    });
  });

  it("đọc QR salon và QR chi nhánh theo đúng loại", () => {
    window.history.replaceState({}, "", "/?qrType=salon&salonId=salon-a&qrToken=salon-token");
    const salonQr = parseQrContext();
    expect(salonQr.qrType).toBe("salon");
    expect(hasQrContext(salonQr)).toBe(true);

    window.history.replaceState(
      {},
      "",
      "/?qrType=branch&salonId=salon-a&branchId=branch-a&qrToken=branch-token",
    );
    const branchQr = parseQrContext();
    expect(branchQr).toMatchObject({ qrType: "branch", branchId: "branch-a" });
    expect(hasQrContext(branchQr)).toBe(true);
  });

  it("không tự gắn salon hoặc QR demo trong môi trường production", () => {
    const productionQr = resolveQrContext("", {
      previewEnabled: false,
      demoEnabled: false,
    });

    expect(productionQr).toEqual({
      qrType: "salon",
      salonId: "",
      branchId: "",
      mirrorId: "",
      qrToken: "",
    });
    expect(hasQrContext(productionQr)).toBe(false);
  });
});
