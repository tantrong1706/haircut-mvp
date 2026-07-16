import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { FirebaseAppCheck } from "@capacitor-firebase/app-check";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { App as CapacitorApp } from "@capacitor/app";
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerTypeHintALLOption,
} from "@capacitor/barcode-scanner";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { Network } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { CustomProvider, initializeAppCheck } from "firebase/app-check";
import {
  callFunction,
  getFirebaseApp,
} from "../../../zalo-mini-app/src/services/firebase";
import type { ManagerUser } from "./ManagerApp";

const PUSH_TOKEN_KEY = "push_token";
const BIOMETRIC_KEY = "biometric_enabled";
let nativeFirebaseInitialized = false;

export function isNativeManager() {
  return Capacitor.isNativePlatform();
}

export async function initializeNativeFirebaseSecurity() {
  if (!isNativeManager() || nativeFirebaseInitialized) return;
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase chưa được cấu hình cho HAIRCUT Manager.");
  }

  await FirebaseAppCheck.initialize({ isTokenAutoRefreshEnabled: true });
  const provider = new CustomProvider({
    getToken: async () => {
      const result = await FirebaseAppCheck.getToken({ forceRefresh: false });
      return {
        token: result.token,
        expireTimeMillis: result.expireTimeMillis ?? Date.now() + 60 * 60 * 1000,
      };
    },
  });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  nativeFirebaseInitialized = true;
}

export async function initializeNativeManager(input: {
  user: ManagerUser;
  onOnlineChange: (online: boolean) => void;
  onLockedChange: (locked: boolean) => void;
  onNativeReady: (value: boolean) => void;
}) {
  if (!isNativeManager()) {
    input.onNativeReady(false);
    return () => undefined;
  }

  await initializeNativeFirebaseSecurity();
  input.onNativeReady(true);
  await SecureStorage.setKeyPrefix("haircut_manager_");
  await SplashScreen.hide();
  const network = await Network.getStatus();
  input.onOnlineChange(network.connected);
  const handles: PluginListenerHandle[] = [];

  handles.push(
    await Network.addListener("networkStatusChange", (status) => {
      input.onOnlineChange(status.connected);
    }),
  );
  handles.push(
    await CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      dispatchManagerRoute(routeFromUrl(url));
    }),
  );
  handles.push(
    await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        void authenticateIfEnabled(input.onLockedChange);
      }
    }),
  );
  handles.push(
    await FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
      void registerPushToken(input.user, token);
    }),
  );
  handles.push(
    await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const data = event.notification.data as Record<string, unknown> | undefined;
      dispatchManagerRoute(String(data?.route || ""));
    }),
  );

  window.__haircutBeforeSignOut = async () => {
    const token = await SecureStorage.get(PUSH_TOKEN_KEY);
    try {
      if (typeof token === "string" && token) {
        await callFunction("unregisterManagerDeviceToken", { token });
      }
    } finally {
      await FirebaseMessaging.deleteToken().catch(() => undefined);
      await SecureStorage.remove(PUSH_TOKEN_KEY);
    }
  };
  window.__haircutNativeShare = async (url: string, title: string) => {
    await Share.share({ title, text: "Mã QR HAIRCUT", url, dialogTitle: "Chia sẻ QR" });
  };

  await requestPushPermission(input.user);
  await authenticateIfEnabled(input.onLockedChange);

  return async () => {
    delete window.__haircutBeforeSignOut;
    delete window.__haircutNativeShare;
    await Promise.all(handles.map((handle) => handle.remove()));
  };
}

export async function scanRewardCode() {
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
    cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    scanInstructions: "Đưa mã quà vào giữa khung hình",
    scanButton: true,
    scanText: "Quét mã",
    cancelButtonAccessibilityLabel: "Đóng trình quét",
  });
  const rewardCode = extractRewardCode(result.ScanResult);
  if (!rewardCode) {
    throw new Error("Mã vừa quét không phải mã quà HAIRCUT hợp lệ.");
  }
  dispatchManagerRoute("/rewards");
  window.dispatchEvent(new CustomEvent("haircut:reward-code-scanned", { detail: rewardCode }));
  await Haptics.notification({ type: NotificationType.Success });
  return rewardCode;
}

export async function enableBiometricLock() {
  const info = await BiometricAuth.checkBiometry();
  if (!info.isAvailable && !info.deviceIsSecure) {
    throw new Error("Thiết bị chưa cài sinh trắc học hoặc mã khóa màn hình.");
  }
  await BiometricAuth.authenticate({
    reason: "Xác nhận để bật khóa HAIRCUT Manager",
    allowDeviceCredential: true,
  });
  await SecureStorage.set(BIOMETRIC_KEY, true);
}

export async function disableBiometricLock() {
  await SecureStorage.remove(BIOMETRIC_KEY);
}

export async function biometricLockEnabled() {
  return (await SecureStorage.get(BIOMETRIC_KEY)) === true;
}

async function authenticateIfEnabled(onLockedChange: (locked: boolean) => void) {
  if (!(await biometricLockEnabled())) {
    onLockedChange(false);
    return;
  }
  onLockedChange(true);
  try {
    await BiometricAuth.authenticate({
      reason: "Mở khóa HAIRCUT Manager",
      allowDeviceCredential: true,
    });
    onLockedChange(false);
  } catch {
    onLockedChange(true);
  }
}

async function requestPushPermission(user: ManagerUser) {
  let permission = await FirebaseMessaging.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await FirebaseMessaging.requestPermissions();
  }
  if (permission.receive === "granted") {
    const { token } = await FirebaseMessaging.getToken();
    await registerPushToken(user, token);
  }
}

async function registerPushToken(user: ManagerUser, token: string) {
  if (!token) return;
  await callFunction("registerManagerDeviceToken", {
    salonId: user.salonId,
    platform: Capacitor.getPlatform(),
    token,
    appVersion: String(import.meta.env.VITE_APP_VERSION || "0.1.0"),
  });
  await SecureStorage.set(PUSH_TOKEN_KEY, token);
}

function dispatchManagerRoute(route: string) {
  if (!route) return;
  window.dispatchEvent(new CustomEvent("haircut:navigate", { detail: route }));
}

function routeFromUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

export function extractRewardCode(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const fromUrl = url.searchParams.get("rewardCode") || url.searchParams.get("code") || "";
    return normalizeRewardCode(fromUrl);
  } catch {
    return normalizeRewardCode(raw);
  }
}

function normalizeRewardCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{5,79}$/.test(normalized) ? normalized : "";
}
