export type FocusTarget = {
  focus: () => void;
};

export function handleDialogKeyboard(input: {
  key: string;
  shiftKey: boolean;
  busy: boolean;
  activeElement: FocusTarget | null;
  focusable: FocusTarget[];
  preventDefault: () => void;
  onCancel: () => void;
}) {
  if (input.key === "Escape") {
    if (!input.busy) {
      input.preventDefault();
      input.onCancel();
    }
    return;
  }

  if (input.key !== "Tab" || input.focusable.length === 0) return;
  const first = input.focusable[0];
  const last = input.focusable[input.focusable.length - 1];
  const activeIndex = input.focusable.indexOf(input.activeElement as FocusTarget);

  if (activeIndex === -1 || (input.shiftKey && input.activeElement === first)) {
    input.preventDefault();
    last.focus();
  } else if (!input.shiftKey && input.activeElement === last) {
    input.preventDefault();
    first.focus();
  }
}
