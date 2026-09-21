import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSession, QrContext } from "../services/types";
import { WebCustomerEntryPage } from "./WebCustomerEntryPage";

const qr: QrContext = {
  qrType: "branch",
  salonId: "salon-a",
  branchId: "branch-a",
  mirrorId: "",
  qrToken: "signed-token",
};
const session: AppSession = {
  identityProvider: "firebase",
  firebaseUid: "uid-a",
  qr,
  sessionId: "session-a",
  branchName: "Chi nhánh Trung tâm",
  branchAddress: "123 Nguyễn Huệ",
  zaloUserId: "",
  sessionStatus: "waiting",
  customer: {
    customerId: "customer-web-a",
    name: "Khách hàng",
    phoneLast4: "4567",
    points: 7,
    allowPhoto: false,
  },
};

const mocks = vi.hoisted(() => ({
  authListener: null as null | ((user: { uid: string } | null) => void),
  authErrorListener: null as null | ((error: unknown) => void),
  subscribeCustomerWebAuth: vi.fn(),
  beginCustomerPhoneSignIn: vi.fn(),
  confirmCustomerPhoneSignIn: vi.fn(),
  customerPhoneAuthErrorMessage: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : "Không xác thực được OTP",
  ),
  savePendingWebQr: vi.fn(),
  loadPendingWebQr: vi.fn(),
  clearPendingWebQr: vi.fn(),
  loadWebSalonHint: vi.fn(),
  saveWebSalonHint: vi.fn(),
  getWebCustomerAccount: vi.fn(),
  resolveWebCustomerContext: vi.fn(),
  checkInWebCustomer: vi.fn(),
  parseQrContext: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("../services/customerWebAuth", () => ({
  subscribeCustomerWebAuth: mocks.subscribeCustomerWebAuth,
  beginCustomerPhoneSignIn: mocks.beginCustomerPhoneSignIn,
  confirmCustomerPhoneSignIn: mocks.confirmCustomerPhoneSignIn,
  customerPhoneAuthErrorMessage: mocks.customerPhoneAuthErrorMessage,
  savePendingWebQr: mocks.savePendingWebQr,
  loadPendingWebQr: mocks.loadPendingWebQr,
  clearPendingWebQr: mocks.clearPendingWebQr,
  loadWebSalonHint: mocks.loadWebSalonHint,
  saveWebSalonHint: mocks.saveWebSalonHint,
}));

vi.mock("../services/webCustomerApi", () => ({
  resolveWebCustomerContext: mocks.resolveWebCustomerContext,
  checkInWebCustomer: mocks.checkInWebCustomer,
  getWebCustomerAccount: mocks.getWebCustomerAccount,
}));

vi.mock("../services/qr", () => ({
  parseQrContext: mocks.parseQrContext,
  hasQrContext: (value: QrContext) => Boolean(value.salonId && value.branchId && value.qrToken),
}));

vi.mock("../services/monitoring", () => ({
  captureError: vi.fn(),
  trackEvent: mocks.trackEvent,
}));

describe("WebCustomerEntryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseQrContext.mockReturnValue(qr);
    mocks.loadPendingWebQr.mockReturnValue(null);
    mocks.loadWebSalonHint.mockReturnValue("");
    mocks.getWebCustomerAccount.mockResolvedValue({
      ...session,
      sessionId: "",
      sessionStatus: undefined,
    });
    mocks.subscribeCustomerWebAuth.mockImplementation(
      (onChange: (user: { uid: string } | null) => void, onError: (error: unknown) => void) => {
        mocks.authListener = onChange;
        mocks.authErrorListener = onError;
        return () => undefined;
      },
    );
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: {
        salonId: "salon-a",
        salonName: "Salon A",
        salonAvatarUrl: "",
        branchId: "branch-a",
        branchName: "Chi nhánh Trung tâm",
        branchAddress: "123 Nguyễn Huệ",
      },
      customer: session.customer,
      activeSession: null,
    });
    mocks.checkInWebCustomer.mockResolvedValue(session);
    mocks.beginCustomerPhoneSignIn.mockResolvedValue({ confirm: vi.fn() });
    mocks.confirmCustomerPhoneSignIn.mockResolvedValue(undefined);
  });

  it("giữ AUTH_INITIALIZING và không hiện login trước khi Firebase restore xong", () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);

    expect(screen.getByText("Đang kiểm tra đăng nhập...")).toBeVisible();
    expect(screen.queryByLabelText("Số điện thoại")).not.toBeInTheDocument();
  });

  it("khách quay lại mở web không QR vẫn xem tài khoản sau khi Auth xác minh", async () => {
    mocks.parseQrContext.mockReturnValue({
      qrType: "salon",
      salonId: "",
      branchId: "",
      mirrorId: "",
      qrToken: "",
    });
    mocks.loadWebSalonHint.mockReturnValue("salon-a");
    const onReady = vi.fn();
    render(<WebCustomerEntryPage onReady={onReady} />);
    expect(mocks.getWebCustomerAccount).not.toHaveBeenCalled();
    mocks.authListener?.({ uid: "uid-a" });
    await waitFor(() =>
      expect(onReady).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "" })),
    );
    expect(mocks.getWebCustomerAccount).toHaveBeenCalledWith("salon-a");
    expect(mocks.checkInWebCustomer).not.toHaveBeenCalled();
  });

  it("hiện Phone OTP khi Firebase xác nhận chưa đăng nhập", async () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    mocks.authListener?.(null);

    expect(await screen.findByLabelText("Số điện thoại")).toBeVisible();
    expect(screen.getByRole("button", { name: "Gửi mã OTP" })).toBeEnabled();
    expect(mocks.beginCustomerPhoneSignIn).not.toHaveBeenCalled();
  });

  it("gửi OTP sau thao tác khách và xử lý mã sai thân thiện", async () => {
    const user = userEvent.setup();
    mocks.confirmCustomerPhoneSignIn.mockRejectedValue(new Error("Mã OTP không đúng"));
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    mocks.authListener?.(null);

    await user.type(await screen.findByLabelText("Số điện thoại"), "0901234567");
    await user.click(screen.getByRole("button", { name: "Gửi mã OTP" }));
    expect(mocks.beginCustomerPhoneSignIn).toHaveBeenCalledWith(
      "0901234567",
      "customer-phone-recaptcha",
    );
    await user.type(await screen.findByLabelText("Mã OTP"), "000000");
    await user.click(screen.getByRole("button", { name: "Xác nhận OTP" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mã OTP không đúng");
  });

  it("auth đã restore thì bỏ qua login và tải đúng tenant customer", async () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    mocks.authListener?.({ uid: "uid-a" });

    expect(await screen.findByRole("heading", { name: "Salon A" })).toBeVisible();
    expect(screen.getByText("Chi nhánh Trung tâm")).toBeVisible();
    expect(screen.getByText(/7 điểm/)).toBeVisible();
    expect(screen.queryByLabelText("Số điện thoại")).not.toBeInTheDocument();
    expect(mocks.resolveWebCustomerContext).toHaveBeenCalledWith(qr);
    expect(mocks.clearPendingWebQr).toHaveBeenCalled();
  });

  it("check-in dùng context đã ký và chống double click trên UI", async () => {
    const user = userEvent.setup();
    let finish!: (value: AppSession) => void;
    mocks.checkInWebCustomer.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onReady = vi.fn();
    render(<WebCustomerEntryPage onReady={onReady} />);
    mocks.authListener?.({ uid: "uid-a" });
    await screen.findByRole("heading", { name: "Salon A" });

    const button = screen.getByRole("button", { name: "Yêu cầu tích điểm" });
    await user.dblClick(button);
    expect(mocks.checkInWebCustomer).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    finish(session);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(session));
  });

  it("khôi phục active session của đúng UID mà không tạo check-in mới", async () => {
    const onReady = vi.fn();
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: {
        salonId: "salon-a",
        salonName: "Salon A",
        salonAvatarUrl: "",
        branchId: "branch-a",
        branchName: "Chi nhánh Trung tâm",
        branchAddress: "123 Nguyễn Huệ",
      },
      customer: session.customer,
      activeSession: session,
    });

    render(<WebCustomerEntryPage onReady={onReady} />);
    mocks.authListener?.({ uid: "uid-a" });

    await waitFor(() => expect(onReady).toHaveBeenCalledWith(session));
    expect(mocks.checkInWebCustomer).not.toHaveBeenCalled();
  });
});
