import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardRedemption } from "./RewardRedemption";

const mocks = vi.hoisted(() => ({
  lookupRewardCode: vi.fn(),
  redeemRewardCode: vi.fn(),
  restoreRewardCode: vi.fn(),
}));

vi.mock("../services/managerApi", () => ({
  lookupRewardCode: mocks.lookupRewardCode,
  redeemRewardCode: mocks.redeemRewardCode,
  restoreRewardCode: mocks.restoreRewardCode,
  formatDateTime: (value: number | null) => (value ? `server:${value}` : ""),
}));

vi.mock("../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: vi.fn((_name: string, callback: () => unknown) => callback()),
}));

describe("RewardRedemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookupRewardCode.mockResolvedValue({
      found: true,
      rewardCode: "HC-TEST-1234",
      rewardName: "Gội đầu",
      customerName: "Khách A",
      status: "unused",
      redeemableAtBranch: true,
      reason: "OK",
      createdAtMs: 100,
    });
    mocks.redeemRewardCode.mockResolvedValue({
      rewardId: "reward-a",
      rewardCode: "HC-TEST-1234",
      rewardName: "Gội đầu",
      customerName: "Khách A",
      alreadyRedeemed: false,
      usedAtMs: 1_700_000_000_123,
      usedBy: "staff-a",
      usedBranchId: "branch-a1",
      usedBranchName: "Chi nhánh A1",
    });
  });

  it("lookup dùng current branch và hiển thị usedAt authoritative từ backend", async () => {
    const user = userEvent.setup();
    render(<RewardRedemption salonId="salon-a" branchId="branch-a1" />);

    await user.type(screen.getByLabelText("Mã quà"), "HC-TEST-1234");
    await user.click(screen.getByRole("button", { name: "Kiểm tra mã" }));
    await waitFor(() =>
      expect(mocks.lookupRewardCode).toHaveBeenCalledWith({
        salonId: "salon-a",
        branchId: "branch-a1",
        rewardCode: "HC-TEST-1234",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã dùng" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đã dùng" }));

    expect(await screen.findByText("server:1700000000123")).toBeVisible();
    expect(screen.getByText("Chi nhánh A1")).toBeVisible();
  });
});
