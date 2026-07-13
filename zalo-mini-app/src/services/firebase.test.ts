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

  it("giữ thông báo phân quyền đã được duyệt đúng callable", () => {
    expect(
      friendlyFirebaseFunctionError(
        {
          code: "functions/permission-denied",
          message: "QR chi nhánh không hợp lệ hoặc đã được tạo lại",
        },
        "registerCustomerFromZalo",
      ),
    ).toBe("QR chi nhánh không hợp lệ hoặc đã được tạo lại");
  });

  it("che thông báo phân quyền lạ từ backend", () => {
    expect(
      friendlyFirebaseFunctionError(
        {
          code: "functions/permission-denied",
          message: "Chi tiết nội bộ không được phép hiển thị",
        },
        "registerCustomerFromZalo",
      ),
    ).toBe("Tài khoản này không có quyền với salon này.");
  });

  it("giữ thông báo tài khoản bị tắt dùng chung cho callable", () => {
    expect(
      friendlyFirebaseFunctionError(
        { code: "functions/permission-denied", message: "Tài khoản đã bị tắt" },
        "getSalonProfile",
      ),
    ).toBe("Tài khoản đã bị tắt");
  });

  it("giữ thông báo nhân viên đang phụ trách có tên động", () => {
    expect(
      friendlyFirebaseFunctionError(
        {
          code: "functions/permission-denied",
          message: "Lượt này đang do Nhân viên Nam phụ trách",
        },
        "submitPointRequest",
      ),
    ).toBe("Lượt này đang do Nhân viên Nam phụ trách");
  });

  it("đọc thông báo từ Error thông thường", () => {
    expect(friendlyFirebaseFunctionError(new Error("Lỗi tạm thời"))).toBe("Lỗi tạm thời");
  });

  it("dùng thông báo chung khi permission-denied không có message", () => {
    expect(
      friendlyFirebaseFunctionError(
        { code: "functions/permission-denied" },
        "registerCustomerFromZalo",
      ),
    ).toBe("Tài khoản này không có quyền với salon này.");
  });

  it("hiển thị đúng cảnh báo giới hạn tần suất", () => {
    expect(
      friendlyFirebaseFunctionError({
        code: "functions/resource-exhausted",
        message: "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.",
      }),
    ).toContain("thao tác quá nhanh");
  });
});
