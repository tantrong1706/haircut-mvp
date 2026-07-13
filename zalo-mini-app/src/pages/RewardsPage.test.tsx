import { render, screen } from "@testing-library/react";
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
});
