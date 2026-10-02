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
  it.each([
    ["waiting", "Salon đã nhận khách."],
    ["serving", "Nhân viên đang phục vụ bạn."],
    ["pending_approval", "Đã gửi yêu cầu. Nhân viên chi nhánh sẽ xác nhận điểm."],
    ["completed", "Điểm đã được cập nhật."],
    ["cancelled", "Lượt này không cộng điểm."],
  ] as const)("giữ đúng nội dung trạng thái %s khi đổi giao diện", (sessionStatus, message) => {
    render(
      <HomePage
        session={{
          ...session,
          sessionStatus,
          assignedStaffName: "",
          branchName: "",
          mirrorName: "",
          branchAddress: "Địa chỉ chi nhánh",
        }}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );
    expect(screen.getByText(message)).toBeVisible();
  });

  it("để khách biết trạng thái đồng bộ và giữ thao tác quét lại sau khi hoàn tất", async () => {
    const onResetSession = vi.fn();
    const props = {
      session: { ...session, sessionStatus: "completed" as const },
      onTabChange: vi.fn(),
      onResetSession,
    };
    const view = render(<HomePage {...props} syncStatus="syncing" />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang cập nhật trạng thái");
    view.rerender(<HomePage {...props} syncStatus="synced" lastSyncedAtMs={1_800_000_000_000} />);
    expect(screen.getByText(/Cập nhật lúc/)).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Quét QR cho lần tiếp theo" }));
    expect(onResetSession).toHaveBeenCalledOnce();
  });

  it("sau xác nhận web chỉ hiển thị một kết quả, không lặp ba bước đã xong", () => {
    render(
      <HomePage
        session={{
          ...session,
          identityProvider: "firebase",
          sessionStatus: "completed",
          customer: { ...session.customer, nextPointEligibleAtMs: Date.now() + 3_600_000 },
        }}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Đã cộng điểm");
    expect(screen.queryByText("Đã gửi yêu cầu")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã hoàn tất")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Quét QR cho lần tiếp theo" }),
    ).not.toBeInTheDocument();
  });

  it("hiển thị thẻ thành viên với điểm thật và số điện thoại đã che", () => {
    render(<HomePage session={session} onTabChange={vi.fn()} onResetSession={vi.fn()} />);
    const card = screen.getByRole("region", { name: "Thẻ thành viên" });
    expect(card).toHaveTextContent("7");
    expect(card).toHaveTextContent("•••• 6789");
    expect(screen.getByRole("progressbar", { name: "Tiến độ vòng quay" })).toHaveAttribute(
      "aria-valuemax",
      "5",
    );
  });

  it("không mời quét QR hay hiện thời gian cooldown trên tài khoản web", () => {
    render(
      <HomePage
        session={{
          ...session,
          identityProvider: "firebase",
          sessionId: "",
          sessionStatus: undefined,
          customer: {
            ...session.customer,
            nextPointEligibleAtMs: Date.now() + 60 * 60_000,
          },
        }}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Quét QR tại chi nhánh/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ (phút|giờ)/)).not.toBeInTheDocument();
  });

  it("xem tài khoản không QR không hiển thị như một yêu cầu tích điểm đã gửi", () => {
    render(
      <HomePage
        session={{
          ...session,
          identityProvider: "firebase",
          sessionId: "",
          sessionStatus: undefined,
        }}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Anh Tân" })).toBeVisible();
    expect(screen.queryByText("Đã gửi yêu cầu")).not.toBeInTheDocument();
    expect(screen.getByText(/Quét QR tại chi nhánh để yêu cầu tích điểm/)).toBeVisible();
  });
  it("hiển thị đúng trạng thái khách và chuyển tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<HomePage session={session} onTabChange={onTabChange} onResetSession={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Anh Tân" })).toBeInTheDocument();
    expect(screen.getByText("Nam đang phục vụ bạn.")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Bạn đã đủ điểm để quay.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tiến độ vòng quay" })).toHaveAttribute(
      "aria-valuenow",
      "5",
    );

    await user.click(screen.getByRole("button", { name: "Quay ngay" }));
    expect(onTabChange).toHaveBeenCalledWith("wheel");

    await user.click(screen.getByRole("button", { name: /Lịch sử/i }));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });

  it("giữ phiên và cho thử lại khi đồng bộ thất bại", async () => {
    const user = userEvent.setup();
    const onRetrySync = vi.fn();
    render(
      <HomePage
        session={{
          ...session,
          sessionStatus: "pending_approval",
          customer: { ...session.customer, points: 3 },
        }}
        syncStatus="error"
        syncMessage="Kết nối hệ thống đang chậm"
        onRetrySync={onRetrySync}
        onTabChange={vi.fn()}
        onResetSession={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Đã gửi yêu cầu. Nhân viên chi nhánh sẽ xác nhận điểm."),
    ).toBeInTheDocument();
    expect(screen.getByText("Thêm 2 điểm để mở lượt quay.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem vòng quay" })).toBeInTheDocument();
    expect(screen.getByText("Kết nối hệ thống đang chậm")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thử lại/i }));
    expect(onRetrySync).toHaveBeenCalledOnce();
  });
});
