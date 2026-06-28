import { useMemo, useState } from "react";
import { AuthGate } from "./pages/AuthGate";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { OwnerPage } from "./pages/OwnerPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RewardsPage } from "./pages/RewardsPage";
import { ScanEntryPage } from "./pages/ScanEntryPage";
import { StaffPage } from "./pages/StaffPage";
import { WheelPage } from "./pages/WheelPage";
import { AppSession, TabKey } from "./services/types";

const tabs: TabKey[] = ["home", "history", "wheel", "rewards"];

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const path = window.location.pathname;

  if (path.startsWith("/staff")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <AuthGate allowedRoles={["owner", "staff"]}>
            {(user) => <StaffPage currentUser={user} />}
          </AuthGate>
        </main>
      </div>
    );
  }

  if (path.startsWith("/owner") || path.startsWith("/admin")) {
    return (
      <div className="app-shell ops-shell">
        <main className="app-main wide-main">
          <AuthGate allowedRoles={["owner"]}>
            {(user) => <OwnerPage currentUser={user} />}
          </AuthGate>
        </main>
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
    return <HomePage session={session} onTabChange={setActiveTab} />;
  }, [activeTab, session]);

  return (
    <div className="app-shell">
      <main className="app-main">{content}</main>
      {session ? (
        <nav className="bottom-nav" aria-label="Dieu huong">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function tabLabel(tab: TabKey) {
  switch (tab) {
    case "home":
      return "Điểm";
    case "history":
      return "Lịch sử";
    case "wheel":
      return "Vòng quay";
    case "rewards":
      return "Quà";
  }
}
