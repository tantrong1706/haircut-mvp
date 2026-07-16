import { FirebaseApp, initializeApp } from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { Functions, getFunctions, httpsCallable } from "firebase/functions";
import { FirebaseStorage, getStorage } from "firebase/storage";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let storage: FirebaseStorage | null = null;

export type FunctionWriteMode = "direct" | "auto" | "required";

export function isFirebaseConfigured() {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY);
}

export function getFunctionWriteMode(): FunctionWriteMode {
  if (import.meta.env.PROD && import.meta.env.VITE_APP_ENV !== "test") {
    return "required";
  }

  const mode = String(import.meta.env.VITE_FUNCTION_WRITE_MODE || "direct").toLowerCase();

  if (mode === "auto" || mode === "required") {
    return mode;
  }

  return "direct";
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    });

    const appCheckSiteKey = String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || "").trim();
    if (appCheckSiteKey && !isNativeRuntime()) {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  }

  return app;
}

export function getFirebaseDb() {
  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!db) {
    db = getFirestore(firebaseApp);
  }

  return db;
}

export function getFirebaseAuth() {
  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!auth) {
    auth = getAuth(firebaseApp);
  }

  return auth;
}

export function getFirebaseFunctions() {
  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!functions) {
    functions = getFunctions(
      firebaseApp,
      import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1",
    );
  }

  return functions;
}

export function getFirebaseStorage() {
  const firebaseApp = getFirebaseApp();

  if (!firebaseApp) {
    return null;
  }

  if (!storage) {
    storage = getStorage(firebaseApp);
  }

  return storage;
}

export async function callFunction<TInput, TOutput>(
  name: string,
  payload: TInput,
): Promise<TOutput> {
  const fns = getFirebaseFunctions();

  if (!fns) {
    throw new Error("Firebase chưa được cấu hình");
  }

  const fn = httpsCallable<TInput, TOutput>(fns, name);
  try {
    const result = await fn(withRuntimeMetadata(payload));
    return result.data;
  } catch (error) {
    throw new Error(friendlyFirebaseFunctionError(error, name));
  }
}

function withRuntimeMetadata<TInput>(payload: TInput): TInput {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return payload;
  }
  const nativePlatform = window.Capacitor?.getPlatform?.();
  const userAgent = navigator.userAgent.toLowerCase();
  const platform =
    nativePlatform === "ios" || nativePlatform === "android"
      ? nativePlatform
      : /iphone|ipad|ipod/.test(userAgent)
        ? "ios"
        : /android/.test(userAgent)
          ? "android"
          : "web";
  return {
    appVersion: String(import.meta.env.VITE_APP_VERSION || "0.1.0"),
    platform,
    ...payload,
  } as TInput;
}

function isNativeRuntime() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

export function friendlyFirebaseFunctionError(error: unknown, callableName = "") {
  const code = normalizeErrorCode(readErrorField(error, "code"));
  const rawMessage = readErrorMessage(error);
  const message = normalizeRawErrorMessage(rawMessage);
  const businessCode = readBusinessErrorCode(error);

  if (code === "unauthenticated") {
    return message || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (businessCode && BUSINESS_ERROR_MESSAGES[businessCode]) {
    return BUSINESS_ERROR_MESSAGES[businessCode];
  }
  if (code === "permission-denied") {
    if (isApprovedPermissionMessage(callableName, message)) {
      return message;
    }

    return "Tài khoản này không có quyền với salon này.";
  }
  if (code === "not-found") {
    return "Không tìm thấy dữ liệu cần xử lý.";
  }
  if (code === "already-exists") {
    return "Dữ liệu này đã tồn tại.";
  }
  if (code === "invalid-argument") {
    return message || "Thông tin gửi lên chưa hợp lệ.";
  }
  if (code === "failed-precondition") {
    if (message.toLowerCase().includes("index")) {
      return "Firebase đang thiếu hoặc đang tạo chỉ mục dữ liệu. Vui lòng thử lại sau vài phút.";
    }

    return message || "Điều kiện xử lý chưa hợp lệ.";
  }
  if (code === "deadline-exceeded" || code === "unavailable") {
    return "Kết nối hệ thống đang chậm. Vui lòng thử lại.";
  }
  if (code === "resource-exhausted") {
    return message || "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  }
  if (code === "internal") {
    if (message.toLowerCase().includes("index")) {
      return "Firebase đang thiếu hoặc đang tạo chỉ mục dữ liệu. Vui lòng thử lại sau vài phút.";
    }

    return "Hệ thống chưa xử lý được thao tác này. Vui lòng thử lại.";
  }

  return message || "Không xử lý được thao tác. Vui lòng thử lại.";
}

const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Tài khoản này không có quyền thực hiện thao tác.",
  USER_INACTIVE: "Tài khoản đã bị khóa. Vui lòng liên hệ người quản lý.",
  SALON_SUSPENDED: "Salon đang tạm khóa. Vui lòng liên hệ hỗ trợ.",
  SALON_PENDING_DELETION: "Salon đang trong thời gian chờ xóa dữ liệu.",
  INVALID_SALON: "Salon không tồn tại hoặc tài khoản không còn thuộc salon này.",
  INVALID_BRANCH: "Chi nhánh không tồn tại hoặc đã bị khóa.",
  BRANCH_ACCESS_DENIED: "Bạn chưa được phân công tại chi nhánh này.",
  SESSION_ALREADY_CLAIMED: "Khách đã được một nhân viên khác nhận.",
  SESSION_NOT_OPEN: "Lượt phục vụ không còn ở trạng thái cho phép thao tác.",
  REQUEST_ALREADY_PROCESSED: "Yêu cầu này đã được xử lý trước đó.",
  REWARD_ALREADY_REDEEMED: "Mã quà đã được sử dụng hoặc đã bị hủy.",
  REWARD_EXPIRED: "Mã quà đã hết hạn.",
  INVALID_REQUEST: "Dữ liệu yêu cầu không còn hợp lệ. Vui lòng tải lại.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.",
  APP_VERSION_UNSUPPORTED: "Phiên bản ứng dụng đã quá cũ. Vui lòng cập nhật.",
  FEATURE_DISABLED: "Tính năng này đang tạm ngừng.",
  MAINTENANCE_MODE: "Hệ thống đang bảo trì. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Hệ thống chưa xử lý được thao tác này. Vui lòng thử lại.",
};

const COMMON_PERMISSION_MESSAGES = new Set([
  "Không tìm thấy hồ sơ phân quyền",
  "Tài khoản đã bị tắt",
  "Không có quyền với salon này",
  "Bạn không được phân công tại chi nhánh này",
]);

const PERMISSION_MESSAGES_BY_CALLABLE: Record<string, Set<string>> = {
  createSalon: new Set(["Tài khoản này không thể tạo salon"]),
  resolveCustomerQr: new Set([
    "QR Gương 1 không hợp lệ hoặc đã bị khóa",
    "QR chi nhánh không hợp lệ hoặc đã được tạo lại",
    "QR salon không hợp lệ hoặc đã được tạo lại",
  ]),
  registerCustomerFromZalo: new Set([
    "QR Gương 1 không hợp lệ hoặc đã bị khóa",
    "QR chi nhánh không hợp lệ hoặc đã được tạo lại",
    "QR salon không hợp lệ hoặc đã được tạo lại",
  ]),
  submitPointRequest: new Set(["Bạn không phụ trách lượt cắt này"]),
  cancelServiceSession: new Set(["Bạn không được hủy lượt cắt này"]),
  approvePointRequest: new Set(["Yêu cầu không thuộc salon này"]),
  getCustomerSessionFromZalo: new Set(["Lượt cắt không thuộc khách hàng này"]),
  lookupRewardCode: new Set(["Nhân viên chưa được phép kiểm tra mã quà"]),
  redeemRewardCode: new Set(["Nhân viên chưa được phép xác nhận mã quà"]),
};

function isApprovedPermissionMessage(callableName: string, message: string) {
  if (!message || message.length > 180) {
    return false;
  }
  if (COMMON_PERMISSION_MESSAGES.has(message)) {
    return true;
  }
  if (PERMISSION_MESSAGES_BY_CALLABLE[callableName]?.has(message)) {
    return true;
  }

  return (
    callableName === "submitPointRequest" && /^Lượt này đang do .{1,80} phụ trách$/u.test(message)
  );
}

function normalizeErrorCode(value: string) {
  return value.replace(/^functions\//, "").toLowerCase();
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return readErrorField(error, "message");
}

function readErrorField(error: unknown, field: "code" | "message") {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return "";
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function readBusinessErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null) return "";
  const record = error as Record<string, unknown>;
  const directDetails = record.details;
  const customData = record.customData;
  const details =
    typeof directDetails === "object" && directDetails !== null
      ? directDetails
      : typeof customData === "object" && customData !== null
        ? (customData as Record<string, unknown>).details
        : null;
  if (typeof details !== "object" || details === null) return "";
  const value = (details as Record<string, unknown>).errorCode;
  return typeof value === "string" ? value.toUpperCase() : "";
}

function normalizeRawErrorMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed || trimmed === "INTERNAL") {
    return "";
  }

  return trimmed;
}
