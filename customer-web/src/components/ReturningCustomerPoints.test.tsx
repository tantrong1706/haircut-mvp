import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturningCustomerPoints } from "./ReturningCustomerPoints";

const mocks = vi.hoisted(() => ({ search: vi.fn(), award: vi.fn() }));
vi.mock("../services/operations", () => ({ searchSalonCustomers: mocks.search }));
vi.mock("../services/returningCustomerPoints", () => ({ awardReturningCustomerPoints: mocks.award }));
const customers = [
  { id: "customer-a", name: "An", phoneLast4: "5678", points: 4, lastVisitAtMs: null },
  { id: "customer-b", name: "Bình", phoneLast4: "5678", points: 7, lastVisitAtMs: null },
];
const props = { salonId: "salon-a", branchId: "branch-a", branchName: "Chi nhánh A", pointPerVisit: 2, canAward: true };
async function search() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("4 số cuối điện thoại"), "5678");
  await user.click(screen.getByRole("button", { name: "Tìm khách" }));
  await screen.findByRole("button", { name: /Chọn An/ });
  return user;
}
describe("ReturningCustomerPoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.search.mockResolvedValue({ customers, nextCursor: null });
    mocks.award.mockResolvedValue({ pointsAdded: 2, pointsAfter: 6, alreadyProcessed: false });
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
    expect(mocks.award).toHaveBeenCalledWith(expect.objectContaining({ salonId: "salon-a", branchId: "branch-a", customerId: "customer-b", phoneLast4: "5678", operationId: expect.any(String) }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Đã cộng 2 điểm/);
    expect(screen.queryByRole("button", { name: "Xác nhận cộng 2 điểm" })).not.toBeInTheDocument();
  });
  it("fails closed without a branch or permission", () => {
    const { rerender } = render(<ReturningCustomerPoints {...props} branchId="" />);
    expect(screen.queryByLabelText("4 số cuối điện thoại")).not.toBeInTheDocument();
    rerender(<ReturningCustomerPoints {...props} canAward={false} />);
    expect(screen.queryByLabelText("4 số cuối điện thoại")).not.toBeInTheDocument();
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("clears the selection when the search term changes", async () => {
    render(<ReturningCustomerPoints {...props} />);
    const user = await search();
    await user.click(screen.getByRole("button", { name: /Chọn An/ }));
    await user.clear(screen.getByLabelText("4 số cuối điện thoại"));
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
    await user.type(screen.getByLabelText("4 số cuối điện thoại"), "5678");
    await user.click(screen.getByRole("button", { name: "Tìm khách" }));
    expect(await screen.findByText(/Chưa tìm thấy khách/)).toBeInTheDocument();
    expect(mocks.award).not.toHaveBeenCalled();
  });
});
