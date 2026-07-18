import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OwnerOverview, StaffSession } from "../services/managerApi";
import { OwnerCustomersScreen } from "./owner/OwnerCustomersScreen";
import { OwnerManagementScreen } from "./owner/OwnerManagementScreen";
import { OwnerTodayScreen } from "./owner/OwnerTodayScreen";
import { StaffHistoryScreen } from "./staff/StaffHistoryScreen";
import { StaffRewardsScreen } from "./staff/StaffRewardsScreen";

const overview: OwnerOverview = {
  customersToday: 12,
  customers7Days: 54,
  customers30Days: 210,
  pendingRequests: 2,
  pointsApprovedToday: 7,
  spinsToday: 3,
  unusedRewards: 4,
  inactiveCustomers: [],
};

const sessions: StaffSession[] = [
  {
    id: "waiting",
    salonId: "salon",
    branchId: "branch",
    branchName: "Chi nhánh chính",
    branchAddress: "",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-1",
    status: "waiting",
    assignedStaffId: "",
    assignedStaffName: "",
    claimedAtMs: null,
    createdAtMs: Date.now(),
    expiresAtMs: null,
    cancellationReason: "",
    customer: {
      id: "customer-1",
      name: "Anh Hoàng",
      phoneLast4: "8761",
      points: 8,
      allowPhoto: true,
    },
  },
  {
    id: "serving",
    salonId: "salon",
    branchId: "branch",
    branchName: "Chi nhánh chính",
    branchAddress: "",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-2",
    status: "serving",
    assignedStaffId: "staff",
    assignedStaffName: "Minh",
    claimedAtMs: Date.now(),
    createdAtMs: Date.now(),
    expiresAtMs: null,
    cancellationReason: "",
    customer: {
      id: "customer-2",
      name: "Chị Ngọc",
      phoneLast4: "3456",
      points: 4,
      allowPhoto: true,
    },
  },
  {
    id: "pending",
    salonId: "salon",
    branchId: "branch",
    branchName: "Chi nhánh chính",
    branchAddress: "",
    mirrorId: "",
    mirrorName: "",
    customerId: "customer-3",
    status: "pending_approval",
    assignedStaffId: "staff",
    assignedStaffName: "Minh",
    claimedAtMs: Date.now(),
    createdAtMs: Date.now(),
    expiresAtMs: null,
    cancellationReason: "",
    customer: {
      id: "customer-3",
      name: "Anh Nam",
      phoneLast4: "1122",
      points: 5,
      allowPhoto: false,
    },
  },
];

describe("Manager screen information architecture", () => {
  it("Hôm nay cho Owner thấy ngay hàng chờ, đang phục vụ và việc cần duyệt", () => {
    const html = renderToStaticMarkup(
      <OwnerTodayScreen
        overview={overview}
        sessions={sessions}
        loading={false}
        error=""
        branches={[]}
        branchFilter="all"
        onBranchFilterChange={() => undefined}
        onRefresh={() => undefined}
        onOpenTab={() => undefined}
        onOpenManagement={() => undefined}
      />,
    );
    expect(html).toContain("Đang chờ");
    expect(html).toContain("Đang phục vụ");
    expect(html).toContain("2 yêu cầu đang chờ duyệt");
    expect(html).toContain("Xem lượt khách");
  });

  it("tab Khách mặc định có đúng ba nhóm trạng thái và lối vào tìm kiếm", () => {
    const html = renderToStaticMarkup(
      <OwnerCustomersScreen salonId="salon" sessions={sessions} onConfirm={() => undefined} />,
    );
    expect(html).toContain("Đang chờ (1)");
    expect(html).toContain("Đang phục vụ (1)");
    expect(html).toContain("Chờ duyệt (1)");
    expect(html).toContain("Tìm khách");
  });

  it("Quản lý giữ các nhóm chức năng lớn và trạng thái quyền audit", () => {
    const html = renderToStaticMarkup(
      <OwnerManagementScreen
        salonId="salon"
        initialSection={null}
        branchFilter="all"
        onBranchesChange={() => undefined}
        onConfirm={() => undefined}
        onOpenScanner={() => undefined}
        onOpenTab={() => undefined}
      />,
    );
    for (const label of [
      "Chi nhánh và QR",
      "Nhân viên",
      "Khách hàng",
      "Điểm",
      "Quà và vòng quay",
      "Đổi quà",
      "Báo cáo",
      "Nhật ký hoạt động",
      "Quản lý thêm",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("Staff có lối vào gửi điểm, đổi quà và bộ lọc lịch sử đơn giản", () => {
    const rewardsHtml = renderToStaticMarkup(
      <StaffRewardsScreen
        salonId="salon"
        pointPerVisit={1}
        canRedeem
        scanning={false}
        onOpenScanner={() => undefined}
        onOpenActive={() => undefined}
      />,
    );
    const historyHtml = renderToStaticMarkup(
      <StaffHistoryScreen sessions={sessions} currentUid="staff" />,
    );
    expect(rewardsHtml).toContain("Gửi yêu cầu điểm");
    expect(rewardsHtml).toContain("Mở khách đang làm");
    expect(rewardsHtml).toContain("Xác nhận mã quà");
    expect(historyHtml).toContain("Hôm nay");
    expect(historyHtml).toContain("7 ngày");
    expect(historyHtml).toContain("30 ngày");
  });
});
