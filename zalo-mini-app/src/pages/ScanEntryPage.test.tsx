import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession } from "../services/types";
import { ScanEntryPage } from "./ScanEntryPage";

const mocks = vi.hoisted(() => ({
  buildRegisterInput: vi.fn(),
  getZaloIdentity: vi.fn(),
  requestPhoneToken: vi.fn(),
  registerCustomer: vi.fn(),
  resolveCustomerQr: vi.fn(),
}));

vi.mock("../services/runtime", () => ({
  isZaloMiniAppRuntime: () => true,
}));

vi.mock("../services/zalo", () => ({
  getZaloIdentity: mocks.getZaloIdentity,
  requestPhoneToken: mocks.requestPhoneToken,
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
    mocks.requestPhoneToken.mockResolvedValue("phone-token-test");
  });

  it("tự hiện thông tin Zalo và tạo lượt chỉ bằng nút xác nhận", async () => {
    const user = userEvent.setup();
    const onReady = vi.fn();
    render(<ScanEntryPage onReady={onReady} />);

    expect(await screen.findByText("Anh Tân")).toBeInTheDocument();
    expect(screen.getAllByText("123 Nguyễn Huệ, Quận 1, TP.HCM")).not.toHaveLength(0);
    expect(screen.getByText("Thông tin tùy chọn").closest("details")).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" }));

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(session));
    expect(mocks.getZaloIdentity).toHaveBeenCalledTimes(2);
    expect(mocks.buildRegisterInput).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: "salon-a", branchId: "branch-a" }),
      expect.objectContaining({ name: "Anh Tân", zaloUserId: "zalo-a" }),
      false,
      undefined,
      "phone-token-test",
    );
    expect(mocks.requestPhoneToken).toHaveBeenCalledTimes(1);
  });

  it("hiển thị ảnh salon và quay về logo mặc định khi ảnh lỗi", async () => {
    const { container } = render(<ScanEntryPage onReady={vi.fn()} />);
    const salonAvatar = await screen.findByAltText("Ảnh đại diện HAIRCUT Studio");

    expect(salonAvatar).toHaveAttribute("src", "https://example.test/salon-avatar.webp");
    fireEvent.error(salonAvatar);
    expect(container.querySelector(".salon-identity-avatar .brand-mark")).toBeInTheDocument();
  });

  it("không xin phone token khi khách đã tự nhập số điện thoại", async () => {
    const user = userEvent.setup();
    render(<ScanEntryPage onReady={vi.fn()} />);

    await screen.findByText("Anh Tân");
    await user.click(screen.getByText("Thông tin tùy chọn"));
    await user.type(screen.getByRole("textbox", { name: /^Số điện thoại/ }), "0912345678");
    await user.click(screen.getByRole("button", { name: "Xác nhận vào hàng chờ" }));

    await waitFor(() => expect(mocks.registerCustomer).toHaveBeenCalled());
    expect(mocks.requestPhoneToken).not.toHaveBeenCalled();
    expect(mocks.buildRegisterInput).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      false,
      "0912345678",
      undefined,
    );
  });
});
