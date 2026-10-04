import { describe, expect, it } from "vitest";
import { cleanParams, redactSensitiveText, redactSensitiveUrl } from "./monitoring";

describe("scrub dữ liệu giám sát", () => {
  it("che credential cả khi URL lỗi cú pháp và khi dùng userinfo", () => {
    expect(redactSensitiveUrl("http://[invalid]?token=fixture-hidden")).not.toContain("fixture-hidden");
    const url = new URL(redactSensitiveUrl("https://fixture-user:fixture-password@example.test/path"));
    expect(decodeURIComponent(url.username)).toBe("[redacted]");
    expect(decodeURIComponent(url.password)).toBe("[redacted]");
    expect(redactSensitiveText("password='fixture spaced password' token=fixture-plain"))
      .not.toContain("fixture");
    expect(redactSensitiveUrl("/history?tab=photos")).toContain("tab=photos");
  });

  it("che token Firebase Storage và mã xác thực Web, kể cả tên tham số khác kiểu chữ", () => {
    const url = new URL(redactSensitiveUrl(
      "https://example.test/photo?token=storage-fixture&ID_TOKEN=id-fixture&oobCode=action-fixture&route=history#refresh_token=refresh-fixture",
    ));
    expect(url.searchParams.get("token")).toBe("[redacted]");
    expect(url.searchParams.get("ID_TOKEN")).toBe("[redacted]");
    expect(url.searchParams.get("oobCode")).toBe("[redacted]");
    expect(url.searchParams.get("route")).toBe("history");
    expect(decodeURIComponent(url.hash)).not.toContain("refresh-fixture");
  });

  it("che credential trong lỗi dạng JSON, không chỉ các token Zalo", () => {
    const raw = JSON.stringify({
      idToken: "fixture-id-token", refreshToken: "fixture-refresh-token",
      verificationCode: "fixture-verification", password: "fixture password with spaces",
      otp: "654321", token: "fixture-storage-token", errorCode: "PERMISSION_DENIED",
    });
    const scrubbed = redactSensitiveText(raw);
    for (const secret of ["fixture-id-token", "fixture-refresh-token", "fixture-verification",
      "fixture password with spaces", "654321", "fixture-storage-token"]) {
      expect(scrubbed).not.toContain(secret);
    }
    expect(scrubbed).toContain("PERMISSION_DENIED");
  });

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
