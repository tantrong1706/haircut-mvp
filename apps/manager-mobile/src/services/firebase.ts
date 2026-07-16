import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

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
    return { ok: true as const, app: managerApp };
  } catch {
    return { ok: false as const, code: "MANAGER_FIREBASE_INIT_FAILED", missing: [] };
  }
}

export function getManagerFirebaseApp() {
  if (managerApp) return managerApp;
  const result = initializeManagerFirebase();
  return result.ok ? result.app : null;
}

export async function callManagerFunction<TInput, TOutput>(name: string, input: TInput) {
  const app = getManagerFirebaseApp();
  if (!app) throw new Error("HAIRCUT Manager chưa được cấu hình Firebase.");
  const functions = getFunctions(
    app,
    String(import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1"),
  );
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  return (await callable(input)).data;
}
