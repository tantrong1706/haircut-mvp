import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { InlineFeedback, OfflineNotice } from "./components/Feedback";
import { ManagerNativeContext } from "./hooks/useManagerNative";
import { runManagerBootstrap } from "./managerBootstrap";
import { runOptionalPushInitialization } from "./optionalPush";
import type { AppUser } from "./services/managerApi";
import { captureError, trackEvent } from "./services/monitoring";
import {
  biometricLockEnabled,
  disableBiometricLock,
  enableBiometricLock,
  initializeNativeManager,
  initializePushNotifications,
  managerRuntimeUserKey,
  retryBiometricUnlock,
  safelyHideSplashScreen,
  scanRewardCode,
} from "./nativeRuntime";

export function NativeManagerShell({ user, children }: { user: AppUser; children: ReactNode }) {
  const userKey = managerRuntimeUserKey(user);
  const currentUserKey = useRef(userKey);
  const bootstrapGeneration = useRef(0);
  const pushGeneration = useRef(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [nativeReady, setNativeReady] = useState(false);
  const [nativeReadyUserKey, setNativeReadyUserKey] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [biometricError, setBiometricError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [pushAttempt, setPushAttempt] = useState(0);
  const [pushStatus, setPushStatus] = useState<
    "idle" | "initializing" | "ready" | "denied" | "unavailable"
  >("idle");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<{
    message: string;
    code: string;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    currentUserKey.current = userKey;
  }, [userKey]);

  useEffect(() => {
    let cancelled = false;
    const generation = ++bootstrapGeneration.current;
    const attempt = initializeNativeManager({
      user,
      onOnlineChange: setOnline,
      onLockedChange: setLocked,
      onBiometricError: setBiometricError,
      onNativeReady: setNativeReady,
    });
    const isCurrent = () =>
      !cancelled &&
      bootstrapGeneration.current === generation &&
      currentUserKey.current === userKey;

    setBootstrapping(true);
    setBootstrapError(null);
    setNativeReady(false);
    setNativeReadyUserKey(null);
    void runManagerBootstrap({
      attempt,
      hideSplash: safelyHideSplashScreen,
      track: (name, params) => trackEvent(name, params),
    }).then((result) => {
      if (!isCurrent() || (!result.ok && result.stale)) return;
      if (result.ok) {
        setNativeReadyUserKey(userKey);
        void biometricLockEnabled().then((enabled) => {
          if (isCurrent()) setBiometricEnabled(enabled);
        });
      } else {
        setNativeReady(false);
        setNativeReadyUserKey(null);
        setBootstrapError(result);
        captureError(new Error(result.code), {
          area: "manager_bootstrap",
          error_code: result.code,
          request_id: result.requestId,
        });
      }
      setBootstrapping(false);
    });
    return () => {
      cancelled = true;
      if (bootstrapGeneration.current === generation) bootstrapGeneration.current += 1;
      void attempt.invalidate();
    };
  }, [bootstrapAttempt, user, userKey]);

  useEffect(() => {
    if (!nativeReady || nativeReadyUserKey !== userKey || bootstrapping || bootstrapError) {
      setPushStatus("idle");
      return undefined;
    }

    let cancelled = false;
    const generation = ++pushGeneration.current;
    const attempt = initializePushNotifications(user);
    const isCurrent = () =>
      !cancelled && pushGeneration.current === generation && currentUserKey.current === userKey;
    setPushStatus("initializing");
    void runOptionalPushInitialization({
      attempt,
      onWarning: (code) => {
        if (!isCurrent()) return;
        trackEvent("manager_push_unavailable", {
          error_code: code,
          salon_id: user.salonId,
        });
        captureError(new Error(code), {
          area: "manager_push",
          error_code: code,
        });
      },
    }).then((result) => {
      if (!isCurrent()) return;
      setPushStatus(result.status);
    });

    return () => {
      cancelled = true;
      if (pushGeneration.current === generation) pushGeneration.current += 1;
      void attempt.invalidate();
    };
  }, [bootstrapError, bootstrapping, nativeReady, nativeReadyUserKey, pushAttempt, user, userKey]);

  const scan = useCallback(async () => {
    setScanning(true);
    setMessage("");
    try {
      await scanRewardCode();
      setMessage("Đã nhận mã quà từ camera.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không quét được mã.");
    } finally {
      setScanning(false);
    }
  }, []);

  const toggleBiometric = useCallback(async () => {
    setMessage("");
    try {
      if (biometricEnabled) {
        await disableBiometricLock();
        setBiometricEnabled(false);
        setMessage("Đã tắt khóa sinh trắc học.");
      } else {
        await enableBiometricLock();
        setBiometricEnabled(true);
        setMessage("Đã bật khóa sinh trắc học.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không đổi được khóa sinh trắc học.");
    }
  }, [biometricEnabled]);

  async function unlock() {
    if (unlocking) return;
    setUnlocking(true);
    setBiometricError("");
    const result = await retryBiometricUnlock(setLocked);
    if (!result.ok) {
      setBiometricError(result.message);
      trackEvent("manager_biometric_unlock_failed", {
        error_code: result.code,
        salon_id: user.salonId,
      });
    }
    setUnlocking(false);
  }

  const nativeContext = useMemo(
    () => ({
      nativeReady,
      online,
      biometricEnabled,
      scanning,
      pushStatus,
      scanReward: scan,
      toggleBiometric,
      retryPush: () => setPushAttempt((value) => value + 1),
    }),
    [nativeReady, online, biometricEnabled, scanning, pushStatus, scan, toggleBiometric],
  );

  if (locked) {
    return (
      <main className="manager-lock">
        <ShieldCheck />
        <h1>HAIRCUT Manager đang khóa</h1>
        <p>Dùng sinh trắc học hoặc mã khóa thiết bị để tiếp tục.</p>
        {biometricError ? (
          <p className="manager-lock-error" role="alert">
            {biometricError}
          </p>
        ) : null}
        <button
          className="manager-button primary"
          type="button"
          disabled={unlocking}
          onClick={() => void unlock()}
        >
          <ShieldCheck aria-hidden="true" />
          {unlocking ? "Đang xác thực..." : "Thử lại bằng sinh trắc học hoặc mã khóa"}
        </button>
      </main>
    );
  }

  if (bootstrapping) {
    return (
      <main className="manager-startup-error">
        <LoaderCircle className="spin" />
        <h1>Đang khởi động HAIRCUT Manager</h1>
        <p>Ứng dụng đang xác minh thiết bị và kết nối an toàn.</p>
      </main>
    );
  }

  if (bootstrapError) {
    return (
      <main className="manager-startup-error">
        <AlertTriangle />
        <h1>Chưa thể mở ứng dụng</h1>
        <p>{bootstrapError.message}</p>
        <small>
          Mã lỗi: {bootstrapError.code} · {bootstrapError.requestId}
        </small>
        <button onClick={() => setBootstrapAttempt((value) => value + 1)}>
          <RotateCcw />
          Thử lại
        </button>
      </main>
    );
  }

  return (
    <ManagerNativeContext.Provider value={nativeContext}>
      <div className={nativeReady ? "manager-native" : "manager-web-preview"}>
        {!online ? <OfflineNotice /> : null}
        {pushStatus === "denied" || pushStatus === "unavailable" ? (
          <InlineFeedback
            tone="warning"
            action={
              <button type="button" onClick={() => setPushAttempt((value) => value + 1)}>
                <RotateCcw aria-hidden="true" />
                Thử bật lại
              </button>
            }
          >
            {pushStatus === "denied"
              ? "Thông báo đang bị tắt. Bạn vẫn có thể dùng đầy đủ các chức năng chính."
              : "Tạm thời chưa kết nối được thông báo. Ứng dụng vẫn hoạt động bình thường."}
          </InlineFeedback>
        ) : null}
        {message ? (
          <div className="manager-native-message" role="status">
            <span>{message}</span>
            <button aria-label="Đóng" onClick={() => setMessage("")}>
              <X />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </ManagerNativeContext.Provider>
  );
}
