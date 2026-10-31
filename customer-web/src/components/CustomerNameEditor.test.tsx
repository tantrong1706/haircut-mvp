import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
const save = vi.hoisted(() => vi.fn());
vi.mock("../services/customerName", () => ({ updateCustomerName: save }));
import { CustomerNameEditor } from "./CustomerNameEditor";
const props = {
  salonId: "salon-a",
  customerId: "customer-a",
  customerName: "Khách 1028",
  onSaved: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ customerId: "customer-a", name: "Anh Minh" });
});
async function edit() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Sửa tên khách/ }));
  const field = screen.getByRole("textbox", { name: "Tên khách" });
  await user.clear(field);
  await user.type(field, "Anh Minh");
  return user;
}
describe("explicit customer name editing", () => {
  it("does not write or ask for a name until the edit action is selected", () => {
    render(<CustomerNameEditor {...props} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it("saves the selected directory customer without requesting points", async () => {
    render(<CustomerNameEditor {...props} />);
    const user = await edit();
    await user.click(screen.getByRole("button", { name: "Lưu tên" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên khách.");
    expect(save).toHaveBeenCalledWith({
      salonId: "salon-a",
      customerId: "customer-a",
      name: "Anh Minh",
      expectedName: "Khách 1028",
    });
    expect(props.onSaved).toHaveBeenCalledWith("Anh Minh");
  });
  it("passes the pending request when used by a staff screen", async () => {
    render(<CustomerNameEditor {...props} pointRequestId="request-a" />);
    const user = await edit();
    await user.click(screen.getByRole("button", { name: "Lưu tên" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ pointRequestId: "request-a" }));
  });
  it("cancels without mutating customer data", async () => {
    render(<CustomerNameEditor {...props} />);
    const user = await edit();
    await user.click(screen.getByRole("button", { name: "Hủy đổi tên" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("keeps a failed draft and retries explicitly", async () => {
    save.mockRejectedValueOnce(new Error("Không có quyền sửa"));
    render(<CustomerNameEditor {...props} />);
    const user = await edit();
    await user.click(screen.getByRole("button", { name: "Lưu tên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không có quyền sửa");
    expect(screen.getByRole("textbox", { name: "Tên khách" })).toHaveValue("Anh Minh");
    expect(props.onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Lưu tên" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu tên khách.");
  });
  it("blocks empty names and disabled actions", async () => {
    const view = render(<CustomerNameEditor {...props} />);
    const user = await edit();
    await user.clear(screen.getByRole("textbox", { name: "Tên khách" }));
    expect(screen.getByRole("button", { name: "Lưu tên" })).toBeDisabled();
    view.rerender(<CustomerNameEditor {...props} disabled />);
    expect(screen.getByRole("button", { name: "Lưu tên" })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
  it("does not let an in-flight result update an unmounted editor", async () => {
    let finish!: (value: unknown) => void;
    save.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(<CustomerNameEditor {...props} />);
    const user = await edit();
    await user.dblClick(screen.getByRole("button", { name: "Lưu tên" }));
    expect(save).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => finish({ customerId: "customer-a", name: "Anh Minh" }));
    expect(props.onSaved).not.toHaveBeenCalled();
  });
});
