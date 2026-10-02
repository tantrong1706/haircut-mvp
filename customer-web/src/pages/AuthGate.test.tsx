import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  listenAuthState: vi.fn(),
  getAppUser: vi.fn(),
  acceptPendingStaffInvite: vi.fn(),
}));

vi.mock("../services/auth", () => ({
  acceptPendingStaffInvite: mocks.acceptPendingStaffInvite,
  completeOwnerSalonProfile: vi.fn(),
  getAppUser: mocks.getAppUser,
  isValidAuthEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
  listenAuthState: mocks.listenAuthState,
  registerOwnerSalon: vi.fn(),
  requestOwnerStaffPasswordReset: mocks.requestPasswordReset,
  signInOwnerStaff: vi.fn(),
  signOutOwnerStaff: vi.fn(),
}));

vi.mock("../services/monitoring", () => ({
  clearMonitoringUser: vi.fn(),
  setMonitoringUser: vi.fn(),
  trackEvent: vi.fn(),
}));

describe("AuthGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestPasswordReset.mockResolvedValue(undefined);
    mocks.getAppUser.mockResolvedValue(null);
    mocks.acceptPendingStaffInvite.mockImplementation(async (profile) => profile);
    mocks.listenAuthState.mockImplementation((onChange: (user: null) => void) => {
      onChange(null);
      return () => undefined;
    });
  });

  it("gửi email đặt lại mật khẩu từ màn hình khôi phục riêng", async () => {
    const user = userEvent.setup();
    render(<AuthGate allowedRoles={["owner"]}>{() => <div>Trang chủ salon</div>}</AuthGate>);

    await screen.findByRole("heading", { name: "Đăng nhập quản lý" });
    await user.click(screen.getByRole("button", { name: "Quên mật khẩu?" }));

    expect(screen.getByRole("heading", { name: "Khôi phục mật khẩu" })).toBeInTheDocument();
    const sendButton = screen.getByRole("button", { name: "Gửi email đặt lại mật khẩu" });
    expect(sendButton).toBeDisabled();

    await user.type(screen.getByLabelText("Email"), "owner@haircut.vn");
    await user.click(sendButton);

    await waitFor(() => {
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith("owner@haircut.vn");
    });
    expect(screen.getByText(/Mã xác minh dùng một lần/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Quay lại đăng nhập" }));
    expect(screen.getByRole("heading", { name: "Đăng nhập quản lý" })).toBeInTheDocument();
  });

  it("xác nhận lời mời sau khi nhân viên đã đăng nhập thành công", async () => {
    const user = userEvent.setup();
    const pendingProfile = {
      uid: "staff-a",
      salonId: "salon-a",
      name: "Nhân viên A",
      avatarUrl: "",
      role: "staff" as const,
      isActive: true,
      inviteStatus: "pending" as const,
      branchIds: ["branch-a"],
    };
    mocks.listenAuthState.mockImplementation(
      (onChange: (user: { uid: string; email: string }) => void) => {
        void onChange({ uid: "staff-a", email: "staff@example.test" });
        return () => undefined;
      },
    );
    mocks.getAppUser.mockResolvedValue(pendingProfile);
    mocks.acceptPendingStaffInvite.mockResolvedValue({
      ...pendingProfile,
      inviteStatus: "accepted",
    });

    render(
      <AuthGate allowedRoles={["staff"]}>
        {(profile) => <div>Đã vào: {profile.name}</div>}
      </AuthGate>,
    );

    expect(await screen.findByRole("heading", { name: "Xác nhận tham gia salon" })).toBeVisible();
    expect(mocks.acceptPendingStaffInvite).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Xác nhận lời mời" }));

    expect(await screen.findByText("Đã vào: Nhân viên A")).toBeInTheDocument();
    expect(mocks.acceptPendingStaffInvite).toHaveBeenCalledWith(pendingProfile);
  });
});
