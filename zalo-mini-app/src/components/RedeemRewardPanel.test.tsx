import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedeemRewardPanel } from "./RedeemRewardPanel";

const mocks = vi.hoisted(() => ({
  lookupRewardCode: vi.fn(),
  redeemRewardCode: vi.fn(),
  restoreRewardCode: vi.fn(),
}));

vi.mock("../services/operations", () => ({
  formatDateTime: () => "13/07/2026 10:00",
  lookupRewardCode: mocks.lookupRewardCode,
  redeemRewardCode: mocks.redeemRewardCode,
  restoreRewardCode: mocks.restoreRewardCode,
}));

vi.mock("../services/monitoring", () => ({
  trackEvent: vi.fn(),
  withMonitoringTrace: (_name: string, action: () => Promise<unknown>) => action(),
}));

describe("RedeemRewardPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookupRewardCode.mockResolvedValue({
      found: true,
      rewardId: "reward-a",
      rewardCode: "HC-TEST",
      rewardName: "Gội đầu miễn phí",
      customerName: "Anh Tân",
      status: "unused",
      createdAtMs: Date.now(),
    });
    mocks.redeemRewardCode.mockResolvedValue({
      rewardId: "reward-a",
      rewardCode: "HC-TEST",
      rewardName: "Gội đầu miễn phí",
      customerName: "Anh Tân",
    });
  });

  it("chỉ đổi quà sau bước xác nhận", async () => {
    const user = userEvent.setup();
    render(<RedeemRewardPanel salonId="salon-a" branchId="branch-a1" />);

    await user.type(screen.getByLabelText("Mã quà"), "hc-test");
    await user.click(screen.getByRole("button", { name: "Kiểm tra mã" }));
    expect(mocks.lookupRewardCode).toHaveBeenCalledWith({
      salonId: "salon-a",
      branchId: "branch-a1",
      rewardCode: "HC-TEST",
    });
    await user.click(await screen.findByRole("button", { name: "Xác nhận khách đã dùng" }));

    expect(screen.queryByRole("button", { name: "Copy mã" })).not.toBeInTheDocument();

    expect(screen.getByRole("dialog", { name: "Xác nhận sử dụng quà?" })).toBeInTheDocument();
    expect(mocks.redeemRewardCode).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận đã dùng" }));
    expect(mocks.redeemRewardCode).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Đã xác nhận Gội đầu miễn phí/)).toBeInTheDocument();
  });

  it("phân biệt request lặp với lần sử dụng mới", async () => {
    const user = userEvent.setup();
    mocks.redeemRewardCode.mockResolvedValue({
      rewardId: "reward-a",
      rewardCode: "HC-TEST",
      rewardName: "Gội đầu miễn phí",
      customerName: "Anh Tân",
      alreadyRedeemed: true,
    });
    render(<RedeemRewardPanel salonId="salon-a" branchId="branch-a1" />);

    await user.type(screen.getByLabelText("Mã quà"), "HC-TEST");
    await user.click(screen.getByRole("button", { name: "Kiểm tra mã" }));
    await user.click(await screen.findByRole("button", { name: "Xác nhận khách đã dùng" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đã trao quà" }));

    expect(await screen.findByText(/Mã quà này đã được xác nhận trước đó/)).toBeInTheDocument();
  });
});
