import { act, render, screen } from "@testing-library/react";
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

beforeEach(() => {
  create.mockReset().mockResolvedValue({ customerId: "customer-fixture" });
});

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
  expect(phone()).toHaveAttribute("aria-invalid", "true");
  expect(phone()).toHaveAccessibleDescription(/số di động Việt Nam/);
  expect(phone()).toHaveFocus();
  expect(create).not.toHaveBeenCalled();
  await actor.clear(phone());
  expect(phone()).not.toHaveAttribute("aria-invalid", "true");
  expect(screen.queryByRole("alert")).toBeNull();
  await actor.type(phone(), "+84 90 000 4321");
  await submit(actor);
  expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
  expect(phone()).not.toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "Lưu khách" })).toHaveFocus();
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

it("requires the visit branch and records photo consent only after an explicit choice", async () => {
  const actor = userEvent.setup();
  create.mockResolvedValue({ customerId: "customer-fixture", sessionId: "visit-fixture" });
  const onCreated = vi.fn();
  render(
    <ManualCustomerForm
      mode="visit"
      salonId="salon-a"
      branches={[
        { id: "branch-a", name: "Chi nhánh A" },
        { id: "branch-b", name: "Chi nhánh B" },
      ]}
      onCreated={onCreated}
    />,
  );
  await actor.click(screen.getByRole("button", { name: "Thêm khách trực tiếp" }));
  expect(name()).toHaveValue("");
  expect(phone()).toHaveValue("");
  const createVisit = screen.getByRole("button", { name: "Tạo lượt chờ" });
  const consent = screen.getByRole("checkbox", { name: /Khách đã đồng ý/ });
  expect(consent).not.toBeChecked();
  await actor.type(name(), "Khách trực tiếp");
  expect(createVisit).toBeDisabled();
  await actor.selectOptions(screen.getByLabelText("Chi nhánh phục vụ"), "branch-b");
  await actor.click(consent);
  await actor.click(createVisit);
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Đã tạo lượt chờ xác nhận. Chưa cộng điểm.",
  );
  expect(create).toHaveBeenLastCalledWith({
    salonId: "salon-a",
    branchId: "branch-b",
    name: "Khách trực tiếp",
    startVisit: true,
    allowPhoto: true,
    operationId: expect.any(String),
  });
  expect(onCreated).toHaveBeenCalledWith("visit-fixture");
});

it("does not announce a pending visit when an older server returns only a profile", async () => {
  const actor = userEvent.setup();
  const onCreated = vi.fn();
  render(
    <ManualCustomerForm mode="visit" salonId="salon-a" branchId="branch-a" onCreated={onCreated} />,
  );
  await actor.click(screen.getByRole("button", { name: "Thêm khách trực tiếp" }));
  await actor.type(name(), "Khách mẫu");
  await actor.click(screen.getByRole("button", { name: "Tạo lượt chờ" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Máy chủ chưa trả lượt chờ");
  expect(screen.queryByRole("status")).toBeNull();
  expect(onCreated).not.toHaveBeenCalled();
  expect(create).toHaveBeenLastCalledWith(
    expect.objectContaining({ startVisit: true, allowPhoto: false }),
  );
});

it("announces a pending save, disables edits, and restores focus when the visit is ready", async () => {
  const actor = userEvent.setup();
  let complete!: () => void;
  create.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = () => resolve({ customerId: "customer-fixture", sessionId: "visit-fixture" });
    }),
  );
  render(<ManualCustomerForm mode="visit" salonId="salon-a" branchId="branch-a" />);
  const trigger = screen.getByRole("button", { name: "Thêm khách trực tiếp" });
  await actor.click(trigger);
  const form = screen.getByRole("form", { name: "Tạo lượt khách trực tiếp" });
  expect(screen.getByRole("heading", { name: "Tạo lượt khách trực tiếp" })).toBeVisible();
  expect(form).toHaveAccessibleDescription(/không tự cộng điểm/i);
  expect(phone()).toHaveAccessibleDescription(/để trống/i);
  await actor.type(name(), "Khách mẫu");
  await actor.click(screen.getByRole("button", { name: "Tạo lượt chờ" }));
  expect(form).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Đóng" })).toBeDisabled();
  expect(phone()).toBeDisabled();
  expect(trigger).toBeDisabled();
  expect(create).toHaveBeenCalledOnce();

  await act(async () => complete());
  expect(await screen.findByRole("status")).toHaveTextContent("Chưa cộng điểm");
  expect(form).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
