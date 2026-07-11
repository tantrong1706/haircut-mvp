import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import type { AppSession } from "../services/types";

const session: AppSession = {
  qr: { salonId: "salon-a", mirrorId: "Gương VIP", qrToken: "token" },
  sessionId: "session-a",
  zaloUserId: "zalo-a",
  sessionStatus: "serving",
  customer: {
    customerId: "customer-a",
    name: "Anh Tân",
    phoneLast4: "6789",
    points: 7,
    allowPhoto: false,
  },
};

describe("HomePage", () => {
  it("hiển thị đúng trạng thái khách và chuyển tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<HomePage session={session} onTabChange={onTabChange} onResetSession={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Anh Tân" })).toBeInTheDocument();
    expect(screen.getByText("Đang chờ chủ salon duyệt điểm.")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lịch sử/i }));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });
});
