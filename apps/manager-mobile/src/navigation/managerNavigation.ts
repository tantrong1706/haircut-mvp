export type OwnerPrimaryTab = "today" | "customers" | "approvals" | "management" | "settings";
export type StaffPrimaryTab = "queue" | "active" | "rewards" | "history" | "account";
export type ManagerPrimaryTab = OwnerPrimaryTab | StaffPrimaryTab;
export type OwnerManagementSection = "branches" | "staff" | "wheel" | "redeem" | "audit";

export const OWNER_PRIMARY_TABS = [
  { id: "today", label: "Hôm nay" },
  { id: "customers", label: "Khách" },
  { id: "approvals", label: "Duyệt" },
  { id: "management", label: "Quản lý" },
  { id: "settings", label: "Cài đặt" },
] as const satisfies ReadonlyArray<{ id: OwnerPrimaryTab; label: string }>;

export const STAFF_PRIMARY_TABS = [
  { id: "queue", label: "Hàng chờ" },
  { id: "active", label: "Đang làm" },
  { id: "rewards", label: "Điểm và quà" },
  { id: "history", label: "Lịch sử" },
  { id: "account", label: "Tài khoản" },
] as const satisfies ReadonlyArray<{ id: StaffPrimaryTab; label: string }>;

export const OWNER_MANAGEMENT_SECTIONS = [
  { id: "branches", label: "Chi nhánh và QR" },
  { id: "staff", label: "Nhân viên" },
  { id: "wheel", label: "Vòng quay" },
  { id: "redeem", label: "Đổi quà" },
  { id: "audit", label: "Nhật ký hoạt động" },
] as const satisfies ReadonlyArray<{ id: OwnerManagementSection; label: string }>;

type OwnerFeatureRoute = { tab: OwnerPrimaryTab; taps: 1 | 2 | 3 };
type StaffFeatureRoute = { tab: StaffPrimaryTab; taps: 1 | 2 | 3 };

export type ManagerFeaturePlacement = {
  id: string;
  owner?: OwnerFeatureRoute;
  staff?: StaffFeatureRoute;
  visibility?: "always" | "role" | "feature-flag" | "background";
};

export const MANAGER_FEATURE_PLACEMENTS: readonly ManagerFeaturePlacement[] = [
  { id: "owner.overview", owner: { tab: "today", taps: 1 } },
  { id: "owner.branch_filter", owner: { tab: "today", taps: 1 } },
  { id: "owner.queue", owner: { tab: "customers", taps: 1 } },
  { id: "owner.active_sessions", owner: { tab: "customers", taps: 1 } },
  { id: "owner.pending_sessions", owner: { tab: "customers", taps: 1 } },
  { id: "owner.completed_sessions", owner: { tab: "customers", taps: 2 } },
  { id: "owner.cancelled_sessions", owner: { tab: "customers", taps: 2 } },
  { id: "owner.no_show", owner: { tab: "customers", taps: 2 } },
  { id: "owner.customer_search", owner: { tab: "customers", taps: 1 } },
  { id: "owner.customer_profile", owner: { tab: "customers", taps: 2 } },
  { id: "owner.customer_points", owner: { tab: "customers", taps: 2 } },
  { id: "owner.point_history", owner: { tab: "customers", taps: 3 } },
  { id: "owner.haircut_history", owner: { tab: "customers", taps: 2 } },
  { id: "owner.haircut_notes", owner: { tab: "customers", taps: 3 } },
  { id: "owner.haircut_photos", owner: { tab: "customers", taps: 3 } },
  { id: "owner.customer_rewards", owner: { tab: "customers", taps: 2 } },
  { id: "owner.reward_history", owner: { tab: "customers", taps: 3 } },
  { id: "owner.customer_branch_history", owner: { tab: "customers", taps: 3 } },
  { id: "owner.customer_staff_history", owner: { tab: "customers", taps: 3 } },
  { id: "owner.customer_delete", owner: { tab: "customers", taps: 3 } },
  { id: "owner.point_requests", owner: { tab: "approvals", taps: 1 } },
  { id: "owner.approval_photos", owner: { tab: "approvals", taps: 2 } },
  { id: "owner.approve_points", owner: { tab: "approvals", taps: 2 } },
  { id: "owner.reject_points", owner: { tab: "approvals", taps: 2 } },
  { id: "owner.approval_history", owner: { tab: "approvals", taps: 2 } },
  { id: "owner.branches", owner: { tab: "management", taps: 2 } },
  { id: "owner.staff", owner: { tab: "management", taps: 2 } },
  { id: "owner.salon_qr", owner: { tab: "management", taps: 2 } },
  { id: "owner.branch_qr", owner: { tab: "management", taps: 3 } },
  { id: "owner.qr_actions", owner: { tab: "management", taps: 3 } },
  { id: "owner.legacy_migration", owner: { tab: "management", taps: 2 } },
  { id: "owner.point_config", owner: { tab: "settings", taps: 2 } },
  { id: "owner.wheel_config", owner: { tab: "management", taps: 2 } },
  { id: "owner.rewards", owner: { tab: "management", taps: 2 } },
  { id: "owner.reward_redeem", owner: { tab: "management", taps: 2 } },
  { id: "owner.reports", owner: { tab: "today", taps: 1 } },
  {
    id: "owner.audit_permission",
    owner: { tab: "management", taps: 2 },
    visibility: "role",
  },
  { id: "owner.salon_profile", owner: { tab: "settings", taps: 2 } },
  { id: "owner.salon_branding", owner: { tab: "settings", taps: 2 } },
  { id: "owner.personal_avatar", owner: { tab: "settings", taps: 2 } },
  { id: "owner.account", owner: { tab: "settings", taps: 1 } },
  { id: "owner.password_reset", owner: { tab: "settings", taps: 2 } },
  { id: "owner.notifications", owner: { tab: "settings", taps: 2 } },
  { id: "owner.biometric", owner: { tab: "settings", taps: 2 } },
  { id: "owner.support", owner: { tab: "settings", taps: 2 } },
  { id: "owner.privacy", owner: { tab: "settings", taps: 2 } },
  { id: "owner.terms", owner: { tab: "settings", taps: 2 } },
  { id: "owner.salon_deletion", owner: { tab: "settings", taps: 2 } },
  { id: "owner.sign_out", owner: { tab: "settings", taps: 2 } },
  { id: "staff.branch_context", staff: { tab: "queue", taps: 1 } },
  { id: "staff.queue", staff: { tab: "queue", taps: 1 } },
  { id: "staff.claim", staff: { tab: "queue", taps: 2 } },
  { id: "staff.active_session", staff: { tab: "active", taps: 1 } },
  { id: "staff.notes", staff: { tab: "active", taps: 2 } },
  { id: "staff.photos", staff: { tab: "active", taps: 2 } },
  { id: "staff.complete_session", staff: { tab: "active", taps: 2 } },
  { id: "staff.no_show", staff: { tab: "queue", taps: 2 } },
  { id: "staff.cancel_session", staff: { tab: "active", taps: 2 } },
  { id: "staff.submit_points", staff: { tab: "active", taps: 2 } },
  { id: "staff.point_status", staff: { tab: "history", taps: 1 } },
  { id: "staff.reward_redeem", staff: { tab: "rewards", taps: 1 }, visibility: "role" },
  { id: "staff.reward_history", staff: { tab: "history", taps: 1 } },
  { id: "staff.history", staff: { tab: "history", taps: 1 } },
  { id: "staff.account", staff: { tab: "account", taps: 1 } },
  { id: "staff.password_reset", staff: { tab: "account", taps: 2 } },
  { id: "staff.notifications", staff: { tab: "account", taps: 2 } },
  { id: "staff.biometric", staff: { tab: "account", taps: 2 } },
  { id: "staff.support", staff: { tab: "account", taps: 2 } },
  { id: "staff.privacy", staff: { tab: "account", taps: 2 } },
  { id: "staff.terms", staff: { tab: "account", taps: 2 } },
  { id: "staff.personal_deletion", staff: { tab: "account", taps: 2 } },
  { id: "staff.sign_out", staff: { tab: "account", taps: 1 } },
  {
    id: "shared.authentication",
    owner: { tab: "settings", taps: 1 },
    staff: { tab: "account", taps: 1 },
    visibility: "background",
  },
  {
    id: "shared.offline",
    owner: { tab: "today", taps: 1 },
    staff: { tab: "queue", taps: 1 },
    visibility: "background",
  },
  {
    id: "shared.app_check",
    owner: { tab: "settings", taps: 1 },
    staff: { tab: "account", taps: 1 },
    visibility: "background",
  },
  {
    id: "shared.deep_link",
    owner: { tab: "today", taps: 1 },
    staff: { tab: "queue", taps: 1 },
    visibility: "background",
  },
  {
    id: "shared.feature_flags",
    owner: { tab: "today", taps: 1 },
    staff: { tab: "queue", taps: 1 },
    visibility: "feature-flag",
  },
  {
    id: "shared.role_denied",
    owner: { tab: "settings", taps: 1 },
    staff: { tab: "account", taps: 1 },
    visibility: "role",
  },
  {
    id: "shared.retry",
    owner: { tab: "today", taps: 1 },
    staff: { tab: "queue", taps: 1 },
  },
  {
    id: "shared.reward_scanner",
    owner: { tab: "management", taps: 2 },
    staff: { tab: "rewards", taps: 1 },
    visibility: "role",
  },
  {
    id: "shared.push_notifications",
    owner: { tab: "settings", taps: 2 },
    staff: { tab: "account", taps: 2 },
    visibility: "background",
  },
] as const satisfies readonly ManagerFeaturePlacement[];

export function ownerTabFromRoute(route: string): OwnerPrimaryTab | null {
  const normalized = route.toLowerCase();
  if (normalized.includes("customer")) return "customers";
  if (normalized.includes("approval") || normalized.includes("point")) return "approvals";
  if (
    normalized.includes("reward") ||
    normalized.includes("branch") ||
    normalized.includes("staff") ||
    normalized.includes("wheel") ||
    normalized.includes("audit") ||
    normalized.includes("qr")
  ) {
    return "management";
  }
  if (normalized.includes("setting") || normalized.includes("account")) return "settings";
  if (
    normalized.includes("today") ||
    normalized.includes("overview") ||
    normalized.includes("report")
  )
    return "today";
  return null;
}

export function staffTabFromRoute(route: string): StaffPrimaryTab | null {
  const normalized = route.toLowerCase();
  if (normalized.includes("reward")) return "rewards";
  if (normalized.includes("history") || normalized.includes("approval")) return "history";
  if (normalized.includes("account") || normalized.includes("setting")) return "account";
  if (normalized.includes("active") || normalized.includes("serving")) return "active";
  if (normalized.includes("queue") || normalized.includes("waiting")) return "queue";
  return null;
}

export function staffTabAfterSessionStatus(
  status: "waiting" | "serving" | "pending_approval" | "completed" | "cancelled",
): StaffPrimaryTab {
  if (status === "serving") return "active";
  if (status === "pending_approval" || status === "completed" || status === "cancelled")
    return "queue";
  return "queue";
}
