import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { RewardsPage } from "./RewardsPage";

const mocks = vi.hoisted(() => ({
  getRewards: vi.fn(),
}));

vi.mock("../services/api", () => ({
  getRewards: mocks.getRewards,
}));

const session = {
  qr: { qrType: "branch", salonId: "salon-a", branchId: "branch-a", qrToken: "test" },
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  customer: { customerId: "customer-a", name: "Anh Tân", points: 5, allowPhoto: false },
} as AppSession;

describe("RewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tải lại danh sách quà sau lỗi tạm thời", async () => {
    const user = userEvent.setup();
    mocks.getRewards
      .mockRejectedValueOnce(new Error("Không kết nối được"))
      .mockResolvedValueOnce([]);

    render(<RewardsPage session={session} />);

    expect(await screen.findByText("Không kết nối được")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Chưa có mã quà")).toBeInTheDocument();
    expect(mocks.getRewards).toHaveBeenCalledTimes(2);
  });

  it("tách quà còn dùng được khỏi lịch sử và chỉ cho sao chép mã còn hiệu lực", async () => {
    const user = userEvent.setup();
    const onOpenWheel = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mocks.getRewards.mockResolvedValue([
      {
        id: "reward-active",
        rewardName: "Gội đầu miễn phí",
        rewardCode: "HC-ACTIVE",
        status: "unused",
        branchName: "Chi nhánh Trung tâm",
        createdAt: "24/08/2026",
        expiresAt: "24/09/2026",
      },
      {
        id: "reward-used",
        rewardName: "Giảm 10%",
        rewardCode: "HC-USED",
        status: "used",
        createdAt: "20/08/2026",
        usedAt: "21/08/2026",
      },
      {
        id: "reward-expired",
        rewardName: "Hấp dầu",
        rewardCode: "HC-EXPIRED",
        status: "expired",
        createdAt: "01/07/2026",
      },
      {
        id: "reward-revoked",
        rewardName: "Tặng sáp",
        rewardCode: "HC-REVOKED",
        status: "revoked",
        createdAt: "01/07/2026",
      },
    ]);

    const props = { session, onOpenWheel } as Parameters<typeof RewardsPage>[0] & {
      onOpenWheel: () => void;
    };
    render(<RewardsPage {...props} />);

    const rewardNavigation = screen.getByRole("navigation", { name: "Quà và vòng quay" });
    expect(within(rewardNavigation).getByRole("button", { name: "Mã quà" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(rewardNavigation).getByRole("button", { name: "Vòng quay" }));
    expect(onOpenWheel).toHaveBeenCalledTimes(1);

    const activeSection = await screen.findByRole("region", { name: "Quà có thể sử dụng" });
    const historySection = screen.getByRole("region", { name: "Lịch sử quà" });
    expect(within(activeSection).getByText("Gội đầu miễn phí")).toBeInTheDocument();
    expect(within(activeSection).getByText("Chỉ dùng tại: Chi nhánh Trung tâm")).toBeInTheDocument();
    expect(within(historySection).getByText("Đã dùng")).toBeInTheDocument();
    expect(within(historySection).getByText("Hết hạn")).toBeInTheDocument();
    expect(within(historySection).getByText("Đã hủy")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sao chép mã quà" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Sao chép mã quà" }));
    expect(writeText).toHaveBeenCalledWith("HC-ACTIVE");
    expect(await screen.findByText("Đã sao chép mã quà.")).toBeInTheDocument();
  });
});
