import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { CustomerRewardActions } from "./CustomerRewardActions";

const mocks = vi.hoisted(() => ({ list: vi.fn(), redeem: vi.fn() }));
vi.mock("../services/customerRewardRedemption", () => ({
  listRedeemableCustomerRewards: mocks.list,
  redeemCustomerReward: mocks.redeem,
}));

const props = {
  salonId: "salon-a",
  branchId: "branch-a",
  branchName: "Chi nhánh A",
  customerId: "customer-a",
  customerName: "An",
};
const reward = { id: "reward-a", rewardName: "Gội đầu", expiresAtMs: 1_800_000_000_000 };

beforeEach(() => vi.resetAllMocks());

it("requires the owner to enter the customer's suffix and handles an empty or paged result", async () => {
  mocks.list
    .mockResolvedValueOnce({ rewards: [], nextCursor: "cursor-a" })
    .mockResolvedValueOnce({ rewards: [reward], nextCursor: null });
  const user = userEvent.setup();
  render(<CustomerRewardActions {...props} />);
  await user.click(screen.getByRole("button", { name: "Xem quà có thể dùng" }));
  const load = screen.getByRole("button", { name: "Tải quà của khách" });
  expect(load).toBeDisabled();
  await user.type(screen.getByLabelText("4 số cuối điện thoại để xem quà"), "1234");
  await user.click(load);
  expect(await screen.findByText("Chưa thấy quà trong trang này.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Xem thêm quà" }));
  expect(await screen.findByRole("button", { name: "Sử dụng Gội đầu" })).toBeVisible();
  expect(mocks.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ phoneLast4: "1234", cursor: "cursor-a" }),
  );
  await user.click(screen.getByRole("button", { name: "Ẩn quà của khách" }));
  expect(screen.queryByRole("button", { name: "Sử dụng Gội đầu" })).not.toBeInTheDocument();
});

it("retains the confirmation key after a lost response and clears the gift on a successful retry", async () => {
  mocks.list.mockResolvedValue({ rewards: [reward], nextCursor: null });
  mocks.redeem
    .mockRejectedValueOnce(new Error("Mất kết nối"))
    .mockResolvedValueOnce({ rewardId: reward.id, alreadyRedeemed: true });
  const user = userEvent.setup();
  render(<CustomerRewardActions {...props} verifiedPhoneLast4="1234" />);
  await user.click(screen.getByRole("button", { name: "Xem quà có thể dùng" }));
  await user.click(await screen.findByRole("button", { name: "Sử dụng Gội đầu" }));
  await user.click(screen.getByRole("button", { name: "Quay lại" }));
  expect(mocks.redeem).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sử dụng Gội đầu" }));
  const confirm = screen.getByRole("button", { name: "Xác nhận đã trao quà" });
  await user.click(confirm);
  expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
  await user.click(confirm);
  expect(await screen.findByText("Quà này đã được xác nhận trước đó.")).toBeVisible();
  expect(mocks.redeem.mock.calls[0][0]).toEqual(mocks.redeem.mock.calls[1][0]);
  expect(screen.getByText("Không có quà dùng được tại chi nhánh này.")).toBeVisible();
});

it("does not load a reward in an unselected branch and can recover a failed list", async () => {
  mocks.list
    .mockRejectedValueOnce("Offline")
    .mockResolvedValueOnce({ rewards: [], nextCursor: null });
  const user = userEvent.setup();
  const { rerender } = render(
    <CustomerRewardActions {...props} branchId="" verifiedPhoneLast4="1234" />,
  );
  expect(screen.getByRole("button", { name: "Xem quà có thể dùng" })).toBeDisabled();
  expect(mocks.list).not.toHaveBeenCalled();
  rerender(<CustomerRewardActions {...props} verifiedPhoneLast4="1234" />);
  await user.click(screen.getByRole("button", { name: "Xem quà có thể dùng" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Chưa tải được quà của khách.");
  await user.click(screen.getByRole("button", { name: "Tải quà của khách" }));
  expect(await screen.findByText("Không có quà dùng được tại chi nhánh này.")).toBeVisible();
});
