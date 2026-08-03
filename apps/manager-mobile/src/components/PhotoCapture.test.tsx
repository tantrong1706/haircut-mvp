import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PhotoCapture } from "./PhotoCapture";

const mocks = vi.hoisted(() => ({ inspectCameraPermission: vi.fn() }));

vi.mock("../services/managerApi", () => ({
  cameraPermissionMessage: (state: string) => (state === "denied" ? "Camera đang bị chặn." : ""),
  inspectCameraPermission: mocks.inspectCameraPermission,
}));

beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:manager-photo-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe("PhotoCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspectCameraPermission.mockResolvedValue("granted");
  });

  it("chỉ gửi ảnh sau khi người dùng xác nhận preview", async () => {
    const user = userEvent.setup();
    const onFilesSelected = vi.fn();
    render(<PhotoCapture photos={[]} consentGranted onFilesSelected={onFilesSelected} />);

    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "haircut.jpg", {
      type: "image/jpeg",
    });
    await user.upload(screen.getByLabelText("Chọn ảnh kiểu tóc từ máy"), photo);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByAltText("Ảnh chờ tải 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tải 1 ảnh" }));
    expect(onFilesSelected).toHaveBeenCalledWith([photo]);
  });

  it("phân loại quyền camera bị chặn nhưng vẫn giữ lựa chọn thư viện", async () => {
    const user = userEvent.setup();
    mocks.inspectCameraPermission.mockResolvedValue("denied");
    render(<PhotoCapture photos={[]} consentGranted onFilesSelected={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Chụp ảnh/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Camera đang bị chặn.");
    expect(screen.getByLabelText("Chọn ảnh kiểu tóc từ máy")).toBeEnabled();
  });

  it("hiển thị tiến độ và cho hủy upload", async () => {
    const user = userEvent.setup();
    const onCancelUpload = vi.fn();
    render(
      <PhotoCapture
        photos={[]}
        consentGranted
        busy
        progress={42}
        onCancelUpload={onCancelUpload}
        onFilesSelected={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Đã tải 42%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hủy tải" }));
    expect(onCancelUpload).toHaveBeenCalledOnce();
  });
});
