import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { HistoryPage } from "./HistoryPage";
const mocks = vi.hoisted(() => ({ getHaircutHistory: vi.fn() }));
vi.mock("../services/api", () => ({ getHaircutHistory: mocks.getHaircutHistory }));
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
});
