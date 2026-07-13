import { render, screen } from "@testing-library/react";
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

  it("hiển thị ảnh kiểu tóc đã được chủ salon duyệt", async () => {
    mocks.getHaircutHistory.mockResolvedValue([
      {
        id: "record-a",
        createdAt: "12/07/2026",
        staffName: "Nam",
        note: "Fade thấp, giữ mái",
        photoUrls: ["https://firebasestorage.googleapis.com/photo-a.jpg"],
        pointsAdded: 2,
      },
    ]);

    render(<HistoryPage session={session} />);

    expect(await screen.findByAltText("Ảnh kiểu tóc lần cắt 1")).toHaveAttribute(
      "src",
      "https://firebasestorage.googleapis.com/photo-a.jpg",
    );
    expect(screen.getByText("Fade thấp, giữ mái")).toBeInTheDocument();
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
