import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "./AuthGate";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  listenAuthState: vi.fn(),
}));

vi.mock("../services/auth", () => ({
  completeOwnerSalonProfile: vi.fn(),
  getAppUser: vi.fn(),
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
});
