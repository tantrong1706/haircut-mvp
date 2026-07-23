import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmDialogRequest } from "./ConfirmDialog";

function DialogHarness({ busy = false }: { busy?: boolean }) {
  const [request, setRequest] = useState<ConfirmDialogRequest | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() =>
          setRequest({
            title: "Xác nhận thao tác",
            description: "Dữ liệu sẽ được cập nhật.",
            confirmLabel: "Xác nhận",
            onConfirm: vi.fn(),
          })
        }
      >
        Mở hộp thoại
      </button>
      <ConfirmDialog
        request={request}
        busy={busy}
        onCancel={() => setRequest(null)}
        onConfirm={() => undefined}
      />
    </>
  );
}

describe("ConfirmDialog accessibility", () => {
  it("focus an toàn khi mở, Escape đóng và trả focus về nút mở", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const opener = screen.getByRole("button", { name: "Mở hộp thoại" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Xác nhận thao tác");
    expect(dialog).toHaveAccessibleDescription("Dữ liệu sẽ được cập nhật.");
    expect(await screen.findByRole("button", { name: "Quay lại" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("giữ focus bên trong dialog khi Tab qua nút cuối", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận" });
    confirm.focus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Đóng" })).toHaveFocus();
  });

  it("không cho Escape đóng khi đang xử lý", async () => {
    const user = userEvent.setup();
    render(<DialogHarness busy />);
    await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
