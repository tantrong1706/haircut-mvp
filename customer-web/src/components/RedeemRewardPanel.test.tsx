import { act, render, screen, waitFor } from "@testing-library/react";
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

  it("requires an explicit branch and invalidates the checked code when the owner switches branches", async () => {
    const user = userEvent.setup();
    render(<RedeemRewardPanel salonId="salon-a" allowRestore branchChoices={[
      { id: "branch-a1", name: "Chi nhánh Một" },
      { id: "branch-a2", name: "Chi nhánh Hai" },
    ]} />);
    const branch = screen.getByRole("combobox", { name: "Chi nhánh đổi quà" });
    const check = screen.getByRole("button", { name: "Kiểm tra mã" });
    expect(check).toBeDisabled();
    await user.selectOptions(branch, "branch-a1");
    await user.type(screen.getByLabelText("Mã quà"), "HC-TEST");
    await user.click(check);
    expect(await screen.findByText("Mã còn hiệu lực")).toBeVisible();
    expect(mocks.lookupRewardCode).toHaveBeenLastCalledWith({
      salonId: "salon-a", branchId: "branch-a1", rewardCode: "HC-TEST",
    });
    await user.selectOptions(branch, "branch-a2");
    expect(screen.queryByText("Mã còn hiệu lực")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận khách đã dùng" })).toBeDisabled();
    await user.click(check);
    expect(mocks.lookupRewardCode).toHaveBeenLastCalledWith({
      salonId: "salon-a", branchId: "branch-a2", rewardCode: "HC-TEST",
    });
    expect(mocks.redeemRewardCode).not.toHaveBeenCalled();
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

    await user.click(screen.getByRole("button", { name: "Xác nhận đã trao quà" }));
    expect(mocks.redeemRewardCode).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Đã xác nhận Gội đầu miễn phí/)).toBeInTheDocument();
  });

  it("uses the only active branch automatically and blocks lookup if there are none", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RedeemRewardPanel salonId="salon-a" branchChoices={[]} />);
    expect(screen.getByText("Chưa có chi nhánh hoạt động để đổi quà.")).toBeVisible();
    expect(screen.getByLabelText("Mã quà")).toBeDisabled();
    rerender(<RedeemRewardPanel salonId="salon-a" branchChoices={[{ id: "branch-a1", name: "Chi nhánh Một" }]} />);
    expect(screen.getByText("Chi nhánh đổi quà: Chi nhánh Một")).toBeVisible();
    await user.type(screen.getByLabelText("Mã quà"), "HC-TEST");
    await user.click(screen.getByRole("button", { name: "Kiểm tra mã" }));
    expect(mocks.lookupRewardCode).toHaveBeenLastCalledWith({ salonId: "salon-a", branchId: "branch-a1", rewardCode: "HC-TEST" });
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

  it("nhận mã từ scanner nhưng vẫn bắt nhân viên kiểm tra trước", async () => {
    render(<RedeemRewardPanel salonId="salon-a" branchId="branch-a1" />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("haircut:reward-code-scanned", { detail: "HC-SCANNED12" }),
      );
    });
    await waitFor(() => expect(screen.getByLabelText("Mã quà")).toHaveValue("HC-SCANNED12"));
    expect(screen.getByText(/Hãy kiểm tra trước khi xác nhận/)).toBeVisible();
    expect(mocks.lookupRewardCode).not.toHaveBeenCalled();
    expect(mocks.redeemRewardCode).not.toHaveBeenCalled();
  });
});
