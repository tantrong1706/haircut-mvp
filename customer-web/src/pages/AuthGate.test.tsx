import { act, render, screen, waitFor } from "@testing-library/react";
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

  it.each(["owner", "staff"] as const)("restores remembered %s without asking for credentials", async (role) => {
    mocks.listenAuthState.mockImplementation((onChange) => {
      void onChange({ uid: "remembered", email: "fixture@example.test" });
      return () => undefined;
    });
    mocks.getAppUser.mockResolvedValue({ uid: "remembered", salonId: "demo", name: "Remembered", role, isActive: true });
    const view = render(<AuthGate allowedRoles={[role]}>{() => <div>Remembered workspace</div>}</AuthGate>);
    expect(await screen.findByText("Remembered workspace")).toBeVisible();
    view.unmount();
    render(<AuthGate allowedRoles={[role]}>{() => <div>Remembered workspace</div>}</AuthGate>);
    expect(await screen.findByText("Remembered workspace")).toBeVisible();
    expect(screen.queryByLabelText("Mật khẩu")).not.toBeInTheDocument();
  });

  it("never restores a stale profile after a sign-out event", async () => {
    let emit!: (user: { uid: string } | null) => Promise<void>;
    let finish!: (profile: unknown) => void;
    mocks.listenAuthState.mockImplementation((onChange) => { emit = onChange; return () => undefined; });
    mocks.getAppUser.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<AuthGate allowedRoles={["owner"]}>{() => <div>Private workspace</div>}</AuthGate>);
    let restoring!: Promise<void>;
    act(() => { restoring = emit({ uid: "old-owner" }); });
    await act(async () => { await emit(null); });
    await act(async () => {
      finish({ uid: "old-owner", salonId: "demo", role: "owner", isActive: true });
      await restoring;
    });
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Đăng nhập quản lý" })).toBeVisible();
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
