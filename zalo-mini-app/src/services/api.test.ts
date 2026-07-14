import { describe, expect, it } from "vitest";
import { customerSessionRefreshDelay, resolveCustomerQr } from "./api";

describe("customerSessionRefreshDelay", () => {
  it("dừng polling khi lượt đã kết thúc", () => {
    expect(customerSessionRefreshDelay("completed", 0, 0)).toBeNull();
    expect(customerSessionRefreshDelay("cancelled", 0, 0)).toBeNull();
  });

  it("giảm tần suất khi chờ duyệt và backoff sau lỗi", () => {
    expect(customerSessionRefreshDelay("waiting", 0, 0)).toBe(20_000);
    expect(customerSessionRefreshDelay("pending_approval", 0, 0)).toBe(30_000);
    expect(customerSessionRefreshDelay("waiting", 2, 0)).toBe(80_000);
  });
});

describe("resolveCustomerQr ở chế độ xem trước", () => {
  it("QR salon yêu cầu chọn khi có nhiều chi nhánh", async () => {
    const result = await resolveCustomerQr({
      qrType: "salon",
      salonId: "demo-salon",
      branchId: "",
      mirrorId: "",
      qrToken: "demo-token",
    });

    expect(result.selectionRequired).toBe(true);
    expect(result.branchId).toBe("");
    expect(result.branches).toHaveLength(2);
  });

  it("QR chi nhánh mở thẳng đúng tên và địa chỉ", async () => {
    const result = await resolveCustomerQr({
      qrType: "branch",
      salonId: "demo-salon",
      branchId: "demo-branch-main",
      mirrorId: "",
      qrToken: "demo-token",
    });

    expect(result.selectionRequired).toBe(false);
    expect(result.branchName).toBe("Chi nhánh Trung tâm");
    expect(result.branchAddress).toContain("Nguyễn Huệ");
  });
});
