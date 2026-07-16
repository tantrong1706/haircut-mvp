import { useEffect, useState, type ReactNode } from "react";
import { LockKeyhole, ScanLine, ShieldCheck, WifiOff, X } from "lucide-react";
import type { ManagerUser } from "./ManagerApp";
import {
  biometricLockEnabled,
  disableBiometricLock,
  enableBiometricLock,
  initializeNativeManager,
  scanRewardCode,
} from "./nativeRuntime";

export function NativeManagerShell({ user, children }: { user: ManagerUser; children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [nativeReady, setNativeReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cleanup: (() => void | Promise<void>) | undefined;
    void initializeNativeManager({
      user,
      onOnlineChange: setOnline,
      onLockedChange: setLocked,
      onNativeReady: setNativeReady,
    }).then((nextCleanup) => { cleanup = nextCleanup; void biometricLockEnabled().then(setBiometricEnabled); });
    return () => { void cleanup?.(); };
  }, [user.uid, user.salonId]);

  async function scan() {
    setScanning(true); setMessage("");
    try { await scanRewardCode(); setMessage("Đã nhận mã quà từ camera."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không quét được mã."); }
    finally { setScanning(false); }
  }

  async function toggleBiometric() {
    setMessage("");
    try {
      if (biometricEnabled) { await disableBiometricLock(); setBiometricEnabled(false); setMessage("Đã tắt khóa sinh trắc học."); }
      else { await enableBiometricLock(); setBiometricEnabled(true); setMessage("Đã bật khóa sinh trắc học."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không đổi được khóa sinh trắc học."); }
  }

  if (locked) {
    return <main className="manager-lock"><ShieldCheck /><h1>HAIRCUT Manager đang khóa</h1><p>Dùng sinh trắc học hoặc mã khóa thiết bị để tiếp tục.</p></main>;
  }

  return <div className={nativeReady ? "manager-native" : "manager-web-preview"}>
    {!online ? <div className="manager-offline"><WifiOff />Thiết bị đang mất mạng. Dữ liệu chỉ đọc có thể chưa mới nhất.</div> : null}
    {nativeReady ? <div className="manager-native-bar"><strong>{user.role === "owner" ? "Chủ salon" : "Nhân viên"}</strong><div><button title="Quét mã quà" disabled={scanning} onClick={() => void scan()}><ScanLine />{scanning ? "Đang quét" : "Quét quà"}</button><button title="Khóa sinh trắc học" onClick={() => void toggleBiometric()}><LockKeyhole />{biometricEnabled ? "Đã khóa" : "Bật khóa"}</button></div></div> : null}
    {message ? <div className="manager-native-message" role="status"><span>{message}</span><button aria-label="Đóng" onClick={() => setMessage("")}><X /></button></div> : null}
    {children}
  </div>;
}
