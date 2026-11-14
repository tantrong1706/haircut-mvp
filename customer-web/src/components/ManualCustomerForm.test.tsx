import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ManualCustomerForm } from "./ManualCustomerForm";
import { createManualCustomer } from "../services/manualCustomer";

vi.mock("../services/manualCustomer", () => ({ createManualCustomer: vi.fn() }));
const create = vi.mocked(createManualCustomer);
const open = (actor: ReturnType<typeof userEvent.setup>) =>
  actor.click(screen.getByRole("button", { name: /^Thêm khách$/ }));
const submit = (actor: ReturnType<typeof userEvent.setup>) =>
  actor.click(screen.getByRole("button", { name: "Lưu khách" }));
const name = () => screen.getByLabelText("Tên khách", { exact: true });
const phone = () => screen.getByLabelText("Số điện thoại (không bắt buộc)");

beforeEach(() => create.mockReset().mockResolvedValue({ customerId: "customer-fixture" }));

it("focuses the name, saves without a number, and does not reopen itself", async () => {
  const actor = userEvent.setup();
  const onCreated = vi.fn();
  render(<ManualCustomerForm salonId="salon-a" onCreated={onCreated} />);
  expect(screen.queryByLabelText("Tên khách")).toBeNull();
  await open(actor);
  expect(name()).toHaveFocus();
  expect(screen.getByRole("button", { name: "Lưu khách" })).toBeDisabled();
  await actor.type(name(), "Khách không có số");
  await submit(actor);
  expect(await screen.findByRole("status")).toHaveTextContent("Đã thêm khách");
  expect(create).toHaveBeenCalledWith({
    salonId: "salon-a",
    name: "Khách không có số",
    operationId: expect.any(String),
  });
  expect(onCreated).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Thêm khách" })).toHaveFocus();
});

it("blocks malformed numbers and retries a network error without changing the operation key", async () => {
  const actor = userEvent.setup();
  create.mockRejectedValueOnce(new Error("Mất kết nối"));
  render(<ManualCustomerForm salonId="salon-a" branchId="branch-a" branchName="Chi nhánh A" />);
  await open(actor);
  await actor.type(name(), "Khách mẫu");
  await actor.type(phone(), "090123");
  await submit(actor);
  expect(await screen.findByRole("alert")).toHaveTextContent("số di động Việt Nam");
  expect(create).not.toHaveBeenCalled();
  await actor.clear(phone());
  await actor.type(phone(), "+84 90 000 4321");
  await submit(actor);
  expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
  await submit(actor);
  expect(await screen.findByRole("status")).toBeVisible();
  expect(create.mock.calls[0][0]).toMatchObject({ branchId: "branch-a", phone: "0900004321" });
  expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
});

it("clears draft contact data when staff changes branch", async () => {
  const actor = userEvent.setup();
  const view = render(<ManualCustomerForm salonId="salon-a" branchId="branch-a" />);
  await open(actor);
  await actor.type(name(), "Khách mẫu");
  await actor.type(phone(), "0900004321");
  await actor.click(screen.getByRole("button", { name: /^Đóng$/ }));
  view.rerender(<ManualCustomerForm salonId="salon-a" branchId="branch-b" />);
  await open(actor);
  expect(name()).toHaveValue("");
  expect(phone()).toHaveValue("");
  expect(create).not.toHaveBeenCalled();
});
