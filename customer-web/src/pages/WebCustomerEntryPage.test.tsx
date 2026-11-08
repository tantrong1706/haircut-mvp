import { act, render, screen, waitFor } from "@testing-library/react";
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
  it("shows directions for the scanned branch but leaves account access when requests are paused", async () => {
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: {
        ...qr,
        salonName: "Salon A",
        branchName: "Chi nhánh Trung tâm",
        branchAddress: "123 Nguyễn Huệ",
        branchDirectionsEnabled: true,
        acceptingPointRequests: false,
      },
      customer: session.customer,
      activeSession: null,
    });
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    const link = await screen.findByRole("link", { name: "Chỉ đường" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=123+Nguy%E1%BB%85n+Hu%E1%BB%87",
    );
    expect(screen.getByText(/tạm dừng nhận yêu cầu tích điểm/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Yêu cầu tích điểm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem điểm, lịch sử và quà" })).toBeEnabled();
  });

  it("shows the salon logo, public hotline and hours after resolving a valid QR", async () => {
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: {
        ...qr,
        salonName: "Salon A",
        branchName: "Chi nhánh Trung tâm",
        branchAddress: "123 Nguyễn Huệ",
        salonAvatarUrl: "https://firebasestorage.googleapis.com/fixture",
        salonHotline: "028 0000 0000",
        salonOpeningHours: "Thứ 2–CN, 09:00–20:00",
      },
      customer: session.customer,
      activeSession: null,
    });
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    expect(await screen.findByRole("heading", { name: "Salon A" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Logo Salon A" })).toBeVisible();
    expect(screen.getByRole("link", { name: "028 0000 0000" })).toHaveAttribute(
      "href",
      "tel:02800000000",
    );
    expect(screen.getByText("Thứ 2–CN, 09:00–20:00")).toBeVisible();
    expect(screen.getByText("123 Nguyễn Huệ")).toBeVisible();
  });
  it("shows concise photo permission without a count or optional wording", async () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));

    const permission = await screen.findByRole("checkbox", {
      name: "Cho phép salon chụp và lưu ảnh",
    });
    expect(permission).not.toBeChecked();
    expect(
      screen.queryByText(/tối đa 3 ảnh|không bắt buộc|Không chọn vẫn được tích điểm/iu),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tìm hiểu về ảnh" })).toHaveAttribute(
      "href",
      "/privacy#photo-consent",
    );
  });

  it("blocks a new point request without photo consent but keeps account access", async () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    await screen.findByRole("heading", { name: "Salon A" });
    expect(screen.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Yêu cầu tích điểm" }));
    expect(mocks.checkInWebCustomer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/đồng ý.*ảnh/i);
    await userEvent.click(screen.getByRole("button", { name: "Xem điểm, lịch sử và quà" }));
    expect(mocks.getWebCustomerAccount).toHaveBeenCalledWith("salon-a");
  });

  it("sends photo permission only after the customer selects it explicitly", async () => {
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    await screen.findByRole("heading", { name: "Salon A" });
    await userEvent.click(screen.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i }));
    await userEvent.click(screen.getByRole("button", { name: "Yêu cầu tích điểm" }));
    expect(mocks.checkInWebCustomer).toHaveBeenCalledWith(qr, true);
  });

  it("reloads context and hides old points when UID changes without an intermediate logout", async () => {
    const onReady = vi.fn();
    render(<WebCustomerEntryPage onReady={onReady} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    await screen.findByText("7 điểm");
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: { ...qr, salonName: "Salon A", branchName: "Chi nhánh Trung tâm", branchAddress: "" },
      customer: { ...session.customer, customerId: "customer-b", name: "Khách B", points: 2 },
      activeSession: null,
    });
    act(() => mocks.authListener?.({ uid: "uid-b" }));
    expect(await screen.findByText("2 điểm")).toBeVisible();
    expect(screen.queryByText("7 điểm")).toBeNull();
    expect(mocks.resolveWebCustomerContext).toHaveBeenCalledTimes(2);
    expect(onReady).not.toHaveBeenCalled();
  });

  it.each(["checkin", "account"])(
    "does not restore an old %s result after logout",
    async (operation) => {
      let finish!: (value: AppSession) => void;
      const pending = new Promise<AppSession>((resolve) => {
        finish = resolve;
      });
      if (operation === "checkin") mocks.checkInWebCustomer.mockReturnValue(pending);
      else mocks.getWebCustomerAccount.mockReturnValue(pending);
      const onReady = vi.fn();
      render(<WebCustomerEntryPage onReady={onReady} />);
      act(() => mocks.authListener?.({ uid: "uid-a" }));
      if (operation === "checkin") {
        await userEvent.click(
          await screen.findByRole("checkbox", { name: /Cho phép salon.*ảnh/i }),
        );
      }
      await userEvent.click(
        await screen.findByRole("button", {
          name: operation === "checkin" ? "Yêu cầu tích điểm" : "Xem điểm, lịch sử và quà",
        }),
      );
      expect(
        operation === "checkin" ? mocks.checkInWebCustomer : mocks.getWebCustomerAccount,
      ).toHaveBeenCalledOnce();
      act(() => mocks.authListener?.(null));
      await screen.findByLabelText("Số điện thoại");
      await act(async () => {
        finish(session);
        await pending;
      });
      expect(onReady).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Số điện thoại")).toBeEnabled();
    },
  );

  it("ignores old context that resolves after switching directly to another UID", async () => {
    let finish!: (value: unknown) => void;
    mocks.resolveWebCustomerContext.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const onReady = vi.fn();
    render(<WebCustomerEntryPage onReady={onReady} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    await waitFor(() => expect(mocks.resolveWebCustomerContext).toHaveBeenCalledTimes(1));
    act(() => mocks.authListener?.({ uid: "uid-b" }));
    await act(async () => {
      finish({ qr, customer: session.customer, activeSession: session });
    });
    expect(onReady).not.toHaveBeenCalled();
    expect(mocks.resolveWebCustomerContext).toHaveBeenCalledTimes(2);
  });

  it("ignores check-in completion after the entry screen unmounts", async () => {
    let finish!: (value: AppSession) => void;
    const pending = new Promise<AppSession>((resolve) => {
      finish = resolve;
    });
    mocks.checkInWebCustomer.mockReturnValue(pending);
    const onReady = vi.fn();
    const view = render(<WebCustomerEntryPage onReady={onReady} />);
    act(() => mocks.authListener?.({ uid: "uid-a" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Cho phép salon.*ảnh/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Yêu cầu tích điểm" }));
    expect(mocks.checkInWebCustomer).toHaveBeenCalledOnce();
    view.unmount();
    await act(async () => {
      finish(session);
      await pending;
    });
    expect(onReady).not.toHaveBeenCalled();
  });
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

  it("ẩn yêu cầu tích điểm trong cooldown nhưng vẫn cho xem tài khoản, không hiện thời gian", async () => {
    mocks.resolveWebCustomerContext.mockResolvedValue({
      qr: {
        salonId: "salon-a",
        salonName: "Salon A",
        salonAvatarUrl: "",
        branchId: "branch-a",
        branchName: "Chi nhánh Trung tâm",
        branchAddress: "123 Nguyễn Huệ",
      },
      customer: { ...session.customer, nextPointEligibleAtMs: Date.now() + 60 * 60_000 },
      activeSession: null,
    });
    render(<WebCustomerEntryPage onReady={vi.fn()} />);
    mocks.authListener?.({ uid: "uid-a" });

    expect(await screen.findByRole("heading", { name: "Salon A" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Yêu cầu tích điểm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem điểm, lịch sử và quà" })).toBeEnabled();
    expect(screen.queryByText(/\d+ (phút|giờ)/)).not.toBeInTheDocument();
    expect(mocks.checkInWebCustomer).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole("checkbox", { name: /Cho phép salon.*ảnh/i }));
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
