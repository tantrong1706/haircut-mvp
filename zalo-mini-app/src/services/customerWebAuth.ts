import {
  RecaptchaVerifier,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { getCustomerFirebaseAuth } from "./firebase";
import type { QrContext } from "./types";
import { safeStorageGet, safeStorageSet } from "./safeStorage";

const PENDING_QR_KEY = "haircut_pending_web_qr";
const SALON_HINT_KEY = "haircut_web_salon_hint";
const TEST_AUTH_UID_KEY = "haircut_test_web_auth_uid";
const PENDING_QR_TTL_MS = 10 * 60_000;
let persistencePromise: Promise<void> | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

export type CustomerPhoneConfirmation = Pick<ConfirmationResult, "confirm">;

// Navigation hint only. Every account read is re-authorized by Firebase UID on the server.
export function saveWebSalonHint(salonId: string) {
  if (/^[A-Za-z0-9_-]{1,128}$/u.test(salonId)) safeStorageSet(SALON_HINT_KEY, salonId);
}

export function loadWebSalonHint() {
  const salonId = safeStorageGet(SALON_HINT_KEY) || "";
  return /^[A-Za-z0-9_-]{1,128}$/u.test(salonId) ? salonId : "";
}

export function normalizeVietnamPhone(input: string) {
  const compact = input.trim().replace(/[\s().-]/g, "");
  const digits = compact.replace(/^\+/, "");
  let national = "";
  if (/^0[35789]\d{8}$/u.test(digits)) national = digits.slice(1);
  else if (/^84[35789]\d{8}$/u.test(digits)) national = digits.slice(2);
  if (!national) {
    throw new Error("Vui lòng nhập đúng số điện thoại Việt Nam.");
  }
  return `+84${national}`;
}

export function configureCustomerWebAuthPersistence() {
  if (persistencePromise) return persistencePromise;
  const auth = getCustomerFirebaseAuth();
  if (!auth) return Promise.reject(new Error("Firebase Auth chưa được cấu hình"));
  persistencePromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
    persistencePromise = null;
    throw error;
  });
  return persistencePromise;
}

export function subscribeCustomerWebAuth(
  onChange: (user: User | null) => void,
  onError: (error: unknown) => void,
) {
  if (testAdapterEnabled()) {
    const emit = () => {
      const uid = localStorage.getItem(TEST_AUTH_UID_KEY);
      onChange(uid ? ({ uid } as User) : null);
    };
    const eventName = "haircut-test-web-auth";
    window.addEventListener(eventName, emit);
    queueMicrotask(emit);
    return () => window.removeEventListener(eventName, emit);
  }

  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  void configureCustomerWebAuthPersistence()
    .then(() => {
      if (stopped) return;
      const auth = getCustomerFirebaseAuth();
      if (!auth) throw new Error("Firebase Auth chưa được cấu hình");
      unsubscribe = onAuthStateChanged(auth, onChange, onError);
    })
    .catch(onError);
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

export async function beginCustomerPhoneSignIn(
  phoneInput: string,
  recaptchaContainerId: string,
): Promise<CustomerPhoneConfirmation> {
  const phone = normalizeVietnamPhone(phoneInput);
  if (testAdapterEnabled()) {
    return {
      confirm: async (code: string) => {
        if (code !== "123456") {
          throw Object.assign(new Error("Mã OTP không đúng"), {
            code: "auth/invalid-verification-code",
          });
        }
        localStorage.setItem(TEST_AUTH_UID_KEY, "web-test-uid");
        window.dispatchEvent(new Event("haircut-test-web-auth"));
        return {} as never;
      },
    };
  }

  await configureCustomerWebAuthPersistence();
  const auth = getCustomerFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth chưa được cấu hình");
  auth.languageCode = "vi";
  recaptchaVerifier?.clear();
  recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  try {
    return await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
  } catch (error) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
    throw error;
  }
}

export async function confirmCustomerPhoneSignIn(
  confirmation: CustomerPhoneConfirmation,
  otp: string,
) {
  if (!/^\d{6}$/u.test(otp.trim())) {
    throw new Error("Mã OTP gồm 6 chữ số.");
  }
  await confirmation.confirm(otp.trim());
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;
}

export async function signOutCustomerWeb() {
  if (testAdapterEnabled()) {
    localStorage.removeItem(TEST_AUTH_UID_KEY);
    window.dispatchEvent(new Event("haircut-test-web-auth"));
    return;
  }
  const auth = getCustomerFirebaseAuth();
  if (auth) await signOut(auth);
}

export function customerPhoneAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (code === "auth/invalid-verification-code") return "Mã OTP không đúng. Vui lòng thử lại.";
  if (code === "auth/code-expired" || code === "auth/session-expired") {
    return "Mã OTP đã hết hạn. Vui lòng gửi mã mới.";
  }
  if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") {
    return "Bạn đã yêu cầu quá nhiều mã. Vui lòng chờ rồi thử lại.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Firebase chưa bật Phone provider. Vui lòng liên hệ hỗ trợ.";
  }
  if (code === "auth/invalid-phone-number") return "Số điện thoại không hợp lệ.";
  if (code === "auth/captcha-check-failed") {
    return "Kiểm tra bảo mật chưa hoàn tất. Vui lòng thử gửi mã lại.";
  }
  return error instanceof Error ? error.message : "Không xác thực được số điện thoại.";
}

export function savePendingWebQr(qr: QrContext, nowMs = Date.now()) {
  if (!validPendingQr(qr)) return;
  sessionStorage.setItem(
    PENDING_QR_KEY,
    JSON.stringify({ schemaVersion: 1, expiresAtMs: nowMs + PENDING_QR_TTL_MS, qr }),
  );
}

export function loadPendingWebQr(nowMs = Date.now()): QrContext | null {
  try {
    const raw = sessionStorage.getItem(PENDING_QR_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as {
      schemaVersion?: unknown;
      expiresAtMs?: unknown;
      qr?: QrContext;
    };
    if (
      value.schemaVersion !== 1 ||
      typeof value.expiresAtMs !== "number" ||
      value.expiresAtMs <= nowMs ||
      !validPendingQr(value.qr)
    ) {
      clearPendingWebQr();
      return null;
    }
    return value.qr ?? null;
  } catch {
    clearPendingWebQr();
    return null;
  }
}

export function clearPendingWebQr() {
  sessionStorage.removeItem(PENDING_QR_KEY);
}

function validPendingQr(value: QrContext | undefined): value is QrContext {
  return Boolean(
    value &&
    value.salonId &&
    value.qrToken &&
    (value.qrType === "salon" || (value.qrType === "branch" && value.branchId)),
  );
}

function testAdapterEnabled() {
  return (
    import.meta.env.VITE_APP_ENV === "test" &&
    (window as typeof window & { __haircutWebAuthTestMode?: boolean }).__haircutWebAuthTestMode ===
      true
  );
}
