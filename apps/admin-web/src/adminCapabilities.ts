export type AdminTab = "overview" | "salons" | "features" | "audit" | "support";

export const ADMIN_WRITE_ACTIONS_ENABLED = false;

export const READ_ONLY_ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "salons", label: "Salon" },
  { id: "features", label: "Cấu hình" },
  { id: "audit", label: "Nhật ký" },
];

export const ADMIN_TABS = [...READ_ONLY_ADMIN_TABS, { id: "support" as const, label: "Sự cố" }];
export const ADMIN_SUPPORT_REPAIR_ACTIONS = [
  "reconcile_customer_count",
  "clear_stale_session_pointer",
] as const;
