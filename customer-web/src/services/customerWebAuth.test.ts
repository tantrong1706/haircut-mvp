import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QrContext } from "./types";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null, languageCode: "" },
  setPersistence: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  signOut: vi.fn(),
  recaptchaClear: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: { type: "LOCAL" },
  setPersistence: mocks.setPersistence,
  onAuthStateChanged: mocks.onAuthStateChanged,
  signInWithPhoneNumber: mocks.signInWithPhoneNumber,
  signOut: mocks.signOut,
  RecaptchaVerifier: class {
    clear = mocks.recaptchaClear;
    constructor() {}
  },
}));

vi.mock("./firebase", () => ({
  getCustomerFirebaseAuth: () => mocks.auth,
}));

import {
  beginCustomerPhoneSignIn,
  clearPendingWebQr,
  confirmCustomerPhoneSignIn,
  configureCustomerWebAuthPersistence,
  customerPhoneAuthErrorMessage,
  loadPendingWebQr,
  normalizeVietnamPhone,
  loadWebSalonHint,
  savePendingWebQr,
  saveWebSalonHint,
  signOutCustomerWeb,
  subscribeCustomerWebAuth,
} from "./customerWebAuth";

const qr: QrContext = {
  qrType: "branch",
  salonId: "salon-a",
  branchId: "branch-a",
  mirrorId: "",
  qrToken: "signed-token",
};

describe("chuẩn hóa số điện thoại Việt Nam", () => {
  it.each([
    ["0901234567", "+84901234567"],
    ["84901234567", "+84901234567"],
    ["+84 90 123 4567", "+84901234567"],
  ])("chuẩn hóa %s thành E.164", (input, expected) => {
    expect(normalizeVietnamPhone(input)).toBe(expected);
  });

  it.each(["", "123", "0281234567", "+12025550123", "090123456789"])(
    "từ chối số ngoài phạm vi Việt Nam hiện tại: %s",
    (input) => {
      expect(() => normalizeVietnamPhone(input)).toThrow("số điện thoại Việt Nam");
    },
  );
});

describe("pending QR trong phiên đăng nhập", () => {
  beforeEach(() => sessionStorage.clear());

  it("giữ QR ngắn hạn qua reload rồi xóa sau khi dùng", () => {
    savePendingWebQr(qr, 1_000);
    expect(loadPendingWebQr(1_000 + 60_000)).toEqual(qr);
    clearPendingWebQr();
    expect(loadPendingWebQr(1_000 + 60_000)).toBeNull();
  });

  it("loại QR hết hạn và payload bị sửa", () => {
    savePendingWebQr(qr, 1_000);
    expect(loadPendingWebQr(1_000 + 11 * 60_000)).toBeNull();
    sessionStorage.setItem("haircut_pending_web_qr", "not-json");
    expect(loadPendingWebQr(1_000)).toBeNull();
  });
});

describe("salon hint không phải identity", () => {
  beforeEach(() => localStorage.clear());

  it("chỉ giữ salonId hợp lệ để mở lại tài khoản", () => {
    saveWebSalonHint("salon-a");
    expect(loadWebSalonHint()).toBe("salon-a");
    localStorage.setItem("haircut_web_salon_hint", "../../customer-forged");
    expect(loadWebSalonHint()).toBe("");
  });
});

describe("Firebase Phone Auth web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      false;
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.onAuthStateChanged.mockReturnValue(() => undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it("cấu hình browserLocalPersistence trước khi nghe auth state", async () => {
    const onChange = vi.fn();
    const stop = subscribeCustomerWebAuth(onChange, vi.fn());
    await vi.waitFor(() => {
      expect(mocks.setPersistence).toHaveBeenCalledTimes(1);
      expect(mocks.onAuthStateChanged).toHaveBeenCalledTimes(1);
    });
    expect(mocks.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.onAuthStateChanged.mock.invocationCallOrder[0],
    );
    stop();
  });

  it("không gửi OTP khi chỉ cấu hình persistence", async () => {
    await configureCustomerWebAuthPersistence();
    expect(mocks.signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it("chỉ gửi OTP sau hành động explicit với số E.164", async () => {
    mocks.signInWithPhoneNumber.mockResolvedValue({ confirm: vi.fn() });
    await beginCustomerPhoneSignIn("0901234567", "customer-recaptcha");
    expect(mocks.signInWithPhoneNumber).toHaveBeenCalledWith(
      mocks.auth,
      "+84901234567",
      expect.anything(),
    );
  });

  it("logout chỉ dùng customer Auth instance", async () => {
    await signOutCustomerWeb();
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth);
  });

  it("xác nhận OTP chỉ chấp nhận 6 chữ số và dọn captcha", async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    await expect(confirmCustomerPhoneSignIn({ confirm }, "12x")).rejects.toThrow("6 chữ số");
    await confirmCustomerPhoneSignIn({ confirm }, "123456");
    expect(confirm).toHaveBeenCalledWith("123456");
    expect(mocks.recaptchaClear).toHaveBeenCalled();
  });

  it("dọn captcha khi Firebase từ chối gửi OTP", async () => {
    mocks.signInWithPhoneNumber.mockRejectedValue(new Error("send failed"));
    await expect(beginCustomerPhoneSignIn("0901234567", "customer-recaptcha")).rejects.toThrow(
      "send failed",
    );
    expect(mocks.recaptchaClear).toHaveBeenCalled();
  });

  it("test adapter yêu cầu mã cố định chỉ trong runtime test", async () => {
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode =
      true;
    const onChange = vi.fn();
    const stop = subscribeCustomerWebAuth(onChange, vi.fn());
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
    const confirmation = await beginCustomerPhoneSignIn("0901234567", "unused");
    await expect(confirmation.confirm("000000")).rejects.toMatchObject({
      code: "auth/invalid-verification-code",
    });
    await confirmation.confirm("123456");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ uid: "web-test-uid" }));
    await signOutCustomerWeb();
    expect(onChange).toHaveBeenLastCalledWith(null);
    stop();
    expect(mocks.signInWithPhoneNumber).not.toHaveBeenCalled();
  });

  it.each([
    ["auth/invalid-verification-code", "Mã OTP không đúng"],
    ["auth/code-expired", "Mã OTP đã hết hạn"],
    ["auth/too-many-requests", "quá nhiều"],
    ["auth/operation-not-allowed", "chưa bật Phone"],
    ["auth/invalid-phone-number", "không hợp lệ"],
    ["auth/captcha-check-failed", "bảo mật"],
  ])("hiển thị lỗi thân thiện cho %s", (code, message) => {
    expect(customerPhoneAuthErrorMessage({ code })).toContain(message);
  });
});
