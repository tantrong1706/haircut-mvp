import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { HistoryPage } from "./HistoryPage";

const mocks = vi.hoisted(() => ({
  getHaircutHistory: vi.fn(),
}));

vi.mock("../services/api", () => ({
  getHaircutHistory: mocks.getHaircutHistory,
}));

const session: AppSession = {
  qr: {
    qrType: "legacy-mirror",
    salonId: "salon-a",
    branchId: "branch-a",
    mirrorId: "mirror-a",
    qrToken: "qr-token",
  },
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  customer: {
    customerId: "customer-a",
    name: "Anh Tân",
    points: 5,
    allowPhoto: true,
  },
};

describe("HistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hiển thị thumbnail ảnh đầu và badge số ảnh còn lại", async () => {
    mocks.getHaircutHistory.mockResolvedValue([
      {
        id: "record-a",
        createdAt: "12/07/2026 14:30",
        salonName: "CH Haircut Salon",
        branchId: "branch-a",
        branchName: "Chi nhánh Quận 1",
        staffName: "Nam",
        serviceName: "Cắt tạo kiểu",
        note: "Fade thấp, giữ mái",
        photoUrls: [
          "https://firebasestorage.googleapis.com/photo-a.jpg",
          "https://firebasestorage.googleapis.com/photo-b.jpg",
          "https://firebasestorage.googleapis.com/photo-c.jpg",
        ],
        pointsAdded: 2,
      },
    ]);

    render(<HistoryPage session={session} />);

    expect(await screen.findByAltText("Ảnh đại diện lần cắt 12/07/2026 14:30")).toHaveAttribute(
      "src",
      "https://firebasestorage.googleapis.com/photo-a.jpg",
    );
    expect(screen.queryByAltText("Ảnh kiểu tóc lần cắt 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Còn 2 ảnh")).toHaveTextContent("+2");
    expect(screen.getByText("Fade thấp, giữ mái")).toBeInTheDocument();
  });

  it("mở đúng detail, xem đủ ảnh, chuyển ảnh và đóng bằng nút hoặc Escape", async () => {
    const user = userEvent.setup();
    mocks.getHaircutHistory.mockResolvedValue([
      {
        id: "record-a",
        createdAt: "12/07/2026 14:30",
        salonName: "CH Haircut Salon",
        branchId: "branch-a",
        branchName: "Chi nhánh Quận 1",
        staffName: "Nam",
        serviceName: "Cắt tạo kiểu",
        note: "Fade thấp, giữ mái",
        photoUrls: [
          "https://firebasestorage.googleapis.com/photo-a.jpg",
          "https://firebasestorage.googleapis.com/photo-b.jpg",
        ],
        pointsAdded: 2,
      },
      {
        id: "record-b",
        createdAt: "11/07/2026 09:00",
        salonName: "CH Haircut Salon",
        branchId: "branch-b",
        branchName: "Chi nhánh Quận 3",
        staffName: "Lan",
        note: "Tỉa gọn",
        photoUrls: [],
        pointsAdded: 1,
      },
    ]);
    render(<HistoryPage session={session} />);

    await user.click(await screen.findByRole("button", { name: /12\/07\/2026 14:30/ }));
    const dialog = screen.getByRole("dialog", { name: "Chi tiết lần cắt" });
    expect(within(dialog).getByText("Chi nhánh Quận 1")).toBeInTheDocument();
    expect(within(dialog).getByText("Cắt tạo kiểu")).toBeInTheDocument();
    expect(within(dialog).getByText("Fade thấp, giữ mái")).toBeInTheDocument();
    expect(within(dialog).getByAltText("Ảnh lớn 1 trong 2")).toHaveAttribute(
      "src",
      "https://firebasestorage.googleapis.com/photo-a.jpg",
    );
    await user.click(within(dialog).getByRole("button", { name: "Ảnh tiếp theo" }));
    expect(within(dialog).getByAltText("Ảnh lớn 2 trong 2")).toHaveAttribute(
      "src",
      "https://firebasestorage.googleapis.com/photo-b.jpg",
    );

    await user.click(within(dialog).getByRole("button", { name: "Đóng chi tiết" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /11\/07\/2026 09:00/ }));
    expect(within(screen.getByRole("dialog")).getByText("Không có ảnh")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cho thử lại tại chỗ sau lỗi mạng", async () => {
    const user = userEvent.setup();
    mocks.getHaircutHistory
      .mockRejectedValueOnce(new Error("Mạng đang gián đoạn"))
      .mockResolvedValueOnce([]);

    render(<HistoryPage session={session} />);

    expect(await screen.findByText("Mạng đang gián đoạn")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Chưa có lịch sử cắt tóc")).toBeInTheDocument();
    expect(mocks.getHaircutHistory).toHaveBeenCalledTimes(2);
  });
});
