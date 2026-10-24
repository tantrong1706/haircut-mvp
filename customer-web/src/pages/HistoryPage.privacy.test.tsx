import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { HistoryPage } from "./HistoryPage";
import type { AppSession } from "../services/types";
vi.mock("../services/api", () => ({ getHaircutHistory: async () => [{
  id: "synthetic-record", createdAt: "24/10/2026 09:00", pointsAdded: 1,
  note: "Internal synthetic haircut formula", staffName: "Private staff",
  photoUrls: ["https://example.invalid/private-photo.jpg"],
}] }));

it("customer history shows visit dates and points, never salon-only images or notes even from an old response", async () => {
  render(<HistoryPage session={{ qr: { salonId: "synthetic-salon" } } as AppSession} />);
  expect(await screen.findByText("24/10/2026 09:00")).toBeInTheDocument();
  expect(screen.getByText("+1")).toBeInTheDocument();
  expect(screen.queryAllByRole("img")).toHaveLength(0);
  expect(screen.queryByText("Internal synthetic haircut formula")).not.toBeInTheDocument();
  expect(screen.queryByText(/Private staff/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /chi tiết/ })).not.toBeInTheDocument();
});
