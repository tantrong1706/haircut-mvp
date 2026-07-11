import { describe, expect, it } from "vitest";
import { friendlyFirebaseFunctionError } from "./firebase";

describe("friendlyFirebaseFunctionError", () => {
  it("giữ thông báo unauthenticated từ backend", () => {
    expect(
      friendlyFirebaseFunctionError({
        code: "functions/unauthenticated",
        message: "Zalo access token không hợp lệ",
      }),
    ).toBe("Zalo access token không hợp lệ");
  });

  it("dùng thông báo hết phiên khi backend không gửi chi tiết", () => {
    expect(friendlyFirebaseFunctionError({ code: "functions/unauthenticated" })).toContain(
      "đăng nhập lại",
    );
  });

  it("giữ thông báo nghiệp vụ hợp lệ", () => {
    expect(
      friendlyFirebaseFunctionError({
        code: "functions/failed-precondition",
        message: "Khách chưa đủ điểm để quay",
      }),
    ).toBe("Khách chưa đủ điểm để quay");
  });
});
