import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  initializeManagerWebAppCheck,
  managerAppCheckErrorMessage,
  markFirebaseAppCheckInitialized,
  type ManagerAppCheckStatus,
} from "./appCheck";

const managerFirebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const REQUIRED_CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

let managerApp: FirebaseApp | null = null;
let managerAppCheckStatus: ManagerAppCheckStatus | null = null;

export function missingManagerFirebaseKeys(config: FirebaseOptions = managerFirebaseConfig) {
  return REQUIRED_CONFIG_KEYS.filter((key) => !String(config[key] || "").trim());
}

export function initializeManagerFirebase() {
  const missing = missingManagerFirebaseKeys();
  if (missing.length > 0) {
    return { ok: false as const, code: "MANAGER_FIREBASE_CONFIG_MISSING", missing };
  }

  try {
    const existing = getApps().length > 0 ? getApp() : null;
    if (
      existing &&
      existing.options.projectId &&
      existing.options.projectId !== managerFirebaseConfig.projectId
    ) {
      return { ok: false as const, code: "MANAGER_FIREBASE_PROJECT_MISMATCH", missing: [] };
    }
    managerApp = existing ?? initializeApp(managerFirebaseConfig);
    managerAppCheckStatus ??= initializeManagerWebAppCheck({
      app: managerApp,
      siteKey: String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || ""),
      debugToken: import.meta.env.DEV ? import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN : undefined,
      production: import.meta.env.PROD,
      nativeRuntime: window.Capacitor?.isNativePlatform?.() === true,
      createProvider: (siteKey) => new ReCaptchaEnterpriseProvider(siteKey),
      initialize: (app, provider) => {
        initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
        markFirebaseAppCheckInitialized(app.name);
      },
    });
    if (
      import.meta.env.PROD &&
      managerAppCheckStatus.enabled === false &&
      managerAppCheckStatus.reason !== "native_runtime"
    ) {
      return {
        ok: false as const,
        code:
          managerAppCheckStatus.reason === "missing_site_key"
            ? "MANAGER_APP_CHECK_CONFIG_MISSING"
            : "MANAGER_APP_CHECK_INIT_FAILED",
        missing: [],
      };
    }
    return { ok: true as const, app: managerApp, appCheck: managerAppCheckStatus };
  } catch {
    return { ok: false as const, code: "MANAGER_FIREBASE_INIT_FAILED", missing: [] };
  }
}

export function getManagerFirebaseApp() {
  if (managerApp) return managerApp;
  const result = initializeManagerFirebase();
  return result.ok ? result.app : null;
}

export function getManagerSignedInEmail() {
  const app = getManagerFirebaseApp();
  return app ? getAuth(app).currentUser?.email || "" : "";
}

export async function callManagerFunction<TInput, TOutput>(name: string, input: TInput) {
  const app = getManagerFirebaseApp();
  if (!app) throw new Error("HAIRCUT Manager chưa được cấu hình Firebase.");
  const functions = getFunctions(
    app,
    String(import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1"),
  );
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  try {
    return (await callable(input)).data;
  } catch (error) {
    const appCheckMessage = managerAppCheckErrorMessage(error);
    if (appCheckMessage) throw new Error(appCheckMessage);
    throw error;
  }
}
