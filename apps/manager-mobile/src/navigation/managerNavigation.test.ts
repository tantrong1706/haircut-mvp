import { describe, expect, it } from "vitest";
import {
  OWNER_PRIMARY_TABS,
  STAFF_PRIMARY_TABS,
  ownerTabFromRoute,
  staffTabAfterSessionStatus,
  staffTabFromRoute,
} from "./managerNavigation";

describe("Manager navigation", () => {
  it("giữ đúng 5 tab chính cho mỗi vai trò", () => {
    expect(OWNER_PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      "Hôm nay",
      "Khách",
      "Duyệt",
      "Quản lý",
      "Cài đặt",
    ]);
    expect(STAFF_PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      "Hàng chờ",
      "Đang làm",
      "Điểm và quà",
      "Lịch sử",
      "Tài khoản",
    ]);
  });

  it("đưa deep link tới đúng tab Owner", () => {
    expect(ownerTabFromRoute("/customers")).toBe("customers");
    expect(ownerTabFromRoute("/point-approvals")).toBe("approvals");
    expect(ownerTabFromRoute("/rewards")).toBe("management");
    expect(ownerTabFromRoute("/audit")).toBe("management");
    expect(ownerTabFromRoute("/reports")).toBe("today");
    expect(ownerTabFromRoute("/settings")).toBe("settings");
  });

  it("đưa deep link và trạng thái lượt tới đúng tab Staff", () => {
    expect(staffTabFromRoute("/queue")).toBe("queue");
    expect(staffTabFromRoute("/serving")).toBe("active");
    expect(staffTabFromRoute("/rewards")).toBe("rewards");
    expect(staffTabFromRoute("/history")).toBe("history");
    expect(staffTabAfterSessionStatus("serving")).toBe("active");
    expect(staffTabAfterSessionStatus("pending_approval")).toBe("history");
    expect(staffTabAfterSessionStatus("cancelled")).toBe("history");
  });
});
