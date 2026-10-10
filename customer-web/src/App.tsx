import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CircleUserRound, Gift, History, House, type LucideIcon } from "lucide-react";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { trackEvent } from "./services/monitoring";
import { parseQrContext } from "./services/qr";
import type { AppSession, TabKey } from "./services/types";

const AuthGate = lazy(() =>
  import("./pages/AuthGate").then((module) => ({ default: module.AuthGate })),
);
const AppCheckDiagnosticPage = lazy(() =>
  import("./pages/AppCheckDiagnosticPage").then((module) => ({
    default: module.AppCheckDiagnosticPage,
  })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })),
);
const CustomerAccountPage = lazy(() =>
  import("./pages/CustomerAccountPage").then((module) => ({
    default: module.CustomerAccountPage,
  })),
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
const TermsPage = lazy(() =>
  import("./pages/TermsPage").then((module) => ({ default: module.TermsPage })),
);
const AccountDeletionPage = lazy(() =>
  import("./pages/AccountDeletionPage").then((module) => ({ default: module.AccountDeletionPage })),
);
const RewardsPage = lazy(() =>
  import("./pages/RewardsPage").then((module) => ({ default: module.RewardsPage })),
);
const StaffPage = lazy(() =>
  import("./pages/StaffPage").then((module) => ({ default: module.StaffPage })),
);
const WheelPage = lazy(() =>
  import("./pages/WheelPage").then((module) => ({ default: module.WheelPage })),
);
const WebCustomerEntryPage = lazy(() =>
  import("./pages/WebCustomerEntryPage").then((module) => ({
    default: module.WebCustomerEntryPage,
  })),
);

const tabs: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "home", label: "Điểm", Icon: House },
  { key: "history", label: "Lịch sử", Icon: History },
  { key: "rewards", label: "Quà và quay", Icon: Gift },
];

const webTabs: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  ...tabs,
  { key: "account", label: "Tài khoản", Icon: CircleUserRound },
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

function AdminPortalRedirect() {
  const adminUrl = String(import.meta.env.VITE_ADMIN_URL || "").trim();

  useEffect(() => {
    if (adminUrl) {
      window.location.replace(adminUrl);
    }
  }, [adminUrl]);

  return (
    <section className="panel loading-panel" aria-live="polite">
      <h1>HAIRCUT Admin</h1>
      <p>
        {adminUrl
          ? "Đang chuyển sang cổng quản trị hệ thống..."
          : "Cổng quản trị hệ thống chưa được cấu hình trên môi trường này."}
      </p>
    </section>
  );
}

export default function App() {
  const path = window.location.pathname;
  const isCustomerRoute = ![
    "/staff",
    "/owner",
    "/admin",
    "/privacy",
    "/terms",
    "/delete-account",
    "/app-check",
  ].some((route) => path.startsWith(route));
  const currentQr = useMemo(() => parseQrContext(), []);
  const [session, setSession] = useState<AppSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [sessionSync, setSessionSync] = useState<{
    status: "idle" | "syncing" | "synced" | "error";
    message: string;
    syncedAtMs: number | null;
  }>({ status: "idle", message: "", syncedAtMs: null });

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
    if (!isCustomerRoute || !session) {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let isActive = true;
    setSessionSync((current) => ({ ...current, status: "syncing", message: "" }));

    void import("./services/api").then(({ listenSessionLiveUpdates }) => {
      if (!isActive) {
        return;
      }

      unsubscribe = listenSessionLiveUpdates(
        session,
        setSession,
        (message) => {
          console.warn("Không đồng bộ được phiên khách.", message);
          setSessionSync((current) => ({ ...current, status: "error", message }));
        },
        (syncedAtMs) => {
          setSessionSync({ status: "synced", message: "", syncedAtMs });
        },
      );
    });

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [isCustomerRoute, session?.sessionId, syncAttempt]);

  useEffect(() => {
    if (!isCustomerRoute) {
      return undefined;
    }

    let unsubscribe: (() => void) | undefined;
    let active = true;
    void import("./services/customerWebAuth").then(({ subscribeCustomerWebAuth }) => {
      if (!active) return;
      unsubscribe = subscribeCustomerWebAuth(
        (user) => {
          setSession((current) => {
            if (!current || current.identityProvider !== "firebase") return current;
            if (!user || (current.firebaseUid && current.firebaseUid !== user.uid)) {
              setActiveTab("home");
              setSessionSync({ status: "idle", message: "", syncedAtMs: null });
              return null;
            }
            return current;
          });
        },
        () => undefined,
      );
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isCustomerRoute, session?.firebaseUid, session?.identityProvider]);

  function resetSession() {
    trackEvent("customer_session_reset", {
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
    setSession(null);
    setActiveTab("home");
    setSessionSync({ status: "idle", message: "", syncedAtMs: null });
  }

  function finishWebLogout() {
    setSession(null);
    setActiveTab("home");
    setSessionSync({ status: "idle", message: "", syncedAtMs: null });
  }

  function retrySessionSync() {
    if (!navigator.onLine) {
      setSessionSync((current) => ({
        ...current,
        status: "error",
        message: "Thiết bị đang mất kết nối mạng.",
      }));
      return;
    }

    setSessionSync((current) => ({ ...current, status: "syncing", message: "" }));
    setSyncAttempt((current) => current + 1);
  }

  function changeCustomerTab(nextTab: TabKey) {
    setActiveTab(nextTab);
    trackEvent("customer_tab_opened", {
      tab: nextTab,
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
  }

  if (path === "/app-check") {
    return (
      <div className="app-shell">
        <main className="app-main customer-main">
          <Suspense fallback={<PageLoading />}>
            <AppCheckDiagnosticPage />
          </Suspense>
        </main>
      </div>
    );
  }

  if (path.startsWith("/staff")) {
    return (
      <div className="app-shell ops-shell">
        {!isOnline ? (
          <p className="offline-banner">
            Mất kết nối mạng. Thao tác chưa lưu cần được thử lại sau khi có mạng.
          </p>
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

  if (path.startsWith("/admin")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <AdminPortalRedirect />
        </main>
      </div>
    );
  }

  if (path.startsWith("/owner")) {
    return (
      <div className="app-shell ops-shell">
        {!isOnline ? (
          <p className="offline-banner">
            Mất kết nối mạng. Thao tác chưa lưu cần được thử lại sau khi có mạng.
          </p>
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

  if (path.startsWith("/delete-account")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <Suspense fallback={<PageLoading />}>
            <AuthGate allowedRoles={["owner", "staff"]}>
              {(user) => <AccountDeletionPage currentUser={user} />}
            </AuthGate>
          </Suspense>
        </main>
      </div>
    );
  }

  if (path.startsWith("/terms")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <Suspense fallback={<PageLoading />}>
            <TermsPage />
          </Suspense>
        </main>
      </div>
    );
  }

  let content = <WebCustomerEntryPage onReady={setSession} />;

  if (session && activeTab === "account" && session.identityProvider === "firebase") {
    content = <CustomerAccountPage session={session} onLoggedOut={finishWebLogout} />;
  } else if (session && activeTab === "history") {
    content = <HistoryPage session={session} />;
  } else if (session && activeTab === "wheel") {
    content = (
      <WheelPage
        session={session}
        onSessionChange={setSession}
        onOpenRewards={() => changeCustomerTab("rewards")}
      />
    );
  } else if (session && activeTab === "rewards") {
    content = <RewardsPage session={session} onOpenWheel={() => changeCustomerTab("wheel")} />;
  } else if (session) {
    content = (
      <HomePage
        session={session}
        syncStatus={sessionSync.status}
        syncMessage={sessionSync.message}
        lastSyncedAtMs={sessionSync.syncedAtMs}
        onRetrySync={retrySessionSync}
        onTabChange={changeCustomerTab}
        onResetSession={resetSession}
      />
    );
  }

  return (
    <div className="app-shell">
      {!isOnline ? (
        <p className="offline-banner">
          Mất kết nối mạng. Thao tác chưa lưu cần được thử lại sau khi có mạng.
        </p>
      ) : null}
      <main className="app-main customer-main">
        <Suspense fallback={<PageLoading />}>{content}</Suspense>
      </main>
      <InstallAppPrompt />
      {session ? (
        <nav className="bottom-nav web-customer-nav" aria-label="Điều hướng">
          {webTabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={
                activeTab === key || (key === "rewards" && activeTab === "wheel") ? "active" : ""
              }
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
