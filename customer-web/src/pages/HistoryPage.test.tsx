import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { HistoryPage } from "./HistoryPage";
const mocks = vi.hoisted(() => ({ getHaircutHistory: vi.fn(), getWebCustomerVisitPhotos: vi.fn() }));
vi.mock("../services/api", () => ({ getHaircutHistory: mocks.getHaircutHistory }));
vi.mock("../services/webCustomerApi", () => ({
  getWebCustomerVisitPhotos: mocks.getWebCustomerVisitPhotos,
}));
const session = { qr: { salonId: "synthetic-salon" } } as AppSession;
describe("customer history", () => {
  beforeEach(() => vi.clearAllMocks());
  it("shows the date and points without internal salon records", async () => {
    mocks.getHaircutHistory.mockResolvedValue([{ id: "fixture", createdAt: "24/10/2026", pointsAdded: 1, note: "Private", photoUrls: [] }]);
    render(<HistoryPage session={session} />);
    expect(await screen.findByText("24/10/2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Đã cộng 1 điểm")).toBeInTheDocument();
    expect(screen.queryByText("Private")).not.toBeInTheDocument();
  });
  it("allows retry after a network failure", async () => {
    mocks.getHaircutHistory.mockRejectedValueOnce(new Error("Mạng đang gián đoạn")).mockResolvedValueOnce([]);
    render(<HistoryPage session={session} />);
    expect(await screen.findByText("Mạng đang gián đoạn")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", {name: "Thử lại"}));
    expect(await screen.findByText("Chưa có lịch sử cắt tóc")).toBeInTheDocument();
  });
  it("opens only the selected visit photo and clears it when switching customer", async () => {
    mocks.getHaircutHistory.mockResolvedValueOnce([
      { id: "photo-visit", createdAt: "24/10/2026", pointsAdded: 1, hasCustomerPhotos: true },
      { id: "no-photo", createdAt: "18/10/2026", pointsAdded: 1 },
    ]).mockResolvedValueOnce([]);
    mocks.getWebCustomerVisitPhotos.mockResolvedValue(["https://storage.googleapis.com/demo/fixture.jpg"]);
    const user = userEvent.setup();
    const { rerender } = render(<HistoryPage session={session} />);
    await screen.findByText("24/10/2026");
    expect(mocks.getWebCustomerVisitPhotos).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Xem ảnh ngày 24/10/2026" }));
    expect(await screen.findByRole("img", { name: "Ảnh kiểu tóc 1" })).toBeInTheDocument();
    expect(mocks.getWebCustomerVisitPhotos).toHaveBeenCalledWith(session, "photo-visit");
    rerender(<HistoryPage session={{ ...session, firebaseUid: "different-customer" }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(await screen.findByText("Chưa có lịch sử cắt tóc")).toBeInTheDocument();
  });
  it("keeps the visit visible when loading photos fails or consent is no longer available", async () => {
    mocks.getHaircutHistory.mockResolvedValueOnce([
      { id: "photo-visit", createdAt: "24/10/2026", pointsAdded: 1, hasCustomerPhotos: true },
    ]);
    mocks.getWebCustomerVisitPhotos.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<HistoryPage session={session} />);
    await user.click(await screen.findByRole("button", { name: "Xem ảnh ngày 24/10/2026" }));
    expect(await screen.findByText("Chưa tải được ảnh. Vui lòng thử lại.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Thử lại ngày 24/10/2026" }));
    expect(await screen.findByText("Ảnh của lượt cắt này không còn khả dụng.")).toBeVisible();
    expect(screen.getByLabelText("Đã cộng 1 điểm")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
