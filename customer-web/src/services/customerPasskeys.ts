import { signInWithCustomToken } from "firebase/auth";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { callCustomerWebFunction, getCustomerFirebaseAuth } from "./firebase";
import { configureCustomerWebAuthPersistence } from "./customerWebAuth";

export function customerPasskeysAvailable() {
  return (
    import.meta.env.VITE_CUSTOMER_PASSKEYS_ENABLED === "true" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential === "function"
  );
}
export async function signInCustomerPasskey() {
  const { challengeId, options } = await callCustomerWebFunction<
    Record<string, never>,
    { challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }
  >("beginCustomerPasskeySignIn", {});
  const response = await startAuthentication({ optionsJSON: options });
  const { token } = await callCustomerWebFunction<
    { challengeId: string; response: typeof response },
    { token: string }
  >("finishCustomerPasskeySignIn", { challengeId, response });
  await configureCustomerWebAuthPersistence();
  const auth = getCustomerFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth chưa được cấu hình");
  await signInWithCustomToken(auth, token);
}
export async function registerCustomerPasskey() {
  const { challengeId, options } = await callCustomerWebFunction<
    Record<string, never>,
    { challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }
  >("beginCustomerPasskeyRegistration", {});
  const response = await startRegistration({ optionsJSON: options });
  await callCustomerWebFunction("finishCustomerPasskeyRegistration", { challengeId, response });
}
export function listCustomerPasskeys() {
  return callCustomerWebFunction<
    Record<string, never>,
    { keys: Array<{ id: string; createdAtMs: number }> }
  >("listCustomerPasskeys", {});
}
export function removeCustomerPasskey(id: string) {
  return callCustomerWebFunction<{ id: string }, { ok: boolean; requiresSignIn?: boolean }>(
    "removeCustomerPasskey",
    { id },
  );
}
export function customerPasskeyError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Bạn đã hủy hoặc chưa xác nhận passkey. Bạn vẫn có thể dùng OTP.";
  return "Chưa dùng được passkey. Bạn có thể đăng nhập bằng OTP và thử lại.";
}
