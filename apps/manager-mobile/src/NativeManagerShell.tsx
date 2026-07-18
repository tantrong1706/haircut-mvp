import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { OfflineNotice } from "./components/Feedback";
import { ManagerNativeContext } from "./hooks/useManagerNative";
import { runManagerBootstrap } from "./managerBootstrap";
import type { AppUser } from "./services/managerApi";
import { captureError, trackEvent } from "./services/monitoring";
import {
  biometricLockEnabled,
  disableBiometricLock,
  enableBiometricLock,
  initializeNativeManager,
  safelyHideSplashScreen,
  scanRewardCode,
} from "./nativeRuntime";

export function NativeManagerShell({ user, children }: { user: AppUser; children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [nativeReady, setNativeReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<{
    message: string;
    code: string;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void | Promise<void>) | undefined;
    setBootstrapping(true);
    setBootstrapError(null);
    void runManagerBootstrap({
      initialize: () =>
        initializeNativeManager({
          user,
          onOnlineChange: setOnline,
          onLockedChange: setLocked,
          onNativeReady: setNativeReady,
        }),
      hideSplash: safelyHideSplashScreen,
      track: (name, params) => trackEvent(name, params),
    }).then((result) => {
      if (cancelled) {
        if (result.ok) void result.cleanup();
        return;
      }
      if (result.ok) {
        cleanup = result.cleanup;
        void biometricLockEnabled().then(setBiometricEnabled);
      } else {
        setNativeReady(false);
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
      void cleanup?.();
    };
  }, [bootstrapAttempt, user.uid, user.salonId]);

  async function scan() {
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
  }

  async function toggleBiometric() {
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
  }

  const nativeContext = useMemo(
    () => ({
      nativeReady,
      online,
      biometricEnabled,
      scanning,
      scanReward: scan,
      toggleBiometric,
    }),
    [nativeReady, online, biometricEnabled, scanning],
  );

  if (locked) {
    return (
      <main className="manager-lock">
        <ShieldCheck />
        <h1>HAIRCUT Manager đang khóa</h1>
        <p>Dùng sinh trắc học hoặc mã khóa thiết bị để tiếp tục.</p>
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
