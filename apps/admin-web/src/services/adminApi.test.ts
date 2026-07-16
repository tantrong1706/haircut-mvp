import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAdminFunction } from "./firebase";
import { adminApi } from "./adminApi";

vi.mock("./firebase", () => ({ callAdminFunction: vi.fn() }));

const mockedCall = vi.mocked(callAdminFunction);

describe("adminApi", () => {
  beforeEach(() => mockedCall.mockReset());

  it("giới hạn trang danh sách salon và gọi đúng callable", async () => {
    mockedCall.mockResolvedValueOnce({ salons: [], nextCursor: null });

    await adminApi.salons("cursor-a");

    expect(mockedCall).toHaveBeenCalledWith("listSystemAdminSalons", {
      cursor: "cursor-a",
      pageSize: 50,
    });
  });

  it("gửi lý do khi đổi trạng thái salon", async () => {
    mockedCall.mockResolvedValueOnce({
      salonId: "salon-a",
      previousStatus: "active",
      status: "suspended",
    });

    await adminApi.updateSalonStatus({
      salonId: "salon-a",
      status: "suspended",
      reason: "Kiểm tra gian lận",
    });

    expect(mockedCall).toHaveBeenCalledWith("updateSystemAdminSalonStatus", {
      salonId: "salon-a",
      status: "suspended",
      reason: "Kiểm tra gian lận",
    });
  });

  it("không gửi salonId khi cập nhật feature flags toàn hệ thống", async () => {
    mockedCall.mockResolvedValueOnce({ salonId: null, features: {} });

    await adminApi.updateFeatures({ features: { maintenanceMode: true } });

    expect(mockedCall).toHaveBeenCalledWith("updateSystemFeatureFlags", {
      features: { maintenanceMode: true },
    });
  });
});
