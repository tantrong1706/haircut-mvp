import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getManagerPointRequestHistory,
  getManagerRewardHistory,
  getManagerSessionHistory,
} from "../services/managerApi";
import { OwnerApprovalsScreen } from "./owner/OwnerApprovalsScreen";
import { OwnerCustomersScreen } from "./owner/OwnerCustomersScreen";
import { StaffHistoryScreen } from "./staff/StaffHistoryScreen";

vi.mock("../services/managerApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/managerApi")>();
  return {
    ...actual,
    getManagerPointRequestHistory: vi.fn(),
    getManagerRewardHistory: vi.fn(),
    getManagerSessionHistory: vi.fn(),
  };
});

const sessionHistory = {
  sessions: [
    {
      id: "session-history",
      salonId: "salon",
      branchId: "branch",
      branchName: "Chi nhánh chính",
      branchAddress: "1 Nguyễn Huệ",
      customerId: "customer",
      status: "cancelled" as const,
      assignedStaffId: "staff",
      assignedStaffName: "Minh",
      claimedAtMs: null,
      createdAtMs: 1_700_000_000_000,
      completedAtMs: null,
      cancelledAtMs: 1_700_000_100_000,
      cancellationReason: "no_show",
      customer: {
        id: "customer",
        name: "Anh Nam",
        phoneLast4: "1122",
        points: 5,
        allowPhoto: false,
      },
    },
  ],
};

describe("Manager history screens", () => {
  beforeEach(() => {
    vi.mocked(getManagerSessionHistory).mockResolvedValue(sessionHistory);
    vi.mocked(getManagerRewardHistory).mockResolvedValue({
      rewards: [
        {
          id: "reward",
          rewardName: "Gội đầu",
          rewardCodeLast4: "1234",
          status: "used",
          branchId: "branch",
          customerId: "customer",
          customerName: "Anh Nam",
          createdAtMs: 1_700_000_000_000,
          usedAtMs: 1_700_000_100_000,
          expiresAtMs: null,
        },
      ],
    });
    vi.mocked(getManagerPointRequestHistory).mockResolvedValue({
      requests: [
        {
          id: "request",
          salonId: "salon",
          branchId: "branch",
          branchName: "Chi nhánh chính",
          sessionId: "session",
          customerId: "customer",
          staffName: "Minh",
          note: "Fade thấp",
          pointsAdded: 1,
          status: "approved",
          rejectionReason: "",
          createdAtMs: 1_700_000_000_000,
          processedAtMs: 1_700_000_100_000,
          customer: {
            id: "customer",
            name: "Anh Nam",
            phoneLast4: "1122",
            points: 6,
            allowPhoto: false,
          },
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("tải lịch sử lượt và đổi quà đúng chi nhánh của staff", async () => {
    render(<StaffHistoryScreen salonId="salon" branchId="branch" />);

    expect(await screen.findByText("Anh Nam")).toBeInTheDocument();
    expect(screen.getByText("Không đến")).toBeInTheDocument();
    expect(screen.getByText("Gội đầu")).toBeInTheDocument();
    expect(screen.getByText(/Mã kết thúc 1234/)).toBeInTheDocument();
    expect(getManagerSessionHistory).toHaveBeenCalledWith({
      salonId: "salon",
      branchId: "branch",
      limit: 30,
    });
  });

  it("owner mở lịch sử lượt và thấy trạng thái khách không đến", async () => {
    const user = userEvent.setup();
    render(
      <OwnerCustomersScreen
        salonId="salon"
        branchId="branch"
        sessions={[]}
        onConfirm={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Lịch sử/ }));
    expect(await screen.findByText("Anh Nam")).toBeInTheDocument();
    expect(screen.getByText("Không đến")).toBeInTheDocument();
    expect(getManagerSessionHistory).toHaveBeenCalledWith({
      salonId: "salon",
      branchId: "branch",
      limit: 50,
    });
  });

  it("owner tải lịch sử yêu cầu điểm đã xử lý", async () => {
    const user = userEvent.setup();
    render(
      <OwnerApprovalsScreen
        salonId="salon"
        requests={[]}
        branches={[]}
        branchFilter="all"
        onBranchFilterChange={() => undefined}
        onRequestsChange={() => undefined}
        onRefreshOverview={() => undefined}
        onConfirm={() => undefined}
        pointApprovalEnabled
        photoUploadEnabled
      />,
    );

    await user.click(screen.getByRole("button", { name: "Xem lịch sử đã xử lý" }));
    await waitFor(() => expect(screen.getByText("+1 điểm")).toBeInTheDocument());
    expect(screen.getByText("Anh Nam")).toBeInTheDocument();
    expect(getManagerPointRequestHistory).toHaveBeenCalledWith({
      salonId: "salon",
      branchId: null,
      limit: 50,
    });
  });
});
