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
import {
  ManagerBootstrapError,
  createSingleFlight,
  type InitializationAttemptContext,
} from "./managerBootstrap";
import {
  createPushInitializationSingleFlight,
  type PushInitializationResult,
} from "./optionalPush";
import { callManagerFunction, getManagerFirebaseApp } from "./services/firebase";

const PUSH_TOKEN_KEY = "push_token";
const BIOMETRIC_KEY = "biometric_enabled";
let nativeFirebaseInitialized = false;
let activeNativeOwnerAttemptId: number | null = null;

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

type NativeCleanup = () => void | Promise<void>;

export function createNativeInitializationController<TInput>(
  task: (input: TInput, context: InitializationAttemptContext) => Promise<NativeCleanup>,
) {
  let nativeInitializationConsumers = 0;
  const start = createSingleFlight(task, {
    cleanup: (cleanup) => cleanup(),
    onActivate: () => {
      nativeInitializationConsumers += 1;
    },
    onDeactivate: () => {
      nativeInitializationConsumers = Math.max(0, nativeInitializationConsumers - 1);
    },
  });
  return {
    start,
    getConsumerCount: () => nativeInitializationConsumers,
  };
}

const nativeInitialization = createNativeInitializationController(
  async (input: NativeManagerInput, context: InitializationAttemptContext) => {
    if (!isNativeManager()) {
      input.onNativeReady(false);
      return () => undefined;
    }

    const handles: PluginListenerHandle[] = [];
    try {
      await initializeNativeFirebaseSecurity();
      assertActiveAttempt(context);
      await SecureStorage.setKeyPrefix("haircut_manager_");
      assertActiveAttempt(context);
      const network = await Network.getStatus();
      assertActiveAttempt(context);
      input.onOnlineChange(network.connected);
      input.onNativeReady(true);

      handles.push(
        await Network.addListener("networkStatusChange", (status) => {
          if (context.isActive()) input.onOnlineChange(status.connected);
        }),
      );
      assertActiveAttempt(context);
      handles.push(
        await CapacitorApp.addListener("appUrlOpen", ({ url }) => {
          if (context.isActive()) dispatchManagerRoute(routeFromUrl(url));
        }),
      );
      assertActiveAttempt(context);
      handles.push(
        await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
          if (isActive && context.isActive()) {
            void authenticateIfEnabled(input.onLockedChange, input.onBiometricError);
          }
        }),
      );
      assertActiveAttempt(context);
      activeNativeOwnerAttemptId = context.attemptId;
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
      assertActiveAttempt(context);

      let cleaned = false;
      const cleanup = async () => {
        if (cleaned) return;
        cleaned = true;
        if (activeNativeOwnerAttemptId === context.attemptId) {
          delete window.__haircutBeforeSignOut;
          delete window.__haircutNativeShare;
          activeNativeOwnerAttemptId = null;
        }
        await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
      };
      return cleanup;
    } catch (error) {
      if (activeNativeOwnerAttemptId === context.attemptId) {
        delete window.__haircutBeforeSignOut;
        delete window.__haircutNativeShare;
        activeNativeOwnerAttemptId = null;
      }
      await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
      if (error instanceof ManagerBootstrapError) throw error;
      throw new ManagerBootstrapError("MANAGER_NATIVE_PLUGIN_FAILED");
    }
  },
);

export function initializeNativeManager(input: NativeManagerInput) {
  return nativeInitialization.start(managerRuntimeUserKey(input.user), input);
}

const initializePushNotificationsOnce = createPushInitializationSingleFlight(
  async (
    userKey: string,
    context: InitializationAttemptContext,
  ): Promise<PushInitializationResult> => {
    const user = JSON.parse(userKey) as AppUser;
    if (!isNativeManager()) {
      return { status: "unavailable", cleanup: async () => undefined };
    }

    const handles: PluginListenerHandle[] = [];
    try {
      handles.push(
        await FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
          if (context.isActive()) void registerPushToken(user, token).catch(() => undefined);
        }),
      );
      assertActiveAttempt(context);
      handles.push(
        await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
          if (!context.isActive()) return;
          const data = event.notification.data as Record<string, unknown> | undefined;
          dispatchManagerRoute(String(data?.route || ""));
        }),
      );
      assertActiveAttempt(context);
      const status = await requestPushPermission(user, context);
      assertActiveAttempt(context);
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
  return initializePushNotificationsOnce(managerRuntimeUserKey(user));
}

export function managerRuntimeUserKey(user: AppUser) {
  return JSON.stringify({
    uid: user.uid,
    salonId: user.salonId,
    role: user.role,
    branchIds: [...(user.branchIds || [])].sort(),
  });
}

function assertActiveAttempt(context: InitializationAttemptContext) {
  if (!context.isActive()) throw new Error("MANAGER_NATIVE_ATTEMPT_STALE");
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
  context: InitializationAttemptContext,
): Promise<PushInitializationResult["status"]> {
  let permission = await FirebaseMessaging.checkPermissions();
  assertActiveAttempt(context);
  if (permission.receive === "prompt") {
    permission = await FirebaseMessaging.requestPermissions();
    assertActiveAttempt(context);
  }
  if (permission.receive === "granted") {
    const { token } = await FirebaseMessaging.getToken();
    assertActiveAttempt(context);
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
