import { describe, expect, it, vi } from "vitest";
import { handleDialogKeyboard, type FocusTarget } from "./dialogKeyboard";

function target(): FocusTarget {
  return { focus: vi.fn() };
}

describe("bàn phím ConfirmDialog", () => {
  it("Escape đóng dialog khi không bận", () => {
    const onCancel = vi.fn();
    const preventDefault = vi.fn();
    handleDialogKeyboard({
      key: "Escape",
      shiftKey: false,
      busy: false,
      activeElement: null,
      focusable: [],
      preventDefault,
      onCancel,
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("không cho Escape đóng khi thao tác đang chạy", () => {
    const onCancel = vi.fn();
    handleDialogKeyboard({
      key: "Escape",
      shiftKey: false,
      busy: true,
      activeElement: null,
      focusable: [],
      preventDefault: vi.fn(),
      onCancel,
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("Tab ở nút cuối quay lại nút đầu", () => {
    const first = target();
    const last = target();
    const preventDefault = vi.fn();
    handleDialogKeyboard({
      key: "Tab",
      shiftKey: false,
      busy: false,
      activeElement: last,
      focusable: [first, last],
      preventDefault,
      onCancel: vi.fn(),
    });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("Shift+Tab ở nút đầu quay lại nút cuối", () => {
    const first = target();
    const last = target();
    handleDialogKeyboard({
      key: "Tab",
      shiftKey: true,
      busy: false,
      activeElement: first,
      focusable: [first, last],
      preventDefault: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(last.focus).toHaveBeenCalledOnce();
  });
});
