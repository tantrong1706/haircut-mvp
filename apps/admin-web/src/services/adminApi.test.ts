import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAdminFunction } from "./firebase";
import { adminApi } from "./adminApi";

vi.mock("./firebase", () => ({ callAdminFunction: vi.fn() }));

const mockedCall = vi.mocked(callAdminFunction);

describe("adminApi", () => {
  it("omits the optional cursor on the first page instead of sending Firebase an undefined property", async () => {
    await adminApi.salonOperations("salon-a");
    expect(mockedCall).toHaveBeenCalledWith("getSystemAdminSalonOperations", {
      salonId: "salon-a",
      pageSize: 50,
    });
    expect(Object.prototype.hasOwnProperty.call(mockedCall.mock.calls[0][1], "cursor")).toBe(false);
  });
  beforeEach(() => mockedCall.mockReset());

  it("giới hạn trang danh sách salon và gọi đúng callable", async () => {
    mockedCall.mockResolvedValueOnce({ salons: [], nextCursor: null });

    await adminApi.salons("cursor-a");

    expect(mockedCall).toHaveBeenCalledWith("listSystemAdminSalons", {
      cursor: "cursor-a",
      pageSize: 50,
    });
  });

  it("chỉ bổ sung kiểm tra và sửa có giới hạn, không mở các thao tác ghi quản trị cũ", () => {
    expect(Object.keys(adminApi)).toEqual([
      "access",
      "overview",
      "salons",
      "features",
      "auditEvents",
      "diagnostics",
      "repair",
      "salonOperations",
      "manageSalon",
    ]);
  });
  it("scopes pending requests to one salon and one bounded page", async () => {
    await adminApi.salonOperations("salon-a", "request-cursor");
    expect(mockedCall).toHaveBeenCalledWith("getSystemAdminSalonOperations", {
      salonId: "salon-a",
      cursor: "request-cursor",
      pageSize: 50,
    });
  });
});
