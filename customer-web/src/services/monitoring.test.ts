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

  it("chỉ giữ trường vận hành trong allowlist", () => {
    expect(
      cleanParams({
        salon_id: "salon-a",
        branch_id: "branch-a",
        session_status: "waiting",
        customer_name: "Không được gửi",
        phone: "0838098761",
        note: "Fade thấp",
        reward_code: "HC-SECRET123",
      }),
    ).toEqual({
      salon_id: "salon-a",
      branch_id: "branch-a",
      session_status: "waiting",
    });
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

  it("che email, số điện thoại, mã quà và bearer token", () => {
    const safeText = redactSensitiveText(
      "tantrong1706@gmail.com 0838098761 HC-SECRET123 Bearer eyJhbGciOiJIUzI1NiJ9",
    );

    expect(safeText).toContain("[email]");
    expect(safeText).toContain("[phone]");
    expect(safeText).toContain("[reward-code]");
    expect(safeText).toContain("Bearer [redacted]");
  });
});
