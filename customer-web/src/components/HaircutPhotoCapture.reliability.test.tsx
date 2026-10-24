import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HaircutPhotoCapture } from "./HaircutPhotoCapture";
import * as permission from "../services/cameraPermission";

describe("photo capture reliability", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = vi.fn(() => "blob:synthetic-preview");
      static revokeObjectURL = vi.fn();
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], "fixture.jpg", { type: "image/jpeg" });

  it("opens the native file picker without waiting for the unrelated camera permission API", async () => {
    vi.spyOn(permission, "inspectCameraPermission").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<HaircutPhotoCapture photos={[]} consentGranted onFilesSelected={vi.fn()} />);
    const input = screen.getByLabelText("Chụp ảnh kiểu tóc");
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: /Chụp ảnh Camera sau/ }));
    expect(click).toHaveBeenCalledOnce();
  });

  it("locks confirmation if consent is withdrawn after selecting a draft", async () => {
    const user = userEvent.setup(), upload = vi.fn();
    const view = render(<HaircutPhotoCapture photos={[]} consentGranted onFilesSelected={upload} />);
    await user.upload(screen.getByLabelText("Chụp ảnh kiểu tóc"), photo());
    view.rerender(<HaircutPhotoCapture photos={[]} consentGranted={false} onFilesSelected={upload} />);
    expect(screen.getByRole("button", { name: "Tải 1 ảnh" })).toBeDisabled();
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByAltText("Ảnh chờ tải 1")).toBeInTheDocument();
  });
});
