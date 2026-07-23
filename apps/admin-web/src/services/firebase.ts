import { getApp, getApps, initializeApp } from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { adminAppCheckErrorMessage, initializeAdminAppCheck } from "./appCheck";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !String(value || "").trim())
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(`Thiếu cấu hình Firebase Admin Web: ${missing.join(", ")}`);
}

const app = getApps().length > 0 ? getApp() : initializeApp(config);

export const adminAppCheckStatus = initializeAdminAppCheck({
  app,
  siteKey: String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || ""),
  debugToken: import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN,
  production: import.meta.env.PROD,
  createProvider: (siteKey) => new ReCaptchaEnterpriseProvider(siteKey),
  initialize: (firebaseApp, provider) => {
    initializeAppCheck(firebaseApp, { provider, isTokenAutoRefreshEnabled: true });
  },
});

if (!adminAppCheckStatus.enabled) {
  console.warn("Admin App Check chưa hoạt động.", { reason: adminAppCheckStatus.reason });
}

export const auth = getAuth(app);
auth.languageCode = "vi";
export const db = getFirestore(app);
const functions = getFunctions(app, "asia-southeast1");

export async function callAdminFunction<TInput, TOutput>(name: string, input: TInput) {
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  try {
    const result = await callable(input);
    return result.data;
  } catch (error) {
    const appCheckMessage = adminAppCheckErrorMessage(error);
    if (appCheckMessage) throw new Error(appCheckMessage);
    throw error;
  }
}
