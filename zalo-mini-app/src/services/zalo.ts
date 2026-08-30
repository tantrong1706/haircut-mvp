import { MINI_APP_NAME } from "../config/branding";
import { isZaloMiniAppRuntime } from "./runtime";

export type ZaloIdentity = {
  accessToken: string;
  zaloUserId?: string;
  name: string;
  avatar?: string;
};

type ZaloIdentityOptions = {
  requestProfilePermission?: boolean;
};

const ZALO_REQUIRED_MESSAGE = `Vui lòng mở ${MINI_APP_NAME} trong Zalo để xác nhận danh tính khách hàng.`;
const ZALO_PROFILE_PERMISSION_CODE = "ZALO_PROFILE_PERMISSION_REQUIRED";
const ZALO_PROFILE_RETRY_CODE = "ZALO_PROFILE_RETRY_REQUIRED";
const PROFILE_PERMISSION_ERROR_CODES = new Set([-1401, -2002]);
const PROFILE_TIMEOUT_ERROR_CODES = new Set([-1408, -14]);

export type ZaloProfileErrorClassification =
  | { kind: "permission"; message: string }
  | { kind: "network"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "unavailable"; message: string };

export class ZaloProfilePermissionError extends Error {
  readonly code = ZALO_PROFILE_PERMISSION_CODE;

  constructor() {
    super("Bạn chưa cho phép đọc tên Zalo. Hãy mở cài đặt quyền và bật Thông tin người dùng.");
    this.name = "ZaloProfilePermissionError";
  }
}

export class ZaloProfileRetryableError extends Error {
  readonly code = ZALO_PROFILE_RETRY_CODE;
  readonly kind: Exclude<ZaloProfileErrorClassification["kind"], "permission">;

  constructor(classification: Exclude<ZaloProfileErrorClassification, { kind: "permission" }>) {
    super(classification.message);
    this.name = "ZaloProfileRetryableError";
    this.kind = classification.kind;
  }
}

export function isZaloProfilePermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === ZALO_PROFILE_PERMISSION_CODE
  );
}

export function isZaloProfileRetryableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === ZALO_PROFILE_RETRY_CODE
  );
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function zaloErrorCode(error: unknown): number | null {
  const root = errorRecord(error);
  const candidates = [
    root?.code,
    root?.error_code,
    errorRecord(root?.error)?.code,
    errorRecord(root?.data)?.code,
    errorRecord(root?.data)?.error_code,
    errorRecord(root?.response)?.code,
  ];

  for (const candidate of candidates) {
    const numericCode = typeof candidate === "string" ? Number(candidate) : candidate;
    if (typeof numericCode === "number" && Number.isFinite(numericCode)) {
      return numericCode;
    }
  }
  return null;
}

function zaloErrorMessage(error: unknown): string {
  const root = errorRecord(error);
  const candidates = [
    error instanceof Error ? error.message : "",
    root?.message,
    root?.error_message,
    errorRecord(root?.error)?.message,
    errorRecord(root?.data)?.message,
  ];
  return candidates.find((candidate): candidate is string => typeof candidate === "string") || "";
}

export function classifyZaloProfileError(error: unknown): ZaloProfileErrorClassification {
  const code = zaloErrorCode(error);
  const normalizedMessage = zaloErrorMessage(error).trim().toLocaleLowerCase("vi");

  if (
    (code !== null && PROFILE_PERMISSION_ERROR_CODES.has(code)) ||
    /\b(permission denied|user denied)\b/.test(normalizedMessage) ||
    /từ chối (cung cấp|quyền|truy cập)/.test(normalizedMessage)
  ) {
    return {
      kind: "permission",
      message: "Bạn chưa cho phép đọc tên Zalo. Hãy mở cài đặt quyền và bật Thông tin người dùng.",
    };
  }
  if (
    (code !== null && PROFILE_TIMEOUT_ERROR_CODES.has(code)) ||
    /\b(timeout|timed out)\b/.test(normalizedMessage) ||
    /quá thời gian/.test(normalizedMessage)
  ) {
    return {
      kind: "timeout",
      message: "Zalo phản hồi quá lâu. Vui lòng kiểm tra kết nối và thử lại.",
    };
  }
  if (/\b(network|internet|offline|failed to fetch|connection)\b/.test(normalizedMessage)) {
    return {
      kind: "network",
      message: "Không thể kết nối với Zalo. Vui lòng kiểm tra mạng và thử lại.",
    };
  }
  return {
    kind: "unavailable",
    message: "Chưa đọc được thông tin Zalo. Vui lòng thử lại sau ít phút.",
  };
}

function previewIdentity(): ZaloIdentity | null {
  if (import.meta.env.VITE_ZALO_PREVIEW !== "true") {
    return null;
  }

  return {
    accessToken: "preview-access-token",
    zaloUserId: "preview-zalo-user",
    name: "Khách xem trước",
  };
}

export async function getZaloAccessToken(): Promise<string> {
  const preview = previewIdentity();
  if (preview) {
    return preview.accessToken;
  }

  if (!isZaloMiniAppRuntime()) {
    throw new Error(ZALO_REQUIRED_MESSAGE);
  }

  try {
    const { getAccessToken } = await import("zmp-sdk/apis");
    const token = String(await getAccessToken()).trim();

    if (!token || token.toUpperCase().includes("DEFAULT ACCESS TOKEN")) {
      throw new Error("Zalo access token không hợp lệ");
    }

    return token;
  } catch {
    throw new Error(ZALO_REQUIRED_MESSAGE);
  }
}

export async function getZaloIdentity(options: ZaloIdentityOptions = {}): Promise<ZaloIdentity> {
  const preview = previewIdentity();
  if (preview) {
    return preview;
  }

  const accessToken = await getZaloAccessToken();

  try {
    const { getUserInfo } = await import("zmp-sdk/apis");
    const { userInfo } = await getUserInfo({
      autoRequestPermission: options.requestProfilePermission === true,
      avatarType: "normal",
    });
    const rawUserInfo = userInfo as { id?: unknown; userId?: unknown };

    return {
      accessToken,
      zaloUserId: String(rawUserInfo.id || rawUserInfo.userId || "").trim() || undefined,
      name: userInfo.name || "Khách hàng",
      avatar: userInfo.avatar,
    };
  } catch (error) {
    const classification = classifyZaloProfileError(error);
    if (classification.kind === "permission") {
      if (options.requestProfilePermission === true) {
        throw new ZaloProfilePermissionError();
      }

      return {
        accessToken,
        name: "",
      };
    }

    throw new ZaloProfileRetryableError(classification);
  }
}

export async function openZaloProfilePermissionSettings(): Promise<void> {
  if (!isZaloMiniAppRuntime()) {
    throw new Error(ZALO_REQUIRED_MESSAGE);
  }

  try {
    const { openPermissionSetting } = await import("zmp-sdk/apis");
    await openPermissionSetting();
  } catch {
    throw new Error("Không mở được cài đặt quyền Zalo. Vui lòng đóng Mini App rồi mở lại.");
  }
}
