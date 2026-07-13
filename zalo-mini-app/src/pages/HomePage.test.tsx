import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import type { AppSession } from "../services/types";

const session: AppSession = {
  qr: {
    qrType: "legacy-mirror",
    salonId: "salon-a",
    branchId: "branch-a",
    mirrorId: "Gương VIP",
    qrToken: "token",
  },
  sessionId: "session-a",
  branchName: "Chi nhánh trung tâm",
  zaloUserId: "zalo-a",
  sessionStatus: "serving",
  assignedStaffName: "Nam",
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
    expect(screen.getByText("Nam đang phục vụ bạn.")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lịch sử/i }));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });

  it("giữ phiên và cho thử lại khi đồng bộ thất bại", async () => {
    const user = userEvent.setup();
    const onRetrySync = vi.fn();
    render(
      <HomePage
        session={{ ...session, sessionStatus: "pending_approval" }}
        syncStatus="error"
        syncMessage="Kết nối hệ thống đang chậm"
        onRetrySync={onRetrySync}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );

    expect(screen.getByText("Đang chờ chủ salon duyệt điểm.")).toBeInTheDocument();
    expect(screen.getByText("Kết nối hệ thống đang chậm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thử lại/i }));
    expect(onRetrySync).toHaveBeenCalledOnce();
  });
});
