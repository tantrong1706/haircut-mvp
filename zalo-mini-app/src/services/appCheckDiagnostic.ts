import { deleteApp, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFirebaseApp } from "./firebase";

export type AppCheckDiagnosticResult =
  { status: "passed" } | { status: "failed"; code: string; httpStatus?: number };

export async function runAppCheckDiagnostic(): Promise<AppCheckDiagnosticResult> {
  if ((globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }).FIREBASE_APPCHECK_DEBUG_TOKEN) {
    return { status: "failed", code: "DEBUG_MODE_NOT_ALLOWED" };
  }
  const siteKey = String(import.meta.env.VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_SITE_KEY || "").trim();
  if (!siteKey) return { status: "failed", code: "NOT_CONFIGURED" };
  const source = getFirebaseApp();
  if (!source) return { status: "failed", code: "NOT_CONFIGURED" };
  const probe = initializeApp(source.options, "haircut-appcheck-diagnostic");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const check = initializeAppCheck(probe, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: false,
    });
    const result = await Promise.race([
      getToken(check, true),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject({ code: "CHECK_TIMEOUT" }), 25_000);
      }),
    ]);
    return result.token ? { status: "passed" } : { status: "failed", code: "EMPTY_RESPONSE" };
  } catch (error) {
    const value = error as { code?: unknown; customData?: { httpStatus?: unknown } } | null;
    const rawCode = value?.code;
    const code =
      typeof rawCode === "string" &&
      (rawCode === "CHECK_TIMEOUT" || /^appCheck\/[a-z-]+$/.test(rawCode))
        ? rawCode
        : "CHECK_FAILED";
    const httpStatus = value?.customData?.httpStatus;
    return {
      status: "failed",
      code,
      ...(typeof httpStatus === "number" && httpStatus >= 400 && httpStatus <= 599
        ? { httpStatus }
        : {}),
    };
  } finally {
    clearTimeout(timer);
    await deleteApp(probe).catch(() => undefined);
  }
}
