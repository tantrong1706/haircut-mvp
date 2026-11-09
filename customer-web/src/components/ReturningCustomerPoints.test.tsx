import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturningCustomerPoints } from "./ReturningCustomerPoints";

const mocks = vi.hoisted(() => ({ search: vi.fn(), award: vi.fn(), details: vi.fn(), listRewards: vi.fn(), useReward: vi.fn() }));
vi.mock("../services/customerRewardRedemption", () => ({
  listRedeemableCustomerRewards: mocks.listRewards,
  redeemCustomerReward: mocks.useReward,
}));
vi.mock("../services/operations", () => ({
  searchSalonCustomers: mocks.search,
  getSalonCustomerDetails: mocks.details,
}));
vi.mock("../services/returningCustomerPoints", () => ({
  awardReturningCustomerPoints: mocks.award,
}));
const customers = [
  { id: "customer-a", name: "An", phoneLast4: "5678", points: 4, lastVisitAtMs: null },
  { id: "customer-b", name: "Bình", phoneLast4: "5678", points: 7, lastVisitAtMs: null },
];
const props = {
  salonId: "salon-a",
  branchId: "branch-a",
  branchName: "Chi nhánh A",
  pointPerVisit: 2,
  canAward: true,
};
async function search() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"), "5678");
  await user.click(screen.getByRole("button", { name: "Tìm khách" }));
  await screen.findByRole("button", { name: /Chọn An/ });
  return user;
}
describe("ReturningCustomerPoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search.mockResolvedValue({ customers, nextCursor: null });
    mocks.details.mockResolvedValue({ ...customers[0], recentRecords: [] });
    mocks.award.mockResolvedValue({ pointsAdded: 2, pointsAfter: 6, alreadyProcessed: false });
  });
  it("lets reward-authorized staff find and use a gift without the points permission or a code", async () => {
    mocks.listRewards.mockResolvedValue({ rewards: [{ id: "reward-b", rewardName: "Gội đầu miễn phí", expiresAtMs: null }], nextCursor: null });
    mocks.useReward.mockResolvedValue({ rewardId: "reward-b", alreadyRedeemed: false });
    render(<ReturningCustomerPoints {...props} canAward={false} canRedeem />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn Bình/ }));
    await user.click(screen.getByRole("button", { name: "Xem quà có thể dùng" }));
    expect(await screen.findByText("Gội đầu miễn phí")).toBeVisible();
    expect(mocks.listRewards).toHaveBeenCalledWith(expect.objectContaining({
      salonId: "salon-a", branchId: "branch-a", customerId: "customer-b", phoneLast4: "5678",
    }));
    await user.click(screen.getByRole("button", { name: /Sử dụng Gội đầu miễn phí/ }));
    expect(mocks.useReward).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Xác nhận đã trao quà" }));
    expect(mocks.useReward).toHaveBeenCalledWith(expect.objectContaining({ rewardId: "reward-b", customerId: "customer-b", branchId: "branch-a" }));
    expect(await screen.findByText(/Đã xác nhận sử dụng/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Sử dụng Gội đầu miễn phí/ })).not.toBeInTheDocument();
    expect(mocks.award).not.toHaveBeenCalled();
    expect(mocks.details).not.toHaveBeenCalled();
  });
  it("accepts a pasted Vietnamese name, but requires the customer's suffix before awarding", async () => {
    const user = userEvent.setup();
    render(<ReturningCustomerPoints {...props} />);
    const lookup = screen.getByRole("textbox", { name: "Tên khách hoặc 4 số cuối điện thoại" });
    expect(lookup).not.toHaveAttribute("inputmode", "numeric");
    await user.click(lookup);
    await user.paste("Bình");
    expect(lookup).toHaveValue("Bình");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    expect(mocks.search).toHaveBeenCalledWith(
      expect.objectContaining({ term: "Bình", branchId: "branch-a" }),
    );
    await user.click(await screen.findByRole("button", { name: /Chọn Bình/ }));
    const confirm = screen.getByRole("button", { name: "Xác nhận cộng 2 điểm" });
    const suffix = screen.getByLabelText("Xác nhận 4 số cuối điện thoại");
    expect(confirm).toBeDisabled();
    await user.type(suffix, "1234");
    expect(confirm).toBeDisabled();
    expect(mocks.award).not.toHaveBeenCalled();
    await user.clear(suffix);
    await user.type(suffix, "5678");
    await user.click(confirm);
    expect(mocks.award).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "customer-b", phoneLast4: "5678" }),
    );
  });
  it("requires selecting a customer and confirming; never awards from a suffix alone", async () => {
    render(<ReturningCustomerPoints {...props} />);
    expect(screen.getByRole("button", { name: "Tìm khách" })).toBeDisabled();
    const user = await search();
    expect(mocks.award).not.toHaveBeenCalled();
    expect(screen.getByText(/trùng 4 số/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Chọn Bình/ }));
    expect(mocks.award).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Xác nhận cộng 2 điểm" }));
    await waitFor(() => expect(mocks.award).toHaveBeenCalledOnce());
    expect(mocks.award).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-a",
        branchId: "branch-a",
        customerId: "customer-b",
        phoneLast4: "5678",
        operationId: expect.any(String),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/Đã cộng 2 điểm/);
    expect(screen.queryByRole("button", { name: "Xác nhận cộng 2 điểm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm ảnh" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Thêm ghi chú" })).toBeEnabled();
  });
  it("loads internal haircut history for the selected customer within the current branch", async () => {
    mocks.details.mockResolvedValue({
      ...customers[0],
      recentRecords: [
        {
          id: "record",
          createdAtMs: 1234567890000,
          note: "Synthetic old style",
          staffName: "Staff",
          photoUrls: ["https://example.invalid/internal.jpg"],
        },
      ],
    });
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    expect(await screen.findByText("Synthetic old style")).toBeVisible();
    expect(mocks.details).toHaveBeenCalledWith({
      salonId: "salon-a",
      branchId: "branch-a",
      customerId: "customer-a",
    });
    expect(screen.getByRole("img")).toBeVisible();
    expect(mocks.award).not.toHaveBeenCalled();
  });
  it("fails closed without a branch or permission", () => {
    const { rerender } = render(<ReturningCustomerPoints {...props} branchId="" />);
    expect(screen.queryByLabelText("Tên khách hoặc 4 số cuối điện thoại")).not.toBeInTheDocument();
    rerender(<ReturningCustomerPoints {...props} canAward={false} />);
    expect(screen.queryByLabelText("Tên khách hoặc 4 số cuối điện thoại")).not.toBeInTheDocument();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("clears the selection when the search term changes", async () => {
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    await user.clear(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"));
    expect(screen.queryByRole("button", { name: "Xác nhận cộng 2 điểm" })).not.toBeInTheDocument();
  });
  it("keeps the same operation ID for a failed-response retry and prevents double click", async () => {
    mocks.award.mockRejectedValueOnce(new Error("Mất kết nối, vui lòng thử lại."));
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    await user.click(screen.getByRole("button", { name: "Xác nhận cộng 2 điểm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
    const first = mocks.award.mock.calls[0][0];
    await user.click(screen.getByRole("button", { name: "Xác nhận cộng 2 điểm" }));
    await waitFor(() => expect(mocks.award).toHaveBeenCalledTimes(2));
    expect(mocks.award.mock.calls[1][0]).toEqual(first);
  });
  it("shows no results without creating a customer", async () => {
    mocks.search.mockResolvedValue({ customers: [], nextCursor: null });
    render(<ReturningCustomerPoints {...props} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"), "5678");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    expect(await screen.findByText(/Chưa tìm thấy khách/)).toBeInTheDocument();
    expect(mocks.award).not.toHaveBeenCalled();
  });

  it("discards a previous-branch selection", async () => {
    const { rerender } = render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    rerender(<ReturningCustomerPoints {...props} branchId="branch-b" branchName="Chi nhánh B" />);
    expect(screen.queryByRole("button", { name: "Xác nhận cộng 2 điểm" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại")).toHaveValue("");
  });

  it("does not display stale search results after the suffix changes", async () => {
    let complete!: (value: unknown) => void;
    mocks.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<ReturningCustomerPoints {...props} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"), "5678");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    await user.clear(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"));
    complete({ customers, nextCursor: null });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Chọn An/ })).not.toBeInTheDocument(),
    );
  });

  it("reports a lookup error and permits a new lookup", async () => {
    mocks.search.mockRejectedValueOnce(new Error("Không tìm được khách"));
    render(<ReturningCustomerPoints {...props} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tên khách hoặc 4 số cuối điện thoại"), "5678");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm được khách");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    expect(await screen.findByRole("button", { name: /Chọn An/ })).toBeInTheDocument();
  });

  it("loads another page without automatically selecting or awarding", async () => {
    mocks.search.mockResolvedValueOnce({ customers: [customers[0]], nextCursor: "next" });
    mocks.search.mockResolvedValueOnce({
      customers: [{ ...customers[1], lastVisitAtMs: 1000 }],
      nextCursor: null,
    });
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: "Xem thêm khách" }));
    expect(await screen.findByRole("button", { name: /Chọn Bình/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chọn An/ })).toBeInTheDocument();
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "next" }));
    expect(mocks.award).not.toHaveBeenCalled();
  });

  it("blocks double submission while pending and reports an already processed retry", async () => {
    let complete!: (value: unknown) => void;
    mocks.award.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    await user.dblClick(screen.getByRole("button", { name: "Xác nhận cộng 2 điểm" }));
    expect(mocks.award).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Đang cộng điểm..." })).toBeDisabled();
    complete({ pointsAdded: 2, pointsAfter: 6, alreadyProcessed: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Lượt này đã được ghi nhận");
  });
});
