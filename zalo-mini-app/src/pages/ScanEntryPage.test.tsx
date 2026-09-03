import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { ScanEntryPage } from "./ScanEntryPage";

const mocks = vi.hoisted(() => ({
  buildRegisterInput: vi.fn(),
  getCustomerCheckinProfile: vi.fn(),
  getZaloIdentity: vi.fn(),
  registerCustomer: vi.fn(),
  resolveCustomerQr: vi.fn(),
  isZaloProfilePermissionError: vi.fn(),
  isZaloProfileRetryableError: vi.fn(),
  openZaloProfilePermissionSettings: vi.fn(),
}));

vi.mock("../services/runtime", () => ({
  isZaloMiniAppRuntime: () => true,
}));

vi.mock("../services/zalo", () => ({
  getZaloIdentity: mocks.getZaloIdentity,
  isZaloProfilePermissionError: mocks.isZaloProfilePermissionError,
  isZaloProfileRetryableError: mocks.isZaloProfileRetryableError,
  openZaloProfilePermissionSettings: mocks.openZaloProfilePermissionSettings,
}));

vi.mock("../services/api", () => ({
  buildRegisterInput: mocks.buildRegisterInput,
  getCustomerCheckinProfile: mocks.getCustomerCheckinProfile,
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
    mocks.getCustomerCheckinProfile.mockResolvedValue({
      exists: true,
      hasPhone: true,
      phoneLast4: "5678",
      allowPhoto: false,
    });
    mocks.registerCustomer.mockResolvedValue(session);
    mocks.isZaloProfilePermissionError.mockImplementation(
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ZALO_PROFILE_PERMISSION_REQUIRED",
    );
    mocks.isZaloProfileRetryableError.mockImplementation(
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ZALO_PROFILE_RETRY_REQUIRED",
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
      screen.getByText(/QR giúp CH Hair Studio xác định đúng salon và chi nhánh/i),
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
    expect(screen.getByText(/Cho phép CH Hair Studio đọc tên hiển thị/i)).toBeInTheDocument();
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

  it.each([
    ["mạng", "Không thể kết nối với Zalo. Vui lòng kiểm tra mạng và thử lại."],
    ["SDK", "Chưa đọc được thông tin Zalo. Vui lòng thử lại sau ít phút."],
  ])("hiện thử lại cho lỗi %s mà không mở cài đặt quyền", async (_kind, message) => {
    const user = userEvent.setup();
    const retryableError = Object.assign(new Error(message), {
      code: "ZALO_PROFILE_RETRY_REQUIRED",
      retryable: true,
    });
    mocks.getZaloIdentity.mockRejectedValueOnce(retryableError).mockResolvedValueOnce({
      accessToken: "access-token-test",
      zaloUserId: "zalo-a",
      name: "Anh Tân",
    });

    render(<ScanEntryPage onReady={vi.fn()} />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở cài đặt quyền Zalo" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Anh Tân")).toBeInTheDocument();
    expect(mocks.getZaloIdentity).toHaveBeenNthCalledWith(2, {
      requestProfilePermission: false,
    });
    expect(mocks.openZaloProfilePermissionSettings).not.toHaveBeenCalled();
  });

  it("không lặp yêu cầu quyền khi vẫn bị từ chối sau khi trở về từ cài đặt", async () => {
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
      .mockRejectedValueOnce(permissionError);

    render(<ScanEntryPage onReady={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Cho phép đọc tên Zalo" }));
    await user.click(await screen.findByRole("button", { name: "Mở cài đặt quyền Zalo" }));

    expect(
      await screen.findByRole("button", { name: "Mở cài đặt quyền Zalo" }),
    ).toBeInTheDocument();
    expect(mocks.openZaloProfilePermissionSettings).toHaveBeenCalledTimes(1);
    expect(mocks.getZaloIdentity).toHaveBeenCalledTimes(3);
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
    mocks.getCustomerCheckinProfile.mockResolvedValue({
      exists: false,
      hasPhone: false,
      phoneLast4: "",
      allowPhoto: false,
    });
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

  it("khách cũ không phải nhập lại số điện thoại và chỉ gửi xác nhận", async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();

    render(<ScanEntryPage onReady={onReady} />);

    expect(await screen.findByText("Đã lưu số kết thúc 5678")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^Số điện thoại/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" }));

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(session));
    expect(mocks.getCustomerCheckinProfile).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: "salon-a", qrToken: "token-test" }),
      expect.objectContaining({ accessToken: "access-token-test" }),
    );
    expect(mocks.buildRegisterInput).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch-a" }),
      expect.anything(),
      false,
      undefined,
      undefined,
    );
  });

  it("lần đầu bắt buộc nhập số điện thoại hợp lệ", async () => {
    const user = userEvent.setup();
    mocks.getCustomerCheckinProfile.mockResolvedValue({
      exists: false,
      hasPhone: false,
      phoneLast4: "",
      allowPhoto: false,
    });

    render(<ScanEntryPage onReady={vi.fn()} />);

    const phoneInput = await screen.findByRole("textbox", { name: /^Số điện thoại/ });
    const submit = screen.getByRole("button", { name: "Xác nhận vào hàng chờ" });
    expect(submit).toBeDisabled();

    await user.type(phoneInput, "123");
    expect(submit).toBeDisabled();

    await user.clear(phoneInput);
    await user.type(phoneInput, "0912345678");
    expect(submit).toBeEnabled();
  });

  it("QR salon luôn để khách tự chọn chi nhánh, không ưu tiên chi nhánh cũ", async () => {
    const user = userEvent.setup();
    mocks.resolveCustomerQr.mockResolvedValue({
      qrType: "salon",
      salonId: "salon-a",
      salonName: "HAIRCUT Studio",
      salonAvatarUrl: "",
      branchId: null,
      branchName: "",
      branchAddress: "",
      selectionRequired: true,
      branches: [
        { id: "branch-a", name: "Chi nhánh A", address: "A", phone: "", isActive: true },
        { id: "branch-b", name: "Chi nhánh B", address: "B", phone: "", isActive: true },
      ],
    });
    window.history.replaceState(
      {},
      "",
      "/?qrType=salon&salonId=salon-a&qrToken=token-test",
    );

    render(<ScanEntryPage onReady={vi.fn()} />);

    const branchSelect = await screen.findByRole("combobox", { name: "Chọn chi nhánh" });
    expect(branchSelect).toHaveValue("");
    expect(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" })).toBeDisabled();

    await user.selectOptions(branchSelect, "branch-b");
    expect(branchSelect).toHaveValue("branch-b");
    expect(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" })).toBeEnabled();
  });
});
