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
  createBiometricUnlockSingleFlight,
  runBiometricUnlock,
  type BiometricUnlockResult,
} from "./biometricUnlock";
import type { AppUser } from "./services/managerApi";
import { ManagerBootstrapError, createSingleFlight } from "./managerBootstrap";
import {
  createPushInitializationSingleFlight,
  type PushInitializationResult,
} from "./optionalPush";
import { callManagerFunction, getManagerFirebaseApp } from "./services/firebase";

const PUSH_TOKEN_KEY = "push_token";
const BIOMETRIC_KEY = "biometric_enabled";
let nativeFirebaseInitialized = false;
let activeNativeCleanup: (() => void | Promise<void>) | null = null;
let nativeInitializationConsumers = 0;

export function isNativeManager() {
  return Capacitor.isNativePlatform();
}

export async function initializeNativeFirebaseSecurity() {
  if (!isNativeManager() || nativeFirebaseInitialized) return;
  const app = getManagerFirebaseApp();
  if (!app) {
    throw new ManagerBootstrapError("MANAGER_FIREBASE_INIT_FAILED");
  }

  try {
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
  } catch {
    throw new ManagerBootstrapError("MANAGER_APP_CHECK_FAILED");
  }
}

type NativeManagerInput = {
  user: AppUser;
  onOnlineChange: (online: boolean) => void;
  onLockedChange: (locked: boolean) => void;
  onBiometricError: (message: string) => void;
  onNativeReady: (value: boolean) => void;
};

const initializeNativeManagerOnce = createSingleFlight(async (input: NativeManagerInput) => {
  if (!isNativeManager()) {
    input.onNativeReady(false);
    return () => undefined;
  }

  if (activeNativeCleanup) await activeNativeCleanup();
  const handles: PluginListenerHandle[] = [];
  try {
    await initializeNativeFirebaseSecurity();
    await SecureStorage.setKeyPrefix("haircut_manager_");
    const network = await Network.getStatus();
    input.onOnlineChange(network.connected);
    input.onNativeReady(true);

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
          void authenticateIfEnabled(input.onLockedChange, input.onBiometricError);
        }
      }),
    );
    window.__haircutBeforeSignOut = async () => {
      const token = await SecureStorage.get(PUSH_TOKEN_KEY);
      try {
        if (typeof token === "string" && token) {
          await callManagerFunction("unregisterManagerDeviceToken", { token });
        }
      } finally {
        await FirebaseMessaging.deleteToken().catch(() => undefined);
        await SecureStorage.remove(PUSH_TOKEN_KEY);
      }
    };
    window.__haircutNativeShare = async (url: string, title: string) => {
      await Share.share({ title, text: "Mã QR HAIRCUT", url, dialogTitle: "Chia sẻ QR" });
    };

    await authenticateIfEnabled(input.onLockedChange, input.onBiometricError);

    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      delete window.__haircutBeforeSignOut;
      delete window.__haircutNativeShare;
      await Promise.all(handles.map((handle) => handle.remove()));
      if (activeNativeCleanup === cleanup) activeNativeCleanup = null;
    };
    activeNativeCleanup = cleanup;
    return cleanup;
  } catch (error) {
    delete window.__haircutBeforeSignOut;
    delete window.__haircutNativeShare;
    await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
    if (error instanceof ManagerBootstrapError) throw error;
    throw new ManagerBootstrapError("MANAGER_NATIVE_PLUGIN_FAILED");
  }
});

export function initializeNativeManager(input: NativeManagerInput) {
  nativeInitializationConsumers += 1;
  return initializeNativeManagerOnce(input)
    .then(() => {
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        nativeInitializationConsumers = Math.max(0, nativeInitializationConsumers - 1);
        if (nativeInitializationConsumers === 0 && activeNativeCleanup) {
          await activeNativeCleanup();
        }
      };
    })
    .catch((error) => {
      nativeInitializationConsumers = Math.max(0, nativeInitializationConsumers - 1);
      throw error;
    });
}

const initializePushNotificationsOnce = createPushInitializationSingleFlight(
  async (userKey: string): Promise<PushInitializationResult> => {
    const user = JSON.parse(userKey) as AppUser;
    if (!isNativeManager()) {
      return { status: "unavailable", cleanup: async () => undefined };
    }

    const handles: PluginListenerHandle[] = [];
    try {
      handles.push(
        await FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
          void registerPushToken(user, token).catch(() => undefined);
        }),
      );
      handles.push(
        await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
          const data = event.notification.data as Record<string, unknown> | undefined;
          dispatchManagerRoute(String(data?.route || ""));
        }),
      );
      const status = await requestPushPermission(user);
      let cleaned = false;
      return {
        status,
        cleanup: async () => {
          if (cleaned) return;
          cleaned = true;
          await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
        },
      };
    } catch {
      await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
      throw new Error("MANAGER_PUSH_PLUGIN_FAILED");
    }
  },
);

export function initializePushNotifications(user: AppUser) {
  return initializePushNotificationsOnce(
    JSON.stringify({
      uid: user.uid,
      salonId: user.salonId,
      role: user.role,
      branchIds: user.branchIds,
    }),
  );
}

export async function safelyHideSplashScreen() {
  if (!isNativeManager()) return true;
  try {
    await SplashScreen.hide();
    return true;
  } catch {
    return false;
  }
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

const unlockBiometricOnce = createBiometricUnlockSingleFlight(() =>
  runBiometricUnlock({
    check: () => BiometricAuth.checkBiometry(),
    authenticate: () =>
      BiometricAuth.authenticate({
        reason: "Mở khóa HAIRCUT Manager",
        allowDeviceCredential: true,
      }),
  }),
);

export async function retryBiometricUnlock(
  onLockedChange: (locked: boolean) => void,
): Promise<BiometricUnlockResult> {
  onLockedChange(true);
  const result = await unlockBiometricOnce();
  onLockedChange(!result.ok);
  return result;
}

async function authenticateIfEnabled(
  onLockedChange: (locked: boolean) => void,
  onBiometricError: (message: string) => void,
) {
  if (!(await biometricLockEnabled())) {
    onLockedChange(false);
    onBiometricError("");
    return;
  }
  const result = await retryBiometricUnlock(onLockedChange);
  onBiometricError(result.ok ? "" : result.message);
}

async function requestPushPermission(
  user: AppUser,
): Promise<PushInitializationResult["status"]> {
  let permission = await FirebaseMessaging.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await FirebaseMessaging.requestPermissions();
  }
  if (permission.receive === "granted") {
    const { token } = await FirebaseMessaging.getToken();
    await registerPushToken(user, token);
    return "ready";
  }
  return "denied";
}

async function registerPushToken(user: AppUser, token: string) {
  if (!token) return;
  await callManagerFunction("registerManagerDeviceToken", {
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
