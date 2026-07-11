import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Gift, History, House, Sparkles, type LucideIcon } from "lucide-react";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { trackEvent } from "./services/monitoring";
import { parseQrContext } from "./services/qr";
import { clearSavedSession, loadSavedSession, saveSession } from "./services/sessionStore";
import type { AppSession, TabKey } from "./services/types";

const AuthGate = lazy(() =>
  import("./pages/AuthGate").then((module) => ({ default: module.AuthGate })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const OwnerPage = lazy(() =>
  import("./pages/OwnerPage").then((module) => ({ default: module.OwnerPage })),
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage").then((module) => ({ default: module.PrivacyPage })),
);
const RewardsPage = lazy(() =>
  import("./pages/RewardsPage").then((module) => ({ default: module.RewardsPage })),
);
const ScanEntryPage = lazy(() =>
  import("./pages/ScanEntryPage").then((module) => ({ default: module.ScanEntryPage })),
);
const StaffPage = lazy(() =>
  import("./pages/StaffPage").then((module) => ({ default: module.StaffPage })),
);
const WheelPage = lazy(() =>
  import("./pages/WheelPage").then((module) => ({ default: module.WheelPage })),
);

const tabs: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "home", label: "Điểm", Icon: House },
  { key: "history", label: "Lịch sử", Icon: History },
  { key: "wheel", label: "Vòng quay", Icon: Sparkles },
  { key: "rewards", label: "Quà", Icon: Gift },
];

function PageLoading() {
  return (
    <section className="panel loading-panel" aria-live="polite">
      <div className="skeleton-line wide" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </section>
  );
}

export default function App() {
  const path = window.location.pathname;
  const isCustomerRoute = !["/staff", "/owner", "/admin", "/privacy"].some((route) =>
    path.startsWith(route),
  );
  const currentQr = useMemo(() => parseQrContext(), []);
  const [session, setSession] = useState<AppSession | null>(() =>
    isCustomerRoute ? loadSavedSession(currentQr) : null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    trackEvent("page_view", {
      page_path: path,
      has_customer_session: Boolean(session),
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
  }, [currentQr.salonId, path, session?.sessionId]);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
      trackEvent(navigator.onLine ? "app_online" : "app_offline", {
        page_path: path,
      });
    }

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, [path]);

  useEffect(() => {
    if (!isCustomerRoute) {
      return;
    }

    if (session) {
      saveSession(session);
    } else {
      clearSavedSession();
    }
  }, [isCustomerRoute, session]);

  useEffect(() => {
    if (!isCustomerRoute || !session) {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let isActive = true;

    void import("./services/api").then(({ listenSessionLiveUpdates }) => {
      if (!isActive) {
        return;
      }

      unsubscribe = listenSessionLiveUpdates(session, setSession, (message) => {
        console.warn("Không đồng bộ được phiên khách.", message);
      });
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [isCustomerRoute, session?.sessionId]);

  function resetSession() {
    trackEvent("customer_session_reset", {
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
    setSession(null);
    setActiveTab("home");
  }

  function changeCustomerTab(nextTab: TabKey) {
    setActiveTab(nextTab);
    trackEvent("customer_tab_opened", {
      tab: nextTab,
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
  }

  if (path.startsWith("/staff")) {
    return (
      <div className="app-shell ops-shell">
        {!isOnline ? (
          <p className="offline-banner">Mất kết nối mạng. Dữ liệu mới sẽ gửi lại khi có mạng.</p>
        ) : null}
        <main className="app-main wide-main">
          <Suspense fallback={<PageLoading />}>
            <AuthGate allowedRoles={["owner", "staff"]}>
              {(user) => <StaffPage currentUser={user} />}
            </AuthGate>
          </Suspense>
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
          <Suspense fallback={<PageLoading />}>
            <AuthGate allowedRoles={["owner"]}>
              {(user) => <OwnerPage currentUser={user} />}
            </AuthGate>
          </Suspense>
        </main>
        <InstallAppPrompt />
      </div>
    );
  }

  if (path.startsWith("/privacy")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <Suspense fallback={<PageLoading />}>
            <PrivacyPage />
          </Suspense>
        </main>
      </div>
    );
  }

  let content = <ScanEntryPage onReady={setSession} />;

  if (session && activeTab === "history") {
    content = <HistoryPage session={session} />;
  } else if (session && activeTab === "wheel") {
    content = <WheelPage session={session} onSessionChange={setSession} />;
  } else if (session && activeTab === "rewards") {
    content = <RewardsPage session={session} />;
  } else if (session) {
    content = (
      <HomePage session={session} onTabChange={changeCustomerTab} onResetSession={resetSession} />
    );
  }

  return (
    <div className="app-shell">
      {!isOnline ? (
        <p className="offline-banner">Mất kết nối mạng. Dữ liệu mới sẽ gửi lại khi có mạng.</p>
      ) : null}
      <main className="app-main">
        <Suspense fallback={<PageLoading />}>{content}</Suspense>
      </main>
      <InstallAppPrompt />
      {session ? (
        <nav className="bottom-nav" aria-label="Điều hướng">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => changeCustomerTab(key)}
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
