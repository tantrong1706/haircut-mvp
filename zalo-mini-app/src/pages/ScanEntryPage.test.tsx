import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { ScanEntryPage } from "./ScanEntryPage";

const mocks = vi.hoisted(() => ({
  buildRegisterInput: vi.fn(),
  getZaloIdentity: vi.fn(),
  registerCustomer: vi.fn(),
  resolveCustomerQr: vi.fn(),
  isZaloProfilePermissionError: vi.fn(),
  openZaloProfilePermissionSettings: vi.fn(),
}));

vi.mock("../services/runtime", () => ({
  isZaloMiniAppRuntime: () => true,
}));

vi.mock("../services/zalo", () => ({
  getZaloIdentity: mocks.getZaloIdentity,
  isZaloProfilePermissionError: mocks.isZaloProfilePermissionError,
  openZaloProfilePermissionSettings: mocks.openZaloProfilePermissionSettings,
}));

vi.mock("../services/api", () => ({
  buildRegisterInput: mocks.buildRegisterInput,
  registerCustomer: mocks.registerCustomer,
  resolveCustomerQr: mocks.resolveCustomerQr,
}));

vi.mock("../services/monitoring", () => ({
  captureError: vi.fn(),
  trackEvent: vi.fn(),
  withMonitoringTrace: (_name: string, callback: () => unknown) => callback(),
}));

const session: AppSession = {
  qr: {
    qrType: "branch",
    salonId: "salon-a",
    branchId: "branch-a",
    mirrorId: "",
  },
  sessionId: "session-a",
  branchName: "Chi nhánh Trung tâm",
  branchAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
  zaloUserId: "zalo-a",
  sessionStatus: "waiting",
  customer: {
    customerId: "customer-a",
    name: "Anh Tân",
    phoneLast4: "",
    points: 0,
    allowPhoto: false,
  },
};

describe("ScanEntryPage", () => {
  beforeEach(() => {
    window.history.replaceState(
      {},
      "",
      "/?qrType=branch&salonId=salon-a&branchId=branch-a&qrToken=token-test",
    );
    mocks.resolveCustomerQr.mockResolvedValue({
      qrType: "branch",
      salonId: "salon-a",
      salonName: "HAIRCUT Studio",
      salonAvatarUrl: "https://example.test/salon-avatar.webp",
      branchId: "branch-a",
      branchName: "Chi nhánh Trung tâm",
      branchAddress: "123 Nguyễn Huệ, Quận 1, TP.HCM",
      selectionRequired: false,
      branches: [
        {
          id: "branch-a",
          name: "Chi nhánh Trung tâm",
          address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
          phone: "",
          isActive: true,
        },
      ],
    });
    mocks.getZaloIdentity.mockResolvedValue({
      accessToken: "access-token-test",
      zaloUserId: "zalo-a",
      name: "Anh Tân",
      avatar: "https://example.com/avatar.jpg",
    });
    mocks.buildRegisterInput.mockReturnValue({ request: "register" });
    mocks.registerCustomer.mockResolvedValue(session);
    mocks.isZaloProfilePermissionError.mockImplementation(
      (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error,
    );
    mocks.openZaloProfilePermissionSettings.mockResolvedValue(undefined);
  });

  it("tự hiện thông tin Zalo và tạo lượt chỉ bằng nút xác nhận", async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    render(<ScanEntryPage onReady={onReady} />);

    expect(await screen.findByText("Anh Tân")).toBeInTheDocument();
    expect(screen.getAllByText("123 Nguyễn Huệ, Quận 1, TP.HCM")).not.toHaveLength(0);
    expect(screen.getByText("Thông tin tùy chọn").closest("details")).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" }));

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(session));
    expect(mocks.getZaloIdentity).toHaveBeenCalledTimes(2);
    expect(mocks.buildRegisterInput).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: "salon-a", branchId: "branch-a" }),
      expect.objectContaining({
        name: "Anh Tân",
        zaloUserId: "zalo-a",
      }),
      false,
      undefined,
      undefined,
    );
    expect(mocks.getZaloIdentity).toHaveBeenNthCalledWith(1, {
      requestProfilePermission: false,
    });
    expect(mocks.getZaloIdentity).toHaveBeenNthCalledWith(2, {
      requestProfilePermission: false,
    });
  });

  it("mở link chung không QR mà không hiện lối vào quản lý", async () => {
    window.history.replaceState({}, "", "/");
    const onOpenLegalPage = vi.fn();

    render(<ScanEntryPage onReady={vi.fn()} onOpenLegalPage={onOpenLegalPage} />);

    expect(screen.getByRole("heading", { name: "Quét QR tại salon" })).toBeInTheDocument();
    expect(
      screen.getByText(/QR giúp HAIRCUT xác định đúng salon và chi nhánh/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Trang chủ salon")).not.toBeInTheDocument();
    expect(screen.queryByText("Trang nhân viên")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" })).toHaveAttribute(
      "href",
      "#privacy",
    );
    expect(screen.getByRole("link", { name: "Điều khoản sử dụng" })).toHaveAttribute(
      "href",
      "#terms",
    );

    fireEvent.click(screen.getByRole("link", { name: "Chính sách quyền riêng tư" }));
    fireEvent.click(screen.getByRole("link", { name: "Điều khoản sử dụng" }));

    expect(onOpenLegalPage).toHaveBeenNthCalledWith(1, "privacy");
    expect(onOpenLegalPage).toHaveBeenNthCalledWith(2, "terms");
    expect(window.location.pathname).toBe("/");
    expect(mocks.resolveCustomerQr).not.toHaveBeenCalled();
    expect(mocks.getZaloIdentity).not.toHaveBeenCalled();
  });

  it("giải thích trước khi xin lại quyền hồ sơ bị từ chối", async () => {
    const user = userEvent.setup();
    mocks.getZaloIdentity
      .mockResolvedValueOnce({
        accessToken: "access-token-test",
        name: "",
      })
      .mockResolvedValueOnce({
        accessToken: "access-token-test",
        zaloUserId: "zalo-a",
        name: "Anh Tân",
      });

    render(<ScanEntryPage onReady={vi.fn()} />);

    expect(await screen.findByText("Chưa nhận được thông tin Zalo")).toBeInTheDocument();
    expect(screen.getByText(/Cho phép HAIRCUT đọc tên hiển thị/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở trong Zalo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cho phép đọc tên Zalo" }));

    expect(await screen.findByText("Anh Tân")).toBeInTheDocument();
    expect(mocks.getZaloIdentity).toHaveBeenNthCalledWith(2, {
      requestProfilePermission: true,
    });
  });

  it("mở cài đặt để phục hồi quyền hồ sơ đã bị từ chối", async () => {
    const user = userEvent.setup();
    const permissionError = Object.assign(new Error("Quyền hồ sơ đã bị từ chối"), {
      code: "ZALO_PROFILE_PERMISSION_REQUIRED",
    });
    mocks.getZaloIdentity
      .mockResolvedValueOnce({
        accessToken: "access-token-test",
        name: "",
      })
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce({
        accessToken: "access-token-test",
        zaloUserId: "zalo-a",
        name: "Anh Tân",
      });

    render(<ScanEntryPage onReady={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Cho phép đọc tên Zalo" }));

    expect(
      await screen.findByRole("button", { name: "Mở cài đặt quyền Zalo" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở cài đặt quyền Zalo" }));

    expect(mocks.openZaloProfilePermissionSettings).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Anh Tân")).toBeInTheDocument();
  });

  it("hiển thị ảnh salon và quay về logo mặc định khi ảnh lỗi", async () => {
    const { container } = render(<ScanEntryPage onReady={vi.fn()} />);
    const salonAvatar = await screen.findByAltText("Ảnh đại diện HAIRCUT Studio");

    expect(salonAvatar).toHaveAttribute("src", "https://example.test/salon-avatar.webp");
    fireEvent.error(salonAvatar);
    expect(container.querySelector(".salon-identity-avatar .brand-mark")).toBeInTheDocument();
  });

  it("chỉ gửi số điện thoại khi khách tự nhập", async () => {
    const user = userEvent.setup();
    render(<ScanEntryPage onReady={vi.fn()} />);

    await screen.findByText("Anh Tân");
    await user.type(screen.getByRole("textbox", { name: /^Số điện thoại/ }), "0912345678");
    await user.click(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" }));

    await waitFor(() => expect(mocks.registerCustomer).toHaveBeenCalled());
    expect(mocks.buildRegisterInput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
      "0912345678",
      undefined,
    );
  });
});
