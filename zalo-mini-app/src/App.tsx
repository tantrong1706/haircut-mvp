import { useEffect, useMemo, useState } from "react";
import { Gift, History, House, Sparkles, type LucideIcon } from "lucide-react";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { AuthGate } from "./pages/AuthGate";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { OwnerPage } from "./pages/OwnerPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RewardsPage } from "./pages/RewardsPage";
import { ScanEntryPage } from "./pages/ScanEntryPage";
import { StaffPage } from "./pages/StaffPage";
import { WheelPage } from "./pages/WheelPage";
import { listenSessionLiveUpdates, parseQrContext } from "./services/api";
import { clearSavedSession, loadSavedSession, saveSession } from "./services/sessionStore";
import { AppSession, TabKey } from "./services/types";

const tabs: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "home", label: "Điểm", Icon: House },
  { key: "history", label: "Lịch sử", Icon: History },
  { key: "wheel", label: "Vòng quay", Icon: Sparkles },
  { key: "rewards", label: "Quà", Icon: Gift },
];

export default function App() {
  const currentQr = useMemo(() => parseQrContext(), []);
  const [session, setSession] = useState<AppSession | null>(() => loadSavedSession(currentQr));
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const path = window.location.pathname;

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (session) {
      saveSession(session);
    } else {
      clearSavedSession();
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    return listenSessionLiveUpdates(session, setSession, (message) => {
      console.warn("Không đồng bộ được phiên khách.", message);
    });
  }, [session?.sessionId]);

  function resetSession() {
    setSession(null);
    setActiveTab("home");
  }

  if (path.startsWith("/staff")) {
    return (
      <div className="app-shell ops-shell">
        {!isOnline ? (
          <p className="offline-banner">Mất kết nối mạng. Dữ liệu mới sẽ gửi lại khi có mạng.</p>
        ) : null}
        <main className="app-main wide-main">
          <AuthGate allowedRoles={["owner", "staff"]}>
            {(user) => <StaffPage currentUser={user} />}
          </AuthGate>
        </main>
        <InstallAppPrompt />
      </div>
    );
  }

  if (path.startsWith("/owner") || path.startsWith("/admin")) {
    return (
      <div className="app-shell ops-shell">
        {!isOnline ? (
          <p className="offline-banner">Mất kết nối mạng. Dữ liệu mới sẽ gửi lại khi có mạng.</p>
        ) : null}
        <main className="app-main wide-main">
          <AuthGate allowedRoles={["owner"]}>
            {(user) => <OwnerPage currentUser={user} />}
          </AuthGate>
        </main>
        <InstallAppPrompt />
      </div>
    );
  }

  if (path.startsWith("/privacy")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <PrivacyPage />
        </main>
      </div>
    );
  }

  const content = useMemo(() => {
    if (!session) {
      return <ScanEntryPage onReady={setSession} />;
    }

    if (activeTab === "history") {
      return <HistoryPage session={session} />;
    }
    if (activeTab === "wheel") {
      return <WheelPage session={session} onSessionChange={setSession} />;
    }
    if (activeTab === "rewards") {
      return <RewardsPage session={session} />;
    }
    return <HomePage session={session} onTabChange={setActiveTab} onResetSession={resetSession} />;
  }, [activeTab, session]);

  return (
    <div className="app-shell">
      {!isOnline ? (
        <p className="offline-banner">Mất kết nối mạng. Dữ liệu mới sẽ gửi lại khi có mạng.</p>
      ) : null}
      <main className="app-main">{content}</main>
      <InstallAppPrompt />
      {session ? (
        <nav className="bottom-nav" aria-label="Điều hướng">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={20} strokeWidth={2.3} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
