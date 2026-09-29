// Development-only design fixture. This is not an entry of the production build.
import ReactDOM from "react-dom/client";
import { CalendarClock, Gift, Scissors, UserRound } from "lucide-react";
import { HomePage } from "../../src/pages/HomePage";
import { HistoryPage } from "../../src/pages/HistoryPage";
import { RewardsPage } from "../../src/pages/RewardsPage";
import { WheelPage } from "../../src/pages/WheelPage";
import { StaffPage } from "../../src/pages/StaffPage";
import { OwnerPage } from "../../src/pages/OwnerPage";
import { isFirebaseConfigured } from "../../src/services/firebase";
import type { AppSession } from "../../src/services/types";
import type { AppUser } from "../../src/services/auth";
import "../../src/styles/global.css";
import "../../src/styles/home.css";
import "../../src/styles/staff.css";
import "../../src/styles/owner.css";
import "../../src/styles/rewards.css";
import "../../src/styles/barber-web.css";

if (import.meta.env.MODE !== "test" || isFirebaseConfigured()) {
  throw new Error("Design fixtures require test mode without Firebase credentials.");
}
const session: AppSession = {
  qr: {
    salonId: "demo-salon",
    branchId: "demo-branch-main",
    qrType: "branch",
    qrToken: "fixture-only",
  },
  sessionId: "design-fixture",
  zaloUserId: "fixture-only",
  salonName: "CH Haircut Salon",
  branchName: "Chi nhánh trung tâm",
  sessionStatus: "completed",
  customer: {
    customerId: "mock-customer",
    name: "Anh Minh",
    phoneLast4: "1234",
    points: 4,
    allowPhoto: true,
  },
};
const user: AppUser = {
  uid: "fixture-user",
  salonId: "demo-salon",
  name: "Minh",
  avatarUrl: "",
  role: "owner",
  isActive: true,
  branchIds: ["demo-branch-main"],
};
const page = new URLSearchParams(location.search).get("page") || "home";
const isOps = page === "staff" || page === "owner";
const screen =
  page === "staff" ? (
    <StaffPage currentUser={{ ...user, role: "staff" }} />
  ) : page === "owner" ? (
    <OwnerPage currentUser={user} />
  ) : page === "history" ? (
    <HistoryPage session={session} />
  ) : page === "rewards" ? (
    <RewardsPage session={session} />
  ) : page === "wheel" ? (
    <WheelPage session={session} onSessionChange={() => undefined} />
  ) : (
    <HomePage
      session={{
        ...session,
        identityProvider: "firebase",
        customer: { ...session.customer, nextPointEligibleAtMs: Date.now() + 3_600_000 },
      }}
      onTabChange={(tab) => {
        location.search = "?page=" + tab;
      }}
      onResetSession={() => undefined}
    />
  );

ReactDOM.createRoot(document.getElementById("root")!).render(
  <div className="app-shell">
    <main className={isOps ? "app-main wide-main" : "app-main"}>{screen}</main>
    {!isOps ? (
      <nav className="bottom-nav web-customer-nav" aria-label="Điều hướng">
        {[
          { key: "home", label: "Điểm", Icon: Scissors },
          { key: "history", label: "Lịch sử", Icon: CalendarClock },
          { key: "rewards", label: "Quà và quay", Icon: Gift },
          { key: "account", label: "Tài khoản", Icon: UserRound },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className={page === key || (key === "rewards" && page === "wheel") ? "active" : ""}
            onClick={() => {
              location.search = "?page=" + key;
            }}
          >
            <Icon size={20} strokeWidth={2.3} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    ) : null}
  </div>,
);
