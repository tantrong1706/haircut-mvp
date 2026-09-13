import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Gift, History, House, type LucideIcon } from "lucide-react";
import { InstallAppPrompt } from "./components/InstallAppPrompt";
import { MINI_APP_NAME } from "./config/branding";
import { trackEvent } from "./services/monitoring";
import { parseQrContext } from "./services/qr";
import { isZaloMiniAppRuntime } from "./services/runtime";
import {
  clearSavedSession,
  loadSavedSessionCandidate,
  saveSession,
} from "./services/sessionStore";
import type { SavedSessionCandidate } from "./services/sessionStore";
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
const TermsPage = lazy(() =>
  import("./pages/TermsPage").then((module) => ({ default: module.TermsPage })),
);
const AccountDeletionPage = lazy(() =>
  import("./pages/AccountDeletionPage").then((module) => ({ default: module.AccountDeletionPage })),
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
  { key: "rewards", label: "Quà và quay", Icon: Gift },
];

const managementRoutes = ["/staff", "/owner", "/admin", "/delete-account"];
type LegalPageKey = "privacy" | "terms";

function legalPageFromHash(hash: string): LegalPageKey | null {
  const route = hash.replace(/^#/, "").split(/[/?]/, 1)[0];
  return route === "privacy" || route === "terms" ? route : null;
}

function PageLoading() {
  return (
    <section className="panel loading-panel" aria-live="polite">
      <div className="skeleton-line wide" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </section>
  );
}

function SessionRestorePanel({
  status,
  message,
  onRetry,
  onReset,
}: {
  status: "verifying" | "error";
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  if (status === "verifying") {
    return (
      <section className="panel loading-panel" aria-live="polite">
        <strong>Đang xác minh phiên khách...</strong>
        <p>{MINI_APP_NAME} đang kiểm tra tài khoản Zalo hiện tại trước khi hiển thị dữ liệu.</p>
      </section>
    );
  }

  return (
    <section className="panel empty-state" role="alert">
      <h1>Chưa xác minh được phiên khách</h1>
      <p>{message || "Kết nối đang chậm. Dữ liệu đã lưu sẽ không được hiển thị khi chưa xác minh."}</p>
      <div className="inline-actions">
        <button type="button" onClick={onRetry}>
          Thử lại
        </button>
        <button type="button" className="secondary-button" onClick={onReset}>
          Quét lại QR
        </button>
      </div>
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
  const isZaloRuntime = isZaloMiniAppRuntime();
  const requestedPath = window.location.pathname;
  const path =
    isZaloRuntime && managementRoutes.some((route) => requestedPath.startsWith(route))
      ? "/"
      : requestedPath;
  const isCustomerRoute = ![
    "/staff",
    "/owner",
    "/admin",
    "/privacy",
    "/terms",
    "/delete-account",
  ].some((route) => path.startsWith(route));
  const currentQr = useMemo(() => parseQrContext(), []);
  const [savedSessionCandidate, setSavedSessionCandidate] =
    useState<SavedSessionCandidate | null>(() =>
      isCustomerRoute ? loadSavedSessionCandidate(currentQr) : null,
    );
  const [session, setSession] = useState<AppSession | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [sessionRestore, setSessionRestore] = useState<{
    status: "idle" | "verifying" | "error";
    message: string;
  }>(() => ({ status: savedSessionCandidate ? "verifying" : "idle", message: "" }));
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [legalPage, setLegalPage] = useState<LegalPageKey | null>(() =>
    isZaloRuntime ? legalPageFromHash(window.location.hash) : null,
  );
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [sessionSync, setSessionSync] = useState<{
    status: "idle" | "syncing" | "synced" | "error";
    message: string;
    syncedAtMs: number | null;
  }>({ status: "idle", message: "", syncedAtMs: null });

  useEffect(() => {
    if (!isZaloRuntime) {
      return undefined;
    }

    function syncLegalPage() {
      setLegalPage(legalPageFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", syncLegalPage);
    window.addEventListener("popstate", syncLegalPage);
    return () => {
      window.removeEventListener("hashchange", syncLegalPage);
      window.removeEventListener("popstate", syncLegalPage);
    };
  }, [isZaloRuntime]);

  useEffect(() => {
    trackEvent("page_view", {
      page_path: legalPage ? `#${legalPage}` : path,
      has_customer_session: Boolean(session),
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
  }, [currentQr.salonId, legalPage, path, session?.sessionId]);

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
      void saveSession(session);
    }
  }, [isCustomerRoute, session]);

  useEffect(() => {
    if (!isCustomerRoute || !savedSessionCandidate) {
      setSessionRestore({ status: "idle", message: "" });
      return undefined;
    }

    let isActive = true;
    setSessionRestore({ status: "verifying", message: "" });

    void import("./services/api")
      .then(({ restoreSavedCustomerSession }) =>
        restoreSavedCustomerSession(savedSessionCandidate),
      )
      .then((result) => {
        if (!isActive) {
          return;
        }
        if (result.status === "discarded") {
          clearSavedSession();
          setSavedSessionCandidate(null);
          setSession(null);
          return;
        }

        setSession(result.session);
        setSavedSessionCandidate(null);
        setSessionRestore({ status: "idle", message: "" });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }
        setSessionRestore({
          status: "error",
          message: error instanceof Error ? error.message : "Không thể xác minh phiên khách.",
        });
      });

    return () => {
      isActive = false;
    };
  }, [isCustomerRoute, restoreAttempt, savedSessionCandidate]);

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

  function resetSession() {
    trackEvent("customer_session_reset", {
      salon_id: session?.qr.salonId || currentQr.salonId,
    });
    setSession(null);
    setSavedSessionCandidate(null);
    clearSavedSession();
    setActiveTab("home");
    setSessionSync({ status: "idle", message: "", syncedAtMs: null });
  }

  function retrySavedSession() {
    if (!navigator.onLine) {
      setSessionRestore({ status: "error", message: "Thiết bị đang mất kết nối mạng." });
      return;
    }
    setRestoreAttempt((current) => current + 1);
  }

  function discardSavedSession() {
    clearSavedSession();
    setSavedSessionCandidate(null);
    setSession(null);
    setSessionRestore({ status: "idle", message: "" });
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

  function openLegalPage(nextPage: LegalPageKey) {
    if (!isZaloRuntime) {
      window.location.assign(`/${nextPage}`);
      return;
    }

    const nextHash = `#${nextPage}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(
        { ...window.history.state, haircutLegalPage: nextPage },
        "",
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
    setLegalPage(nextPage);
  }

  function closeLegalPage() {
    if (window.history.state?.haircutLegalPage) {
      window.history.back();
      return;
    }

    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    setLegalPage(null);
  }

  if (isZaloRuntime && legalPage) {
    const legalContent =
      legalPage === "privacy" ? (
        <PrivacyPage onBack={closeLegalPage} onNavigate={openLegalPage} />
      ) : (
        <TermsPage onBack={closeLegalPage} onNavigate={openLegalPage} />
      );

    return (
      <div className="app-shell">
        <main className="app-main">
          <Suspense fallback={<PageLoading />}>{legalContent}</Suspense>
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

  let content = <ScanEntryPage onReady={setSession} onOpenLegalPage={openLegalPage} />;

  if (!session && sessionRestore.status !== "idle") {
    content = (
      <SessionRestorePanel
        status={sessionRestore.status}
        message={sessionRestore.message}
        onRetry={retrySavedSession}
        onReset={discardSavedSession}
      />
    );
  }

  if (session && activeTab === "history") {
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
      <main className="app-main">
        <Suspense fallback={<PageLoading />}>{content}</Suspense>
      </main>
      <InstallAppPrompt />
      {session ? (
        <nav className="bottom-nav" aria-label="Điều hướng">
          {tabs.map(({ key, label, Icon }) => (
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
