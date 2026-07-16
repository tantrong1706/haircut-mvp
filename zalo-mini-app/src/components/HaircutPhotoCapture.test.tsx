import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HaircutPhotoCapture } from "./HaircutPhotoCapture";

describe("HaircutPhotoCapture", () => {
  it("luôn hiện camera nhưng khóa khi khách chưa đồng ý", () => {
    render(<HaircutPhotoCapture photos={[]} consentGranted={false} onFilesSelected={vi.fn()} />);

    expect(screen.getByLabelText("Chụp ảnh kiểu tóc")).toBeDisabled();
    expect(screen.getByText("Chưa có đồng ý")).toBeInTheDocument();
    expect(screen.getByText(/Camera được khóa để bảo vệ quyền riêng tư/i)).toBeInTheDocument();
  });

  it("mở camera sau và chuyển ảnh đã chọn cho luồng tải lên", async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    render(<HaircutPhotoCapture photos={[]} consentGranted onFilesSelected={onFilesSelected} />);

    const cameraInput = screen.getByLabelText("Chụp ảnh kiểu tóc");
    expect(cameraInput).toHaveAttribute("capture", "environment");
    const photo = new File([new Uint8Array([1, 2, 3])], "toc-moi.jpg", {
      type: "image/jpeg",
    });
    await user.upload(cameraInput, photo);

    expect(onFilesSelected).toHaveBeenCalledWith([photo]);
  });

  it("hiện ảnh xem trước và cho chụp lại bằng cách xóa ảnh", async () => {
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
