import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const award = vi.hoisted(() => vi.fn());
vi.mock("../services/returningCustomerPoints", () => ({ awardReturningCustomerPoints: award }));
import { CustomerPointAction } from "./CustomerPointAction";
const props = {
  salonId: "salon-fixture",
  branchId: "branch-fixture",
  branchName: "Chi nhánh A",
  pointPerVisit: 1,
  customer: { id: "customer-fixture", name: "Khách mẫu", phoneLast4: "5678" },
  onAwarded: vi.fn(),
};
describe("owner customer directory point action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    award.mockResolvedValue({ pointsAdded: 1, pointsAfter: 4, alreadyProcessed: false });
  });
  it("requires explicit confirmation of the exact customer and branch", async () => {
    const user = userEvent.setup();
    render(<CustomerPointAction {...props} />);
    await user.click(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" }));
    expect(award).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("5678");
    expect(screen.getByRole("dialog")).toHaveTextContent("Chi nhánh A");
    await user.click(screen.getByRole("button", { name: "Xác nhận cộng 1 điểm" }));
    expect(await screen.findByText("Đã cộng 1 điểm.")).toBeVisible();
    expect(award).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: props.salonId,
        branchId: props.branchId,
        customerId: props.customer.id,
        phoneLast4: "5678",
        operationId: expect.any(String),
      }),
    );
    expect(props.onAwarded).toHaveBeenCalledWith(4);
  });
  it("blocks missing branches and incomplete customer phone records", () => {
    const view = render(<CustomerPointAction {...props} branchId="" />);
    expect(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" })).toBeDisabled();
    view.rerender(
      <CustomerPointAction {...props} customer={{ ...props.customer, phoneLast4: "" }} />,
    );
    expect(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" })).toBeDisabled();
  });
  it("retries the same operation after an uncertain response and blocks double submission", async () => {
    award.mockRejectedValueOnce(new Error("Mạng bị gián đoạn"));
    const user = userEvent.setup();
    render(<CustomerPointAction {...props} />);
    await user.click(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận cộng 1 điểm" }));
    expect(await screen.findByText("Mạng bị gián đoạn")).toBeVisible();
    const original = award.mock.calls[0][0];
    let finish!: (value: unknown) => void;
    award.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await user.click(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" }));
    await user.dblClick(screen.getByRole("button", { name: "Xác nhận cộng 1 điểm" }));
    expect(award).toHaveBeenCalledTimes(2);
    expect(award.mock.calls[1][0]).toEqual(original);
    finish({ pointsAdded: 1, pointsAfter: 4, alreadyProcessed: true });
    expect(await screen.findByText("Lượt này đã được ghi nhận.")).toBeVisible();
  });
  it("cancels without writing and clears a confirmation when branch changes", async () => {
    const user = userEvent.setup();
    const view = render(<CustomerPointAction {...props} />);
    await user.click(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tích điểm cho Khách mẫu" }));
    view.rerender(<CustomerPointAction {...props} branchId="branch-b" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(award).not.toHaveBeenCalled();
  });
});
