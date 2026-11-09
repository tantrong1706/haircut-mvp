import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CustomerPointAdjustment } from "./CustomerPointAdjustment";

const mocks = vi.hoisted(() => ({ adjust: vi.fn() }));
vi.mock("../services/customerPointAdjustment", () => ({ adjustSalonCustomerPoints: mocks.adjust }));

it("blocks an overdraw and retries the same confirmed adjustment after a network error", async () => {
  mocks.adjust.mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValueOnce({
    pointsBefore: 3,
    pointsAfter: 5,
    currentPoints: 5,
    alreadyProcessed: true,
  });
  const onAdjusted = vi.fn();
  const user = userEvent.setup();
  render(
    <CustomerPointAdjustment
      salonId="salon"
      customerId="customer"
      customerName="Khách mẫu"
      points={3}
      onAdjusted={onAdjusted}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Điều chỉnh điểm" }));
  await user.selectOptions(screen.getByLabelText("Thao tác điểm"), "subtract");
  await user.type(screen.getByLabelText("Số điểm điều chỉnh"), "5");
  await user.type(screen.getByLabelText("Lý do điều chỉnh"), "Sửa điểm nhập sai");
  expect(screen.getByText(/không đủ điểm/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Kiểm tra điều chỉnh" })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Thao tác điểm"), "add");
  const amount = screen.getByLabelText("Số điểm điều chỉnh");
  await user.clear(amount);
  await user.type(amount, "2");
  await user.click(screen.getByRole("button", { name: "Kiểm tra điều chỉnh" }));
  await user.click(screen.getByRole("button", { name: "Quay lại" }));
  expect(mocks.adjust).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Kiểm tra điều chỉnh" }));
  const confirm = screen.getByRole("button", { name: "Xác nhận điều chỉnh" });
  await user.click(confirm);
  expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
  await user.click(confirm);
  expect(await screen.findByText(/Điều chỉnh đã được ghi nhận/)).toBeVisible();
  expect(mocks.adjust.mock.calls[0][0]).toEqual(mocks.adjust.mock.calls[1][0]);
  expect(onAdjusted).toHaveBeenCalledWith(5);
});
