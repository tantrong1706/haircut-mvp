import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Gift,
  Home,
  LayoutGrid,
  ListChecks,
  Scissors,
  Search,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";
import type {
  OwnerPrimaryTab,
  StaffPrimaryTab,
} from "../navigation/managerNavigation";
import {
  OWNER_PRIMARY_TABS,
  STAFF_PRIMARY_TABS,
} from "../navigation/managerNavigation";
import type { AppUser } from "../services/managerApi";

const OWNER_ICONS: Record<OwnerPrimaryTab, LucideIcon> = {
  today: Home,
  customers: Search,
  approvals: ClipboardCheck,
  management: LayoutGrid,
  settings: Settings,
};

const STAFF_ICONS: Record<StaffPrimaryTab, LucideIcon> = {
  queue: UsersRound,
  active: Scissors,
  rewards: Gift,
  history: CalendarClock,
  account: UserRound,
};

export function ManagerLayout({
  user,
  salonName,
  branchName,
  activeOwnerTab,
  activeStaffTab,
  onOwnerTabChange,
  onStaffTabChange,
  badgeCounts,
  children,
}: {
  user: AppUser;
  salonName: string;
  branchName?: string;
  activeOwnerTab?: OwnerPrimaryTab;
  activeStaffTab?: StaffPrimaryTab;
  onOwnerTabChange?: (tab: OwnerPrimaryTab) => void;
  onStaffTabChange?: (tab: StaffPrimaryTab) => void;
  badgeCounts?: Partial<Record<OwnerPrimaryTab | StaffPrimaryTab, number>>;
  children: ReactNode;
}) {
  const isOwner = user.role === "owner";
  const tabs = isOwner ? OWNER_PRIMARY_TABS : STAFF_PRIMARY_TABS;

  return (
    <div className="manager-app-shell">
      <header className="manager-app-header">
        <BrandMark compact />
        <div className="manager-header-context">
          <strong>{salonName || "Salon của bạn"}</strong>
          <span>
            {user.name || (isOwner ? "Chủ salon" : "Nhân viên")}
            {branchName ? ` · ${branchName}` : ""}
          </span>
        </div>
        <span className="manager-role-badge">
          {isOwner ? <BadgeCheck aria-hidden="true" /> : <ListChecks aria-hidden="true" />}
          {isOwner ? "Chủ" : "Nhân viên"}
        </span>
      </header>

      <main className="manager-main">{children}</main>

      <nav className="manager-bottom-nav" aria-label="Điều hướng chính">
        {tabs.map((tab) => {
          const id = tab.id as OwnerPrimaryTab | StaffPrimaryTab;
          const Icon = isOwner
            ? OWNER_ICONS[id as OwnerPrimaryTab]
            : STAFF_ICONS[id as StaffPrimaryTab];
          const active = isOwner ? id === activeOwnerTab : id === activeStaffTab;
          const count = badgeCounts?.[id] || 0;
          return (
            <button
              key={id}
              type="button"
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (isOwner) onOwnerTabChange?.(id as OwnerPrimaryTab);
                else onStaffTabChange?.(id as StaffPrimaryTab);
              }}
            >
              <span className="manager-nav-icon">
                <Icon aria-hidden="true" />
                {count > 0 ? <small>{Math.min(count, 99)}</small> : null}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
