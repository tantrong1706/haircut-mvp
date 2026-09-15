import { createHash } from "node:crypto";

export type CallableAuthContext =
  | {
      uid?: unknown;
      token?: Record<string, unknown>;
    }
  | null
  | undefined;

export type WebPhonePrincipal = {
  uid: string;
  phone: string;
  phoneLast4: string;
};

export function customerIdForZalo(salonId: string, zaloUserId: string): string {
  return stableCustomerId(`${salonId}:${zaloUserId}`);
}

export function customerIdForWeb(salonId: string, firebaseUid: string): string {
  return stableCustomerId(`${salonId}:web:${firebaseUid}`);
}

export function webPhonePrincipal(auth: CallableAuthContext): WebPhonePrincipal {
  const uid = typeof auth?.uid === "string" ? auth.uid.trim() : "";
  const phone = typeof auth?.token?.phone_number === "string" ? auth.token.phone_number.trim() : "";
  const firebase = auth?.token?.firebase;
  const provider =
    typeof firebase === "object" && firebase !== null && "sign_in_provider" in firebase
      ? String((firebase as Record<string, unknown>).sign_in_provider || "")
      : "";

  if (!uid || provider !== "phone" || !/^\+84[35789]\d{8}$/u.test(phone)) {
    throw new Error("Yêu cầu Firebase Phone Auth đã xác minh");
  }

  return { uid, phone, phoneLast4: phone.slice(-4) };
}

function stableCustomerId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}
