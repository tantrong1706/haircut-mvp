import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { customerIdForWeb, customerIdForZalo, webPhonePrincipal } from "../src/customerWebIdentity";

describe("customer identity theo provider", () => {
  it("giữ nguyên document ID của khách Zalo hiện tại", () => {
    const expected = createHash("sha256").update("salon-a:zalo-user-a").digest("hex").slice(0, 40);

    expect(customerIdForZalo("salon-a", "zalo-user-a")).toBe(expected);
  });

  it("tạo customer khác nhau cho cùng UID ở hai salon", () => {
    expect(customerIdForWeb("salon-a", "uid-123")).not.toBe(customerIdForWeb("salon-b", "uid-123"));
  });

  it("không trùng identity Zalo ngay cả khi subject giống nhau", () => {
    expect(customerIdForWeb("salon-a", "same-subject")).not.toBe(
      customerIdForZalo("salon-a", "same-subject"),
    );
  });
});

describe("Firebase Phone principal", () => {
  it("chỉ lấy UID và số điện thoại đã xác minh từ auth context", () => {
    expect(
      webPhonePrincipal({
        uid: "uid-123",
        token: {
          phone_number: "+84901234567",
          firebase: { sign_in_provider: "phone" },
        },
      }),
    ).toEqual({ uid: "uid-123", phone: "+84901234567", phoneLast4: "4567" });
  });

  it.each([
    null,
    { uid: "uid-123", token: {} },
    { uid: "uid-123", token: { phone_number: "+84901234567" } },
    {
      uid: "uid-123",
      token: { phone_number: "0901234567", firebase: { sign_in_provider: "phone" } },
    },
  ])("từ chối auth context không phải Firebase Phone đã xác minh", (auth) => {
    expect(() => webPhonePrincipal(auth)).toThrow("Firebase Phone Auth");
  });
});
