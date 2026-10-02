import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HaircutPhotoCapture } from "./HaircutPhotoCapture";

describe("HaircutPhotoCapture", () => {
  beforeAll(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("luôn hiện camera nhưng khóa khi khách chưa đồng ý", () => {
    render(<HaircutPhotoCapture photos={[]} consentGranted={false} onFilesSelected={vi.fn()} />);

    expect(screen.getByLabelText("Chụp ảnh kiểu tóc")).toBeDisabled();
    expect(screen.getByText("Chưa có đồng ý")).toBeInTheDocument();
    expect(screen.getByText(/Camera được khóa để bảo vệ quyền riêng tư/i)).toBeInTheDocument();
  });

  it("mở camera sau, hiển thị preview và chỉ upload sau khi xác nhận", async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-a");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<HaircutPhotoCapture photos={[]} consentGranted onFilesSelected={onFilesSelected} />);

    const cameraInput = screen.getByLabelText("Chụp ảnh kiểu tóc");
    expect(cameraInput).toHaveAttribute("capture", "environment");
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "toc-moi.jpg", {
      type: "image/jpeg",
    });
    await user.upload(cameraInput, photo);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByAltText("Ảnh chờ tải 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(onFilesSelected).toHaveBeenCalledWith([photo]);
  });

  it("cho xóa ảnh nháp trước khi upload và thu hồi object URL", async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-a");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    render(<HaircutPhotoCapture photos={[]} consentGranted onFilesSelected={onFilesSelected} />);

    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "toc-moi.jpg", {
      type: "image/jpeg",
    });
    await user.upload(screen.getByLabelText("Chụp ảnh kiểu tóc"), photo);
    await user.click(screen.getByRole("button", { name: "Xóa ảnh chờ tải 1" }));

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-a");
  });

  it("hiện ảnh đã tải và cho xóa", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const photo = { id: "photo-a", url: "https://example.com/photo-a.jpg" };
    render(
      <HaircutPhotoCapture
        photos={[photo]}
        consentGranted
        onFilesSelected={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByAltText("Ảnh kiểu tóc 1")).toHaveAttribute("src", photo.url);
    await user.click(screen.getByRole("button", { name: "Xóa ảnh kiểu tóc 1" }));
    expect(onRemove).toHaveBeenCalledWith(photo);
  });
});
