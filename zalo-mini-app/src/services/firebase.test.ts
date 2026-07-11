import { describe, expect, it } from "vitest";
import { friendlyFirebaseFunctionError } from "./firebase";

describe("friendlyFirebaseFunctionError", () => {
  it("dịch lỗi hết phiên đăng nhập", () => {
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
