import { FirebaseApp, initializeApp } from "firebase/app";
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
    const result = await fn(payload);
    return result.data;
  } catch (error) {
    throw new Error(friendlyFirebaseFunctionError(error));
  }
}

export function friendlyFirebaseFunctionError(error: unknown) {
  const code = normalizeErrorCode(readErrorField(error, "code"));
  const rawMessage = readErrorMessage(error);
  const message = normalizeRawErrorMessage(rawMessage);

  if (code === "unauthenticated") {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }
  if (code === "permission-denied") {
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
  if (code === "internal") {
    if (message.toLowerCase().includes("index")) {
      return "Firebase đang thiếu hoặc đang tạo chỉ mục dữ liệu. Vui lòng thử lại sau vài phút.";
    }

    return "Hệ thống chưa xử lý được thao tác này. Vui lòng thử lại.";
  }

  return message || "Không xử lý được thao tác. Vui lòng thử lại.";
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

function normalizeRawErrorMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed || trimmed === "INTERNAL") {
    return "";
  }

  return trimmed;
}
