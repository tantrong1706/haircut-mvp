import { createHash } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { webPhonePrincipal, type CallableAuthContext } from "../../customerWebIdentity";

export function assertPasskeyEnrollment(auth: CallableAuthContext, nowMs: number) {
  const principal = webPhonePrincipal(auth);
  const firebase = auth?.token?.firebase as { sign_in_provider?: unknown } | undefined;
  const at = auth?.token?.auth_time;
  if (
    firebase?.sign_in_provider !== "phone" ||
    typeof at !== "number" ||
    !Number.isFinite(at) ||
    at * 1_000 > nowMs + 30_000 ||
    nowMs - at * 1_000 > 5 * 60_000
  ) {
    throw new HttpsError(
      "unauthenticated",
      "Vui lòng xác thực lại bằng OTP trước khi thêm passkey.",
    );
  }
  return principal;
}

export function assertPasskeyAccount(
  user: { uid: string; phoneNumber?: string; disabled: boolean },
  enrolledPhone: string,
  privileged: boolean,
) {
  if (
    !user.uid ||
    user.disabled ||
    user.phoneNumber !== enrolledPhone ||
    !/^\+84[35789]\d{8}$/u.test(enrolledPhone) ||
    privileged
  ) {
    throw new HttpsError("permission-denied", "Không dùng được passkey của tài khoản này.");
  }
}

export function passkeyUserHandle(uid: string) {
  return createHash("sha256").update(`ch-hair-customer-passkey:${uid}`).digest("base64url");
}
