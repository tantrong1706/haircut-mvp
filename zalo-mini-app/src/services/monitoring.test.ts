import { describe, expect, it } from "vitest";
import { cleanParams, redactSensitiveText, redactSensitiveUrl } from "./monitoring";

describe("scrub dữ liệu giám sát", () => {
  it("loại mọi tham số có tên token, secret hoặc proof", () => {
    expect(
      cleanParams({
        salon_id: "salon-a",
        qrToken: "qr-khong-duoc-gui",
        access_token: "access-khong-duoc-gui",
        appsecret_proof: "proof-khong-duoc-gui",
      }),
    ).toEqual({ salon_id: "salon-a" });
  });

  it("che token trong URL trước khi gửi Sentry", () => {
    const safeUrl = new URL(
      redactSensitiveUrl(
        "https://example.test/?qrToken=qr-bi-mat&access_token=access-bi-mat&appsecret_proof=proof-bi-mat",
      ),
    );

    expect(safeUrl.searchParams.get("qrToken")).toBe("[redacted]");
    expect(safeUrl.searchParams.get("access_token")).toBe("[redacted]");
    expect(safeUrl.searchParams.get("appsecret_proof")).toBe("[redacted]");
  });

  it("che token trong thông báo lỗi và breadcrumb", () => {
    const safeText = redactSensitiveText(
      "Lỗi ?qrToken=qr-bi-mat&access_token=access-bi-mat&appsecret_proof=proof-bi-mat",
    );

    expect(safeText).not.toContain("qr-bi-mat");
    expect(safeText).not.toContain("access-bi-mat");
    expect(safeText).not.toContain("proof-bi-mat");
  });
});
