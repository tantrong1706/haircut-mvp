import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OwnerConfirmDialog } from "./OwnerConfirmDialog";
const request = { title: "Xác nhận thao tác", description: "Thông tin thử", confirmLabel: "Xác nhận", onConfirm: () => undefined };
describe("OwnerConfirmDialog", () => {
  it("does not render a closed dialog", () => {
    render(<OwnerConfirmDialog request={null} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("focuses cancel, traps Tab and restores the trigger after Escape", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Mở</button><OwnerConfirmDialog request={open ? request : null} busy={false} onCancel={() => setOpen(false)} onConfirm={vi.fn()} /></>;
    }
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Mở" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Hủy" })).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: "Xác nhận" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Hủy" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("does not cancel or submit while busy", async () => {
    const cancel = vi.fn(), confirm = vi.fn();
    render(<OwnerConfirmDialog request={request} busy onCancel={cancel} onConfirm={confirm} />);
    expect(screen.getByRole("button", { name: "Đang xử lý..." })).toBeDisabled();
    await userEvent.setup().keyboard("{Escape}{Tab}");
    expect(cancel).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveFocus();
  });
  it("keeps custom labels and danger style, confirming only on explicit click", async () => {
    const cancel = vi.fn(), confirm = vi.fn();
    render(<OwnerConfirmDialog request={{ ...request, tone: "danger", cancelLabel: "Quay lại" }} busy={false} onCancel={cancel} onConfirm={confirm} />);
    expect(screen.getByRole("dialog")).toHaveClass("danger");
    await userEvent.setup().click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(confirm).toHaveBeenCalledOnce();
    await userEvent.setup().click(screen.getByRole("button", { name: "Quay lại" }));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("moves keyboard focus from the dialog container into its controls", () => {
    render(<OwnerConfirmDialog request={request} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Hủy" })).toHaveFocus();
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Xác nhận" })).toHaveFocus();
  });
});
