import { render, screen } from "@testing-library/react";
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
  qr: { salonId: "salon-a", mirrorId: "mirror-a", qrToken: "qr-token" },
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
});
